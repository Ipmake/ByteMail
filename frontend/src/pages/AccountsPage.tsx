import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  FormControlLabel,
  CircularProgress,
  Chip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import SyncIcon from '@mui/icons-material/Sync';
import EditIcon from '@mui/icons-material/Edit';
import { useNavigate } from 'react-router-dom';
import { emailAccountsApi } from '../api';
import { AddAccountDialog } from '../components/AddAccountDialog';
import type { EmailAccount } from '../types';
import { useSettingsStore } from '../stores/settingsStore';
import { formatDateTimeWithSettings } from '../utils/dateFormatting';

export const AccountsPage: React.FC = () => {
  const navigate = useNavigate();
  const { settings } = useSettingsStore();
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [editingAccount, setEditingAccount] = useState<EmailAccount | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Edit form state
  const [emailAddress, setEmailAddress] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [imapHost, setImapHost] = useState('');
  const [imapPort, setImapPort] = useState('993');
  const [imapSecure, setImapSecure] = useState(true);
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('465');
  const [smtpSecure, setSmtpSecure] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const data = await emailAccountsApi.getAll();
      setAccounts(data);
    } catch (error) {
      console.error('Failed to load accounts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSuccess = () => {
    loadAccounts();
    // Navigate back to mail after adding account
    navigate('/');
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this account?')) return;

    try {
      await emailAccountsApi.delete(id);
      loadAccounts();
    } catch (error) {
      console.error('Failed to delete account:', error);
    }
  };

  const handleSync = async (id: string) => {
    setSyncing(id);
    try {
      await emailAccountsApi.sync(id);
      loadAccounts();
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setSyncing(null);
    }
  };

  const handleEditClick = (account: EmailAccount) => {
    setEditingAccount(account);
    setEmailAddress(account.emailAddress);
    setDisplayName(account.displayName || '');
    setImapHost(account.imapHost);
    setImapPort(account.imapPort.toString());
    setImapSecure(account.imapSecure);
    setSmtpHost(account.smtpHost);
    setSmtpPort(account.smtpPort.toString());
    setSmtpSecure(account.smtpSecure);
    setUsername(account.username);
    setPassword('');
    setEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingAccount || !emailAddress || !imapHost || !smtpHost || !username) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      await emailAccountsApi.update(editingAccount.id, {
        emailAddress,
        displayName,
        imapHost,
        imapPort: parseInt(imapPort),
        imapSecure,
        smtpHost,
        smtpPort: parseInt(smtpPort),
        smtpSecure,
        username,
        ...(password && { password }), // Only include password if it was changed
      });
      setDialogOpen(false);
      resetForm();
      setEditingAccount(null);
      loadAccounts();
    } catch (error) {
      setError('Failed to update account. Please check your settings.');
      console.error(error);
    }
  };

  const resetForm = () => {
    setEmailAddress('');
    setDisplayName('');
    setImapHost('');
    setImapPort('993');
    setImapSecure(true);
    setSmtpHost('');
    setSmtpPort('465');
    setSmtpSecure(true);
    setUsername('');
    setPassword('');
    setError('');
    setEditingAccount(null);
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600, mb: 0.5 }}>
            Email Accounts
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your connected email accounts
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
          size="large"
        >
          Add Account
        </Button>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        <TableContainer component={Paper} elevation={2}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Email Address</strong></TableCell>
                <TableCell><strong>Display Name</strong></TableCell>
                <TableCell><strong>IMAP Server</strong></TableCell>
                <TableCell><strong>SMTP Server</strong></TableCell>
                <TableCell><strong>Status</strong></TableCell>
                <TableCell><strong>Last Sync</strong></TableCell>
                <TableCell align="right"><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account.id} hover>
                  <TableCell>{account.emailAddress}</TableCell>
                  <TableCell>{account.displayName || '-'}</TableCell>
                  <TableCell>{account.imapHost}:{account.imapPort}</TableCell>
                  <TableCell>{account.smtpHost}:{account.smtpPort}</TableCell>
                  <TableCell>
                    <Chip
                      label={account.isActive ? 'Active' : 'Inactive'}
                      color={account.isActive ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {account.lastSyncAt
                      ? formatDateTimeWithSettings(account.lastSyncAt, settings)
                      : 'Never'}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleSync(account.id)}
                      disabled={syncing === account.id}
                      title="Sync"
                    >
                      {syncing === account.id ? (
                        <CircularProgress size={20} />
                      ) : (
                        <SyncIcon />
                      )}
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleEditClick(account)}
                      color="primary"
                      title="Edit"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(account.id)}
                      color="error"
                      title="Delete"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {accounts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No email accounts configured. Add your first account to get started.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* Add Account Dialog */}
      <AddAccountDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={handleAddSuccess}
      />

      {/* Edit Account Dialog */}
      <Dialog open={editDialogOpen} onClose={() => { setEditDialogOpen(false); resetForm(); }} maxWidth="md" fullWidth>
        <DialogTitle>Edit Email Account</DialogTitle>
        <DialogContent>
          {error && (
            <Box sx={{ mb: 2, p: 2, bgcolor: 'error.main', color: 'error.contrastText', borderRadius: 1 }}>
              {error}
            </Box>
          )}

          <Box sx={{ mb: 2, p: 2, bgcolor: 'info.dark', color: 'info.contrastText', borderRadius: 1 }}>
            <Typography variant="body2">
              Note: Leave password blank to keep existing password
            </Typography>
          </Box>

          <TextField
            fullWidth
            label="Email Address"
            value={emailAddress}
            onChange={(e) => setEmailAddress(e.target.value)}
            margin="normal"
            required
          />

          <TextField
            fullWidth
            label="Display Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            margin="normal"
          />

          <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>IMAP Settings (Incoming)</Typography>
          <TextField
            fullWidth
            label="IMAP Host"
            value={imapHost}
            onChange={(e) => setImapHost(e.target.value)}
            margin="normal"
            required
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="IMAP Port"
              value={imapPort}
              onChange={(e) => setImapPort(e.target.value)}
              margin="normal"
              type="number"
              required
              sx={{ flex: 1 }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={imapSecure}
                  onChange={(e) => setImapSecure(e.target.checked)}
                />
              }
              label="Use SSL/TLS"
              sx={{ mt: 2 }}
            />
          </Box>

          <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>SMTP Settings (Outgoing)</Typography>
          <TextField
            fullWidth
            label="SMTP Host"
            value={smtpHost}
            onChange={(e) => setSmtpHost(e.target.value)}
            margin="normal"
            required
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="SMTP Port"
              value={smtpPort}
              onChange={(e) => setSmtpPort(e.target.value)}
              margin="normal"
              type="number"
              required
              sx={{ flex: 1 }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={smtpSecure}
                  onChange={(e) => setSmtpSecure(e.target.checked)}
                />
              }
              label="Use SSL/TLS"
              sx={{ mt: 2 }}
            />
          </Box>

          <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>Authentication</Typography>
          <TextField
            fullWidth
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            margin="normal"
            required={false}
            helperText="Leave blank to keep existing password"
          />
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => { setEditDialogOpen(false); resetForm(); }}>Cancel</Button>
          <Button 
            onClick={handleUpdate} 
            variant="contained"
          >
            Update Account
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
