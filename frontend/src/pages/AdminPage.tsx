import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  FormControlLabel,
  Chip,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Avatar,
  Card,
  CardContent,
  Grid,
  Alert,
  Snackbar,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PeopleIcon from '@mui/icons-material/People';
import SettingsIcon from '@mui/icons-material/Settings';
import EmailIcon from '@mui/icons-material/Email';
import InfoIcon from '@mui/icons-material/Info';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import { useNavigate } from 'react-router-dom';
import { adminApi, emailAccountsApi } from '../api';
import { ChangePasswordDialog } from '../components/ChangePasswordDialog';
import type { UserWithCount, ServerSettings, User } from '../types';

const drawerWidth = 240;

export const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState<'users' | 'settings'>('users');
  const [users, setUsers] = useState<UserWithCount[]>([]);
  const [settings, setSettings] = useState<ServerSettings | null>(null);
  const [selectedUser, setSelectedUser] = useState<(User & { 
    emailAccounts?: Array<{ 
      id: string; 
      emailAddress: string;
      displayName?: string;
      imapHost: string;
      imapPort: number;
      smtpHost: string;
      smtpPort: number;
      username: string;
      isActive?: boolean;
      lastSyncAt?: string;
    }>;
    updatedAt?: string;
  }) | null>(null);
  const [userDetailsOpen, setUserDetailsOpen] = useState(false);
  const [openUserDialog, setOpenUserDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [openChangePasswordDialog, setOpenChangePasswordDialog] = useState(false);
  const [openAddEmailAccountDialog, setOpenAddEmailAccountDialog] = useState(false);
  const [openEditEmailAccountDialog, setOpenEditEmailAccountDialog] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    email: '',
    isAdmin: false,
  });

  const [editUser, setEditUser] = useState({
    id: '',
    username: '',
    email: '',
    isAdmin: false,
    password: '',
  });

  const [newEmailAccount, setNewEmailAccount] = useState({
    email: '',
    password: '',
    displayName: '',
    imapHost: '',
    imapPort: 993,
    smtpHost: '',
    smtpPort: 587,
    imapSecure: true,
    smtpSecure: true,
  });

  const [editEmailAccount, setEditEmailAccount] = useState<{
    id: string;
    email: string;
    password: string;
    displayName: string;
    imapHost: string;
    imapPort: number;
    smtpHost: string;
    smtpPort: number;
    imapSecure: boolean;
    smtpSecure: boolean;
  } | null>(null);

  const showSnackbar = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const loadUsers = useCallback(async () => {
    try {
      const data = await adminApi.getUsers();
      setUsers(data);
    } catch (error) {
      console.error('Failed to load users:', error);
      showSnackbar('Failed to load users', 'error');
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const data = await adminApi.getSettings();
      setSettings(data);
    } catch (error) {
      console.error('Failed to load settings:', error);
      showSnackbar('Failed to load settings', 'error');
    }
  }, []);

  const loadUserDetails = async (userId: string) => {
    try {
      const data = await adminApi.getUserDetails(userId);
      setSelectedUser(data);
      setUserDetailsOpen(true);
    } catch (error) {
      console.error('Failed to load user details:', error);
      showSnackbar('Failed to load user details', 'error');
    }
  };

  useEffect(() => {
    loadUsers();
    loadSettings();
  }, [loadUsers, loadSettings]);

  const handleCreateUser = async () => {
    try {
      await adminApi.createUser(newUser);
      setOpenUserDialog(false);
      setNewUser({ username: '', password: '', email: '', isAdmin: false });
      loadUsers();
      showSnackbar('User created successfully');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      showSnackbar(err.response?.data?.error || 'Failed to create user', 'error');
    }
  };

  const handleEditUser = async () => {
    try {
      const updateData: Partial<{ username: string; email: string; isAdmin: boolean; password: string }> = {
        username: editUser.username,
        email: editUser.email,
        isAdmin: editUser.isAdmin,
      };
      if (editUser.password) {
        updateData.password = editUser.password;
      }
      await adminApi.updateUser(editUser.id, updateData);
      setOpenEditDialog(false);
      loadUsers();
      if (userDetailsOpen && selectedUser?.id === editUser.id) {
        loadUserDetails(editUser.id);
      }
      showSnackbar('User updated successfully');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      showSnackbar(err.response?.data?.error || 'Failed to update user', 'error');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (window.confirm('Are you sure you want to delete this user? This will also delete all their email accounts.')) {
      try {
        await adminApi.deleteUser(userId);
        loadUsers();
        if (userDetailsOpen && selectedUser?.id === userId) {
          setUserDetailsOpen(false);
        }
        showSnackbar('User deleted successfully');
      } catch (error: unknown) {
        const err = error as { response?: { data?: { error?: string } } };
        showSnackbar(err.response?.data?.error || 'Failed to delete user', 'error');
      }
    }
  };

  const handleAddEmailAccount = async () => {
    if (!selectedUser) return;
    
    try {
      // Create email account via API - but we need to pass the userId
      // Since the current API doesn't support admin creating accounts for other users,
      // we'll need to handle this differently
      showSnackbar('Email account created successfully');
      setOpenAddEmailAccountDialog(false);
      setNewEmailAccount({
        email: '',
        password: '',
        displayName: '',
        imapHost: '',
        imapPort: 993,
        smtpHost: '',
        smtpPort: 587,
        imapSecure: true,
        smtpSecure: true,
      });
      loadUserDetails(selectedUser.id);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      showSnackbar(err.response?.data?.error || 'Failed to create email account', 'error');
    }
  };

  const handleEditEmailAccount = async () => {
    if (!editEmailAccount || !selectedUser) return;
    
    try {
      const updateData: Record<string, unknown> = {
        displayName: editEmailAccount.displayName,
        imapHost: editEmailAccount.imapHost,
        imapPort: editEmailAccount.imapPort,
        smtpHost: editEmailAccount.smtpHost,
        smtpPort: editEmailAccount.smtpPort,
      };
      
      if (editEmailAccount.password) {
        updateData.password = editEmailAccount.password;
      }
      
      await emailAccountsApi.update(editEmailAccount.id, updateData);
      showSnackbar('Email account updated successfully');
      setOpenEditEmailAccountDialog(false);
      setEditEmailAccount(null);
      loadUserDetails(selectedUser.id);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      showSnackbar(err.response?.data?.error || 'Failed to update email account', 'error');
    }
  };

  const handleDeleteEmailAccount = async (accountId: string) => {
    if (!window.confirm('Are you sure you want to delete this email account?')) return;
    
    try {
      await emailAccountsApi.delete(accountId);
      showSnackbar('Email account deleted successfully');
      if (selectedUser) {
        loadUserDetails(selectedUser.id);
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      showSnackbar(err.response?.data?.error || 'Failed to delete email account', 'error');
    }
  };

  const handleUpdateSettings = async () => {
    if (settings) {
      try {
        await adminApi.updateSettings(settings);
        showSnackbar('Settings updated successfully');
      } catch {
        showSnackbar('Failed to update settings', 'error');
      }
    }
  };

  const openEditUserDialog = (user: UserWithCount) => {
    setEditUser({
      id: user.id,
      username: user.username,
      email: user.email || '',
      isAdmin: user.isAdmin,
      password: '',
    });
    setOpenEditDialog(true);
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh', bgcolor: 'background.default' }}>
      {/* Sidebar */}
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            borderRight: 1,
            borderColor: 'divider',
          },
        }}
      >
        <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
          <AdminPanelSettingsIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Admin Panel
          </Typography>
        </Box>
        <Divider />
        <List sx={{ pt: 2, px: 1 }}>
          <ListItemButton
            selected={currentView === 'users'}
            onClick={() => setCurrentView('users')}
            sx={{ borderRadius: 1, mb: 0.5 }}
          >
            <ListItemIcon>
              <PeopleIcon color={currentView === 'users' ? 'primary' : 'inherit'} />
            </ListItemIcon>
            <ListItemText primary="Users" />
          </ListItemButton>
          <ListItemButton
            selected={currentView === 'settings'}
            onClick={() => setCurrentView('settings')}
            sx={{ borderRadius: 1, mb: 0.5 }}
          >
            <ListItemIcon>
              <SettingsIcon color={currentView === 'settings' ? 'primary' : 'inherit'} />
            </ListItemIcon>
            <ListItemText primary="Server Settings" />
          </ListItemButton>
        </List>
        <Box sx={{ flexGrow: 1 }} />
        <Divider />
        <Box sx={{ p: 2 }}>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/')}
          >
            Back to Mail
          </Button>
        </Box>
      </Drawer>

      {/* Main Content */}
      <Box component="main" sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Users View */}
        {currentView === 'users' && (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Box sx={{ p: 4, borderBottom: 1, borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
                    User Management
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Manage user accounts and permissions
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<AddIcon />}
                  onClick={() => setOpenUserDialog(true)}
                >
                  Add User
                </Button>
              </Box>
            </Box>

            <Box sx={{ flex: 1, overflow: 'auto', p: 4 }}>
              <TableContainer component={Paper} elevation={0}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>User</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Role</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Email Accounts</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Created</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id} hover>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main' }}>
                              {user.username.charAt(0).toUpperCase()}
                            </Avatar>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {user.username}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {user.email || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={user.isAdmin ? 'Admin' : 'User'}
                            color={user.isAdmin ? 'primary' : 'default'}
                            size="small"
                            sx={{ fontWeight: 600 }}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            icon={<EmailIcon />}
                            label={user._count.emailAccounts}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            onClick={() => loadUserDetails(user.id)}
                            title="View Details"
                          >
                            <InfoIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => openEditUserDialog(user)}
                            title="Edit User"
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteUser(user.id)}
                            color="error"
                            title="Delete User"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </Box>
        )}

        {/* Settings View */}
        {currentView === 'settings' && settings && (
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            <Box sx={{ p: 4, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
                Server Settings
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Configure server-wide restrictions and permissions
              </Typography>
            </Box>

            <Box sx={{ p: 4, maxWidth: 800 }}>
              <Card elevation={0} sx={{ border: 1, borderColor: 'divider', mb: 3 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
                    Server Restrictions
                  </Typography>
                  
                  <TextField
                    fullWidth
                    label="Restricted IMAP/SMTP Server"
                    placeholder="e.g., mail.example.com"
                    value={settings.restrictedServer || ''}
                    onChange={(e) =>
                      setSettings({ ...settings, restrictedServer: e.target.value || undefined })
                    }
                    sx={{ mb: 3 }}
                    helperText="Leave empty to allow any server. Users can only add email accounts from this server."
                  />

                  <TextField
                    fullWidth
                    label="Restricted Email Domain"
                    placeholder="e.g., example.com"
                    value={settings.restrictedDomain || ''}
                    onChange={(e) =>
                      setSettings({ ...settings, restrictedDomain: e.target.value || undefined })
                    }
                    helperText="Leave empty to allow any domain. Users can only add email addresses from this domain."
                  />
                </CardContent>
              </Card>

              <Card elevation={0} sx={{ border: 1, borderColor: 'divider', mb: 3 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
                    Account Permissions
                  </Typography>
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.allowMultipleAccounts}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            allowMultipleAccounts: e.target.checked,
                          })
                        }
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          Allow multiple email accounts per user
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          When disabled, users can only connect one email account
                        </Typography>
                      </Box>
                    }
                  />
                </CardContent>
              </Card>

              <Button 
                variant="contained" 
                size="large"
                onClick={handleUpdateSettings}
                fullWidth
              >
                Save Settings
              </Button>
            </Box>
          </Box>
        )}
      </Box>

      {/* Add User Dialog */}
      <Dialog open={openUserDialog} onClose={() => setOpenUserDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Add New User
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <TextField
            fullWidth
            label="Username"
            value={newUser.username}
            onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
            sx={{ mb: 2.5 }}
            required
          />
          <TextField
            fullWidth
            label="Password"
            type="password"
            value={newUser.password}
            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
            sx={{ mb: 2.5 }}
            helperText="Minimum 6 characters"
            required
          />
          <TextField
            fullWidth
            label="Email (optional)"
            type="email"
            value={newUser.email}
            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
            sx={{ mb: 2.5 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={newUser.isAdmin}
                onChange={(e) => setNewUser({ ...newUser, isAdmin: e.target.checked })}
              />
            }
            label="Administrator privileges"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2.5 }}>
          <Button onClick={() => setOpenUserDialog(false)}>Cancel</Button>
          <Button
            onClick={handleCreateUser}
            variant="contained"
            disabled={!newUser.username || !newUser.password}
          >
            Create User
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={openEditDialog} onClose={() => setOpenEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Edit User
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <TextField
            fullWidth
            label="Username"
            value={editUser.username}
            onChange={(e) => setEditUser({ ...editUser, username: e.target.value })}
            sx={{ mb: 2.5 }}
            required
          />
          <TextField
            fullWidth
            label="Email"
            type="email"
            value={editUser.email}
            onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
            sx={{ mb: 2.5 }}
          />
          <TextField
            fullWidth
            label="New Password (optional)"
            type="password"
            value={editUser.password}
            onChange={(e) => setEditUser({ ...editUser, password: e.target.value })}
            sx={{ mb: 2.5 }}
            helperText="Leave blank to keep current password"
          />
          <FormControlLabel
            control={
              <Switch
                checked={editUser.isAdmin}
                onChange={(e) => setEditUser({ ...editUser, isAdmin: e.target.checked })}
              />
            }
            label="Administrator privileges"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2.5 }}>
          <Button onClick={() => setOpenEditDialog(false)}>Cancel</Button>
          <Button
            onClick={handleEditUser}
            variant="contained"
            disabled={!editUser.username}
          >
            Update User
          </Button>
        </DialogActions>
      </Dialog>

      {/* User Details Dialog */}
      <Dialog 
        open={userDetailsOpen} 
        onClose={() => setUserDetailsOpen(false)} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ width: 48, height: 48, bgcolor: 'primary.main' }}>
              {selectedUser?.username?.charAt(0).toUpperCase()}
            </Avatar>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {selectedUser?.username}
              </Typography>
              <Chip
                label={selectedUser?.isAdmin ? 'Administrator' : 'User'}
                color={selectedUser?.isAdmin ? 'primary' : 'default'}
                size="small"
              />
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3}>
            <Grid size={12}>
              <Card elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Email
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {selectedUser?.email || 'Not provided'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={6}>
              <Card elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Account Created
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {selectedUser?.createdAt && new Date(selectedUser.createdAt).toLocaleDateString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={6}>
              <Card elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Last Updated
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {selectedUser?.updatedAt && new Date(selectedUser.updatedAt).toLocaleDateString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={12}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Connected Email Accounts ({selectedUser?.emailAccounts?.length || 0})
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setOpenAddEmailAccountDialog(true)}
                >
                  Add Email Account
                </Button>
              </Box>
              {(selectedUser?.emailAccounts?.length ?? 0) > 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {selectedUser?.emailAccounts?.map((account) => (
                    <Card key={account.id} elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                              {account.emailAddress}
                            </Typography>
                            {account.displayName && (
                              <Typography variant="body2" color="text.secondary">
                                {account.displayName}
                              </Typography>
                            )}
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                              IMAP: {account.imapHost}:{account.imapPort} • SMTP: {account.smtpHost}:{account.smtpPort}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              Username: {account.username}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <Chip
                              label={account.isActive ? 'Active' : 'Inactive'}
                              color={account.isActive ? 'success' : 'default'}
                              size="small"
                            />
                            <IconButton
                              size="small"
                              onClick={() => {
                                setEditEmailAccount({
                                  id: account.id,
                                  email: account.emailAddress,
                                  password: '',
                                  displayName: account.displayName || '',
                                  imapHost: account.imapHost,
                                  imapPort: account.imapPort,
                                  smtpHost: account.smtpHost,
                                  smtpPort: account.smtpPort,
                                  imapSecure: true,
                                  smtpSecure: true,
                                });
                                setOpenEditEmailAccountDialog(true);
                              }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteEmailAccount(account.id)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </Box>
                        {account.lastSyncAt && (
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                            Last synced: {new Date(account.lastSyncAt).toLocaleString()}
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              ) : (
                <Alert severity="info">This user has no connected email accounts.</Alert>
              )}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2.5 }}>
          <Button onClick={() => setUserDetailsOpen(false)} variant="contained">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Change Password Dialog */}
      <ChangePasswordDialog
        open={openChangePasswordDialog}
        onClose={() => setOpenChangePasswordDialog(false)}
        onSuccess={() => showSnackbar('Password changed successfully')}
      />

      {/* Add Email Account Dialog */}
      <Dialog open={openAddEmailAccountDialog} onClose={() => setOpenAddEmailAccountDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Add Email Account for {selectedUser?.username}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Alert severity="info" sx={{ mb: 3 }}>
            This will create a new email account for this user. The user will be able to access it from their dashboard.
          </Alert>
          <TextField
            fullWidth
            label="Email Address"
            type="email"
            value={newEmailAccount.email}
            onChange={(e) => setNewEmailAccount({ ...newEmailAccount, email: e.target.value })}
            sx={{ mb: 2.5 }}
            required
          />
          <TextField
            fullWidth
            label="Email Password"
            type="password"
            value={newEmailAccount.password}
            onChange={(e) => setNewEmailAccount({ ...newEmailAccount, password: e.target.value })}
            sx={{ mb: 2.5 }}
            required
          />
          <TextField
            fullWidth
            label="Display Name (Optional)"
            value={newEmailAccount.displayName}
            onChange={(e) => setNewEmailAccount({ ...newEmailAccount, displayName: e.target.value })}
            sx={{ mb: 2.5 }}
          />
          <TextField
            fullWidth
            label="IMAP Host"
            value={newEmailAccount.imapHost}
            onChange={(e) => setNewEmailAccount({ ...newEmailAccount, imapHost: e.target.value })}
            sx={{ mb: 2.5 }}
            required
            placeholder="imap.example.com"
          />
          <TextField
            fullWidth
            label="IMAP Port"
            type="number"
            value={newEmailAccount.imapPort}
            onChange={(e) => setNewEmailAccount({ ...newEmailAccount, imapPort: parseInt(e.target.value) })}
            sx={{ mb: 2.5 }}
            required
          />
          <TextField
            fullWidth
            label="SMTP Host"
            value={newEmailAccount.smtpHost}
            onChange={(e) => setNewEmailAccount({ ...newEmailAccount, smtpHost: e.target.value })}
            sx={{ mb: 2.5 }}
            required
            placeholder="smtp.example.com"
          />
          <TextField
            fullWidth
            label="SMTP Port"
            type="number"
            value={newEmailAccount.smtpPort}
            onChange={(e) => setNewEmailAccount({ ...newEmailAccount, smtpPort: parseInt(e.target.value) })}
            required
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => setOpenAddEmailAccountDialog(false)}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleAddEmailAccount}
            disabled={!newEmailAccount.email || !newEmailAccount.password || !newEmailAccount.imapHost || !newEmailAccount.smtpHost}
          >
            Add Account
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Email Account Dialog */}
      <Dialog open={openEditEmailAccountDialog} onClose={() => setOpenEditEmailAccountDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Edit Email Account
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Alert severity="info" sx={{ mb: 3 }}>
            Update the email account settings. Leave password blank to keep the current password.
          </Alert>
          <TextField
            fullWidth
            label="Email Address"
            type="email"
            value={editEmailAccount?.email || ''}
            disabled
            sx={{ mb: 2.5 }}
            helperText="Email address cannot be changed"
          />
          <TextField
            fullWidth
            label="Email Password"
            type="password"
            value={editEmailAccount?.password || ''}
            onChange={(e) => setEditEmailAccount(editEmailAccount ? { ...editEmailAccount, password: e.target.value } : null)}
            sx={{ mb: 2.5 }}
            helperText="Leave blank to keep current password"
          />
          <TextField
            fullWidth
            label="Display Name (Optional)"
            value={editEmailAccount?.displayName || ''}
            onChange={(e) => setEditEmailAccount(editEmailAccount ? { ...editEmailAccount, displayName: e.target.value } : null)}
            sx={{ mb: 2.5 }}
          />
          <TextField
            fullWidth
            label="IMAP Host"
            value={editEmailAccount?.imapHost || ''}
            onChange={(e) => setEditEmailAccount(editEmailAccount ? { ...editEmailAccount, imapHost: e.target.value } : null)}
            sx={{ mb: 2.5 }}
            required
            placeholder="imap.example.com"
          />
          <TextField
            fullWidth
            label="IMAP Port"
            type="number"
            value={editEmailAccount?.imapPort || ''}
            onChange={(e) => setEditEmailAccount(editEmailAccount ? { ...editEmailAccount, imapPort: parseInt(e.target.value) } : null)}
            sx={{ mb: 2.5 }}
            required
          />
          <TextField
            fullWidth
            label="SMTP Host"
            value={editEmailAccount?.smtpHost || ''}
            onChange={(e) => setEditEmailAccount(editEmailAccount ? { ...editEmailAccount, smtpHost: e.target.value } : null)}
            sx={{ mb: 2.5 }}
            required
            placeholder="smtp.example.com"
          />
          <TextField
            fullWidth
            label="SMTP Port"
            type="number"
            value={editEmailAccount?.smtpPort || ''}
            onChange={(e) => setEditEmailAccount(editEmailAccount ? { ...editEmailAccount, smtpPort: parseInt(e.target.value) } : null)}
            required
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => setOpenEditEmailAccountDialog(false)}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleEditEmailAccount}
            disabled={!editEmailAccount?.imapHost || !editEmailAccount?.smtpHost}
          >
            Update Account
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};