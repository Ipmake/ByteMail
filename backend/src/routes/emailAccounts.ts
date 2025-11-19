import express, { Response } from 'express';
import prisma from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { encrypt, decrypt } from '../utils/encryption';
import { ImapService } from '../services/imap.service';
import { SmtpService } from '../services/smtp.service';

const router = express.Router();

router.use(authenticateToken);

// Get all email accounts for current user
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const accounts = await prisma.emailAccount.findMany({
      where: { userId: req.userId },
      select: {
        id: true,
        emailAddress: true,
        displayName: true,
        imapHost: true,
        imapPort: true,
        imapSecure: true,
        smtpHost: true,
        smtpPort: true,
        smtpSecure: true,
        username: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(accounts);
  } catch (error) {
    console.error('Get email accounts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single email account
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const account = await prisma.emailAccount.findFirst({
      where: {
        id,
        userId: req.userId,
      },
      select: {
        id: true,
        emailAddress: true,
        displayName: true,
        imapHost: true,
        imapPort: true,
        imapSecure: true,
        smtpHost: true,
        smtpPort: true,
        smtpSecure: true,
        username: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!account) {
      return res.status(404).json({ error: 'Email account not found' });
    }

    res.json(account);
  } catch (error) {
    console.error('Get email account error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create email account
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const {
      emailAddress,
      displayName,
      imapHost,
      imapPort,
      imapSecure,
      smtpHost,
      smtpPort,
      smtpSecure,
      username,
      password,
    } = req.body;

    if (!emailAddress || !imapHost || !smtpHost || !username || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check server restrictions
    const settings = await prisma.serverSettings.findFirst();

    if (settings) {
      if (settings.restrictedServer && imapHost !== settings.restrictedServer) {
        return res.status(400).json({
          error: `Only email accounts from ${settings.restrictedServer} are allowed`,
        });
      }

      if (settings.restrictedDomain) {
        const domain = emailAddress.split('@')[1];
        if (domain !== settings.restrictedDomain) {
          return res.status(400).json({
            error: `Only email addresses from ${settings.restrictedDomain} are allowed`,
          });
        }
      }

      if (!settings.allowMultipleAccounts) {
        const existingAccounts = await prisma.emailAccount.count({
          where: { userId: req.userId },
        });

        if (existingAccounts > 0) {
          return res.status(400).json({
            error: 'Multiple email accounts are not allowed',
          });
        }
      }
    }

    // Test IMAP connection
    const imapTest = await ImapService.testConnection({
      host: imapHost,
      port: imapPort || 993,
      secure: imapSecure !== false,
      username,
      password,
    });

    if (!imapTest) {
      return res.status(400).json({ error: 'Failed to connect to IMAP server' });
    }

    // Test SMTP connection
    const smtpTest = await SmtpService.testConnection({
      host: smtpHost,
      port: smtpPort || 465,
      secure: smtpSecure !== false,
      username,
      password,
    });

    if (!smtpTest) {
      return res.status(400).json({ error: 'Failed to connect to SMTP server' });
    }

    // Encrypt password
    const encryptedPassword = encrypt(password);

    const account = await prisma.emailAccount.create({
      data: {
        userId: req.userId!,
        emailAddress,
        displayName: displayName || null,
        imapHost,
        imapPort: imapPort || 993,
        imapSecure: imapSecure !== false,
        smtpHost,
        smtpPort: smtpPort || 465,
        smtpSecure: smtpSecure !== false,
        username,
        password: encryptedPassword,
      },
      select: {
        id: true,
        emailAddress: true,
        displayName: true,
        imapHost: true,
        imapPort: true,
        imapSecure: true,
        smtpHost: true,
        smtpPort: true,
        smtpSecure: true,
        username: true,
        isActive: true,
        createdAt: true,
      },
    });

    res.status(201).json(account);
  } catch (error) {
    console.error('Create email account error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update email account
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      displayName,
      imapHost,
      imapPort,
      imapSecure,
      smtpHost,
      smtpPort,
      smtpSecure,
      username,
      password,
      isActive,
    } = req.body;

    const existingAccount = await prisma.emailAccount.findFirst({
      where: {
        id,
        userId: req.userId,
      },
    });

    if (!existingAccount) {
      return res.status(404).json({ error: 'Email account not found' });
    }

    const updateData: any = {};

    if (displayName !== undefined) updateData.displayName = displayName || null;
    if (imapHost !== undefined) updateData.imapHost = imapHost;
    if (imapPort !== undefined) updateData.imapPort = imapPort;
    if (imapSecure !== undefined) updateData.imapSecure = imapSecure;
    if (smtpHost !== undefined) updateData.smtpHost = smtpHost;
    if (smtpPort !== undefined) updateData.smtpPort = smtpPort;
    if (smtpSecure !== undefined) updateData.smtpSecure = smtpSecure;
    if (username !== undefined) updateData.username = username;
    if (isActive !== undefined) updateData.isActive = isActive;

    if (password) {
      updateData.password = encrypt(password);
    }

    // If connection details changed, test them
    if (imapHost || imapPort !== undefined || username || password) {
      const testHost = imapHost || existingAccount.imapHost;
      const testPort = imapPort !== undefined ? imapPort : existingAccount.imapPort;
      const testUsername = username || existingAccount.username;
      const testPassword = password || decrypt(existingAccount.password);

      const imapTest = await ImapService.testConnection({
        host: testHost,
        port: testPort,
        secure: imapSecure !== undefined ? imapSecure : existingAccount.imapSecure,
        username: testUsername,
        password: testPassword,
      });

      if (!imapTest) {
        return res.status(400).json({ error: 'Failed to connect to IMAP server' });
      }
    }

    if (smtpHost || smtpPort !== undefined || username || password) {
      const testHost = smtpHost || existingAccount.smtpHost;
      const testPort = smtpPort !== undefined ? smtpPort : existingAccount.smtpPort;
      const testUsername = username || existingAccount.username;
      const testPassword = password || decrypt(existingAccount.password);

      const smtpTest = await SmtpService.testConnection({
        host: testHost,
        port: testPort,
        secure: smtpSecure !== undefined ? smtpSecure : existingAccount.smtpSecure,
        username: testUsername,
        password: testPassword,
      });

      if (!smtpTest) {
        return res.status(400).json({ error: 'Failed to connect to SMTP server' });
      }
    }

    const account = await prisma.emailAccount.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        emailAddress: true,
        displayName: true,
        imapHost: true,
        imapPort: true,
        imapSecure: true,
        smtpHost: true,
        smtpPort: true,
        smtpSecure: true,
        username: true,
        isActive: true,
        updatedAt: true,
      },
    });

    res.json(account);
  } catch (error) {
    console.error('Update email account error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete email account
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const account = await prisma.emailAccount.findFirst({
      where: {
        id,
        userId: req.userId,
      },
    });

    if (!account) {
      return res.status(404).json({ error: 'Email account not found' });
    }

    await prisma.emailAccount.delete({
      where: { id },
    });

    res.json({ message: 'Email account deleted successfully' });
  } catch (error) {
    console.error('Delete email account error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Sync email account
router.post('/:id/sync', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const account = await prisma.emailAccount.findFirst({
      where: {
        id,
        userId: req.userId,
      },
    });

    if (!account) {
      return res.status(404).json({ error: 'Email account not found' });
    }

    // Wait for sync to complete
    const { syncEmailAccount } = require('../services/imap.service');
    await syncEmailAccount(id);

    res.json({ message: 'Sync completed' });
  } catch (error) {
    console.error('Sync email account error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
