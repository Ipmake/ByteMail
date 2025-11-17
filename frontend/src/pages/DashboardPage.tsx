import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Drawer,
  Button,
  Menu,
  MenuItem,
  CircularProgress,
  Tooltip,
  Snackbar,
  Alert,
  LinearProgress,
  Paper,
  Collapse,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import AccountCircle from "@mui/icons-material/AccountCircle";
import AddIcon from "@mui/icons-material/Add";
import RefreshIcon from "@mui/icons-material/Refresh";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import NotificationsIcon from "@mui/icons-material/Notifications";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import SyncIcon from "@mui/icons-material/Sync";
import { useNavigate, useLocation, Routes, Route, useParams } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { emailAccountsApi, emailsApi } from "../api";
import { FolderList } from "../components/FolderList";
import { EmailList } from "../components/EmailList";
import { EmailViewer } from "../components/EmailViewer";
import { AccountsPage } from "./AccountsPage";
import { ComposePage } from "./ComposePage";
import { SettingsPage } from "./SettingsPage";
import { NotificationHandler } from "../components/NotificationHandler";
import { ChangePasswordDialog } from "../components/ChangePasswordDialog";
import { useSocket } from "../hooks/useSocket";
import {
  requestNotificationPermission,
  areNotificationsEnabled,
} from "../utils/notifications";
import type { EmailAccount, Folder, Email } from "../types";

const DRAWER_WIDTH = 280;

interface SyncProgress {
  accountId: string;
  status: "syncing" | "completed" | "error";
  progress?: number; // 0-1
  message?: string;
  folder?: string;
  error?: string;
}

export const DashboardPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const socket = useSocket();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [emails, setEmails] = useState<Email[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingEmails, setIsLoadingEmails] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);

  // Track which accounts have IDLE started to prevent duplicates
  const idleInitializedAccounts = useRef<Set<string>>(new Set());

  // Parse folderId and emailId from the path for use in effects
  const pathParts = location.pathname.split("/").filter(Boolean);
  const folderId =
    pathParts[0] === "mail" && pathParts[1] ? pathParts[1] : undefined;

  // Wrapper components that use useParams
  const EmailViewerWrapper = () => {
    const params = useParams<{ folderId: string; emailId: string }>();
    return (
      <EmailViewer
        emailId={params.emailId!}
        onClose={handleCloseViewer}
        onDelete={handleDeleteEmail}
        onReply={() => navigate(`/compose/reply/${params.emailId}`)}
        onForward={() => navigate(`/compose/forward/${params.emailId}`)}
        onEditDraft={() => navigate(`/compose/draft/${params.emailId}`)}
      />
    );
  };

  const EmailListWrapper = () => {
    const params = useParams<{ folderId: string; emailId?: string }>();
    return (
      <EmailList
        emails={emails}
        selectedEmail={params.emailId || null}
        onSelectEmail={handleSelectEmail}
        onToggleStar={handleToggleStar}
        onBulkDelete={handleBulkDelete}
        onBulkMarkRead={handleBulkMarkRead}
        onBulkStar={handleBulkStar}
        isLoading={isLoadingEmails}
      />
    );
  };

  const DefaultMailView = () => {
    if (accounts.length === 0) {
      return (
        <Box sx={{ p: 4, textAlign: "center" }}>
          <Typography variant="h6" gutterBottom>
            Welcome to ByteMail!
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            Get started by adding your first email account.
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate("/accounts")}
          >
            Add Email Account
          </Button>
        </Box>
      );
    }
    
    return (
      <EmailList
        emails={emails}
        selectedEmail={null}
        onSelectEmail={handleSelectEmail}
        onToggleStar={handleToggleStar}
        onBulkDelete={handleBulkDelete}
        onBulkMarkRead={handleBulkMarkRead}
        onBulkStar={handleBulkStar}
        isLoading={isLoadingEmails}
      />
    );
  };

  // Socket.IO real-time updates for sync progress
  useEffect(() => {
    if (user && socket.isConnected) {
      const handleSyncProgress = (data: unknown) => {
        const syncData = data as SyncProgress;
        console.log("Sync progress:", syncData);

        // Update sync progress state
        setSyncProgress(syncData);

        // When sync completes, reload accounts and current folder
        if (syncData.status === "completed") {
          // Clear progress after a delay
          setTimeout(() => setSyncProgress(null), 3000);

          loadAccounts().then(() => {
            if (folderId) {
              loadEmails(folderId);
            }
          });
        } else if (syncData.status === "error") {
          // Clear error after a delay
          setTimeout(() => setSyncProgress(null), 5000);
        }
      };

      socket.onSyncProgress(handleSyncProgress);

      return () => {
        socket.offSyncProgress(handleSyncProgress);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, socket.isConnected, folderId]);

  // Handler for new email notifications from NotificationHandler component
  const handleNewEmailNotification = (emailData: {
    emailAccountId: string;
    folderPath: string;
    count: number;
    accountName?: string;
    emailAddress?: string;
  }) => {
    const accountInfo =
      emailData.accountName || emailData.emailAddress || "your account";
    const folderName =
      emailData.folderPath === "INBOX" ? "Inbox" : emailData.folderPath;
    const message = `${emailData.count} new email${
      emailData.count > 1 ? "s" : ""
    } in ${folderName} (${accountInfo})`;

    setSnackbarMessage(message);
    setSnackbarOpen(true);

    // Find the folder that received the new email
    const affectedFolder = folders.find(
      (f) =>
        f.emailAccountId === emailData.emailAccountId &&
        f.path === emailData.folderPath
    );

    if (!affectedFolder) {
      console.warn("Could not find folder for notification:", emailData);
      // Still reload accounts to update counters
      loadAccounts();
      return;
    }

    // Update the unread count for the affected folder immediately (optimistic update)
    setFolders((prevFolders) =>
      prevFolders.map((f) =>
        f.id === affectedFolder.id
          ? { ...f, unreadCount: (f.unreadCount || 0) + emailData.count }
          : f
      )
    );

    // Reload accounts to get accurate folder counters from database
    loadAccounts().then(() => {
      // Only reload emails if we're currently viewing the folder that received new emails
      if (folderId === affectedFolder.id) {
        console.log(
          "Reloading emails for current folder after new email notification"
        );
        loadEmails(folderId);
      }
    });
  };

  // Start IDLE for all accounts when they are loaded
  useEffect(() => {
    if (socket.isConnected && accounts.length > 0) {
      // Filter out accounts that already have IDLE started
      const accountsToInit = accounts.filter(
        (account) => !idleInitializedAccounts.current.has(account.id)
      );

      if (accountsToInit.length === 0) {
        return; // All accounts already initialized
      }

      console.log(`Starting IDLE for ${accountsToInit.length} new accounts`);

      accountsToInit.forEach((account) => {
        socket.joinAccountRoom(account.id);
        socket.startIdle(account.id);
        idleInitializedAccounts.current.add(account.id);
      });

      const handleIdleStarted = (data: {
        accountId: string;
        success: boolean;
      }) => {
        console.log("✅ IDLE started for account:", data.accountId);
      };

      const handleIdleError = (data: { accountId: string; error: string }) => {
        console.error("IDLE error for account:", data.accountId, data.error);
        setSnackbarMessage(`Failed to start notifications for account`);
        setSnackbarOpen(true);
      };

      socket.onIdleStarted(handleIdleStarted);
      socket.onIdleError(handleIdleError);

      return () => {
        // Cleanup listeners when component unmounts
        socket.socket?.off("idle:started", handleIdleStarted);
        socket.socket?.off("idle:error", handleIdleError);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket.isConnected, accounts]);

  // Check notification permission on mount
  useEffect(() => {
    setNotificationsEnabled(areNotificationsEnabled());
  }, []);

  const handleToggleNotifications = async () => {
    if (!notificationsEnabled) {
      const granted = await requestNotificationPermission();
      setNotificationsEnabled(granted);
      if (granted) {
        setSnackbarMessage("Desktop notifications enabled");
        setSnackbarOpen(true);
      } else {
        setSnackbarMessage("Desktop notifications denied");
        setSnackbarOpen(true);
      }
    }
  };

  useEffect(() => {
    loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Set selected account when folders are loaded and folderId is in URL
  useEffect(() => {
    if (folderId && folders.length > 0) {
      const folder = folders.find((f) => f.id === folderId);
      if (folder && selectedAccount !== folder.emailAccountId) {
        setSelectedAccount(folder.emailAccountId);
      }
    }
  }, [folderId, folders, selectedAccount]);

  useEffect(() => {
    if (folderId) {
      loadEmails(folderId);
    }
  }, [folderId]);

  const loadAccounts = async () => {
    try {
      const data = await emailAccountsApi.getAll();
      setAccounts(data);

      // Load folders for all accounts (from database)
      const allFolders: Folder[] = [];
      for (const account of data) {
        try {
          const accountFolders = await emailsApi.getFolders(account.id);
          allFolders.push(...accountFolders);
        } catch (error) {
          console.error(
            `Failed to load folders for account ${account.id}:`,
            error
          );
        }
      }
      setFolders(allFolders);
    } catch (error) {
      console.error("Failed to load accounts:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadEmails = async (folderId: string) => {
    setIsLoadingEmails(true);
    try {
      const data = await emailsApi.getEmails(folderId);
      setEmails(data.emails);
    } catch (error) {
      console.error("Failed to load emails:", error);
    } finally {
      setIsLoadingEmails(false);
    }
  };

  const handleSync = async () => {
    if (!selectedAccount) return;

    setIsSyncing(true);
    try {
      // Actually trigger IMAP sync on the backend
      await emailAccountsApi.sync(selectedAccount);

      // After sync completes, reload accounts and current folder
      await loadAccounts();
      if (folderId) {
        await loadEmails(folderId);
      }
    } catch (error) {
      console.error("Sync failed:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleToggleStar = useCallback(async (emailId: string, isFlagged: boolean) => {
    try {
      // Don't update state - let each row manage itself!
      // Just call the API - don't reload accounts to avoid re-renders
      await emailsApi.markAsFlagged(emailId, isFlagged);
    } catch (error) {
      console.error("Failed to toggle star:", error);
    }
  }, []);

  const handleBulkDelete = async (emailIds: string[]) => {
    try {
      await Promise.all(emailIds.map((id) => emailsApi.delete(id)));
      setEmails((prev) => prev.filter((e) => !emailIds.includes(e.id)));
      loadAccounts();
    } catch (error) {
      console.error("Failed to delete emails:", error);
    }
  };

  const handleBulkMarkRead = useCallback(async (emailIds: string[], isRead: boolean) => {
    try {
      // Just call the API - rows manage themselves
      await Promise.all(emailIds.map((id) => emailsApi.markAsRead(id, isRead)));
      // Only reload accounts for bulk operations (to update unread counts)
      loadAccounts();
    } catch (error) {
      console.error("Failed to mark emails:", error);
    }
  }, []);

  const handleBulkStar = async (emailIds: string[], isFlagged: boolean) => {
    try {
      // Just call the API - rows manage themselves
      await Promise.all(
        emailIds.map((id) => emailsApi.markAsFlagged(id, isFlagged))
      );
      // Reload accounts for bulk operations
      loadAccounts();
    } catch (error) {
      console.error("Failed to star emails:", error);
    }
  };

  const handleSelectEmail = (id: string) => {
    // Navigate to email view
    navigate(`/mail/${folderId}/${id}`);

    // Find if the email is already marked as read
    const email = emails.find((e) => e.id === id);

    // Don't update state - the email viewer will mark it as read
    // Just reload accounts if needed for unread count
    if (email && !email.isRead) {
      // Use a small delay to allow backend to process the mark-as-read
      setTimeout(() => {
        loadAccounts();
      }, 500);
    }
  };

  const handleCloseViewer = () => {
    // Navigate back to folder view
    navigate(`/mail/${folderId}`);
    // Reload emails to get updated counts
    if (folderId) {
      loadEmails(folderId);
    }
  };

  const handleDeleteEmail = () => {
    // Navigate back to folder view
    navigate(`/mail/${folderId}`);
    if (folderId) {
      loadEmails(folderId);
    }
    // Also reload accounts to update folder counts
    loadAccounts();
  };

  const drawer = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Toolbar sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Typography variant="h6" noWrap sx={{ fontWeight: 600 }}>
          Accounts
        </Typography>
      </Toolbar>

      <Box sx={{ p: 2 }}>
        <Button
          fullWidth
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate("/compose")}
          sx={{ mb: 1 }}
        >
          Compose
        </Button>
      </Box>

      <Box sx={{ overflow: "auto", flex: 1 }}>
        {accounts.map((account) => (
          <Box key={account.id} sx={{ mb: 0 }}>
            <FolderList
              accountName={account.emailAddress}
              accountId={account.id}
              folders={folders.filter((f) => f.emailAccountId === account.id)}
              selectedFolder={folderId || null}
              onSelectFolder={(id) => {
                setSelectedAccount(account.id);
                navigate(`/mail/${id}`);
              }}
              onFoldersChanged={loadAccounts}
            />
          </Box>
        ))}
      </Box>
    </Box>
  );

  if (isLoading) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={{ display: "flex", height: "100vh", bgcolor: "background.default" }}
    >
      {/* NotificationHandler - Mounts once, handles all Socket.IO notifications */}
      <NotificationHandler onNewEmail={handleNewEmailNotification} />
      <AppBar
        position="fixed"
        sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
        elevation={0}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setMobileOpen(!mobileOpen)}
            sx={{ mr: 2, display: { sm: "none" } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h5" noWrap sx={{ flexGrow: 1, fontWeight: 600 }}>
            ByteMail
          </Typography>

          <Button
            color="inherit"
            variant="outlined"
            onClick={() => navigate("/accounts")}
            sx={{
              mr: 1,
              borderColor: "rgba(255, 255, 255, 0.3)",
              "&:hover": { borderColor: "rgba(255, 255, 255, 0.5)" },
            }}
          >
            Manage Accounts
          </Button>

          <Tooltip
            title={
              isSyncing
                ? "Syncing with mail server..."
                : "Sync emails from server"
            }
          >
            <span>
              <IconButton
                color="inherit"
                onClick={handleSync}
                sx={{ mr: 1 }}
                disabled={isSyncing || !selectedAccount}
              >
                {isSyncing ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  <RefreshIcon />
                )}
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip
            title={
              notificationsEnabled
                ? "Desktop notifications enabled"
                : "Enable desktop notifications"
            }
          >
            <IconButton
              color="inherit"
              onClick={handleToggleNotifications}
              sx={{ mr: 1 }}
            >
              {notificationsEnabled ? (
                <NotificationsActiveIcon />
              ) : (
                <NotificationsIcon />
              )}
            </IconButton>
          </Tooltip>

          {user?.isAdmin && (
            <IconButton
              color="inherit"
              onClick={() => navigate("/admin")}
              sx={{ mr: 1 }}
            >
              <AdminPanelSettingsIcon />
            </IconButton>
          )}

          <IconButton
            color="inherit"
            onClick={(e) => setAnchorEl(e.currentTarget)}
          >
            <AccountCircle />
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
          >
            <MenuItem disabled>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {user?.username}
              </Typography>
            </MenuItem>
            <MenuItem
              onClick={() => {
                setAnchorEl(null);
                navigate("/settings");
              }}
            >
              Settings
            </MenuItem>
            <MenuItem
              onClick={() => {
                setAnchorEl(null);
                setChangePasswordOpen(true);
              }}
            >
              Change Password
            </MenuItem>
            <MenuItem
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>{" "}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", sm: "none" },
          "& .MuiDrawer-paper": {
            boxSizing: "border-box",
            width: DRAWER_WIDTH,
          },
        }}
      >
        {drawer}
      </Drawer>
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: "none", sm: "block" },
          width: DRAWER_WIDTH,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: DRAWER_WIDTH,
            boxSizing: "border-box",
          },
        }}
        open
      >
        {drawer}
      </Drawer>
      <Box
        component="main"
        sx={{ flexGrow: 1, display: "flex", flexDirection: "column" }}
      >
        <Toolbar />

        <Collapse in={!!syncProgress && syncProgress.status === "syncing"}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              backgroundColor: "primary.main",
              color: "white",
              display: "flex",
              alignItems: "center",
              gap: 2,
              borderRadius: 0,
            }}
          >
            <SyncIcon
              sx={{
                animation: "spin 2s linear infinite",
                "@keyframes spin": {
                  "0%": { transform: "rotate(0deg)" },
                  "100%": { transform: "rotate(360deg)" },
                },
              }}
            />
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {syncProgress?.folder
                  ? `Syncing ${syncProgress?.folder}...`
                  : "Syncing emails..."}
              </Typography>
              {syncProgress?.message && (
                <Typography variant="caption" sx={{ opacity: 0.9 }}>
                  {syncProgress?.message}
                </Typography>
              )}
              {syncProgress?.progress !== undefined && (
                <LinearProgress
                  variant="determinate"
                  value={syncProgress?.progress * 100}
                  sx={{
                    mt: 1,
                    backgroundColor: "rgba(255,255,255,0.3)",
                    "& .MuiLinearProgress-bar": {
                      backgroundColor: "white",
                    },
                  }}
                />
              )}
            </Box>
          </Paper>
        </Collapse>

        <Box sx={{ flex: 1, overflow: "auto" }}>
          <Routes>
            {/* Accounts route */}
            <Route path="/accounts" element={<AccountsPage />} />
            
            {/* Settings route */}
            <Route path="/settings" element={<SettingsPage />} />
            
            {/* Compose routes */}
            <Route path="/compose" element={<ComposePage mode="compose" />} />
            <Route path="/compose/reply/:emailId" element={<ComposePage mode="reply" />} />
            <Route path="/compose/forward/:emailId" element={<ComposePage mode="forward" />} />
            <Route path="/compose/draft/:emailId" element={<ComposePage mode="draft" />} />
            
            {/* Mail routes with email viewer */}
            <Route path="/mail/:folderId/:emailId" element={<EmailViewerWrapper />} />
            
            {/* Mail routes with email list */}
            <Route path="/mail/:folderId" element={<EmailListWrapper />} />
            <Route path="/mail" element={<DefaultMailView />} />
          </Routes>
        </Box>
      </Box>
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity="info"
          variant="filled"
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
      <ChangePasswordDialog
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
        onSuccess={() => {
          setSnackbarMessage("Password changed successfully");
          setSnackbarOpen(true);
        }}
      />
    </Box>
  );
};
