import express, { Response } from 'express';
import prisma from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { SmtpService } from '../services/smtp.service';
import { ImapService } from '../services/imap.service';
import { decrypt } from '../utils/encryption';
import {
  decrementFolderUnreadCount,
  handleEmailReadStatusChange,
  recalculateFolderCounts,
} from '../utils/folder-counter';

const router = express.Router();

router.use(authenticateToken);

// Get folders for an email account
router.get('/accounts/:accountId/folders', async (req: AuthRequest, res: Response) => {
  try {
    const { accountId } = req.params;

    const account = await prisma.emailAccount.findFirst({
      where: {
        id: accountId,
        userId: req.userId,
      },
    });

    if (!account) {
      return res.status(404).json({ error: 'Email account not found' });
    }

    // Just return cached folders without syncing
    const folders = await prisma.folder.findMany({
      where: { emailAccountId: accountId },
      orderBy: { name: 'asc' },
    });

    res.json(folders);
  } catch (error) {
    console.error('Get folders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get emails from a folder
router.get('/folders/:folderId/emails', async (req: AuthRequest, res: Response) => {
  try {
    const { folderId } = req.params;
    const { page = '1', limit = '50', search } = req.query;

    const folder = await prisma.folder.findFirst({
      where: {
        id: folderId,
        emailAccount: {
          userId: req.userId,
        },
      },
      include: {
        emailAccount: true,
      },
    });

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    // Just return cached emails without syncing
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = { folderId };

    if (search) {
      where.OR = [
        { subject: { contains: search as string, mode: 'insensitive' } },
        { textBody: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [emails, total] = await Promise.all([
      prisma.email.findMany({
        where,
        select: {
          id: true,
          messageId: true,
          subject: true,
          from: true,
          to: true,
          date: true,
          isRead: true,
          isFlagged: true,
          hasAttachments: true,
          size: true,
        },
        orderBy: { date: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.email.count({ where }),
    ]);

    res.json({
      emails,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Get emails error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single email
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const email = await prisma.email.findFirst({
      where: {
        id,
        emailAccount: {
          userId: req.userId,
        },
      },
      include: {
        folder: {
          select: {
            id: true,
            name: true,
            path: true,
          },
        },
        emailAccount: true,
      },
    });

    if (!email) {
      return res.status(404).json({ error: 'Email not found' });
    }

    // Mark as read if not already
    if (!email.isRead) {
      await prisma.email.update({
        where: { id },
        data: { isRead: true },
      });

      // Update folder unread count
      await decrementFolderUnreadCount(email.folderId, 1);

      // Mark as read on IMAP server
      try {
        const imapService = new ImapService({
          host: email.emailAccount.imapHost,
          port: email.emailAccount.imapPort,
          secure: email.emailAccount.imapSecure,
          username: email.emailAccount.username,
          password: decrypt(email.emailAccount.password),
        });

        await imapService.connect();
        await imapService.markAsReadOnServer(email.folder.path, email.uid, true);
        await imapService.disconnect();
      } catch (imapError) {
        console.error('Failed to mark as read on IMAP server:', imapError);
        // Don't fail the request if IMAP update fails
      }
    }

    res.json(email);
  } catch (error) {
    console.error('Get email error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark email as read/unread
router.patch('/:id/read', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { isRead } = req.body;

    const email = await prisma.email.findFirst({
      where: {
        id,
        emailAccount: {
          userId: req.userId,
        },
      },
      include: {
        folder: {
          select: {
            id: true,
            name: true,
            path: true,
          },
        },
        emailAccount: true,
      },
    });

    if (!email) {
      return res.status(404).json({ error: 'Email not found' });
    }

    if (email.isRead !== isRead) {
      await prisma.email.update({
        where: { id },
        data: { isRead },
      });

      // Update folder unread count safely
      await handleEmailReadStatusChange(email.folderId, email.isRead, isRead);

      // Update IMAP server
      try {
        const imapService = new ImapService({
          host: email.emailAccount.imapHost,
          port: email.emailAccount.imapPort,
          secure: email.emailAccount.imapSecure,
          username: email.emailAccount.username,
          password: decrypt(email.emailAccount.password),
        });

        await imapService.connect();
        await imapService.markAsReadOnServer(email.folder.path, email.uid, isRead);
        await imapService.disconnect();
      } catch (imapError) {
        console.error('Failed to update read status on IMAP server:', imapError);
        // Don't fail the request if IMAP update fails
      }
    }

    res.json({ message: 'Email updated' });
  } catch (error) {
    console.error('Mark email read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark email as flagged/unflagged
router.patch('/:id/flag', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { isFlagged } = req.body;

    const email = await prisma.email.findFirst({
      where: {
        id,
        emailAccount: {
          userId: req.userId,
        },
      },
    });

    if (!email) {
      return res.status(404).json({ error: 'Email not found' });
    }

    await prisma.email.update({
      where: { id },
      data: { isFlagged },
    });

    res.json({ message: 'Email updated' });
  } catch (error) {
    console.error('Mark email flagged error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Download attachment
router.get('/:id/attachments/:index', async (req: AuthRequest, res: Response) => {
  try {
    const { id, index } = req.params;

    const email = await prisma.email.findFirst({
      where: {
        id,
        emailAccount: {
          userId: req.userId,
        },
      },
    });

    if (!email) {
      return res.status(404).json({ error: 'Email not found' });
    }

    const attachments = email.attachments as any[];
    const attachmentIndex = parseInt(index);

    if (!attachments || attachmentIndex >= attachments.length) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const attachment = attachments[attachmentIndex];

    if (!attachment.content) {
      return res.status(404).json({ error: 'Attachment content not found' });
    }

    // Decode base64 content
    const buffer = Buffer.from(attachment.content, 'base64');

    // Set appropriate headers
    res.setHeader('Content-Type', attachment.contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename}"`);
    res.setHeader('Content-Length', buffer.length);

    res.send(buffer);
  } catch (error) {
    console.error('Download attachment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Save draft
router.post('/drafts', async (req: AuthRequest, res: Response) => {
  try {
    const {
      accountId,
      to,
      cc,
      bcc,
      subject,
      body,
      draftId, // If provided, update existing draft
    } = req.body;

    if (!accountId) {
      return res.status(400).json({ error: 'Missing accountId' });
    }

    const account = await prisma.emailAccount.findFirst({
      where: {
        id: accountId,
        userId: req.userId,
      },
    });

    if (!account) {
      return res.status(404).json({ error: 'Email account not found' });
    }

    // Find or create Drafts folder
    let draftsFolder = await prisma.folder.findFirst({
      where: {
        emailAccountId: accountId,
        OR: [
          { specialUse: '\\Drafts' },
          { specialUse: 'DRAFTS' },
          { path: { contains: 'Draft', mode: 'insensitive' } },
          { name: { contains: 'Draft', mode: 'insensitive' } },
        ],
      },
    });

    if (!draftsFolder) {
      return res.status(404).json({ error: 'Drafts folder not found' });
    }

    // Generate a unique message ID for the draft
    const messageId = draftId || `<draft-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@${account.emailAddress.split('@')[1]}>`;
    const now = new Date();

    // Check if draft already exists
    const existingDraft = draftId ? await prisma.email.findUnique({
      where: { id: draftId },
    }) : null;

    if (existingDraft) {
      // Update existing draft
      const updatedDraft = await prisma.email.update({
        where: { id: draftId },
        data: {
          subject: subject || '(No Subject)',
          to: to || [],
          cc: cc || [],
          bcc: bcc || [],
          textBody: body,
          updatedAt: now,
        },
      });

      return res.json({ draft: updatedDraft });
    } else {
      // Create new draft
      const draft = await prisma.email.create({
        data: {
          emailAccountId: accountId,
          folderId: draftsFolder.id,
          messageId,
          uid: 0, // Temporary UID for drafts not synced to IMAP
          subject: subject || '(No Subject)',
          from: [{ address: account.emailAddress, name: account.displayName || '' }],
          to: to || [],
          cc: cc || [],
          bcc: bcc || [],
          date: now,
          receivedDate: now,
          textBody: body,
          flags: ['\\Draft'],
          isRead: true, // Drafts are considered "read"
        },
      });

      // Update folder count
      await prisma.folder.update({
        where: { id: draftsFolder.id },
        data: { totalCount: { increment: 1 } },
      });

      return res.json({ draft });
    }
  } catch (error) {
    console.error('Save draft error:', error);
    res.status(500).json({ error: 'Failed to save draft' });
  }
});

// Delete draft
router.delete('/drafts/:draftId', async (req: AuthRequest, res: Response) => {
  try {
    const { draftId } = req.params;

    const draft = await prisma.email.findFirst({
      where: {
        id: draftId,
        emailAccount: {
          userId: req.userId,
        },
        flags: {
          has: '\\Draft',
        },
      },
      include: {
        folder: true,
      },
    });

    if (!draft) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    await prisma.email.delete({
      where: { id: draftId },
    });

    // Update folder count
    await prisma.folder.update({
      where: { id: draft.folderId },
      data: { totalCount: { decrement: 1 } },
    });

    res.json({ message: 'Draft deleted successfully' });
  } catch (error) {
    console.error('Delete draft error:', error);
    res.status(500).json({ error: 'Failed to delete draft' });
  }
});

// Get templates for an account
router.get('/accounts/:accountId/templates', async (req: AuthRequest, res: Response) => {
  try {
    const { accountId } = req.params;

    const account = await prisma.emailAccount.findFirst({
      where: {
        id: accountId,
        userId: req.userId,
      },
    });

    if (!account) {
      return res.status(404).json({ error: 'Email account not found' });
    }

    // Find Templates folder
    const templatesFolder = await prisma.folder.findFirst({
      where: {
        emailAccountId: accountId,
        OR: [
          { name: { contains: 'Template', mode: 'insensitive' } },
          { path: { contains: 'Template', mode: 'insensitive' } },
        ],
      },
    });

    if (!templatesFolder) {
      return res.json({ templates: [] });
    }

    // Get all emails from Templates folder
    const templates = await prisma.email.findMany({
      where: {
        folderId: templatesFolder.id,
      },
      select: {
        id: true,
        subject: true,
        textBody: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ templates });
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ error: 'Failed to load templates' });
  }
});

// Save template
router.post('/accounts/:accountId/templates', async (req: AuthRequest, res: Response) => {
  try {
    const { accountId } = req.params;
    const { name, body } = req.body;

    if (!name || !body) {
      return res.status(400).json({ error: 'Name and body are required' });
    }

    const account = await prisma.emailAccount.findFirst({
      where: {
        id: accountId,
        userId: req.userId,
      },
    });

    if (!account) {
      return res.status(404).json({ error: 'Email account not found' });
    }

    // Find or create Templates folder
    let templatesFolder = await prisma.folder.findFirst({
      where: {
        emailAccountId: accountId,
        OR: [
          { name: { contains: 'Template', mode: 'insensitive' } },
          { path: { contains: 'Template', mode: 'insensitive' } },
        ],
      },
    });

    // If no Templates folder exists, create one
    if (!templatesFolder) {
      const imapService = new ImapService({
        host: account.imapHost,
        port: account.imapPort,
        secure: account.imapSecure,
        username: account.username,
        password: decrypt(account.password),
      });

      try {
        await imapService.connect();
        await imapService.createFolder('Templates');
        await imapService.disconnect();
      } catch (err) {
        console.error('Failed to create Templates folder on IMAP:', err);
      }

      // Create folder in database
      templatesFolder = await prisma.folder.create({
        data: {
          emailAccountId: accountId,
          name: 'Templates',
          path: 'Templates',
          delimiter: '/',
        },
      });
    }

    // Create template as an email in the Templates folder
    const messageId = `<template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@templates>`;
    const now = new Date();

    const template = await prisma.email.create({
      data: {
        emailAccountId: accountId,
        folderId: templatesFolder.id,
        messageId,
        uid: 0,
        subject: name,
        from: [{ address: account.emailAddress, name: account.displayName || '' }],
        to: [],
        date: now,
        receivedDate: now,
        textBody: body,
        isRead: true,
      },
    });

    // Update folder count
    await prisma.folder.update({
      where: { id: templatesFolder.id },
      data: { totalCount: { increment: 1 } },
    });

    res.json({ template });
  } catch (error) {
    console.error('Save template error:', error);
    res.status(500).json({ error: 'Failed to save template' });
  }
});

// Delete template
router.delete('/templates/:templateId', async (req: AuthRequest, res: Response) => {
  try {
    const { templateId } = req.params;

    const template = await prisma.email.findFirst({
      where: {
        id: templateId,
        emailAccount: {
          userId: req.userId,
        },
        folder: {
          OR: [
            { name: { contains: 'Template', mode: 'insensitive' } },
            { path: { contains: 'Template', mode: 'insensitive' } },
          ],
        },
      },
      include: {
        folder: true,
      },
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    await prisma.email.delete({
      where: { id: templateId },
    });

    // Update folder count
    await prisma.folder.update({
      where: { id: template.folderId },
      data: { totalCount: { decrement: 1 } },
    });

    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Delete template error:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// Send email
router.post('/send', async (req: AuthRequest, res: Response) => {
  try {
    const {
      accountId,
      to,
      cc,
      bcc,
      subject,
      text,
      html,
      replyTo,
      inReplyTo,
      references,
      attachments,
    } = req.body;

    if (!accountId || !to || !subject) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const account = await prisma.emailAccount.findFirst({
      where: {
        id: accountId,
        userId: req.userId,
      },
    });

    if (!account) {
      return res.status(404).json({ error: 'Email account not found' });
    }

    const smtpService = new SmtpService({
      host: account.smtpHost,
      port: account.smtpPort,
      secure: account.smtpSecure,
      username: account.username,
      password: decrypt(account.password),
    });

    const fromAddress = account.displayName
      ? `"${account.displayName}" <${account.emailAddress}>`
      : account.emailAddress;

    // Process attachments if provided
    const emailAttachments = attachments?.map((att: any) => ({
      filename: att.filename,
      content: Buffer.from(att.content, 'base64'),
      contentType: att.contentType,
    }));

    const info = await smtpService.sendEmail({
      from: fromAddress,
      to,
      cc,
      bcc,
      subject,
      text,
      html,
      replyTo,
      inReplyTo,
      references,
      attachments: emailAttachments,
    });

    // Append sent message to Sent folder on IMAP server
    try {
      const imapService = new ImapService({
        host: account.imapHost,
        port: account.imapPort,
        secure: account.imapSecure,
        username: account.username,
        password: decrypt(account.password),
      });

      await imapService.connect();

      // Try common Sent folder names
      const sentFolderNames = ['Sent', 'Sent Items', 'Sent Mail', '[Gmail]/Sent Mail'];
      let sentFolder: string | null = null;

      for (const folderName of sentFolderNames) {
        const exists = await imapService.ensureFolderExists(folderName);
        if (exists) {
          sentFolder = folderName;
          break;
        }
      }

      // If no Sent folder found, create "Sent"
      if (!sentFolder) {
        await imapService.createFolder('Sent');
        sentFolder = 'Sent';
      }

      // Build the email message in RFC 822 format
      const messageLines = [
        `From: ${fromAddress}`,
        `To: ${Array.isArray(to) ? to.join(', ') : to}`,
      ];

      if (cc) {
        messageLines.push(`Cc: ${Array.isArray(cc) ? cc.join(', ') : cc}`);
      }

      messageLines.push(
        `Subject: ${subject}`,
        `Date: ${new Date().toUTCString()}`,
        `Message-ID: ${info.messageId || `<${Date.now()}@${account.smtpHost}>`}`,
      );

      if (inReplyTo) {
        messageLines.push(`In-Reply-To: ${inReplyTo}`);
      }

      if (references && references.length > 0) {
        messageLines.push(`References: ${references.join(' ')}`);
      }

      messageLines.push(
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=utf-8',
        '',
        text || ''
      );

      const message = messageLines.join('\r\n');

      // Append to Sent folder with Seen flag
      await imapService.appendToFolder(sentFolder, message, ['\\Seen']);
      
      await imapService.disconnect();

      // Sync the Sent folder to update database
      const sentFolderRecord = await prisma.folder.findFirst({
        where: {
          emailAccountId: account.id,
          OR: sentFolderNames.map(name => ({ path: name })),
        },
      });

      if (sentFolderRecord) {
        await imapService.connect();
        await imapService.syncEmails(account.id, sentFolderRecord.path);
        await imapService.disconnect();
      }
    } catch (imapError) {
      console.error('Failed to append to Sent folder:', imapError);
      // Don't fail the request if IMAP append fails - email was still sent
    }

    res.json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('Send email error:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// Delete email
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const email = await prisma.email.findFirst({
      where: {
        id,
        emailAccount: {
          userId: req.userId,
        },
      },
    });

    if (!email) {
      return res.status(404).json({ error: 'Email not found' });
    }

    await prisma.email.delete({
      where: { id },
    });

    // Recalculate folder counts to ensure accuracy after deletion
    await recalculateFolderCounts(email.folderId);

    res.json({ message: 'Email deleted successfully' });
  } catch (error) {
    console.error('Delete email error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Sync account in the background
router.post('/accounts/:accountId/sync', async (req: AuthRequest, res: Response) => {
  try {
    const { accountId } = req.params;

    const account = await prisma.emailAccount.findFirst({
      where: {
        id: accountId,
        userId: req.userId,
      },
    });

    if (!account) {
      return res.status(404).json({ error: 'Email account not found' });
    }

    // Respond immediately
    res.json({ message: 'Sync started' });

    // Perform sync in the background using sync manager
    const { syncManager } = await import('../services/sync-manager.js');
    
    syncManager.syncAccount(accountId).catch(error => {
      console.error(`Background sync error for account ${accountId}:`, error);
    });
  } catch (error) {
    console.error('Sync account error:', error);
    // Response already sent, just log error
  }
});

// Create new folder
router.post('/accounts/:accountId/folders', async (req: AuthRequest, res: Response) => {
  try {
    const { accountId } = req.params;
    const { name } = req.body;

    const account = await prisma.emailAccount.findFirst({
      where: {
        id: accountId,
        userId: req.userId,
      },
    });

    if (!account) {
      return res.status(404).json({ error: 'Email account not found' });
    }

    const { ImapService } = await import('../services/imap.service.js');
    const { decrypt } = await import('../utils/encryption.js');

    const imapConfig = {
      host: account.imapHost,
      port: account.imapPort,
      secure: account.imapSecure,
      username: account.username,
      password: decrypt(account.password),
    };

    const imapService = new ImapService(imapConfig);
    await imapService.connect();
    await imapService.createFolder(name);
    await imapService.syncFolders(accountId);
    await imapService.disconnect();

    const folder = await prisma.folder.findFirst({
      where: {
        emailAccountId: accountId,
        path: name,
      },
    });

    res.json(folder);
  } catch (error) {
    console.error('Create folder error:', error);
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

// Rename folder
router.patch('/folders/:folderId/rename', async (req: AuthRequest, res: Response) => {
  try {
    const { folderId } = req.params;
    const { newName } = req.body;

    const folder = await prisma.folder.findFirst({
      where: {
        id: folderId,
        emailAccount: {
          userId: req.userId,
        },
      },
      include: {
        emailAccount: true,
      },
    });

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    const { ImapService } = await import('../services/imap.service.js');
    const { decrypt } = await import('../utils/encryption.js');

    const imapConfig = {
      host: folder.emailAccount.imapHost,
      port: folder.emailAccount.imapPort,
      secure: folder.emailAccount.imapSecure,
      username: folder.emailAccount.username,
      password: decrypt(folder.emailAccount.password),
    };

    const imapService = new ImapService(imapConfig);
    await imapService.connect();
    await imapService.renameFolder(folder.path, newName);
    await imapService.syncFolders(folder.emailAccountId);
    await imapService.disconnect();

    res.json({ message: 'Folder renamed successfully' });
  } catch (error) {
    console.error('Rename folder error:', error);
    res.status(500).json({ error: 'Failed to rename folder' });
  }
});

// Delete folder
router.delete('/folders/:folderId', async (req: AuthRequest, res: Response) => {
  try {
    const { folderId } = req.params;

    const folder = await prisma.folder.findFirst({
      where: {
        id: folderId,
        emailAccount: {
          userId: req.userId,
        },
      },
      include: {
        emailAccount: true,
      },
    });

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    const { ImapService } = await import('../services/imap.service.js');
    const { decrypt } = await import('../utils/encryption.js');

    const imapConfig = {
      host: folder.emailAccount.imapHost,
      port: folder.emailAccount.imapPort,
      secure: folder.emailAccount.imapSecure,
      username: folder.emailAccount.username,
      password: decrypt(folder.emailAccount.password),
    };

    const imapService = new ImapService(imapConfig);
    await imapService.connect();
    await imapService.deleteFolder(folder.path);
    await imapService.disconnect();

    await prisma.folder.delete({
      where: { id: folderId },
    });

    res.json({ message: 'Folder deleted successfully' });
  } catch (error) {
    console.error('Delete folder error:', error);
    res.status(500).json({ error: 'Failed to delete folder' });
  }
});

// Recalculate folder counts (useful for fixing drift issues)
router.post('/folders/:folderId/recalculate-counts', async (req: AuthRequest, res: Response) => {
  try {
    const { folderId } = req.params;

    // Verify folder belongs to user
    const folder = await prisma.folder.findFirst({
      where: {
        id: folderId,
        emailAccount: {
          userId: req.userId,
        },
      },
    });

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    const { unreadCount, totalCount } = await recalculateFolderCounts(folderId);

    res.json({
      message: 'Folder counts recalculated',
      unreadCount,
      totalCount,
    });
  } catch (error) {
    console.error('Recalculate counts error:', error);
    res.status(500).json({ error: 'Failed to recalculate counts' });
  }
});

export default router;
