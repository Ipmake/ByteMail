import { useEffect } from "react";
import { useSocketStore } from "../stores/socketStore";
import { playNotificationSound } from "../utils/notifications";
import { useSettingsStore } from "../stores/settingsStore";
import { useAccountStore } from "../stores/accountStore";

function NotificationsHandler() {
  const { socket } = useSocketStore();
  const { settings } = useSettingsStore();

  useEffect(() => {
    if (!socket) return;

    const handleNotification = (data: {
      accountId: string;
      count: number;
      folderPath: string;
    }) => {
      console.log("Received notification:", data);
      // Here you can integrate with a notification library or use the browser's Notification API

      const accounts = useAccountStore.getState().accounts;
      const account = accounts?.find((acc) => acc.id === data.accountId);
      if (!account) return;

      if (Notification.permission === "granted") {
        new Notification(`${account.displayName || account.emailAddress} - ByteMail`, {
          body: `You have ${data.count} new email(s) for ${account.displayName || account.emailAddress}`,
          icon: "/icon.png",
        });
      }

      if (settings?.notifications.soundEnabled) {
        playNotificationSound();
      }
    };

    socket.on("email:new", handleNotification);

    return () => {
      socket.off("email:new", handleNotification);
    };
  }, [settings?.notifications.soundEnabled, socket]);

  return <></>;
}

export default NotificationsHandler;
