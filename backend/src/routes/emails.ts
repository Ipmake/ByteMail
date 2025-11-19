import express from 'express';
import multer from 'multer';
import { socketManager } from '../services/socket-connection-manager';
import { authenticateToken } from '../middleware/auth';
import { SmtpService } from '../services/smtp.service';
import prisma from '../db';
import { decrypt } from '../utils/encryption';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Get folders for an email account
router.get('/accounts/:accountId/folders', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;
    const socketId = req.query.socketId as string;

    if (!socketId || !socketManager.isValidSession(socketId)) {
      return res.status(401).json({ error: 'Invalid or missing socket session' });
    }

    const service = await socketManager.getImapService(socketId, accountId);
    const folders = await service.getFolders();

    const foldersWithStatus = await Promise.all(
      folders.map(async (folder) => {
        try {
          const status = await service.getFolderStatus(folder.path);
          return { ...folder, ...status };
        } catch (error) {
          console.error(`Failed to get status for folder ${folder.path}:`, error);
          return folder;
        }
      })
    );

    res.json(foldersWithStatus);
  } catch (error: any) {
    console.error('Get folders error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get emails from a folder
router.get('/folders/:accountId/:folderPath/emails', authenticateToken, async (req, res) => {
  try {
    const { accountId, folderPath } = req.params;
    const socketId = req.query.socketId as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    if (!socketId || !socketManager.isValidSession(socketId)) {
      return res.status(401).json({ error: 'Invalid or missing socket session' });
    }

    const decodedFolderPath = decodeURIComponent(folderPath);
    const service = await socketManager.getImapService(socketId, accountId);
    const result = await service.getEmailsFromFolder(decodedFolderPath, page, limit);

    // Format the response to match the frontend expectations
    const totalPages = Math.ceil(result.total / limit);
    const response = {
      emails: result.emails,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages,
      },
      hasMore: result.hasMore,
    };

    res.json(response);
  } catch (error: any) {
    console.error('Get emails error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get a specific email by UID
router.get('/:accountId/:folderPath/:uid', authenticateToken, async (req, res) => {
  try {
    const { accountId, folderPath, uid } = req.params;
    const socketId = req.query.socketId as string;

    if (!socketId || !socketManager.isValidSession(socketId)) {
      return res.status(401).json({ error: 'Invalid or missing socket session' });
    }

    const decodedFolderPath = decodeURIComponent(folderPath);
    const service = await socketManager.getImapService(socketId, accountId);
    const email = await service.getEmailByUid(decodedFolderPath, parseInt(uid));

    try {
      await service.markAsRead(decodedFolderPath, parseInt(uid), true);
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }

    res.json({ email });
  } catch (error: any) {
    console.error('Get email error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark email as read/unread
router.put('/:accountId/:folderPath/:uid/read', authenticateToken, async (req, res) => {
  try {
    const { accountId, folderPath, uid } = req.params;
    const { socketId, isRead } = req.body;

    if (!socketId || !socketManager.isValidSession(socketId)) {
      return res.status(401).json({ error: 'Invalid or missing socket session' });
    }

    const decodedFolderPath = decodeURIComponent(folderPath);
    const service = await socketManager.getImapService(socketId, accountId);
    await service.markAsRead(decodedFolderPath, parseInt(uid), isRead);

    res.json({ success: true });
  } catch (error: any) {
    console.error('Mark as read error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark email as flagged/unflagged
router.put('/:accountId/:folderPath/:uid/flag', authenticateToken, async (req, res) => {
  try {
    const { accountId, folderPath, uid } = req.params;
    const { socketId, isFlagged } = req.body;

    if (!socketId || !socketManager.isValidSession(socketId)) {
      return res.status(401).json({ error: 'Invalid or missing socket session' });
    }

    const decodedFolderPath = decodeURIComponent(folderPath);
    const service = await socketManager.getImapService(socketId, accountId);
    await service.markAsFlagged(decodedFolderPath, parseInt(uid), isFlagged);

    res.json({ success: true });
  } catch (error: any) {
    console.error('Mark as flagged error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete email
router.delete('/:accountId/:folderPath/:uid', authenticateToken, async (req, res) => {
  try {
    const { accountId, folderPath, uid } = req.params;
    const socketId = req.query.socketId as string;

    if (!socketId || !socketManager.isValidSession(socketId)) {
      return res.status(401).json({ error: 'Invalid or missing socket session' });
    }

    const decodedFolderPath = decodeURIComponent(folderPath);
    const service = await socketManager.getImapService(socketId, accountId);
    await service.deleteEmail(decodedFolderPath, parseInt(uid));

    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete email error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Move email to another folder
router.post('/:accountId/:folderPath/:uid/move', authenticateToken, async (req, res) => {
  try {
    const { accountId, folderPath, uid } = req.params;
    const { socketId, targetFolderPath } = req.body;

    if (!socketId || !socketManager.isValidSession(socketId)) {
      return res.status(401).json({ error: 'Invalid or missing socket session' });
    }

    if (!targetFolderPath) {
      return res.status(400).json({ error: 'targetFolderPath is required' });
    }

    const decodedFolderPath = decodeURIComponent(folderPath);
    const service = await socketManager.getImapService(socketId, accountId);
    await service.moveEmail(decodedFolderPath, targetFolderPath, parseInt(uid));

    res.json({ success: true });
  } catch (error: any) {
    console.error('Move email error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new folder
router.post('/folders/:accountId', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.params;
    const { socketId, folderPath } = req.body;

    if (!socketId || !socketManager.isValidSession(socketId)) {
      return res.status(401).json({ error: 'Invalid or missing socket session' });
    }

    if (!folderPath) {
      return res.status(400).json({ error: 'folderPath is required' });
    }

    const service = await socketManager.getImapService(socketId, accountId);
    await service.createFolder(folderPath);

    res.json({ success: true });
  } catch (error: any) {
    console.error('Create folder error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a folder
router.delete('/folders/:accountId/:folderPath', authenticateToken, async (req, res) => {
  try {
    const { accountId, folderPath } = req.params;
    const socketId = req.query.socketId as string;

    if (!socketId || !socketManager.isValidSession(socketId)) {
      return res.status(401).json({ error: 'Invalid or missing socket session' });
    }

    const decodedFolderPath = decodeURIComponent(folderPath);
    const service = await socketManager.getImapService(socketId, accountId);
    await service.deleteFolder(decodedFolderPath);

    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete folder error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rename a folder
router.put('/folders/:accountId/:folderPath/rename', authenticateToken, async (req, res) => {
  try {
    const { accountId, folderPath } = req.params;
    const { socketId, newPath } = req.body;

    if (!socketId || !socketManager.isValidSession(socketId)) {
      return res.status(401).json({ error: 'Invalid or missing socket session' });
    }

    if (!newPath) {
      return res.status(400).json({ error: 'newPath is required' });
    }

    const decodedFolderPath = decodeURIComponent(folderPath);
    const service = await socketManager.getImapService(socketId, accountId);
    await service.renameFolder(decodedFolderPath, newPath);

    res.json({ success: true });
  } catch (error: any) {
    console.error('Rename folder error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send email
router.post('/send', authenticateToken, upload.array('attachments'), async (req, res) => {
  try {
    const { accountId, to, cc, bcc, subject, body, isHtml, priority, requestReadReceipt, inReplyTo, references } = req.body;
    
    if (!accountId) {
      return res.status(400).json({ error: 'accountId is required' });
    }

    // Get account details
    const account = await prisma.emailAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return res.status(404).json({ error: 'Email account not found' });
    }

    // Decrypt SMTP password
    const smtpPassword = decrypt(account.password);

    // Create SMTP service
    const smtpService = new SmtpService({
      host: account.smtpHost,
      port: account.smtpPort,
      secure: account.smtpSecure,
      username: account.username,
      password: smtpPassword,
    });

    // Parse recipients
    const parseTo = typeof to === 'string' ? JSON.parse(to) : to;
    const parseCc = cc ? (typeof cc === 'string' ? JSON.parse(cc) : cc) : undefined;
    const parseBcc = bcc ? (typeof bcc === 'string' ? JSON.parse(bcc) : bcc) : undefined;

    // Format recipients
    const formatRecipients = (recipients: any[]) => {
      return recipients.map(r => r.name ? `"${r.name}" <${r.address}>` : r.address);
    };

    const toAddresses = formatRecipients(parseTo);
    const ccAddresses = parseCc ? formatRecipients(parseCc) : undefined;
    const bccAddresses = parseBcc ? formatRecipients(parseBcc) : undefined;

    // Process attachments
    const attachments = (req.files as Express.Multer.File[])?.map(file => ({
      filename: file.originalname,
      content: file.buffer,
      contentType: file.mimetype,
    })) || [];

    // Prepare email message
    const emailMessage: any = {
      from: `"${account.displayName || account.emailAddress}" <${account.emailAddress}>`,
      to: toAddresses,
      cc: ccAddresses,
      bcc: bccAddresses,
      subject: subject || '(No Subject)',
      attachments,
    };

    if (isHtml === 'true' || isHtml === true) {
      emailMessage.html = body;
    } else {
      emailMessage.text = body;
    }

    // Add reply headers if provided
    if (inReplyTo) {
      emailMessage.inReplyTo = inReplyTo;
    }
    if (references) {
      emailMessage.references = typeof references === 'string' ? JSON.parse(references) : references;
    }

    // Add priority headers
    if (priority === 'high') {
      emailMessage.priority = 'high';
    } else if (priority === 'low') {
      emailMessage.priority = 'low';
    }

    // Send email
    const info = await smtpService.sendEmail(emailMessage);

    // Save to Sent folder using API connection (not IDLE)
    try {
      const socketId = req.query.socketId as string || req.body.socketId;
      if (socketId && socketManager.isValidSession(socketId)) {
        const imapService = await socketManager.getImapService(socketId, accountId);
        
        // Build RFC822 message format for IMAP append
        const date = new Date().toUTCString();
        let rfc822Message = `From: ${emailMessage.from}\r\n`;
        rfc822Message += `To: ${toAddresses.join(', ')}\r\n`;
        if (ccAddresses) rfc822Message += `Cc: ${ccAddresses.join(', ')}\r\n`;
        rfc822Message += `Subject: ${subject || '(No Subject)'}\r\n`;
        rfc822Message += `Date: ${date}\r\n`;
        rfc822Message += `Message-ID: ${info.messageId}\r\n`;
        
        if (isHtml === 'true' || isHtml === true) {
          rfc822Message += `Content-Type: text/html; charset=UTF-8\r\n`;
        } else {
          rfc822Message += `Content-Type: text/plain; charset=UTF-8\r\n`;
        }
        
        rfc822Message += `\r\n${body}`;
        
        // Try common Sent folder names
        const sentFolderNames = ['Sent', 'Sent Items', 'Sent Mail', '[Gmail]/Sent Mail'];
        let savedToSent = false;
        
        for (const folderName of sentFolderNames) {
          try {
            await imapService.appendEmail(folderName, rfc822Message, ['\\Seen']);
            savedToSent = true;
            console.log(`Email saved to ${folderName} folder`);
            break;
          } catch (err) {
            // Try next folder name
            continue;
          }
        }
        
        if (!savedToSent) {
          console.warn('Could not save email to Sent folder - folder not found');
        }
      }
    } catch (saveError) {
      console.error('Failed to save to Sent folder:', saveError);
      // Don't fail the request if saving to Sent fails
    }

    res.json({ 
      success: true, 
      messageId: info.messageId,
      response: info.response 
    });
  } catch (error: any) {
    console.error('Send email error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get attachment by index
router.get('/:accountId/:folderPath/:uid/attachments/:index', authenticateToken, async (req, res) => {
  try {
    const { accountId, folderPath, uid, index } = req.params;
    const socketId = req.query.socketId as string;

    if (!socketId || !socketManager.isValidSession(socketId)) {
      return res.status(401).json({ error: 'Invalid or missing socket session' });
    }

    const decodedFolderPath = decodeURIComponent(folderPath);
    const service = await socketManager.getImapService(socketId, accountId);
    const email = await service.getEmailByUid(decodedFolderPath, parseInt(uid));

    if (!email.attachments || email.attachments.length === 0) {
      return res.status(404).json({ error: 'No attachments found' });
    }

    const attachmentIndex = parseInt(index);
    if (attachmentIndex < 0 || attachmentIndex >= email.attachments.length) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const attachment = email.attachments[attachmentIndex];
    
    if (!attachment.content) {
      return res.status(404).json({ error: 'Attachment content not found' });
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(attachment.content, 'base64');

    // Set appropriate headers
    res.setHeader('Content-Type', attachment.contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename}"`);
    res.setHeader('Content-Length', buffer.length);

    res.send(buffer);
  } catch (error: any) {
    console.error('Get attachment error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get connection stats
router.get('/connection-stats', authenticateToken, async (req, res) => {
  try {
    const stats = socketManager.getStats();
    res.json(stats);
  } catch (error: any) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
