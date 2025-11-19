import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import { Readable } from 'stream';
import { decrypt } from '../utils/encryption';
import prisma from '../db';

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

  /**
   * Test IMAP connection without creating a service instance
   */
  static async testConnection(config: ImapConfig): Promise<boolean> {
    let connection: any = null;
    try {
      const imapConfig = {
        imap: {
          user: config.username,
          password: config.password,
          host: config.host,
          port: config.port,
          tls: config.secure,
          authTimeout: 10000,
          tlsOptions: { rejectUnauthorized: false },
        },
      };

      connection = await imaps.connect(imapConfig);
      
      // Try to get boxes to verify connection is working
      await connection.getBoxes();
      
      connection.end();
      return true;
    } catch (error: any) {
      console.error('IMAP connection test failed:', error.message);
      if (connection) {
        try {
          connection.end();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      return false;
    }
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

      let specialUse = box.special_use_attrib || null;
      
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

  async getFolderStatus(folderPath: string): Promise<{ total: number; unread: number; uidNext: number }> {
    if (!this.connection) {
      await this.connect();
    }

    const box = await this.connection.openBox(folderPath);
    
    const searchCriteria = ['UNSEEN'];
    const fetchOptions = { bodies: [], struct: false };
    const unreadMessages = await this.connection.search(searchCriteria, fetchOptions);
    
    return {
      total: box.messages.total,
      unread: unreadMessages.length,
      uidNext: box.uidnext,
    };
  }

  async getEmailsFromFolder(
    folderPath: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ emails: any[]; total: number; hasMore: boolean }> {
    if (!this.connection) {
      await this.connect();
    }

    const box = await this.connection.openBox(folderPath);
    const total = box.messages.total;

    if (total === 0) {
      return { emails: [], total: 0, hasMore: false };
    }

    // Calculate the range of messages to fetch (newest first)
    const startIndex = Math.max(1, total - (page * limit) + 1);
    const endIndex = Math.max(1, total - ((page - 1) * limit));
    
    // Use sequence range in search criteria to fetch only the messages we need
    const searchCriteria = [`${startIndex}:${endIndex}`];
    const fetchOptions = {
      bodies: ['HEADER'],
      struct: true,
      markSeen: false,
    };

    const messages = await this.connection.search(searchCriteria, fetchOptions);
    
    // Reverse to show newest first
    const sortedMessages = messages.reverse();

    const emails = [];

    for (const item of sortedMessages) {
      // Find the header part
      const header = item.parts.find((part: any) => part.which === 'HEADER');
      const uid = item.attributes.uid;
      const flags = item.attributes.flags || [];
      const struct = item.attributes.struct || [];

      if (!header || !header.body) {
        continue;
      }

      // Parse the header properly
      let parsed;
      try {
        // The header.body is an object with individual header fields
        // We need to reconstruct the raw email header format
        let headerContent;
        
        if (Buffer.isBuffer(header.body)) {
          headerContent = header.body;
        } else if (typeof header.body === 'string') {
          headerContent = Buffer.from(header.body);
        } else if (typeof header.body === 'object') {
          // Reconstruct the raw email header from the object
          const headerLines: string[] = [];
          for (const [key, value] of Object.entries(header.body)) {
            if (Array.isArray(value)) {
              // Some headers can appear multiple times (e.g., Received)
              value.forEach(v => {
                headerLines.push(`${key}: ${v}`);
              });
            } else {
              headerLines.push(`${key}: ${value}`);
            }
          }
          headerContent = Buffer.from(headerLines.join('\r\n') + '\r\n\r\n');
        } else {
          headerContent = Buffer.from(String(header.body));
        }
        
        parsed = await simpleParser(headerContent);
      } catch (parseError) {
        console.error(`Failed to parse email ${uid} header:`, parseError);
        continue;
      }

      const hasAttachments = this.checkHasAttachments(struct);

      // Create a unique ID for the email (since we're not using DB)
      const emailId = `${this.config.username}-${folderPath}-${uid}`;

      // Helper function to format address
      const formatAddress = (addr: any) => {
        if (!addr) return [];
        if (Array.isArray(addr)) {
          return addr.map(a => ({
            name: a.name || '',
            address: a.address || ''
          }));
        }
        return [{
          name: addr.name || '',
          address: addr.address || ''
        }];
      };

      emails.push({
        id: emailId,
        emailAccountId: this.config.username, // Use email address as account ID
        folderId: folderPath,
        uid,
        messageId: parsed.messageId || `${uid}@${this.config.host}`,
        subject: parsed.subject || '(No Subject)',
        from: formatAddress(parsed.from?.value),
        to: formatAddress(parsed.to?.value),
        cc: formatAddress(parsed.cc?.value),
        bcc: formatAddress(parsed.bcc?.value),
        replyTo: formatAddress(parsed.replyTo?.value),
        date: parsed.date ? parsed.date.toISOString() : new Date().toISOString(),
        flags,
        isRead: flags.includes('\\Seen'),
        isFlagged: flags.includes('\\Flagged'),
        hasAttachments,
        size: item.attributes.size || 0,
        headers: parsed.headers ? Object.fromEntries(parsed.headers) : {},
        inReplyTo: parsed.inReplyTo || null,
        references: parsed.references 
          ? (Array.isArray(parsed.references) ? parsed.references : [parsed.references])
          : [],
        createdAt: parsed.date ? parsed.date.toISOString() : new Date().toISOString(),
        updatedAt: parsed.date ? parsed.date.toISOString() : new Date().toISOString(),
      });
    }

    const hasMore = startIndex > 1;

    return { emails, total, hasMore };
  }

  async getEmailByUid(folderPath: string, uid: number): Promise<any> {
    if (!this.connection) {
      await this.connect();
    }

    await this.connection.openBox(folderPath);

    const searchCriteria = [['UID', uid.toString()]];
    const fetchOptions = {
      bodies: [''],
      struct: true,
      markSeen: false,
    };

    const messages = await this.connection.search(searchCriteria, fetchOptions);

    if (messages.length === 0) {
      throw new Error(`Email with UID ${uid} not found`);
    }

    const message = messages[0];
    const all = message.parts.find((part: any) => part.which === '');
    const flags = message.attributes.flags || [];

    if (!all || !all.body) {
      throw new Error(`Could not fetch body for email UID ${uid}`);
    }

    const emailString = typeof all.body === 'string' ? all.body : all.body.toString();
    const stream = Readable.from(emailString);
    const parsed = await simpleParser(stream);

    return {
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
      size: message.attributes.size || 0,
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
  }

  async markAsRead(folderPath: string, uid: number, isRead: boolean): Promise<void> {
    if (!this.connection) {
      await this.connect();
    }

    await this.connection.openBox(folderPath);

    if (isRead) {
      await this.connection.addFlags(uid, '\\Seen');
    } else {
      await this.connection.delFlags(uid, '\\Seen');
    }
  }

  async markAsFlagged(folderPath: string, uid: number, isFlagged: boolean): Promise<void> {
    if (!this.connection) {
      await this.connect();
    }

    await this.connection.openBox(folderPath);
    
    if (isFlagged) {
      await this.connection.addFlags(uid, '\\Flagged');
    } else {
      await this.connection.delFlags(uid, '\\Flagged');
    }
  }

  async deleteEmail(folderPath: string, uid: number): Promise<void> {
    if (!this.connection) {
      await this.connect();
    }

    await this.connection.openBox(folderPath);
    await this.connection.addFlags(uid, '\\Deleted');
    
    // Access the underlying node-imap connection to expunge
    return new Promise((resolve, reject) => {
      this.connection.imap.expunge((err: any) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async moveEmail(sourcePath: string, targetPath: string, uid: number): Promise<void> {
    if (!this.connection) {
      await this.connect();
    }

    await this.connection.openBox(sourcePath);
    await this.connection.moveMessage(uid, targetPath);
  }

  async createFolder(folderPath: string): Promise<void> {
    if (!this.connection) {
      await this.connect();
    }

    await this.connection.addBox(folderPath);
  }

  async deleteFolder(folderPath: string): Promise<void> {
    if (!this.connection) {
      await this.connect();
    }

    await this.connection.delBox(folderPath);
  }

  async renameFolder(oldPath: string, newPath: string): Promise<void> {
    if (!this.connection) {
      await this.connect();
    }

    await this.connection.renameBox(oldPath, newPath);
  }

  private checkHasAttachments(struct: any[]): boolean {
    if (!struct || !Array.isArray(struct)) return false;
    
    for (const part of struct) {
      if (part.disposition?.type === 'attachment' || part.disposition?.type === 'inline') {
        return true;
      }
      if (part.subtype === 'MIXED' || part.subtype === 'RELATED' || part.subtype === 'ALTERNATIVE') {
        if (part[0] && Array.isArray(part[0]) && this.checkHasAttachments(part[0])) {
          return true;
        }
      }
    }
    return false;
  }

  async appendEmail(folderPath: string, message: string, flags: string[] = []): Promise<void> {
    if (!this.connection) {
      await this.connect();
    }

    return new Promise((resolve, reject) => {
      this.connection.imap.append(message, {
        mailbox: folderPath,
        flags: flags,
      }, (err: any) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}

export async function createImapService(accountId: string): Promise<ImapService> {
   const account = await prisma.emailAccount.findUnique({
    where: { id: accountId },
  });

  if (!account || !account.isActive) {
    throw new Error('Email account not found or inactive');
  }

  const config: ImapConfig = {
    host: account.imapHost,
    port: account.imapPort,
    secure: account.imapSecure,
    username: account.username,
    password: decrypt(account.password),
  };

  return new ImapService(config);
}
