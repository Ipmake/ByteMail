import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  MenuItem,
  Box,
  IconButton,
  Typography,
  CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import { emailsApi } from '../api';
import type { EmailAccount } from '../types';

interface ComposeDialogProps {
  open: boolean;
  onClose: () => void;
  accounts: EmailAccount[];
  defaultAccountId?: string;
  replyTo?: {
    to: string;
    subject: string;
    inReplyTo?: string;
    references?: string[];
  };
}

export const ComposeDialog: React.FC<ComposeDialogProps> = ({
  open,
  onClose,
  accounts,
  defaultAccountId,
  replyTo,
}) => {
  const [accountId, setAccountId] = useState(
    defaultAccountId || accounts[0]?.id || ''
  );
  const [to, setTo] = useState(replyTo?.to || '');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState(replyTo?.subject || '');
  const [body, setBody] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    if (!accountId || !to || !subject) {
      setError('Please fill in all required fields');
      return;
    }

    setIsSending(true);
    setError('');

    try {
      await emailsApi.send({
        accountId,
        to,
        cc: cc || undefined,
        bcc: bcc || undefined,
        subject,
        text: body,
        inReplyTo: replyTo?.inReplyTo,
        references: replyTo?.references,
      });

      onClose();
      // Reset form
      setTo('');
      setCc('');
      setBcc('');
      setSubject('');
      setBody('');
    } catch (err) {
      setError('Failed to send email. Please try again.');
      console.error('Send error:', err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ flex: 1 }}>
            New Message
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            select
            label="From"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            fullWidth
            size="small"
          >
            {accounts.map((account) => (
              <MenuItem key={account.id} value={account.id}>
                {account.displayName || account.emailAddress} &lt;
                {account.emailAddress}&gt;
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="To"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            fullWidth
            size="small"
            required
            placeholder="recipient@example.com"
          />

          {!showCc && !showBcc && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" onClick={() => setShowCc(true)}>
                Cc
              </Button>
              <Button size="small" onClick={() => setShowBcc(true)}>
                Bcc
              </Button>
            </Box>
          )}

          {showCc && (
            <TextField
              label="Cc"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              fullWidth
              size="small"
              placeholder="cc@example.com"
            />
          )}

          {showBcc && (
            <TextField
              label="Bcc"
              value={bcc}
              onChange={(e) => setBcc(e.target.value)}
              fullWidth
              size="small"
              placeholder="bcc@example.com"
            />
          )}

          <TextField
            label="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            fullWidth
            size="small"
            required
          />

          <TextField
            label="Message"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            fullWidth
            multiline
            rows={12}
            placeholder="Type your message here..."
          />

          {error && (
            <Typography variant="body2" color="error">
              {error}
            </Typography>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={isSending}>
          Cancel
        </Button>
        <Button
          onClick={handleSend}
          variant="contained"
          startIcon={isSending ? <CircularProgress size={16} /> : <SendIcon />}
          disabled={isSending || !accountId || !to || !subject}
        >
          {isSending ? 'Sending...' : 'Send'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
