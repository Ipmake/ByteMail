import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import authRoutes from './routes/auth';
import adminRoutes from './routes/admin';
import emailAccountRoutes from './routes/emailAccounts';
import emailRoutes from './routes/emails';
import prisma from './db';
import bcrypt from 'bcryptjs';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
  },
});

const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));
// Increase payload limit for attachments (50MB)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/email-accounts', emailAccountRoutes);
app.use('/api/emails', emailRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files from www directory (production)
if (process.env.NODE_ENV === 'production') {
  const wwwPath = path.join(__dirname, '../../www');
  app.use(express.static(wwwPath));
  
  app.get('{*path}', (req, res) => {
    res.sendFile(path.join(wwwPath, 'index.html'));
  });
}

// Socket.IO
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });

  // Join user room for notifications
  socket.on('join:user', (userId: string) => {
    socket.join(`user:${userId}`);
    console.log(`[Socket] User ${userId} joined room user:${userId} (socket: ${socket.id})`);
    
    // Log all rooms this socket is in
    const rooms = Array.from(socket.rooms);
    console.log(`[Socket] Socket ${socket.id} is now in rooms:`, rooms);
  });

  // Join account room for IDLE notifications
  socket.on('join:account', (accountId: string) => {
    socket.join(`account:${accountId}`);
    console.log(`[Socket] Joined room account:${accountId} (socket: ${socket.id})`);
    
    // Log all rooms this socket is in
    const rooms = Array.from(socket.rooms);
    console.log(`[Socket] Socket ${socket.id} is now in rooms:`, rooms);
  });

  // Start IDLE for an account
  socket.on('idle:start', async (accountId: string) => {
    console.log(`[Socket] Received idle:start request for account ${accountId}`);
    const { imapIdleManager } = await import('./services/imap-idle.service.js');
    try {
      await imapIdleManager.startForAccount(accountId);
      console.log(`[Socket] IDLE started successfully for account ${accountId}`);
      socket.emit('idle:started', { accountId, success: true });
    } catch (error) {
      console.error(`[Socket] Failed to start IDLE for account ${accountId}:`, error);
      socket.emit('idle:error', { accountId, error: error instanceof Error ? error.message : 'Failed to start IDLE' });
    }
  });

  // Stop IDLE for an account
  socket.on('idle:stop', async (accountId: string) => {
    console.log(`Stopping IDLE for account ${accountId}`);
    const { imapIdleManager } = await import('./services/imap-idle.service.js');
    try {
      await imapIdleManager.stopForAccount(accountId);
      socket.emit('idle:stopped', { accountId, success: true });
    } catch (error) {
      console.error(`Failed to stop IDLE for account ${accountId}:`, error);
    }
  });

  // Sync notifications
  socket.on('sync:start', (data) => {
    io.to(`user:${data.userId}`).emit('sync:progress', {
      accountId: data.accountId,
      status: 'syncing',
    });
  });
});

// Export io for use in other modules
export { io };

// Initialize database with default admin user
async function initializeDatabase() {
  try {
    const adminUser = await prisma.user.findFirst({
      where: { isAdmin: true },
    });

    if (!adminUser) {
      const hashedPassword = await bcrypt.hash('admin', 10);
      await prisma.user.create({
        data: {
          username: 'admin',
          password: hashedPassword,
          isAdmin: true,
        },
      });
      console.log('Default admin user created (username: admin, password: admin)');
      console.log('⚠️  Please change the default password immediately!');
    }

    // Ensure server settings exist
    const settings = await prisma.serverSettings.findFirst();
    if (!settings) {
      await prisma.serverSettings.create({
        data: {},
      });
    }
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

// Start server
async function start() {
  try {
    await initializeDatabase();

    // Start IDLE connections for all active accounts
    const { imapIdleManager } = await import('./services/imap-idle.service.js');
    const activeAccounts = await prisma.emailAccount.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    console.log(`Starting IDLE for ${activeAccounts.length} active accounts...`);
    for (const account of activeAccounts) {
      imapIdleManager.startForAccount(account.id).catch((error) => {
        console.error(`Failed to start IDLE for account ${account.id}:`, error);
      });
    }

    httpServer.listen(PORT, () => {
      console.log(`🚀 ByteMail server running on port ${PORT}`);
      console.log(`📧 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔔 IDLE connections active for real-time notifications`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  
  // Stop all IDLE connections
  const { imapIdleManager } = await import('./services/imap-idle.service.js');
  await imapIdleManager.stopAll();
  
  httpServer.close(() => {
    console.log('HTTP server closed');
  });
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server');
  
  // Stop all IDLE connections
  const { imapIdleManager } = await import('./services/imap-idle.service.js');
  await imapIdleManager.stopAll();
  
  httpServer.close(() => {
    console.log('HTTP server closed');
  });
  await prisma.$disconnect();
  process.exit(0);
});
