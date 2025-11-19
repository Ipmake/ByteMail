import { Box } from "@mui/material";
import Appbar from "../components/Appbar";
import { useEffect, useState } from "react";
import { useSocketStore } from "../stores/socketStore";
import LoadingDisplay from "../components/LoadingDisplay";
import { io } from "socket.io-client";
import { useAuthStore } from "../stores/authStore";
import FolderList from "../components/FolderList";
import { Routes, Route } from "react-router-dom";
import EmailList from "./Dashboard/EmailList";
import { AccountsPage } from "./AccountsPage";
import { SettingsPage } from "./SettingsPage";
import { AdminPage } from "./AdminPage";
import NotificationsHandler from "../components/NotificationsHandler";
import GlobalComposeDrawer from "../components/Drawers/GlobalComposeDrawer";

function DashboardPage() {
  const [socketConnected, setSocketConnected] = useState(false);
  const { socket, setSocket, clearSocket } = useSocketStore();

  useEffect(() => {
    if (socket?.connected) return;

    const newSocket = io(window.location.origin, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      auth: {
        token: useAuthStore.getState().token || "",
      },
    });
    setSocket(newSocket);
    newSocket.connect();

    newSocket.once("auth:success", () => {
      console.log("Socket connected:", newSocket.id);
      setSocketConnected(true);
    });

    newSocket.once("auth:error", (err) => {
      console.error("Socket connection error:", err);
      setSocketConnected(false);
    });

    return () => {
      if (socket) {
        socket.disconnect();
        clearSocket();
        console.log("Socket disconnected");
        setSocketConnected(false);
      }
    };
  }, []);

  if (!socketConnected)
    return <LoadingDisplay text="Establishing socket connection..." />;

  return (
    <Box
      sx={{
        width: "100vw",
        height: "100vh",
      }}
    >
      <Appbar />
      <NotificationsHandler />
      <GlobalComposeDrawer /> 
      <Box
        sx={{
          display: "flex",
          width: "100%",
          height: "calc(100vh - 64px)",
        }}
      >
        <FolderList />
        {/* Main content area can go here */}
        <Routes>
          {/* Accounts route */}
          <Route path="/accounts" element={<AccountsPage />} />

          {/* Settings route */}
          <Route path="/settings" element={<SettingsPage />} />

          {/* Admin routes */}
          <Route path="/admin" element={<AdminPage />} />

          {/* Compose routes */}
          {/* <Route path="/compose" element={<ComposePage mode="compose" />} /> */}
          {/* <Route
            path="/compose/reply/:emailId"
            element={<ComposePage mode="reply" />}
          />
          <Route
            path="/compose/forward/:emailId"
            element={<ComposePage mode="forward" />}
          />
          <Route
            path="/compose/draft/:emailId"
            element={<ComposePage mode="draft" />}
          /> */}

          {/* Mail routes with email viewer */}
          {/* <Route
            path="/mail/:folderId/:emailId"
            element={<EmailViewerWrapper />}
          /> */}

          {/* Mail routes with email list */}
          <Route path="/mail/:accountId/:folderPath" element={<EmailList />} />
          <Route path="/mail/:accountId/:folderPath/:emailUid" element={<EmailList />} /> {/* Added route for email viewer within email list */}
        </Routes>
      </Box>
    </Box>
  );
}

export default DashboardPage;
