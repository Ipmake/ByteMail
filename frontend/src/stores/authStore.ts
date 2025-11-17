import { create } from 'zustand';
import { authApi } from '../api';
import type { User, LoginCredentials } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  clearError: () => void;
  initializeAuth: () => void;
}

// Helper functions for localStorage
const getStoredToken = (): string | null => {
  return localStorage.getItem('auth-token');
};

const setStoredToken = (token: string): void => {
  localStorage.setItem('auth-token', token);
};

const removeStoredToken = (): void => {
  localStorage.removeItem('auth-token');
};

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  token: getStoredToken(),
  isAuthenticated: false,
  isLoading: true,
  error: null,

  login: async (credentials: LoginCredentials) => {
    set({ error: null });
    try {
      const response = await authApi.login(credentials);
      setStoredToken(response.token);
      set({
        user: response.user,
        token: response.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      set({
        error: err.response?.data?.error || 'Invalid username or password',
        isLoading: false,
        isAuthenticated: false,
      });
      throw error;
    }
  },

  logout: () => {
    removeStoredToken();
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      error: null,
    });
  },

  refreshUser: async () => {
    const { token } = get();
    if (!token) {
      set({ isLoading: false });
      return;
    }

    try {
      const user = await authApi.getMe();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      console.error('Failed to refresh user:', error);
      removeStoredToken();
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        error: 'Session expired. Please log in again.',
        isLoading: false,
      });
    }
  },

  clearError: () => {
    set({ error: null });
  },

  initializeAuth: () => {
    const token = getStoredToken();
    if (token) {
      // Set token and trigger user fetch
      set({
        token,
        isLoading: true,
      });
      // Fetch user data
      get().refreshUser();
    } else {
      set({
        token: null,
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },
}));
