// Request notification permission
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) {
    console.log('This browser does not support desktop notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
};

// Check if notifications are enabled
export const areNotificationsEnabled = (): boolean => {
  return 'Notification' in window && Notification.permission === 'granted';
};

// Show a desktop notification
export interface EmailNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  onClick?: () => void;
}

export const showEmailNotification = (options: EmailNotificationOptions): void => {
  if (!areNotificationsEnabled()) {
    return;
  }

  const notification = new Notification(options.title, {
    body: options.body,
    icon: options.icon || '/icon.png',
    tag: options.tag || 'email-notification',
    badge: '/icon.png',
    requireInteraction: false,
  });

  if (options.onClick) {
    notification.onclick = () => {
      window.focus();
      options.onClick?.();
      notification.close();
    };
  }

  // Auto close after 5 seconds
  setTimeout(() => {
    notification.close();
  }, 5000);
};

// Show notification for new email
export const showNewEmailNotification = (
  from: string,
  subject: string,
  onClick?: () => void
): void => {
  showEmailNotification({
    title: `New email for ${from}`,
    body: subject || '(No subject)',
    tag: 'new-email',
    onClick,
  });
};
