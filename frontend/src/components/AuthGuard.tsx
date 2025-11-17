import React, { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';
import { LoginPage } from '../pages/LoginPage';
import { Box, CircularProgress } from '@mui/material';

interface AuthGuardProps {
  children: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const { isAuthenticated, isLoading, initializeAuth } = useAuthStore();
  const { loadSettings } = useSettingsStore();

  useEffect(() => {
    // Initialize auth state from localStorage on mount
    // This will automatically fetch user data if token exists
    initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    // Load user settings once authenticated
    if (isAuthenticated) {
      loadSettings();
    }
  }, [isAuthenticated, loadSettings]);

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #121212 0%, #1e1e1e 100%)',
        }}
      >
        <CircularProgress size={60} />
      </Box>
    );
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // Show app if authenticated
  return <>{children}</>;
};
