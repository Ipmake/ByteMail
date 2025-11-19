import { People, Notifications, NotificationsOff, Settings, AdminPanelSettings, AccountCircle, Logout, Lock } from "@mui/icons-material";
import { AppBar, Avatar, Box, IconButton, Tooltip, Typography, Menu, MenuItem, ListItemIcon, ListItemText, Divider } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { ChangePasswordDialog } from "./ChangePasswordDialog";

function Appbar() {
  const navigate = useNavigate();
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    "Notification" in window && Notification.permission === "granted"
  );
  const [accountMenuAnchor, setAccountMenuAnchor] = useState<null | HTMLElement>(null);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const handleAccountMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAccountMenuAnchor(event.currentTarget);
  };

  const handleAccountMenuClose = () => {
    setAccountMenuAnchor(null);
  };

  const handleChangePassword = () => {
    handleAccountMenuClose();
    setChangePasswordOpen(true);
  };

  const handleLogout = () => {
    handleAccountMenuClose();
    localStorage.removeItem('auth-token');
    location.reload();
  };

  const handleNotificationToggle = async () => {
    if (!("Notification" in window)) {
      alert("This browser does not support desktop notifications");
      return;
    }

    if (Notification.permission === "granted") {
      // Can't actually revoke permission programmatically, just inform user
      alert("To disable notifications, please change the permission in your browser settings");
      return;
    }

    if (Notification.permission !== "denied") {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        setNotificationsEnabled(true);
        new Notification("ByteMail", {
          body: "Desktop notifications are now enabled!",
          icon: "/icon.png"
        });
      }
    } else {
      alert("Notifications are blocked. Please enable them in your browser settings.");
    }
  };

  return (
    <AppBar
      position="static"
      sx={{
        height: "64px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexDirection: "row",
      }}
    >
      <Box p={2} display="flex" alignItems="center" gap={2}>
        <Avatar
          src="/icon.png"
          sx={{
            width: "32px",
            height: "32px",
          }}
        />
        <Typography sx={{ flexGrow: 1, fontWeight: "bold" }}>
          ByteMail
        </Typography>
      </Box>

      <Box sx={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        paddingRight: 2,
        flexDirection: 'row',
        gap: 1,
      }}>
        <Tooltip title={notificationsEnabled ? "Notifications Enabled" : "Enable Desktop Notifications"}>
          <IconButton color="inherit" onClick={handleNotificationToggle}>
            {notificationsEnabled ? <Notifications /> : <NotificationsOff />}
          </IconButton>
        </Tooltip>
        <Tooltip title="Settings">
          <IconButton color="inherit" onClick={() => navigate("/settings")}>
            <Settings />
          </IconButton>
        </Tooltip>
        <Tooltip title="Admin Panel">
          <IconButton color="inherit" onClick={() => navigate("/admin")}>
            <AdminPanelSettings />
          </IconButton>
        </Tooltip>
        <Tooltip title="Manage Email Accounts">
          <IconButton color="inherit" onClick={() => navigate("/accounts")}>
            <People />
          </IconButton>
        </Tooltip>
        <Tooltip title="Account">
          <IconButton color="inherit" onClick={handleAccountMenuOpen}>
            <AccountCircle />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Account Menu */}
      <Menu
        anchorEl={accountMenuAnchor}
        open={Boolean(accountMenuAnchor)}
        onClose={handleAccountMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={handleChangePassword}>
          <ListItemIcon>
            <Lock fontSize="small" />
          </ListItemIcon>
          <ListItemText>Change Password</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <Logout fontSize="small" />
          </ListItemIcon>
          <ListItemText>Logout</ListItemText>
        </MenuItem>
      </Menu>

      {/* Change Password Dialog */}
      <ChangePasswordDialog
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </AppBar>
  );
}

export default Appbar;
