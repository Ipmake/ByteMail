import { create } from 'zustand';
import { settingsApi } from '../api';
import type { UserSettings, SettingCategory, SettingUpdate } from '../types/settings';

interface SettingsState {
  settings: UserSettings | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadSettings: () => Promise<void>;
  updateCategory: <T extends SettingCategory>(
    category: T,
    updates: SettingUpdate<T>
  ) => Promise<void>;
  resetCategory: (category: SettingCategory) => Promise<void>;
  resetAll: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  settings: null,
  isLoading: false,
  error: null,

  loadSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      const settings = await settingsApi.getSettings();
      set({ settings, isLoading: false });
    } catch (error) {
      console.error('Failed to load settings:', error);
      set({ 
        error: 'Failed to load settings',
        isLoading: false 
      });
    }
  },

  updateCategory: async <T extends SettingCategory>(
    category: T,
    updates: SettingUpdate<T>
  ) => {
    const currentSettings = get().settings;
    if (!currentSettings) return;

    // Optimistic update
    const newSettings = {
      ...currentSettings,
      [category]: {
        ...currentSettings[category],
        ...updates,
      },
    };
    set({ settings: newSettings });

    try {
      const updatedSettings = await settingsApi.updateSettings(category, updates);
      set({ settings: updatedSettings });
    } catch (error) {
      console.error('Failed to update settings:', error);
      // Revert on error
      set({ settings: currentSettings, error: 'Failed to update settings' });
      throw error;
    }
  },

  resetCategory: async (category: SettingCategory) => {
    try {
      const updatedSettings = await settingsApi.resetCategory(category);
      set({ settings: updatedSettings });
    } catch (error) {
      console.error('Failed to reset category:', error);
      set({ error: 'Failed to reset settings' });
      throw error;
    }
  },

  resetAll: async () => {
    try {
      const updatedSettings = await settingsApi.resetAll();
      set({ settings: updatedSettings });
    } catch (error) {
      console.error('Failed to reset all settings:', error);
      set({ error: 'Failed to reset settings' });
      throw error;
    }
  },
}));
