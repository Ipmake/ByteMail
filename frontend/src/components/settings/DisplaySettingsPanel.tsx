import React from 'react';
import {
  Box,
  Typography,
  Switch,
  FormControlLabel,
  Button,
} from '@mui/material';
import { useSettingsStore } from '../../stores/settingsStore';
import type { DisplaySettings } from '../../types/settings';

interface DisplaySettingsPanelProps {
  settings: DisplaySettings;
}

export const DisplaySettingsPanel: React.FC<DisplaySettingsPanelProps> = ({ settings }) => {
  const { updateCategory, resetCategory } = useSettingsStore();
  const [localSettings, setLocalSettings] = React.useState(settings);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleChange = <K extends keyof DisplaySettings>(
    field: K,
    value: DisplaySettings[K]
  ) => {
    setLocalSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateCategory('display', localSettings);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      await resetCategory('display');
    } catch (error) {
      console.error('Failed to reset settings:', error);
    }
  };

  const hasChanges = JSON.stringify(localSettings) !== JSON.stringify(settings);

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Display Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Customize how your inbox looks
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 600 }}>
        <FormControlLabel
          control={
            <Switch
              checked={localSettings.applyThemeToEmailViewer}
              onChange={(e) => handleChange('applyThemeToEmailViewer', e.target.checked)}
            />
          }
          label="Apply theme to email viewer"
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
