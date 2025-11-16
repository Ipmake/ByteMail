import { ImapService } from './imap.service';
import prisma from '../db';
import { decrypt } from '../utils/encryption';

class SyncManager {
  private activeSyncs: Set<string> = new Set();
  private syncQueue: Array<{ accountId: string; resolve: (value: void | PromiseLike<void>) => void }> = [];
  private maxConcurrentSyncs = 2; // Limit concurrent syncs

  async syncAccount(accountId: string): Promise<void> {
    // If already syncing, skip
    if (this.activeSyncs.has(accountId)) {
      console.log(`Account ${accountId} is already syncing, skipping...`);
      return;
    }

    // Wait if too many syncs are active
    while (this.activeSyncs.size >= this.maxConcurrentSyncs) {
      await new Promise<void>(resolve => {
        this.syncQueue.push({ accountId, resolve });
      });
    }

    this.activeSyncs.add(accountId);

    try {
      await this.performSync(accountId);
    } finally {
      this.activeSyncs.delete(accountId);
      
      // Process next in queue
      if (this.syncQueue.length > 0) {
        const next = this.syncQueue.shift();
        if (next) {
          next.resolve();
        }
      }
    }
  }

  private async performSync(accountId: string): Promise<void> {
    try {
      const account = await prisma.emailAccount.findUnique({
        where: { id: accountId },
      });

      if (!account) {
        console.error(`Account ${accountId} not found`);
        return;
      }

      console.log(`Starting sync for account ${accountId}`);

      const imapConfig = {
        host: account.imapHost,
        port: account.imapPort,
        secure: account.imapSecure,
        username: account.username,
        password: decrypt(account.password),
      };

      const imapService = new ImapService(imapConfig);
      
      try {
        await imapService.connect();
        
        // Sync folders first
        await imapService.syncFolders(accountId);
        
        // Get all folders and sync each one sequentially
        const folders = await prisma.folder.findMany({
          where: { emailAccountId: accountId },
          orderBy: { name: 'asc' },
        });

        console.log(`Syncing ${folders.length} folders for account ${accountId}`);

        for (const folder of folders) {
          try {
            console.log(`Syncing folder ${folder.name} (${folder.path})`);
            await imapService.syncEmails(accountId, folder.path);
          } catch (folderError) {
            console.error(`Error syncing folder ${folder.path}:`, folderError);
            // Continue with next folder
          }
        }
        
        await imapService.disconnect();

        // Update last sync time
        await prisma.emailAccount.update({
          where: { id: accountId },
          data: { lastSyncAt: new Date() },
        });

        console.log(`Sync completed for account ${accountId}`);
      } catch (error) {
        console.error(`Error syncing account ${accountId}:`, error);
        // Ensure connection is closed
        try {
          await imapService.disconnect();
        } catch (e) {
          // Ignore disconnect errors
        }
        throw error;
      }
    } catch (error) {
      console.error(`Failed to sync account ${accountId}:`, error);
      throw error;
    }
  }

  isAccountSyncing(accountId: string): boolean {
    return this.activeSyncs.has(accountId);
  }

  getActiveSyncCount(): number {
    return this.activeSyncs.size;
  }
}

// Export singleton instance
export const syncManager = new SyncManager();
