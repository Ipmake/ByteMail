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
import settingsRoutes from './routes/settings';
import prisma from './db';
import bcrypt from 'bcryptjs';
import { socketManager } from './services/socket-connection-manager';

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
app.use('/api/settings', settingsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files from www directory (production)
if (process.env.NODE_ENV === 'production') {
  const wwwPath = path.join(__dirname, '../www');
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

  // Note: Authentication and IDLE connections are now handled by socketManager
  // Clients should emit 'authenticate' event with JWT token to the socket
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

    // Initialize socket connection manager
    socketManager.initialize(io);
    console.log('✅ Socket connection manager initialized');

    httpServer.listen(PORT, () => {
      console.log(`🚀 ByteMail server running on port ${PORT}`);
      console.log(`📧 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔌 Socket.IO ready for client connections`);
      console.log(`🔔 IDLE connections will be established per authenticated socket`);
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
  await socketManager.shutdown();
  
  httpServer.close(() => {
    console.log('HTTP server closed');
  });
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server');
  
  // Stop all IDLE connections
  await socketManager.shutdown();
  
  httpServer.close(() => {
    console.log('HTTP server closed');
  });
  await prisma.$disconnect();
  process.exit(0);
});
