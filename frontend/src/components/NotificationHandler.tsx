import { useEffect, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';
import { 
  areNotificationsEnabled,
  showNewEmailNotification,
  playNotificationSound,
} from '../utils/notifications';

interface NotificationHandlerProps {
  onNewEmail?: (data: {
    emailAccountId: string;
    folderPath: string;
    count: number;
    accountName?: string;
    emailAddress?: string;
  }) => void;
}

// Global flag to ensure only one instance ever registers listeners
let globalListenerRegistered = false;
let globalUserId: string | null = null;

/**
 * NotificationHandler - A component that mounts once and never re-renders
 * to handle Socket.IO event listeners for notifications.
 */
export const NotificationHandler: React.FC<NotificationHandlerProps> = ({ onNewEmail }) => {
  const socket = useSocket();
  const user = useAuthStore((state) => state.user);
  const { settings } = useSettingsStore();
  const handlerRef = useRef<((data: unknown) => void) | null>(null);

  useEffect(() => {
    // Wait for both user and socket to be ready
    if (!user || !socket.isConnected) {
      return;
    }

    // Only register once globally, even if component remounts
    if (globalListenerRegistered && globalUserId === user.id) {
      console.log('[NotificationHandler] Already initialized globally, skipping');
      return;
    }

    // If user changed, clean up old listener first
    if (globalListenerRegistered && globalUserId !== user.id && handlerRef.current) {
      console.log('[NotificationHandler] User changed, cleaning up old listener');
      socket.offNewEmail(handlerRef.current);
      globalListenerRegistered = false;
    }

    globalListenerRegistered = true;
    globalUserId = user.id;
    console.log('[NotificationHandler] Initializing Socket.IO listeners for user:', user.id);

    // Join user room
    socket.joinUserRoom(user.id);

    // Define handler once and store reference
    const handleNewEmail = (data: unknown) => {
      const emailData = data as {
        emailAccountId: string;
        folderPath: string;
        count: number;
        accountName?: string;
        emailAddress?: string;
      };

      console.log('📨 New email notification:', emailData);

      // Play sound if enabled in settings
      if (settings?.notifications.soundEnabled) {
        playNotificationSound();
      }

      // Show desktop notification if enabled
      if (areNotificationsEnabled()) {
        const accountInfo = emailData.accountName || emailData.emailAddress || 'your account';
        const messageText = `${emailData.count} new message${emailData.count > 1 ? 's' : ''} in ${emailData.folderPath}`;
        
        showNewEmailNotification(
          accountInfo,  // "from" parameter - who the email is from
          messageText,  // "subject" parameter - the message body
          () => {
            window.focus();
          }
        );
      }

      // Call parent callback if provided
      if (onNewEmail) {
        onNewEmail(emailData);
      }
    };

    handlerRef.current = handleNewEmail;

    // Register listener
    socket.onNewEmail(handleNewEmail);
    console.log('[NotificationHandler] ✅ Registered email:new listener');

    // Cleanup only runs when component actually unmounts (user logs out)
    return () => {
      console.log('[NotificationHandler] Component unmounting - keeping listener active');
      // Don't clean up on normal navigation, only on actual logout
      // The listener will persist across page changes
    };
  }, [socket.isConnected, user, socket, onNewEmail, settings?.notifications.soundEnabled]);

  return null; // This component renders nothing
};
