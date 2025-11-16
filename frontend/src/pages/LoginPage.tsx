import { useEffect, useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  InputAdornment,
  IconButton,
  useTheme,
  alpha,
  Collapse,
  Avatar,
  CircularProgress,
} from '@mui/material';
import {
  Person as PersonIcon,
  Lock as LockIcon,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import { useAuthStore } from '../stores/authStore';

export const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const theme = useTheme();

  const login = useAuthStore((state) => state.login);
  const authError = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);

    try {
      await login({ username, password });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setError('');
    clearError();
  }, [username, password, clearError]);

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        position: 'relative',
        // Background image for entire container
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage:
            'url(/loginbackground.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'brightness(0.4)',
          zIndex: 0,
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `linear-gradient(135deg, ${alpha(
            theme.palette.primary.dark,
            0.15
          )} 0%, ${alpha('#000', 0.1)} 100%)`,
          zIndex: 0,
        },
      }}
    >
      {/* Left Side - Image & Branding */}
      <Box
        sx={{
          flex: 1,
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'space-between',
          p: 6,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 1.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: (theme) => theme.palette.background.paper,
              }}
            >
              <Avatar
                src="/icon.png"
                alt="ByteMail Logo"
                sx={{ width: 38, height: 38, color: 'primary.main' }}
              />
            </Box>
            <Typography
              variant="h5"
              fontWeight={700}
              color="white"
              fontSize={24}
            >
              ByteMail
            </Typography>
          </Box>
        </Box>

        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Typography variant="h3" fontWeight={700} color="white" gutterBottom>
            Your Webmail, Your Control
          </Typography>
          <Typography
            variant="h6"
            color="rgba(255, 255, 255, 0.9)"
            sx={{ maxWidth: 500 }}
          >
            A modern, self-hosted webmail client that puts you in control of your
            communication.
          </Typography>

          <Typography
            variant="caption"
            sx={{
              display: 'block',
              mt: 3,
              color: 'rgba(255, 255, 255, 0.6)',
              fontSize: 11,
            }}
          >
            Photo by{' '}
            <a
              href="https://unsplash.com/@mariogogh"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'rgba(255, 255, 255, 0.6)',
                textDecoration: 'none',
                fontWeight: 'bold',
              }}
            >
              Mario Gogh
            </a>{' '}
            on{' '}
            <a
              href="https://unsplash.com/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'rgba(255, 255, 255, 0.6)',
                textDecoration: 'none',
                fontWeight: 'bold',
              }}
            >
              Unsplash
            </a>
          </Typography>
        </Box>
      </Box>

      {/* Right Side - Login Form */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 4,
          bgcolor: 'background.default',
          borderTopLeftRadius: { xs: 0, md: 48 },
          borderBottomLeftRadius: { xs: 0, md: 48 },
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 440 }}>
          <Box sx={{ mb: 5 }}>
            <Typography variant="h4" fontWeight={600} gutterBottom>
              Welcome back
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Sign in to your account to continue
            </Typography>
          </Box>

          <Collapse in={!!error || !!authError} sx={{ mb: 3 }} unmountOnExit>
            <Alert severity="error" sx={{ borderRadius: 1.5 }}>
              {error || authError}
            </Alert>
          </Collapse>

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              sx={{ mb: 3 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              fullWidth
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              sx={{ mb: 4 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                    >
                      {showPassword ? (
                        <VisibilityOff fontSize="small" />
                      ) : (
                        <Visibility fontSize="small" />
                      )}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={loading}
              size="large"
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
              sx={{
                py: 1.5,
                textTransform: 'none',
                fontSize: 16,
                fontWeight: 600,
                borderRadius: 1.5,
              }}
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </Button>
          </Box>

          <Box sx={{ mt: 4, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              Powered by ByteMail - Your self-hosted webmail solution
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
