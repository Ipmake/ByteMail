import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  Button,
} from '@mui/material';
import { useSettingsStore } from '../stores/settingsStore';
import { GeneralSettingsPanel } from '../components/settings/GeneralSettingsPanel';
import { EmailSettingsPanel } from '../components/settings/EmailSettingsPanel';
import { NotificationSettingsPanel } from '../components/settings/NotificationSettingsPanel';
import { DisplaySettingsPanel } from '../components/settings/DisplaySettingsPanel';
import { PrivacySettingsPanel } from '../components/settings/PrivacySettingsPanel';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
};

export const SettingsPage: React.FC = () => {
  const { settings, isLoading, error, loadSettings } = useSettingsStore();
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          p: 4,
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">{error}</Alert>
        <Button onClick={loadSettings} sx={{ mt: 2 }}>
          Retry
        </Button>
      </Box>
    );
  }

  if (!settings) {
    return null;
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', width: '100%' }}>
      <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h4" fontWeight={600}>
          Settings
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Manage your account preferences and settings
        </Typography>
      </Box>

      <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        <Paper
          elevation={0}
          sx={{
            minWidth: 240,
          }}
        >
          <Tabs
            orientation="vertical"
            value={activeTab}
            onChange={handleTabChange}
          >
            <Tab label="General" />
            <Tab label="Email" />
            <Tab label="Notifications" />
            <Tab label="Display" />
            <Tab label="Privacy" />
          </Tabs>
        </Paper>

        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <TabPanel value={activeTab} index={0}>
            <GeneralSettingsPanel settings={settings.general} />
          </TabPanel>
          <TabPanel value={activeTab} index={1}>
            <EmailSettingsPanel settings={settings.email} />
          </TabPanel>
          <TabPanel value={activeTab} index={2}>
            <NotificationSettingsPanel settings={settings.notifications} />
          </TabPanel>
          <TabPanel value={activeTab} index={3}>
            <DisplaySettingsPanel settings={settings.display} />
          </TabPanel>
          <TabPanel value={activeTab} index={4}>
            <PrivacySettingsPanel settings={settings.privacy} />
          </TabPanel>
        </Box>
      </Box>
    </Box>
  );
};
