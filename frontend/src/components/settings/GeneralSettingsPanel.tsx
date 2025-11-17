import React from 'react';
import {
  Box,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
} from '@mui/material';
import { useSettingsStore } from '../../stores/settingsStore';
import type { GeneralSettings } from '../../types/settings';

interface GeneralSettingsPanelProps {
  settings: GeneralSettings;
}

export const GeneralSettingsPanel: React.FC<GeneralSettingsPanelProps> = ({ settings }) => {
  const { updateCategory, resetCategory } = useSettingsStore();
  const [localSettings, setLocalSettings] = React.useState(settings);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleChange = (field: keyof GeneralSettings, value: string) => {
    setLocalSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateCategory('general', localSettings);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      await resetCategory('general');
    } catch (error) {
      console.error('Failed to reset settings:', error);
    }
  };

  const hasChanges = JSON.stringify(localSettings) !== JSON.stringify(settings);

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        General Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure your basic preferences
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 600 }}>
        <FormControl fullWidth>
          <InputLabel>Language</InputLabel>
          <Select
            value={localSettings.language}
            label="Language"
            onChange={(e) => handleChange('language', e.target.value)}
          >
            <MenuItem value="en">English</MenuItem>
            <MenuItem value="es">Spanish</MenuItem>
            <MenuItem value="fr">French</MenuItem>
            <MenuItem value="de">German</MenuItem>
          </Select>
        </FormControl>

        <FormControl fullWidth>
          <InputLabel>Date Format</InputLabel>
          <Select
            value={localSettings.dateFormat}
            label="Date Format"
            onChange={(e) => handleChange('dateFormat', e.target.value)}
          >
            <MenuItem value="MM/DD/YYYY">MM/DD/YYYY</MenuItem>
            <MenuItem value="DD/MM/YYYY">DD/MM/YYYY</MenuItem>
            <MenuItem value="YYYY-MM-DD">YYYY-MM-DD</MenuItem>
          </Select>
        </FormControl>

        <FormControl fullWidth>
          <InputLabel>Time Format</InputLabel>
          <Select
            value={localSettings.timeFormat}
            label="Time Format"
            onChange={(e) => handleChange('timeFormat', e.target.value as '12h' | '24h')}
          >
            <MenuItem value="12h">12-hour (AM/PM)</MenuItem>
            <MenuItem value="24h">24-hour</MenuItem>
          </Select>
        </FormControl>

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
