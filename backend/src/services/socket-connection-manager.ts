import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { ImapService, createImapService } from './imap.service';
import prisma from '../db';

interface SocketSession {
  socketId: string;
  userId: string;
  socket: Socket;
  imapConnections: Map<string, ImapConnection>; // accountId -> IDLE connection
  apiConnections: Map<string, ImapConnection>; // accountId -> API query connection
  authenticated: boolean;
  createdAt: Date;
}

interface ImapConnection {
  accountId: string;
  service: ImapService;
  isIdle: boolean;
  currentFolder: string;
  lastUsed: Date;
}

/**
 * Centralized manager for Socket.IO connections and their associated IMAP IDLE connections
 * - Client authenticates via socket
 * - IDLE connections are created per email account
 * - API requests must provide socketId to use the authenticated connection
 */
class SocketConnectionManager {
  private sessions: Map<string, SocketSession> = new Map();
  private io: Server | null = null;

  initialize(io: Server): void {
    this.io = io;
    this.setupSocketHandlers(io);
  }

  private setupSocketHandlers(io: Server): void {
    io.on('connection', async (socket: Socket) => {
      console.log(`[SocketManager] New socket connection: ${socket.id}`);

      await this.handleAuthentication(socket, socket.handshake.auth.token);

      // Handle IDLE start for specific folder
      socket.on('idle:start', async (data: { accountId: string; folderPath?: string }) => {
        await this.handleIdleStart(socket, data.accountId, data.folderPath || 'INBOX');
      });

      // Handle IDLE stop
      socket.on('idle:stop', async (data: { accountId: string }) => {
        await this.handleIdleStop(socket, data.accountId);
      });

      // Handle disconnect
      socket.on('disconnect', async () => {
        await this.handleDisconnect(socket);
      });
    });
  }

  private async handleAuthentication(socket: Socket, token: string): Promise<void> {
    try {
      // Verify JWT token
      const secret = process.env.JWT_SECRET || 'your-secret-key';
      const decoded = jwt.verify(token, secret) as { userId: string };

      console.log(`[SocketManager] Socket ${socket.id} authenticated for user ${decoded.userId}`);

      // Create session
      const session: SocketSession = {
        socketId: socket.id,
        userId: decoded.userId,
        socket,
        imapConnections: new Map(),
        apiConnections: new Map(),
        authenticated: true,
        createdAt: new Date(),
      };

      this.sessions.set(socket.id, session);

      // Join user room for broadcasts
      socket.join(`user:${decoded.userId}`);

      // Emit authentication success with socketId
      socket.emit('auth:success', {
        userId: decoded.userId,
        socketId: socket.id
      });

      console.log(`[SocketManager] ✅ Authentication successful for user ${decoded.userId}`);

    } catch (error: any) {
      console.error(`[SocketManager] Authentication failed for socket ${socket.id}:`, error.message);
      socket.emit('auth:error', { error: 'Authentication failed' });
      socket.disconnect();
    }
  }

  private async startIdleConnection(
    session: SocketSession,
    accountId: string,
    folderPath: string = 'INBOX'
  ): Promise<void> {
    try {
      // Check if already connected
      if (session.imapConnections.has(accountId)) {
        console.log(`[SocketManager] IDLE already active for account ${accountId}`);
        session.socket.emit('idle:started', {
          accountId,
          folderPath: session.imapConnections.get(accountId)!.currentFolder,
          success: true,
          message: 'IDLE connection already active',
        });
        return;
      }

      console.log(`[SocketManager] Creating IMAP connection for account ${accountId}`);

      // Create IMAP service
      const service = await createImapService(accountId);
      await service.connect();

      // Open folder and setup IDLE
      const connection = (service as any).connection;
      await connection.openBox(folderPath);

      // Get initial mail count to track actual new emails
      let lastMailCount = 0;
      try {
        const box = await connection.getBoxes();
        // The current box info is available after openBox
        lastMailCount = (connection as any).imap._box?.messages?.total || 0;
      } catch (e) {
        // Fallback if we can't get initial count
        lastMailCount = 0;
      }

      // Setup event listeners for IDLE notifications
      const mailHandler = (count: number) => {
        console.log(`[SocketManager] 📧 New mail (${count}) in ${folderPath} for account ${accountId}`);
        session.socket.emit('email:new', {
          accountId,
          folderPath,
          count,
        });
        lastMailCount = count;
      };

      const updateHandler = (seqno: number, info: any) => {
        console.log(`[SocketManager] 📝 Email updated in ${folderPath} for account ${accountId}`);
        session.socket.emit('email:update', {
          accountId,
          folderPath,
          seqno,
          info,
        });
      };

      const expungeHandler = (seqno: number) => {
        console.log(`[SocketManager] 🗑️ Email deleted from ${folderPath} for account ${accountId}`);
        session.socket.emit('email:deleted', {
          accountId,
          folderPath,
          seqno,
        });
        // Decrease count when email is deleted
        lastMailCount = Math.max(0, lastMailCount - 1);
      };

      // Attach event listeners
      connection.on('mail', mailHandler);
      connection.on('update', updateHandler);
      connection.on('expunge', expungeHandler);

      // Store connection with event handlers for cleanup
      const imapConnection: ImapConnection = {
        accountId,
        service,
        isIdle: true,
        currentFolder: folderPath,
        lastUsed: new Date(),
      };

      // Store handlers so we can remove them later
      (imapConnection as any).eventHandlers = {
        mail: mailHandler,
        update: updateHandler,
        expunge: expungeHandler,
      };

      session.imapConnections.set(accountId, imapConnection);

      // Notify client with success callback
      session.socket.emit('idle:started', {
        accountId,
        folderPath,
        success: true,
        message: 'IDLE connection established successfully',
      });

      console.log(`[SocketManager] ✅ IDLE started for account ${accountId} on folder ${folderPath}`);

    } catch (error: any) {
      console.error(`[SocketManager] Failed to start IDLE for account ${accountId}:`, error.message);

      // Notify client with error callback
      session.socket.emit('idle:error', {
        accountId,
        folderPath,
        success: false,
        error: error.message,
        message: 'Failed to establish IDLE connection',
      });

      // Also send a failed idle:started event for consistency
      session.socket.emit('idle:started', {
        accountId,
        folderPath,
        success: false,
        error: error.message,
        message: 'Failed to establish IDLE connection',
      });
    }
  }

  private async handleIdleStart(socket: Socket, accountId: string, folderPath: string): Promise<void> {
    const session = this.sessions.get(socket.id);

    if (!session || !session.authenticated) {
      socket.emit('idle:error', {
        accountId,
        folderPath,
        success: false,
        error: 'Not authenticated',
        message: 'Socket session not authenticated'
      });
      socket.emit('idle:started', {
        accountId,
        folderPath,
        success: false,
        error: 'Not authenticated',
        message: 'Socket session not authenticated'
      });
      return;
    }

    // Check if IDLE already exists for this account
    const existingConnection = session.imapConnections.get(accountId);

    if (existingConnection) {
      // If IDLE already exists, don't restart it - just acknowledge
      console.log(`[SocketManager] IDLE already active for account ${accountId} on ${existingConnection.currentFolder}`);
      socket.emit('idle:started', {
        accountId,
        folderPath: existingConnection.currentFolder,
        success: true,
        message: 'IDLE connection already active',
      });
      return;
    }

    // Only start IDLE for INBOX to receive new mail notifications
    // Other folders will be queried on-demand without IDLE
    await this.startIdleConnection(session, accountId, 'INBOX');
  }

  private async handleIdleStop(socket: Socket, accountId: string): Promise<void> {
    const session = this.sessions.get(socket.id);

    if (!session) {
      socket.emit('idle:stopped', {
        accountId,
        success: false,
        error: 'Session not found',
        message: 'Socket session not found'
      });
      return;
    }

    await this.stopIdleConnection(session, accountId);
  }

  private async stopIdleConnection(session: SocketSession, accountId: string): Promise<void> {
    const connection = session.imapConnections.get(accountId);

    if (connection) {
      console.log(`[SocketManager] Stopping IDLE for account ${accountId}`);
      try {
        // Remove event listeners to prevent memory leaks and duplicate events
        const imapConnection = (connection.service as any).connection;
        const handlers = (connection as any).eventHandlers;

        if (imapConnection && handlers) {
          imapConnection.removeListener('mail', handlers.mail);
          imapConnection.removeListener('update', handlers.update);
          imapConnection.removeListener('expunge', handlers.expunge);
        }

        await connection.service.disconnect();
        session.imapConnections.delete(accountId);

        session.socket.emit('idle:stopped', {
          accountId,
          success: true,
          message: 'IDLE connection stopped successfully'
        });
      } catch (error: any) {
        console.error(`[SocketManager] Error disconnecting:`, error.message);
        session.socket.emit('idle:stopped', {
          accountId,
          success: false,
          error: error.message,
          message: 'Error stopping IDLE connection'
        });
      }
    } else {
      session.socket.emit('idle:stopped', {
        accountId,
        success: true,
        message: 'No active IDLE connection for this account'
      });
    }
  }

  private async handleDisconnect(socket: Socket): Promise<void> {
    const session = this.sessions.get(socket.id);

    if (session) {
      const totalConnections = session.imapConnections.size + session.apiConnections.size;
      console.log(`[SocketManager] Socket ${socket.id} disconnected, cleaning up ${totalConnections} IMAP connections`);

      // Close all IDLE connections
      for (const [accountId] of session.imapConnections) {
        await this.stopIdleConnection(session, accountId);
      }

      // Close all API connections
      for (const [accountId, connection] of session.apiConnections) {
        try {
          await connection.service.disconnect();
          console.log(`[SocketManager] Closed API connection for account ${accountId}`);
        } catch (error: any) {
          console.error(`[SocketManager] Error closing API connection for ${accountId}:`, error.message);
        }
      }
      session.apiConnections.clear();

      // Remove session
      this.sessions.delete(socket.id);
    }
  }

  /**
   * Get IMAP service for API requests
   * API endpoints must provide socketId to use the authenticated connection
   */
  async getImapService(socketId: string, accountId: string): Promise<ImapService> {
    const session = this.sessions.get(socketId);

    if (!session || !session.authenticated) {
      throw new Error('Invalid or unauthenticated socket session');
    }

    // Verify user owns this account
    const account = await prisma.emailAccount.findFirst({
      where: {
        id: accountId,
        userId: session.userId,
      },
    });

    if (!account) {
      throw new Error('Email account not found or access denied');
    }

    // Check if we have an existing API connection (separate from IDLE connection)
    const existingConnection = session.apiConnections.get(accountId);

    if (existingConnection) {
      existingConnection.lastUsed = new Date();
      return existingConnection.service;
    }

    // Create a new API connection (separate from IDLE connection)
    console.log(`[SocketManager] Creating new IMAP API connection for account ${accountId}`);
    const service = await createImapService(accountId);
    await service.connect();

    const connection: ImapConnection = {
      accountId,
      service,
      isIdle: false,
      currentFolder: '',
      lastUsed: new Date(),
    };

    session.apiConnections.set(accountId, connection);

    return service;
  }

  /**
   * Verify socket session is valid
   */
  isValidSession(socketId: string): boolean {
    const session = this.sessions.get(socketId);
    return session !== undefined && session.authenticated;
  }

  /**
   * Get user ID from socket session
   */
  getUserId(socketId: string): string | null {
    const session = this.sessions.get(socketId);
    return session?.userId || null;
  }

  /**
   * Get session stats for monitoring
   */
  getStats(): {
    totalSessions: number;
    authenticatedSessions: number;
    totalIdleConnections: number;
  } {
    const authenticatedSessions = Array.from(this.sessions.values()).filter(
      (s) => s.authenticated
    ).length;

    const totalIdleConnections = Array.from(this.sessions.values()).reduce(
      (sum, session) => sum + session.imapConnections.size,
      0
    );

    return {
      totalSessions: this.sessions.size,
      authenticatedSessions,
      totalIdleConnections,
    };
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    console.log(`[SocketManager] Shutting down, closing ${this.sessions.size} sessions...`);

    for (const [socketId, session] of this.sessions) {
      for (const [accountId] of session.imapConnections) {
        await this.stopIdleConnection(session, accountId);
      }
      session.socket.disconnect();
    }

    this.sessions.clear();
  }
}

// Singleton instance
export const socketManager = new SocketConnectionManager();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await socketManager.shutdown();
});

process.on('SIGINT', async () => {
  await socketManager.shutdown();
});
