import React from 'react';
import {
  Box,
  Typography,
  Switch,
  FormControlLabel,
  Button,
} from '@mui/material';
import { useSettingsStore } from '../../stores/settingsStore';
import type { NotificationSettings } from '../../types/settings';

interface NotificationSettingsPanelProps {
  settings: NotificationSettings;
}

export const NotificationSettingsPanel: React.FC<NotificationSettingsPanelProps> = ({ settings }) => {
  const { updateCategory, resetCategory } = useSettingsStore();
  const [localSettings, setLocalSettings] = React.useState(settings);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleChange = <K extends keyof NotificationSettings>(
    field: K,
    value: NotificationSettings[K]
  ) => {
    setLocalSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateCategory('notifications', localSettings);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      await resetCategory('notifications');
    } catch (error) {
      console.error('Failed to reset settings:', error);
    }
  };

  const hasChanges = JSON.stringify(localSettings) !== JSON.stringify(settings);

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Notification Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Manage how you receive notifications
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 600 }}>
        <FormControlLabel
          control={
            <Switch
              checked={localSettings.soundEnabled}
              onChange={(e) => handleChange('soundEnabled', e.target.checked)}
            />
          }
          label="Sound notifications"
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
