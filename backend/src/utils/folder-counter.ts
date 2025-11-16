import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Utility functions for managing folder unread counts.
 * This ensures consistency and prevents negative counts or drift.
 */

/**
 * Recalculate and update the unread count for a folder by counting actual emails.
 * This is the source of truth and should be used after operations that might cause drift.
 */
export async function recalculateFolderUnreadCount(folderId: string): Promise<number> {
  const unreadCount = await prisma.email.count({
    where: {
      folderId,
      isRead: false,
    },
  });

  await prisma.folder.update({
    where: { id: folderId },
    data: { unreadCount: Math.max(0, unreadCount) }, // Ensure non-negative
  });

  return unreadCount;
}

/**
 * Recalculate and update the total count for a folder by counting actual emails.
 */
export async function recalculateFolderTotalCount(folderId: string): Promise<number> {
  const totalCount = await prisma.email.count({
    where: { folderId },
  });

  await prisma.folder.update({
    where: { id: folderId },
    data: { totalCount: Math.max(0, totalCount) },
  });

  return totalCount;
}

/**
 * Recalculate both unread and total counts for a folder.
 */
export async function recalculateFolderCounts(folderId: string): Promise<{ unreadCount: number; totalCount: number }> {
  const [unreadCount, totalCount] = await Promise.all([
    prisma.email.count({
      where: {
        folderId,
        isRead: false,
      },
    }),
    prisma.email.count({
      where: { folderId },
    }),
  ]);

  await prisma.folder.update({
    where: { id: folderId },
    data: {
      unreadCount: Math.max(0, unreadCount),
      totalCount: Math.max(0, totalCount),
    },
  });

  return { unreadCount, totalCount };
}

/**
 * Safely increment unread count (with validation to prevent negative values).
 */
export async function incrementFolderUnreadCount(folderId: string, amount: number = 1): Promise<void> {
  if (amount <= 0) return;

  await prisma.folder.update({
    where: { id: folderId },
    data: {
      unreadCount: {
        increment: amount,
      },
    },
  });
}

/**
 * Safely decrement unread count (with validation to prevent negative values).
 */
export async function decrementFolderUnreadCount(folderId: string, amount: number = 1): Promise<void> {
  if (amount <= 0) return;

  const folder = await prisma.folder.findUnique({
    where: { id: folderId },
    select: { unreadCount: true },
  });

  if (!folder) return;

  // Prevent going negative
  const newCount = Math.max(0, folder.unreadCount - amount);

  await prisma.folder.update({
    where: { id: folderId },
    data: { unreadCount: newCount },
  });
}

/**
 * Handle read status change for an email and update folder count accordingly.
 */
export async function handleEmailReadStatusChange(
  folderId: string,
  wasRead: boolean,
  isNowRead: boolean
): Promise<void> {
  if (wasRead === isNowRead) return; // No change

  if (wasRead && !isNowRead) {
    // Changed from read to unread
    await incrementFolderUnreadCount(folderId, 1);
  } else if (!wasRead && isNowRead) {
    // Changed from unread to read
    await decrementFolderUnreadCount(folderId, 1);
  }
}

/**
 * Recalculate counts for all folders of an email account.
 * Useful for account-wide sync or fixing drift issues.
 */
export async function recalculateAccountFolderCounts(emailAccountId: string): Promise<void> {
  const folders = await prisma.folder.findMany({
    where: { emailAccountId },
    select: { id: true },
  });

  await Promise.all(
    folders.map(folder => recalculateFolderCounts(folder.id))
  );
}
