import express, { Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../db';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Apply auth and admin middleware to all routes
router.use(authenticateToken);
router.use(requireAdmin);

// Get all users
router.get('/users', async (req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        isAdmin: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { emailAccounts: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user details by ID
router.get('/users/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        isAdmin: true,
        createdAt: true,
        updatedAt: true,
        emailAccounts: {
          select: {
            id: true,
            emailAddress: true,
            displayName: true,
            imapHost: true,
            imapPort: true,
            smtpHost: true,
            smtpPort: true,
            isActive: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create user
router.post('/users', async (req: AuthRequest, res: Response) => {
  try {
    const { username, password, email, isAdmin } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        email: email || null,
        isAdmin: isAdmin || false,
      },
      select: {
        id: true,
        username: true,
        email: true,
        isAdmin: true,
        createdAt: true,
      },
    });

    res.status(201).json(user);
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user
router.put('/users/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { username, email, isAdmin, password } = req.body;

    const updateData: any = {};

    if (username !== undefined) {
      const existingUser = await prisma.user.findFirst({
        where: {
          username,
          NOT: { id },
        },
      });

      if (existingUser) {
        return res.status(400).json({ error: 'Username already exists' });
      }

      updateData.username = username;
    }

    if (email !== undefined) updateData.email = email || null;
    if (isAdmin !== undefined) updateData.isAdmin = isAdmin;

    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
      updateData.password = await bcrypt.hash(password, 10);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        isAdmin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json(user);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete user
router.delete('/users/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (id === req.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    await prisma.user.delete({
      where: { id },
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get server settings
router.get('/settings', async (req: AuthRequest, res: Response) => {
  try {
    let settings = await prisma.serverSettings.findFirst();

    if (!settings) {
      settings = await prisma.serverSettings.create({
        data: {},
      });
    }

    res.json(settings);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update server settings
router.put('/settings', async (req: AuthRequest, res: Response) => {
  try {
    const { restrictedServer, restrictedDomain, allowMultipleAccounts } = req.body;

    let settings = await prisma.serverSettings.findFirst();

    if (!settings) {
      settings = await prisma.serverSettings.create({
        data: {
          restrictedServer: restrictedServer || null,
          restrictedDomain: restrictedDomain || null,
          allowMultipleAccounts: allowMultipleAccounts !== undefined ? allowMultipleAccounts : true,
        },
      });
    } else {
      settings = await prisma.serverSettings.update({
        where: { id: settings.id },
        data: {
          restrictedServer: restrictedServer || null,
          restrictedDomain: restrictedDomain || null,
          allowMultipleAccounts: allowMultipleAccounts !== undefined ? allowMultipleAccounts : settings.allowMultipleAccounts,
        },
      });
    }

    res.json(settings);
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
