import imaps from 'imap-simple';
import { EventEmitter } from 'events';
import { ImapConfig } from './imap.service';
import prisma from '../db';

export interface NewEmailNotification {
  emailAccountId: string;
  folderPath: string;
  count: number;
}

export class ImapIdleService extends EventEmitter {
  private config: ImapConfig;
  private connection: any = null;
  private emailAccountId: string;
  private isActive = false;
  private reconnectTimeout?: NodeJS.Timeout;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private currentFolder: string | null = null;
  private noopInterval?: NodeJS.Timeout;
  private mailListener?: (...args: any[]) => void;
  private uidValidityListener?: (...args: any[]) => void;
  private isSyncing = false;
  private pendingNewEmailCount = 0;

  constructor(config: ImapConfig, emailAccountId: string) {
    super();
    this.config = config;
    this.emailAccountId = emailAccountId;
  }

  async start(): Promise<void> {
    if (this.isActive) {
      console.log(`[IDLE ${this.emailAccountId}] Already active`);
      return;
    }

    this.isActive = true;
    await this.connect();
  }

  async stop(): Promise<void> {
    this.isActive = false;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = undefined;
    }
    await this.disconnect();
  }

  private async connect(): Promise<void> {
    try {
      console.log(`[IDLE ${this.emailAccountId}] Establishing IDLE connection...`);
      
      const config = {
        imap: {
          user: this.config.username,
          password: this.config.password,
          host: this.config.host,
          port: this.config.port,
          tls: this.config.secure,
          authTimeout: 10000,
          tlsOptions: { rejectUnauthorized: false },
          keepalive: {
            interval: 10000, // Send keepalive every 10 seconds
            idleInterval: 300000, // Restart IDLE every 5 minutes (some servers require this)
            forceNoop: true,
          },
        },
      };

      this.connection = await imaps.connect(config);
      this.reconnectAttempts = 0;

      console.log(`[IDLE ${this.emailAccountId}] Connection established, setting up IDLE for INBOX`);

      // Open INBOX and start IDLE
      await this.setupIdleForFolder('INBOX');

      // Handle connection end
      this.connection.on('end', () => {
        console.log(`[IDLE ${this.emailAccountId}] Connection ended`);
        this.connection = null;
        this.handleDisconnect();
      });

      // Handle connection errors
      this.connection.on('error', (err: Error) => {
        console.error(`[IDLE ${this.emailAccountId}] Connection error:`, err.message);
        this.connection = null;
        this.handleDisconnect();
      });

    } catch (error: any) {
      console.error(`[IDLE ${this.emailAccountId}] Failed to establish connection:`, error.message);
      this.handleDisconnect();
    }
  }

  private async setupIdleForFolder(folderPath: string): Promise<void> {
    try {
      if (!this.connection) {
        throw new Error('No connection available');
      }

      // Open the mailbox
      await this.connection.openBox(folderPath);
      this.currentFolder = folderPath;
      
      console.log(`[IDLE ${this.emailAccountId}] Mailbox ${folderPath} opened, starting IDLE mode`);

      // Remove old listeners if they exist
      const imapEventTarget = this.connection.imap || this.connection;
      if (this.mailListener) {
        imapEventTarget.off?.('mail', this.mailListener);
        imapEventTarget.removeListener?.('mail', this.mailListener);
      }
      if (this.uidValidityListener) {
        imapEventTarget.off?.('uidvalidity', this.uidValidityListener);
        imapEventTarget.removeListener?.('uidvalidity', this.uidValidityListener);
      }

      // Create new listeners
      this.mailListener = async (numNewMsgs: number) => {
        console.log(`[IDLE ${this.emailAccountId}] 🔔 INSTANT notification: ${numNewMsgs} new message(s) in ${folderPath}`);
        
        // Store count for fast sync
        this.pendingNewEmailCount = numNewMsgs;
        
        // Trigger sync FIRST to fetch the new emails
        await this.triggerBackgroundSync();
        
        // THEN emit event after emails are in database
        this.emit('newEmail', {
          emailAccountId: this.emailAccountId,
          folderPath,
          count: numNewMsgs,
        } as NewEmailNotification);
      };

      this.uidValidityListener = () => {
        console.log(`[IDLE ${this.emailAccountId}] UID validity changed, restarting IDLE`);
      };

      // Listen for new mail events
      imapEventTarget.on('mail', this.mailListener);
      
      // Listen for when IDLE ends (some servers end it periodically)
      if (imapEventTarget.on) {
        imapEventTarget.on('uidvalidity', this.uidValidityListener);
      }

      // Start IDLE mode if available; otherwise fall back to a NOOP-based keepalive
      if (this.connection.imap && typeof this.connection.imap.idle === 'function') {
        try {
          this.connection.imap.idle();
          console.log(`[IDLE ${this.emailAccountId}] ✓ IDLE mode active - listening for instant notifications`);
        } catch (err: any) {
          console.warn(`[IDLE ${this.emailAccountId}] Failed to call imap.idle(), falling back to NOOP:`, err?.message || err);
        }
      } else {
        // NOOP fallback: call noop periodically to keep the connection responsive for server events
        const noopIntervalMs = 15_000; // 15s gives near-instant feel without heavy load
        this.noopInterval = setInterval(() => {
          try {
            if (this.connection && this.connection.imap && typeof this.connection.imap.noop === 'function') {
              this.connection.imap.noop();
            } else if (this.connection && typeof this.connection.noop === 'function') {
              // some wrappers expose noop directly
              this.connection.noop();
            }
          } catch (e: any) {
            console.warn(`[IDLE ${this.emailAccountId}] NOOP failed:`, e?.message || e);
          }
        }, noopIntervalMs);

        console.log(`[IDLE ${this.emailAccountId}] NOOP fallback active (every ${noopIntervalMs}ms) - listening for server mail events`);
      }

    } catch (error: any) {
      console.error(`[IDLE ${this.emailAccountId}] Failed to setup IDLE:`, error.message);
      throw error;
    }
  }

  private async triggerBackgroundSync(): Promise<void> {
    // Prevent concurrent syncs
    if (this.isSyncing) {
      console.log(`[IDLE ${this.emailAccountId}] Sync already in progress, skipping`);
      return;
    }

    this.isSyncing = true;
    
    try {
      // Stop IDLE temporarily to allow sync
      // If the underlying imap exposes done(), call it. Otherwise stop the NOOP interval so sync can run.
      if (this.connection?.imap && typeof this.connection.imap.done === 'function') {
        try {
          this.connection.imap.done();
        } catch (e: any) {
          console.warn(`[IDLE ${this.emailAccountId}] imap.done() failed:`, e?.message || e);
        }
      } else if (this.noopInterval) {
        clearInterval(this.noopInterval);
        this.noopInterval = undefined;
        console.log(`[IDLE ${this.emailAccountId}] Stopped NOOP interval for background sync`);
      }

      console.log(`[IDLE ${this.emailAccountId}] Triggering background sync with incremental sync...`);
      
      // Use the new incremental sync for better performance
      const { ImapService } = await import('./imap.service.js');
      const imapService = new ImapService({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        username: this.config.username,
        password: this.config.password,
      });

      try {
        await imapService.connect();
        // Use incremental sync instead of fastSyncNewEmails for better detection of all changes
        await imapService.incrementalSync(this.emailAccountId, this.currentFolder!);
        await imapService.disconnect();
        console.log(`[IDLE ${this.emailAccountId}] Incremental sync completed`);
      } catch (err: any) {
        console.error(`[IDLE ${this.emailAccountId}] Incremental sync failed:`, err.message);
        // If incremental sync fails, we'll rely on the next full sync
      }
      
      console.log(`[IDLE ${this.emailAccountId}] Background sync completed`);
    } catch (error: any) {
      console.error(`[IDLE ${this.emailAccountId}] Background sync failed:`, error.message);
    } finally {
      this.isSyncing = false;
      
      // Restart IDLE if still active
      if (this.isActive && this.connection && this.currentFolder) {
        if (this.connection.imap && typeof this.connection.imap.idle === 'function') {
          try {
            this.connection.imap.idle();
            console.log(`[IDLE ${this.emailAccountId}] IDLE mode restarted`);
          } catch (e: any) {
            console.warn(`[IDLE ${this.emailAccountId}] Failed to restart imap.idle():`, e?.message || e);
            // If failing to restart idle, ensure NOOP fallback is back in place
            if (!this.noopInterval) {
              const noopIntervalMs = 15_000;
              this.noopInterval = setInterval(() => {
                try {
                  if (this.connection && this.connection.imap && typeof this.connection.imap.noop === 'function') {
                    this.connection.imap.noop();
                  } else if (this.connection && typeof this.connection.noop === 'function') {
                    this.connection.noop();
                  }
                } catch (err: any) {
                  console.warn(`[IDLE ${this.emailAccountId}] NOOP failed (restart):`, err?.message || err);
                }
              }, noopIntervalMs);
              console.log(`[IDLE ${this.emailAccountId}] NOOP fallback re-activated (every ${noopIntervalMs}ms)`);
            }
          }
        } else {
          // If idle not available, ensure NOOP fallback is active
          if (!this.noopInterval) {
            const noopIntervalMs = 15_000;
            this.noopInterval = setInterval(() => {
              try {
                if (this.connection && this.connection.imap && typeof this.connection.imap.noop === 'function') {
                  this.connection.imap.noop();
                } else if (this.connection && typeof this.connection.noop === 'function') {
                  this.connection.noop();
                }
              } catch (err: any) {
                console.warn(`[IDLE ${this.emailAccountId}] NOOP failed (restart):`, err?.message || err);
              }
            }, noopIntervalMs);
            console.log(`[IDLE ${this.emailAccountId}] NOOP fallback re-activated (every ${noopIntervalMs}ms)`);
          }
        }
      }
    }
  }

  private handleDisconnect(): void {
    if (!this.isActive) {
      return; // Don't reconnect if we're stopped
    }

    this.reconnectAttempts++;
    
    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      console.error(`[IDLE ${this.emailAccountId}] Max reconnect attempts reached, stopping`);
      this.isActive = false;
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 60000); // Exponential backoff, max 60s
    console.log(`[IDLE ${this.emailAccountId}] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    this.reconnectTimeout = setTimeout(() => {
      if (this.isActive) {
        this.connect();
      }
    }, delay);
  }

  private async disconnect(): Promise<void> {
    if (this.connection) {
      try {
        console.log(`[IDLE ${this.emailAccountId}] Disconnecting...`);
        
        // Remove event listeners
        const imapEventTarget = this.connection.imap || this.connection;
        if (this.mailListener) {
          imapEventTarget.off?.('mail', this.mailListener);
          imapEventTarget.removeListener?.('mail', this.mailListener);
          this.mailListener = undefined;
        }
        if (this.uidValidityListener) {
          imapEventTarget.off?.('uidvalidity', this.uidValidityListener);
          imapEventTarget.removeListener?.('uidvalidity', this.uidValidityListener);
          this.uidValidityListener = undefined;
        }
        
        // Clear any noop interval
        if (this.noopInterval) {
          clearInterval(this.noopInterval);
          this.noopInterval = undefined;
        }

        try {
          this.connection.end();
        } catch (e: any) {
          console.warn(`[IDLE ${this.emailAccountId}] Error calling connection.end():`, e?.message || e);
        }

        this.connection = null;
        this.currentFolder = null;
      } catch (error: any) {
        console.error(`[IDLE ${this.emailAccountId}] Error during disconnect:`, error.message);
      }
    }
  }

  public getStatus(): { isActive: boolean; reconnectAttempts: number; currentFolder: string | null } {
    return {
      isActive: this.isActive,
      reconnectAttempts: this.reconnectAttempts,
      currentFolder: this.currentFolder,
    };
  }
}

// Manager for all IDLE connections
class ImapIdleManager {
  private connections = new Map<string, ImapIdleService>();

  async startForAccount(emailAccountId: string): Promise<void> {
    // Stop existing connection if any
    await this.stopForAccount(emailAccountId);

    // Get account details
    const account = await prisma.emailAccount.findUnique({
      where: { id: emailAccountId },
    });

    if (!account || !account.isActive) {
      console.log(`Account ${emailAccountId} not found or inactive, skipping IDLE`);
      return;
    }

    // Decrypt password
    const { decrypt } = await import('../utils/encryption.js');
    const password = decrypt(account.password);

    const config: ImapConfig = {
      host: account.imapHost,
      port: account.imapPort,
      secure: account.imapSecure,
      username: account.username,
      password,
    };

    const idleService = new ImapIdleService(config, emailAccountId);
    
    // Listen for new email events
    idleService.on('newEmail', async (notification: NewEmailNotification) => {
      console.log(`New email notification for account ${emailAccountId}:`, notification);
      
      // Get account details for better notification
      const account = await prisma.emailAccount.findUnique({
        where: { id: emailAccountId },
        select: { 
          userId: true, 
          displayName: true, 
          emailAddress: true 
        },
      });

      if (!account) return;

      // Enhanced notification with account info
      const enhancedNotification = {
        ...notification,
        accountName: account.displayName || account.emailAddress,
        emailAddress: account.emailAddress,
      };
      
      // Emit to socket.io
      const { io } = require('../index');
      
      console.log(`[Socket.IO] About to emit 'email:new' event`);
      console.log(`[Socket.IO] Payload:`, JSON.stringify(enhancedNotification, null, 2));
      console.log(`[Socket.IO] Target room: user:${account.userId}`);
      
      // Check how many clients are in the user room
      const userRoom = io.sockets.adapter.rooms.get(`user:${account.userId}`);
      console.log(`[Socket.IO] Clients in user:${account.userId} room:`, userRoom ? userRoom.size : 0);
      
      // Emit only to user room (not account room to avoid duplicates)
      // The client is in both user and account rooms, so emitting to user room is sufficient
      io.to(`user:${account.userId}`).emit('email:new', enhancedNotification);
      console.log(`[Socket.IO] ✅ Emitted to user:${account.userId}`);
      
      console.log(`[Socket.IO] Event emission complete`);
    });

    this.connections.set(emailAccountId, idleService);
    await idleService.start();
    
    console.log(`IDLE service started for account ${emailAccountId}`);
  }

  async stopForAccount(emailAccountId: string): Promise<void> {
    const service = this.connections.get(emailAccountId);
    if (service) {
      await service.stop();
      this.connections.delete(emailAccountId);
      console.log(`IDLE service stopped for account ${emailAccountId}`);
    }
  }

  async stopAll(): Promise<void> {
    const promises = Array.from(this.connections.keys()).map((id) =>
      this.stopForAccount(id)
    );
    await Promise.all(promises);
  }

  async restartForAccount(emailAccountId: string): Promise<void> {
    await this.stopForAccount(emailAccountId);
    await this.startForAccount(emailAccountId);
  }
}

export const imapIdleManager = new ImapIdleManager();
