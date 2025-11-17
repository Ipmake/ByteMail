import React from 'react';
import {
  Box,
  Typography,
  Switch,
  FormControlLabel,
  Button,
} from '@mui/material';
import { useSettingsStore } from '../../stores/settingsStore';
import type { PrivacySettings } from '../../types/settings';

interface PrivacySettingsPanelProps {
  settings: PrivacySettings;
}

export const PrivacySettingsPanel: React.FC<PrivacySettingsPanelProps> = ({ settings }) => {
  const { updateCategory, resetCategory } = useSettingsStore();
  const [localSettings, setLocalSettings] = React.useState(settings);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleChange = <K extends keyof PrivacySettings>(
    field: K,
    value: PrivacySettings[K]
  ) => {
    setLocalSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateCategory('privacy', localSettings);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      await resetCategory('privacy');
    } catch (error) {
      console.error('Failed to reset settings:', error);
    }
  };

  const hasChanges = JSON.stringify(localSettings) !== JSON.stringify(settings);

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Privacy Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Control your privacy and security preferences
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 600 }}>
        <FormControlLabel
          control={
            <Switch
              checked={localSettings.blockExternalImages}
              onChange={(e) => handleChange('blockExternalImages', e.target.checked)}
            />
          }
          label="Block external images in emails"
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
