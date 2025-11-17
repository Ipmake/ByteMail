import React from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
} from '@mui/material';
import { useSettingsStore } from '../../stores/settingsStore';
import type { EmailSettings } from '../../types/settings';

interface EmailSettingsPanelProps {
  settings: EmailSettings;
}

export const EmailSettingsPanel: React.FC<EmailSettingsPanelProps> = ({ settings }) => {
  const { updateCategory, resetCategory } = useSettingsStore();
  const [localSettings, setLocalSettings] = React.useState(settings);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleChange = <K extends keyof EmailSettings>(field: K, value: EmailSettings[K]) => {
    setLocalSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateCategory('email', localSettings);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      await resetCategory('email');
    } catch (error) {
      console.error('Failed to reset settings:', error);
    }
  };

  const hasChanges = JSON.stringify(localSettings) !== JSON.stringify(settings);

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Email Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure how you send and receive emails
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 600 }}>
        <TextField
          fullWidth
          label="Email Signature"
          value={localSettings.signature || ''}
          onChange={(e) => handleChange('signature', e.target.value || undefined)}
          multiline
          rows={4}
          helperText="Automatically added to the end of your emails"
        />

        <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
          <Button variant="outlined" onClick={handleReset}>
            Reset to Default
          </Button>
        </Box>
      </Box>
    </Box>
  );
};
