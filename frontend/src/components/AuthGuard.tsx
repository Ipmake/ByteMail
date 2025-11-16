import React, { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { LoginPage } from '../pages/LoginPage';
import { Box, CircularProgress } from '@mui/material';

interface AuthGuardProps {
  children: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const { isAuthenticated, isLoading, token, refreshUser } = useAuthStore();

  useEffect(() => {
    // If we have a token but no user data loaded yet, refresh user
    if (token && !isLoading) {
      refreshUser();
    }
  }, [token, isLoading, refreshUser]);

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
