import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  FormControlLabel,
  Switch,
  Stepper,
  Step,
  StepLabel,
  CircularProgress,
  Alert,
} from '@mui/material';
import { emailAccountsApi } from '../api';
import type { CreateEmailAccountData } from '../types';

interface AddAccountDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const steps = ['Account Info', 'IMAP Settings', 'SMTP Settings', 'Review'];

export const AddAccountDialog: React.FC<AddAccountDialogProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState<CreateEmailAccountData>({
    emailAddress: '',
    displayName: '',
    imapHost: '',
    imapPort: 993,
    imapSecure: true,
    smtpHost: '',
    smtpPort: 465,
    smtpSecure: true,
    username: '',
    password: '',
  });

  const handleNext = () => {
    setActiveStep((prev) => prev + 1);
    setError('');
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
    setError('');
  };

  const handleChange = (field: keyof CreateEmailAccountData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setError('');

    try {
      await emailAccountsApi.create(formData);
      onSuccess();
      onClose();
      // Reset form
      setFormData({
        emailAddress: '',
        displayName: '',
        imapHost: '',
        imapPort: 993,
        imapSecure: true,
        smtpHost: '',
        smtpPort: 465,
        smtpSecure: true,
        username: '',
        password: '',
      });
      setActiveStep(0);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const response = err as { response?: { data?: { error?: string } } };
        setError(response.response?.data?.error || 'Failed to add account');
      } else {
        setError('Failed to add account');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Email Address"
              type="email"
              value={formData.emailAddress}
              onChange={(e) => handleChange('emailAddress', e.target.value)}
              fullWidth
              required
              placeholder="you@example.com"
            />
            <TextField
              label="Display Name"
              value={formData.displayName}
              onChange={(e) => handleChange('displayName', e.target.value)}
              fullWidth
              placeholder="Your Name (optional)"
            />
            <TextField
              label="Username"
              value={formData.username}
              onChange={(e) => handleChange('username', e.target.value)}
              fullWidth
              required
              placeholder="Usually same as email"
              helperText="Usually same as your email address"
            />
            <TextField
              label="Password"
              type="password"
              value={formData.password}
              onChange={(e) => handleChange('password', e.target.value)}
              fullWidth
              required
            />
          </Box>
        );

      case 1:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Configure incoming mail server (IMAP)
            </Typography>
            <TextField
              label="IMAP Host"
              value={formData.imapHost}
              onChange={(e) => handleChange('imapHost', e.target.value)}
              fullWidth
              required
              placeholder="imap.example.com"
            />
            <TextField
              label="IMAP Port"
              type="number"
              value={formData.imapPort}
              onChange={(e) => handleChange('imapPort', parseInt(e.target.value))}
              fullWidth
              required
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.imapSecure}
                  onChange={(e) => {
                    const secure = e.target.checked;
                    handleChange('imapSecure', secure);
                    // Automatically set port based on SSL/TLS setting
                    handleChange('imapPort', secure ? 993 : 143);
                  }}
                />
              }
              label="Use SSL/TLS"
            />
          </Box>
        );

      case 2:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Configure outgoing mail server (SMTP)
            </Typography>
            <TextField
              label="SMTP Host"
              value={formData.smtpHost}
              onChange={(e) => handleChange('smtpHost', e.target.value)}
              fullWidth
              required
              placeholder="smtp.example.com"
            />
            <TextField
              label="SMTP Port"
              type="number"
              value={formData.smtpPort}
              onChange={(e) => handleChange('smtpPort', parseInt(e.target.value))}
              fullWidth
              required
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.smtpSecure}
                  onChange={(e) => {
                    const secure = e.target.checked;
                    handleChange('smtpSecure', secure);
                    // Automatically set port based on SSL/TLS setting
                    handleChange('smtpPort', secure ? 465 : 587);
                  }}
                />
              }
              label="Use SSL/TLS"
            />
          </Box>
        );

      case 3:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h6" gutterBottom>
              Review Settings
            </Typography>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Email Address
              </Typography>
              <Typography variant="body1">{formData.emailAddress}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                IMAP Server
              </Typography>
              <Typography variant="body1">
                {formData.imapHost}:{formData.imapPort} (
                {formData.imapSecure ? 'SSL' : 'No SSL'})
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                SMTP Server
              </Typography>
              <Typography variant="body1">
                {formData.smtpHost}:{formData.smtpPort} (
                {formData.smtpSecure ? 'SSL' : 'No SSL'})
              </Typography>
            </Box>
            <Alert severity="info">
              The connection will be tested when you click "Add Account"
            </Alert>
          </Box>
        );

      default:
        return null;
    }
  };

  const isStepValid = (step: number): boolean => {
    switch (step) {
      case 0:
        return !!(
          formData.emailAddress &&
          formData.username &&
          formData.password
        );
      case 1:
        return !!(formData.imapHost && formData.imapPort);
      case 2:
        return !!(formData.smtpHost && formData.smtpPort);
      case 3:
        return true;
      default:
        return false;
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Email Account</DialogTitle>

      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {renderStepContent(activeStep)}

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        {activeStep > 0 && (
          <Button onClick={handleBack} disabled={isLoading}>
            Back
          </Button>
        )}
        {activeStep < steps.length - 1 ? (
          <Button
            onClick={handleNext}
            variant="contained"
            disabled={!isStepValid(activeStep)}
          >
            Next
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={isLoading || !isStepValid(activeStep)}
            startIcon={isLoading ? <CircularProgress size={16} /> : null}
          >
            {isLoading ? 'Adding...' : 'Add Account'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
