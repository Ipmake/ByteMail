// Settings type definitions organized by category

export interface GeneralSettings {
  language: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
}

export interface EmailSettings {
  signature?: string;
}

export interface NotificationSettings {
  soundEnabled: boolean;
}

export interface DisplaySettings {
  applyThemeToEmailViewer: boolean;
}

export interface PrivacySettings {
  blockExternalImages: boolean;
}

// Combined settings interface
export interface UserSettings {
  general: GeneralSettings;
  email: EmailSettings;
  notifications: NotificationSettings;
  display: DisplaySettings;
  privacy: PrivacySettings;
}

// Default settings
export const defaultSettings: UserSettings = {
  general: {
    language: 'en',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h',
  },
  email: {
    signature: '\n Sent using ByteMail',
  },
  notifications: {
    soundEnabled: true,
  },
  display: {
    applyThemeToEmailViewer: true,
  },
  privacy: {
    blockExternalImages: false
  },
};

// Helper type for setting updates
export type SettingCategory = keyof UserSettings;
export type SettingUpdate<T extends SettingCategory> = Partial<UserSettings[T]>;
