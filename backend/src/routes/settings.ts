import { Router } from 'express';
import prisma from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// Default settings structure
const defaultSettings = {
  general: {
    language: 'en',
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12h',
  },
  email: {
    signature: '\n Sent using ByteMail',
  },
  notifications: {
    soundEnabled: true,
  },
  display: {
    applyThemeToEmailViewer: true,
  },
  privacy: {
    blockExternalImages: false,
  },
};

// Get user settings
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    let userSettings = await prisma.userSettings.findUnique({
      where: { userId },
    });

    // If no settings exist, create default settings
    if (!userSettings) {
      userSettings = await prisma.userSettings.create({
        data: {
          userId,
          settings: defaultSettings,
        },
      });
    }

    res.json(userSettings.settings);
  } catch (error) {
    console.error('Error fetching user settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update a specific category of settings
router.patch('/:category', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { category } = req.params;
    const updates = req.body;

    // Validate category
    const validCategories = ['general', 'email', 'notifications', 'display', 'privacy'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: 'Invalid settings category' });
    }

    // Get or create user settings
    let userSettings = await prisma.userSettings.findUnique({
      where: { userId },
    });

    if (!userSettings) {
      userSettings = await prisma.userSettings.create({
        data: {
          userId,
          settings: defaultSettings,
        },
      });
    }

    // Update the specific category
    const currentSettings = userSettings.settings as any;
    const updatedSettings = {
      ...currentSettings,
      [category]: {
        ...currentSettings[category],
        ...updates,
      },
    };

    // Save updated settings
    const updated = await prisma.userSettings.update({
      where: { userId },
      data: { settings: updatedSettings },
    });

    res.json(updated.settings);
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Reset a specific category to defaults
router.post('/:category/reset', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { category } = req.params;

    // Validate category
    const validCategories = ['general', 'email', 'notifications', 'display', 'privacy'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: 'Invalid settings category' });
    }

    // Get or create user settings
    let userSettings = await prisma.userSettings.findUnique({
      where: { userId },
    });

    if (!userSettings) {
      userSettings = await prisma.userSettings.create({
        data: {
          userId,
          settings: defaultSettings,
        },
      });
    }

    // Reset the specific category
    const currentSettings = userSettings.settings as any;
    const updatedSettings = {
      ...currentSettings,
      [category]: (defaultSettings as any)[category],
    };

    // Save updated settings
    const updated = await prisma.userSettings.update({
      where: { userId },
      data: { settings: updatedSettings },
    });

    res.json(updated.settings);
  } catch (error) {
    console.error('Error resetting settings category:', error);
    res.status(500).json({ error: 'Failed to reset settings' });
  }
});

// Reset all settings to defaults
router.post('/reset', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    // Update or create with default settings
    const updated = await prisma.userSettings.upsert({
      where: { userId },
      update: { settings: defaultSettings },
      create: {
        userId,
        settings: defaultSettings,
      },
    });

    res.json(updated.settings);
  } catch (error) {
    console.error('Error resetting all settings:', error);
    res.status(500).json({ error: 'Failed to reset settings' });
  }
});

export default router;
