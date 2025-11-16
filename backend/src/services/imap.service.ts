import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import { Readable } from 'stream';
import prisma from '../db';
import { decrypt } from '../utils/encryption';
import { io } from '../index';
import {
  recalculateFolderCounts,
  incrementFolderUnreadCount,
  handleEmailReadStatusChange,
} from '../utils/folder-counter';

export interface ImapConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
}

export class ImapService {
  private config: ImapConfig;
  private connection: any = null;

  constructor(config: ImapConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    const config = {
      imap: {
        user: this.config.username,
        password: this.config.password,
        host: this.config.host,
        port: this.config.port,
        tls: this.config.secure,
        authTimeout: 10000,
        tlsOptions: { rejectUnauthorized: false },
      },
    };

    this.connection = await imaps.connect(config);
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      this.connection.end();
      this.connection = null;
    }
  }

  async getFolders(): Promise<any[]> {
    if (!this.connection) {
      await this.connect();
    }

    const boxes = await this.connection.getBoxes();
    return this.parseBoxes(boxes);
  }

  private parseBoxes(boxes: any, prefix: string = ''): any[] {
    const folders: any[] = [];

    for (const name in boxes) {
      const box = boxes[name];
      const path = prefix ? `${prefix}${box.delimiter}${name}` : name;

      // Determine special use - either from IMAP attribute or by common folder names
      let specialUse = box.special_use_attrib || null;
      
      // If no special_use_attrib, try to detect by common folder names/paths
      if (!specialUse) {
        const upperPath = path.toUpperCase();
        const upperName = name.toUpperCase();
        
        if (upperPath === 'INBOX' || upperName === 'INBOX') {
          specialUse = 'INBOX';
        } else if (upperName === 'SENT' || upperName === 'SENT ITEMS' || upperPath.includes('SENT')) {
          specialUse = '\\Sent';
        } else if (upperName === 'DRAFTS' || upperPath.includes('DRAFT')) {
          specialUse = '\\Drafts';
        } else if (upperName === 'TRASH' || upperName === 'DELETED' || upperPath.includes('TRASH')) {
          specialUse = '\\Trash';
        } else if (upperName === 'JUNK' || upperName === 'SPAM' || upperPath.includes('JUNK') || upperPath.includes('SPAM')) {
          specialUse = '\\Junk';
        } else if (upperName === 'ARCHIVE' || upperPath.includes('ARCHIVE')) {
          specialUse = '\\Archive';
        }
      }

      const folder = {
        name,
        path,
        delimiter: box.delimiter,
        specialUse,
      };

      folders.push(folder);

      if (box.children) {
        folders.push(...this.parseBoxes(box.children, path));
      }
    }

    return folders;
  }

  async syncFolders(emailAccountId: string): Promise<void> {
    const folders = await this.getFolders();

    for (const folder of folders) {
      await prisma.folder.upsert({
        where: {
          emailAccountId_path: {
            emailAccountId,
            path: folder.path,
          },
        },
        update: {
          name: folder.name,
          delimiter: folder.delimiter,
          specialUse: folder.specialUse,
        },
        create: {
          emailAccountId,
          name: folder.name,
          path: folder.path,
          delimiter: folder.delimiter,
          specialUse: folder.specialUse,
        },
      });
    }
  }

  async getEmailsFromFolder(folderPath: string, limit: number = 50, sinceUid?: number): Promise<any[]> {
    if (!this.connection) {
      await this.connect();
    }

    await this.connection.openBox(folderPath);

    // Search for all messages
    const searchCriteria = ['ALL'];
    const fetchOptions = {
      bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)', 'TEXT', ''],
      markSeen: false,
      struct: true,
    };

    const messages = await this.connection.search(searchCriteria, fetchOptions);

    // Filter by UID if sinceUid is provided
    let filteredMessages = messages;
    if (sinceUid) {
      filteredMessages = messages.filter((msg: any) => msg.attributes.uid > sinceUid);
    }

    // If no sinceUid provided, get the last 'limit' messages
    // If sinceUid provided, get all new messages (already filtered)
    const limitedMessages = sinceUid ? filteredMessages : filteredMessages.slice(-limit);

    const emails = [];

    for (const item of limitedMessages) {
      // Try to get the full message body first (part with which === '')
      const all = item.parts.find((part: any) => part.which === '');
      const text = item.parts.find((part: any) => part.which === 'TEXT');
      const header = item.parts.find((part: any) => part.which === 'HEADER.FIELDS (FROM TO SUBJECT DATE)');

      const uid = item.attributes.uid;
      const flags = item.attributes.flags || [];

      // Get email body - prefer full message, fallback to TEXT + HEADER
      let emailBody: string | Buffer;
      if (all && all.body) {
        emailBody = all.body;
      } else if (text && text.body) {
        // Combine header and text if we don't have the full message
        const headerBody = header?.body || '';
        const textBody = text.body || '';
        emailBody = headerBody + '\r\n\r\n' + textBody;
      } else {
        continue;
      }

      // Convert to string if it's a Buffer, then to stream
      const emailString = typeof emailBody === 'string' ? emailBody : emailBody.toString();
      const stream = Readable.from(emailString);
      
      // Parse the email
      const parsed = await simpleParser(stream);

      const email = {
        uid,
        messageId: parsed.messageId || `${uid}@${this.config.host}`,
        subject: parsed.subject || '(No Subject)',
        from: parsed.from ? parsed.from.value : [],
        to: parsed.to ? parsed.to.value : [],
        cc: parsed.cc ? parsed.cc.value : [],
        bcc: parsed.bcc ? parsed.bcc.value : [],
        replyTo: parsed.replyTo ? parsed.replyTo.value : [],
        date: parsed.date || new Date(),
        flags,
        isRead: flags.includes('\\Seen'),
        isFlagged: flags.includes('\\Flagged'),
        hasAttachments: (parsed.attachments && parsed.attachments.length > 0) || false,
        size: item.attributes.size || 0,
        textBody: parsed.text || '',
        htmlBody: parsed.html || '',
        headers: parsed.headers ? Object.fromEntries(parsed.headers) : {},
        attachments: parsed.attachments
          ? parsed.attachments.map((att: any) => ({
              filename: att.filename,
              contentType: att.contentType,
              size: att.size,
              content: att.content ? att.content.toString('base64') : null,
            }))
          : [],
        inReplyTo: parsed.inReplyTo || null,
        references: parsed.references 
          ? (Array.isArray(parsed.references) ? parsed.references : [parsed.references])
          : [],
      };

      emails.push(email);
    }

    return emails;
  }

  /**
   * Fast sync: Only fetch the newest emails by UID range
   * Used when IDLE detects new mail to quickly fetch just those emails
   */
  async fastSyncNewEmails(emailAccountId: string, folderPath: string, count: number = 10): Promise<void> {
    const folder = await prisma.folder.findFirst({
      where: {
        emailAccountId,
        path: folderPath,
      },
    });

    if (!folder) {
      console.error(`Folder not found: ${folderPath}`);
      return;
    }

    try {
      // Open the folder to get current status
      const box = await this.connection.openBox(folderPath);
      const currentTotal = box.messages.total;
      const uidNext = box.uidnext; // Next UID that will be assigned
      
      console.log(`[FastSync] Folder ${folderPath} - Total: ${currentTotal}, UIDNext: ${uidNext}, LastSyncedUID: ${folder.lastSyncedUid}`);
      
      // Calculate the UID range for new emails
      // We want emails with UID greater than lastSyncedUid
      const startUid = (folder.lastSyncedUid || 0) + 1;
      
      // Check if there are potentially new messages
      // If startUid >= uidNext, there are no new messages
      if (startUid >= uidNext) {
        console.log(`[FastSync] No new emails in ${folderPath} (startUid ${startUid} >= uidNext ${uidNext})`);
        return;
      }
      
      // If there are no messages at all, skip
      if (currentTotal === 0) {
        console.log(`[FastSync] No messages in ${folderPath}`);
        return;
      }

      console.log(`[FastSync] Fetching new emails in ${folderPath} from UID ${startUid}:*`);
      
      // Fetch only the new emails by UID
      const searchCriteria = [['UID', `${startUid}:*`]];
      const fetchOptions = {
        bodies: [''],
        struct: true,
        markSeen: false,
      };

      const messages = await this.connection.search(searchCriteria, fetchOptions);
      console.log(`[FastSync] Found ${messages.length} new email(s)`);

      let maxUid = folder.lastSyncedUid || 0;

      for (const message of messages) {
        const all = message.parts.find((part: any) => part.which === '');
        const uid = message.attributes.uid;
        const id = message.attributes['x-gm-msgid'] || message.attributes.uid;

        if (uid > maxUid) {
          maxUid = uid;
        }

        // Parse email
        const parsed = await simpleParser(all.body);

        const messageId = parsed.messageId || `${id}@local`;
        const flags = message.attributes.flags || [];
        const isRead = flags.includes('\\Seen');
        const isFlagged = flags.includes('\\Flagged');

        // Check if already exists
        const existingEmail = await prisma.email.findUnique({
          where: {
            emailAccountId_messageId: {
              emailAccountId,
              messageId,
            },
          },
        });

        if (existingEmail) {
          console.log(`[FastSync] Email ${messageId} already exists, skipping`);
          continue;
        }

        // Create new email
        await prisma.email.create({
          data: {
            emailAccountId,
            folderId: folder.id,
            messageId,
            uid,
            subject: parsed.subject || '(No subject)',
            from: parsed.from?.value || [],
            to: parsed.to?.value || [],
            cc: parsed.cc?.value || [],
            bcc: parsed.bcc?.value || [],
            replyTo: parsed.replyTo?.value || [],
            date: parsed.date || new Date(),
            receivedDate: new Date(),
            flags,
            isRead,
            isFlagged,
            hasAttachments: (parsed.attachments?.length || 0) > 0,
            size: Buffer.byteLength(all.body),
            textBody: parsed.text || '',
            htmlBody: parsed.html || '',
            headers: parsed.headers ? JSON.parse(JSON.stringify(Object.fromEntries(parsed.headers))) : {},
            attachments: parsed.attachments
              ? parsed.attachments.map((att: any) => ({
                  filename: att.filename,
                  contentType: att.contentType,
                  size: att.size,
                  content: att.content ? att.content.toString('base64') : null,
                }))
              : [],
            inReplyTo: parsed.inReplyTo || null,
            references: parsed.references 
              ? (Array.isArray(parsed.references) ? parsed.references : [parsed.references])
              : [],
          },
        });

        console.log(`[FastSync] ✅ Created email: ${messageId}`);

        // Increment unread count if email is unread
        if (!isRead) {
          await incrementFolderUnreadCount(folder.id, 1);
        }
      }

      // Update folder stats
      await prisma.folder.update({
        where: { id: folder.id },
        data: {
          totalCount: currentTotal,
          lastSyncedUid: maxUid,
        },
      });

      // Recalculate unread count to ensure accuracy after fast sync
      await recalculateFolderCounts(folder.id);

      console.log(`[FastSync] ✅ Completed for ${folderPath}, updated lastSyncedUid to ${maxUid}`);
    } catch (error: any) {
      console.error(`[FastSync] Error syncing ${folderPath}:`, error.message);
      throw error;
    }
  }

  async syncEmails(emailAccountId: string, folderPath: string): Promise<void> {
    try {
      console.log(`[SyncEmails] Starting sync for folder ${folderPath}`);
      
      // Use the new incremental sync method for better performance
      await this.incrementalSync(emailAccountId, folderPath);

      console.log(`[SyncEmails] ✅ Folder ${folderPath} synced successfully`);
    } catch (error: any) {
      // Check if folder doesn't exist on server (deleted by another client)
      if (error?.message?.includes("Mailbox doesn't exist") || 
          error?.message?.includes("Mailbox does not exist")) {
        console.log(`Folder ${folderPath} no longer exists on server, removing from database`);
        
        // Find the folder to delete
        const folderToDelete = await prisma.folder.findFirst({
          where: { emailAccountId, path: folderPath }
        });

        if (folderToDelete) {
          // Delete all emails in this folder
          await prisma.email.deleteMany({
            where: { folderId: folderToDelete.id },
          });
          
          // Delete the folder
          await prisma.folder.delete({
            where: { id: folderToDelete.id },
          });
        }
        
        console.log(`Deleted folder ${folderPath} from database`);
        return; // Don't throw error, just skip this folder
      }
      
      // For other errors, rethrow
      throw error;
    }
  }

  async markAsRead(emailAccountId: string, messageId: string, isRead: boolean): Promise<void> {
    await prisma.email.update({
      where: {
        emailAccountId_messageId: {
          emailAccountId,
          messageId,
        },
      },
      data: { isRead },
    });
  }

  async markAsReadOnServer(folderPath: string, uid: number, isRead: boolean): Promise<void> {
    if (!this.connection) {
      await this.connect();
    }

    await this.connection.openBox(folderPath);

    // Search for the message by UID
    const searchCriteria = ['ALL'];
    const fetchOptions = { bodies: [] };
    const messages = await this.connection.search(searchCriteria, fetchOptions);
    
    // Find the message with matching UID
    const message = messages.find((msg: any) => msg.attributes.uid === uid);
    
    if (message) {
      // Add or remove the \Seen flag
      if (isRead) {
        await this.connection.addFlags(message.attributes.uid, '\\Seen');
      } else {
        await this.connection.delFlags(message.attributes.uid, '\\Seen');
      }
    }
  }

  async markAsFlagged(emailAccountId: string, messageId: string, isFlagged: boolean): Promise<void> {
    await prisma.email.update({
      where: {
        emailAccountId_messageId: {
          emailAccountId,
          messageId,
        },
      },
      data: { isFlagged },
    });
  }

  static async testConnection(config: ImapConfig): Promise<boolean> {
    const service = new ImapService(config);
    try {
      await service.connect();
      await service.disconnect();
      return true;
    } catch (error) {
      console.error('IMAP connection test failed:', error);
      return false;
    }
  }

  async createFolder(folderPath: string): Promise<void> {
    if (!this.connection) {
      await this.connect();
    }

    await this.connection.addBox(folderPath);
  }

  async renameFolder(oldPath: string, newPath: string): Promise<void> {
    if (!this.connection) {
      await this.connect();
    }

    await this.connection.renameBox(oldPath, newPath);
  }

  async deleteFolder(folderPath: string): Promise<void> {
    if (!this.connection) {
      await this.connect();
    }

    await this.connection.delBox(folderPath);
  }

  async appendToFolder(folderPath: string, message: string, flags: string[] = []): Promise<void> {
    if (!this.connection) {
      await this.connect();
    }

    await this.connection.append(message, {
      mailbox: folderPath,
      flags: flags,
    });
  }

  async ensureFolderExists(folderPath: string): Promise<boolean> {
    if (!this.connection) {
      await this.connect();
    }

    try {
      await this.connection.openBox(folderPath);
      return true;
    } catch (error) {
      // Folder doesn't exist, try to create it
      try {
        await this.connection.addBox(folderPath);
        return true;
      } catch (createError) {
        console.error(`Failed to create folder ${folderPath}:`, createError);
        return false;
      }
    }
  }

  /**
   * Smart incremental sync - only syncs what changed
   * This is the main entry point for optimized syncing
   */
  async incrementalSync(emailAccountId: string, folderPath: string): Promise<void> {
    const folder = await prisma.folder.findFirst({
      where: { emailAccountId, path: folderPath }
    });

    if (!this.connection) {
      await this.connect();
    }

    const box = await this.connection.openBox(folderPath);

    if (!folder) {
      // First sync - use pagination
      console.log(`[IncrementalSync] First sync for ${folderPath}, using paginated sync`);
      return this.paginatedSync(emailAccountId, folderPath);
    }

    const lastUid = folder.lastSyncedUid || 0;
    const uidNext = box.uidnext;
    const currentTotal = box.messages.total;

    console.log(`[IncrementalSync] ${folderPath} - LastUID: ${lastUid}, UIDNext: ${uidNext}, Total: ${currentTotal}`);

    // 1. Sync new emails (UID > lastSyncedUid)
    if (uidNext > lastUid + 1) {
      const newCount = uidNext - lastUid - 1;
      console.log(`[IncrementalSync] Syncing ${newCount} new emails`);
      await this.syncNewEmails(emailAccountId, folderPath, lastUid + 1, uidNext - 1);
    }

    // 2. Check for flag updates on existing emails (only if we have emails)
    if (lastUid > 0) {
      console.log(`[IncrementalSync] Checking flag updates for existing emails`);
      await this.syncFlagUpdates(emailAccountId, folderPath, lastUid);
    }

    // 3. Check for deleted emails
    console.log(`[IncrementalSync] Checking for deleted emails`);
    await this.syncDeletedEmails(emailAccountId, folderPath);

    // Update folder stats
    await prisma.folder.update({
      where: { id: folder.id },
      data: {
        totalCount: currentTotal,
        lastSyncedUid: Math.max(lastUid, uidNext - 1),
      },
    });

    console.log(`[IncrementalSync] ✅ Completed for ${folderPath}`);
  }

  /**
   * Paginated sync for initial sync of large mailboxes
   */
  async paginatedSync(
    emailAccountId: string, 
    folderPath: string, 
    pageSize: number = 100
  ): Promise<void> {
    if (!this.connection) {
      await this.connect();
    }

    const box = await this.connection.openBox(folderPath);
    const total = box.messages.total;
    
    if (total === 0) {
      console.log(`[PaginatedSync] ${folderPath} is empty`);
      return;
    }

    const folder = await prisma.folder.findFirst({
      where: { emailAccountId, path: folderPath }
    });

    if (!folder) {
      throw new Error(`Folder ${folderPath} not found in database`);
    }
    
    console.log(`[PaginatedSync] Starting paginated sync for ${total} messages in ${folderPath}`);

    let processed = 0;
    const batchSize = pageSize;
    let maxUid = 0;

    // Sync in reverse order (newest first) so users see recent emails faster
    for (let start = total; start > 0; start -= batchSize) {
      const end = Math.max(1, start - batchSize + 1);
      const range = `${end}:${start}`;

      console.log(`[PaginatedSync] Fetching messages ${range} (${processed}/${total} processed)`);

      const searchCriteria = [['UID', `${range}`]];
      const fetchOptions = {
        bodies: [''],
        struct: true,
        markSeen: false,
      };

      try {
        const messages = await this.connection.search(searchCriteria, fetchOptions);
        
        const emails = [];
        for (const message of messages) {
          const all = message.parts.find((part: any) => part.which === '');
          const uid = message.attributes.uid;
          
          if (uid > maxUid) {
            maxUid = uid;
          }

          const parsed = await simpleParser(all.body);
          const flags = message.attributes.flags || [];

          emails.push({
            uid,
            messageId: parsed.messageId || `${uid}@${this.config.host}`,
            subject: parsed.subject || '(No subject)',
            from: parsed.from?.value || [],
            to: parsed.to?.value || [],
            cc: parsed.cc?.value || [],
            bcc: parsed.bcc?.value || [],
            replyTo: parsed.replyTo?.value || [],
            date: parsed.date || new Date(),
            flags,
            isRead: flags.includes('\\Seen'),
            isFlagged: flags.includes('\\Flagged'),
            hasAttachments: (parsed.attachments?.length || 0) > 0,
            size: Buffer.byteLength(all.body),
            textBody: parsed.text || '',
            htmlBody: parsed.html || '',
            headers: parsed.headers ? JSON.parse(JSON.stringify(Object.fromEntries(parsed.headers))) : {},
            attachments: parsed.attachments
              ? parsed.attachments.map((att: any) => ({
                  filename: att.filename,
                  contentType: att.contentType,
                  size: att.size,
                  content: att.content ? att.content.toString('base64') : null,
                }))
              : [],
            inReplyTo: parsed.inReplyTo || null,
            references: parsed.references 
              ? (Array.isArray(parsed.references) ? parsed.references : [parsed.references])
              : [],
          });
        }

        // Batch upsert emails
        await this.batchUpsertEmails(emailAccountId, folder.id, emails);

        processed += emails.length;
        const progress = processed / total;
        console.log(`[PaginatedSync] Progress: ${processed}/${total} (${Math.round(progress * 100)}%)`);

        // Emit progress to frontend
        this.emitSyncProgress(emailAccountId, {
          status: 'syncing',
          progress,
          message: `Synced ${processed} of ${total} emails`,
          folder: folderPath,
        });

      } catch (error: any) {
        console.error(`[PaginatedSync] Error fetching range ${range}:`, error.message);
        // Continue with next batch
      }
    }

    // Update folder stats
    await prisma.folder.update({
      where: { id: folder.id },
      data: {
        lastSyncedUid: maxUid,
      },
    });

    // Recalculate counts
    await recalculateFolderCounts(folder.id);

    console.log(`[PaginatedSync] ✅ Completed for ${folderPath} (${processed} emails processed)`);
  }

  /**
   * Sync only new emails in a UID range
   */
  private async syncNewEmails(
    emailAccountId: string, 
    folderPath: string, 
    startUid: number, 
    endUid: number
  ): Promise<void> {
    const folder = await prisma.folder.findFirst({
      where: { emailAccountId, path: folderPath }
    });

    if (!folder) return;

    const range = `${startUid}:${endUid}`;
    console.log(`[SyncNewEmails] Fetching UIDs ${range}`);

    const searchCriteria = [['UID', range]];
    const fetchOptions = {
      bodies: [''],
      struct: true,
      markSeen: false,
    };

    const messages = await this.connection.search(searchCriteria, fetchOptions);
    
    const emails = [];
    for (const message of messages) {
      const all = message.parts.find((part: any) => part.which === '');
      const uid = message.attributes.uid;
      
      const parsed = await simpleParser(all.body);
      const flags = message.attributes.flags || [];

      emails.push({
        uid,
        messageId: parsed.messageId || `${uid}@${this.config.host}`,
        subject: parsed.subject || '(No subject)',
        from: parsed.from?.value || [],
        to: parsed.to?.value || [],
        cc: parsed.cc?.value || [],
        bcc: parsed.bcc?.value || [],
        replyTo: parsed.replyTo?.value || [],
        date: parsed.date || new Date(),
        flags,
        isRead: flags.includes('\\Seen'),
        isFlagged: flags.includes('\\Flagged'),
        hasAttachments: (parsed.attachments?.length || 0) > 0,
        size: Buffer.byteLength(all.body),
        textBody: parsed.text || '',
        htmlBody: parsed.html || '',
        headers: parsed.headers ? JSON.parse(JSON.stringify(Object.fromEntries(parsed.headers))) : {},
        attachments: parsed.attachments
          ? parsed.attachments.map((att: any) => ({
              filename: att.filename,
              contentType: att.contentType,
              size: att.size,
              content: att.content ? att.content.toString('base64') : null,
            }))
          : [],
        inReplyTo: parsed.inReplyTo || null,
        references: parsed.references 
          ? (Array.isArray(parsed.references) ? parsed.references : [parsed.references])
          : [],
      });
    }

    await this.batchUpsertEmails(emailAccountId, folder.id, emails);
    console.log(`[SyncNewEmails] ✅ Synced ${emails.length} new emails`);
  }

  /**
   * Batch insert/update emails efficiently
   */
  private async batchUpsertEmails(
    emailAccountId: string, 
    folderId: string,
    emails: any[]
  ): Promise<void> {
    if (emails.length === 0) return;

    // Get existing message IDs in one query
    const existingEmails = await prisma.email.findMany({
      where: {
        folderId,
        messageId: { in: emails.map(e => e.messageId) }
      },
      select: { messageId: true, isRead: true, id: true }
    });

    const existingMap = new Map(existingEmails.map(e => [e.messageId, e]));
    const newEmails = emails.filter(e => !existingMap.has(e.messageId));

    // Batch insert new emails
    if (newEmails.length > 0) {
      console.log(`[BatchUpsert] Inserting ${newEmails.length} new emails`);
      
      for (const email of newEmails) {
        try {
          await prisma.email.create({
            data: {
              uid: email.uid,
              folderId,
              emailAccountId,
              messageId: email.messageId,
              subject: email.subject,
              from: email.from,
              to: email.to,
              cc: email.cc,
              bcc: email.bcc,
              replyTo: email.replyTo,
              date: email.date,
              receivedDate: new Date(),
              textBody: email.textBody,
              htmlBody: email.htmlBody,
              flags: email.flags,
              isRead: email.isRead,
              isFlagged: email.isFlagged,
              hasAttachments: email.hasAttachments,
              size: email.size,
              headers: email.headers,
              attachments: email.attachments,
              inReplyTo: email.inReplyTo,
              references: email.references,
            },
          });

          // Increment unread count if email is unread
          if (!email.isRead) {
            await incrementFolderUnreadCount(folderId, 1);
          }
        } catch (error: any) {
          // Skip duplicates (might happen with race conditions)
          if (!error.message?.includes('Unique constraint')) {
            console.error(`[BatchUpsert] Error inserting email ${email.messageId}:`, error.message);
          }
        }
      }
    }

    // Update flags for existing emails
    const existingEmailsToUpdate = emails.filter(e => existingMap.has(e.messageId));
    if (existingEmailsToUpdate.length > 0) {
      console.log(`[BatchUpsert] Updating ${existingEmailsToUpdate.length} existing emails`);
      
      for (const email of existingEmailsToUpdate) {
        const existing = existingMap.get(email.messageId);
        if (!existing) continue;

        const wasRead = existing.isRead;
        const isNowRead = email.isRead;

        await prisma.email.update({
          where: { id: existing.id },
          data: {
            flags: email.flags,
            isRead: email.isRead,
            isFlagged: email.isFlagged,
          }
        });

        // Adjust folder unread count if read status changed
        await handleEmailReadStatusChange(folderId, wasRead, isNowRead);
      }
    }
  }

  /**
   * Sync flag updates for existing emails (faster than full fetch)
   */
  private async syncFlagUpdates(
    emailAccountId: string, 
    folderPath: string, 
    lastUid: number
  ): Promise<void> {
    if (lastUid === 0) return;

    const folder = await prisma.folder.findFirst({
      where: { emailAccountId, path: folderPath }
    });

    if (!folder) return;

    try {
      // Fetch only UIDs and flags (much faster than full fetch)
      const searchCriteria = [['UID', `1:${lastUid}`]];
      const fetchOptions = {
        bodies: [],
        struct: false,
        markSeen: false,
      };

      const messages = await this.connection.search(searchCriteria, fetchOptions);

      const flagUpdates = messages.map((msg: any) => ({
        uid: msg.attributes.uid,
        flags: msg.attributes.flags || [],
      }));

      console.log(`[SyncFlags] Checking ${flagUpdates.length} emails for flag updates`);

      // Get all emails with these UIDs
      const emails = await prisma.email.findMany({
        where: {
          folderId: folder.id,
          uid: { in: flagUpdates.map((u: { uid: number; flags: string[] }) => u.uid) }
        },
        select: { id: true, uid: true, flags: true, isRead: true }
      });

      const emailMap = new Map(emails.map(e => [e.uid, e]));

      // Update changed flags
      let updatedCount = 0;
      for (const update of flagUpdates) {
        const email = emailMap.get(update.uid);
        if (!email) continue;

        // Check if flags actually changed
        const currentFlags = new Set(email.flags);
        const newFlags = new Set(update.flags);
        const flagsChanged = currentFlags.size !== newFlags.size || 
                           ![...currentFlags].every(f => newFlags.has(f));

        if (flagsChanged) {
          const wasRead = email.isRead;
          const isNowRead = update.flags.includes('\\Seen');

          await prisma.email.update({
            where: { id: email.id },
            data: {
              flags: update.flags,
              isRead: isNowRead,
              isFlagged: update.flags.includes('\\Flagged'),
            }
          });

          // Adjust folder unread count if read status changed
          await handleEmailReadStatusChange(folder.id, wasRead, isNowRead);
          updatedCount++;
        }
      }

      if (updatedCount > 0) {
        console.log(`[SyncFlags] ✅ Updated ${updatedCount} emails with flag changes`);
      }

    } catch (error: any) {
      console.error(`[SyncFlags] Error:`, error.message);
    }
  }

  /**
   * Detect and remove deleted emails
   */
  private async syncDeletedEmails(emailAccountId: string, folderPath: string): Promise<void> {
    const folder = await prisma.folder.findFirst({
      where: { emailAccountId, path: folderPath }
    });

    if (!folder) return;

    try {
      // Get all UIDs from server
      const searchCriteria = ['ALL'];
      const fetchOptions = {
        bodies: [],
        struct: false,
        markSeen: false,
      };

      const messages = await this.connection.search(searchCriteria, fetchOptions);
      const serverUids = new Set<number>(messages.map((m: any) => m.attributes.uid));

      // Get all UIDs from database
      const dbEmails = await prisma.email.findMany({
        where: { folderId: folder.id },
        select: { id: true, uid: true }
      });

      // Find emails that are in DB but not on server (deleted)
      const deletedEmailIds = dbEmails
        .filter(email => !serverUids.has(email.uid))
        .map(email => email.id);

      if (deletedEmailIds.length > 0) {
        console.log(`[SyncDeleted] Removing ${deletedEmailIds.length} deleted emails`);
        await prisma.email.deleteMany({
          where: { id: { in: deletedEmailIds } }
        });
        
        // Recalculate folder counts after deletion
        await recalculateFolderCounts(folder.id);
      }

    } catch (error: any) {
      console.error(`[SyncDeleted] Error:`, error.message);
    }
  }

  /**
   * Emit sync progress via Socket.IO
   */
  private emitSyncProgress(emailAccountId: string, progress: any): void {
    try {
      const account = prisma.emailAccount.findUnique({
        where: { id: emailAccountId },
        select: { userId: true }
      });

      account.then(acc => {
        if (acc) {
          io.to(`user:${acc.userId}`).emit('sync:progress', {
            accountId: emailAccountId,
            ...progress
          });
        }
      });
    } catch (error) {
      // Don't fail sync if socket emit fails
    }
  }
}

export async function syncEmailAccount(emailAccountId: string): Promise<void> {
  const account = await prisma.emailAccount.findUnique({
    where: { id: emailAccountId },
    include: { user: true },
  });

  if (!account || !account.isActive) {
    return;
  }

  // Emit sync start event
  io.to(`user:${account.userId}`).emit('sync:progress', {
    accountId: emailAccountId,
    status: 'syncing',
  });

  const config: ImapConfig = {
    host: account.imapHost,
    port: account.imapPort,
    secure: account.imapSecure,
    username: account.username,
    password: decrypt(account.password),
  };

  const service = new ImapService(config);

  try {
    await service.connect();
    await service.syncFolders(emailAccountId);

    const folders = await prisma.folder.findMany({
      where: { emailAccountId },
    });

    for (const folder of folders) {
      await service.syncEmails(emailAccountId, folder.path);
    }

    await prisma.emailAccount.update({
      where: { id: emailAccountId },
      data: { lastSyncAt: new Date() },
    });

    // Emit sync complete event
    io.to(`user:${account.userId}`).emit('sync:progress', {
      accountId: emailAccountId,
      status: 'completed',
    });
  } catch (error) {
    console.error(`Error syncing account ${emailAccountId}:`, error);
    
    // Emit sync error event
    io.to(`user:${account.userId}`).emit('sync:progress', {
      accountId: emailAccountId,
      status: 'error',
      error: error instanceof Error ? error.message : 'Sync failed',
    });
    
    throw error;
  } finally {
    await service.disconnect();
  }
}
