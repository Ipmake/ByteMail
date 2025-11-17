import axios from 'axios';
import type {
  LoginCredentials,
  AuthResponse,
  User,
  EmailAccount,
  CreateEmailAccountData,
  Folder,
  Email,
  EmailListResponse,
  SendEmailData,
  ServerSettings,
  UserWithCount,
  CreateUserData,
  UpdateUserData,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  // Get token from localStorage
  const token = localStorage.getItem('auth-token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth API
export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>('/auth/login', credentials);
    return data;
  },

  getMe: async (): Promise<User> => {
    const { data } = await api.get<User>('/auth/me');
    return data;
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    await api.post('/auth/change-password', { currentPassword, newPassword });
  },
};

// Email Accounts API
export const emailAccountsApi = {
  getAll: async (): Promise<EmailAccount[]> => {
    const { data } = await api.get<EmailAccount[]>('/email-accounts');
    return data;
  },

  getById: async (id: string): Promise<EmailAccount> => {
    const { data } = await api.get<EmailAccount>(`/email-accounts/${id}`);
    return data;
  },

  create: async (accountData: CreateEmailAccountData): Promise<EmailAccount> => {
    const { data } = await api.post<EmailAccount>('/email-accounts', accountData);
    return data;
  },

  update: async (id: string, accountData: Partial<CreateEmailAccountData>): Promise<EmailAccount> => {
    const { data } = await api.put<EmailAccount>(`/email-accounts/${id}`, accountData);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/email-accounts/${id}`);
  },

  sync: async (id: string): Promise<void> => {
    await api.post(`/email-accounts/${id}/sync`);
  },
};

// Emails API
export const emailsApi = {
  getFolders: async (accountId: string): Promise<Folder[]> => {
    const { data } = await api.get<Folder[]>(`/emails/accounts/${accountId}/folders`);
    return data;
  },

  createFolder: async (accountId: string, name: string): Promise<Folder> => {
    const { data } = await api.post<Folder>(`/emails/accounts/${accountId}/folders`, { name });
    return data;
  },

  renameFolder: async (folderId: string, newName: string): Promise<void> => {
    await api.patch(`/emails/folders/${folderId}/rename`, { newName });
  },

  deleteFolder: async (folderId: string): Promise<void> => {
    await api.delete(`/emails/folders/${folderId}`);
  },

  getEmails: async (
    folderId: string,
    page = 1,
    limit = 50,
    search?: string
  ): Promise<EmailListResponse> => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(search && { search }),
    });
    const { data } = await api.get<EmailListResponse>(
      `/emails/folders/${folderId}/emails?${params}`
    );
    return data;
  },

  getById: async (id: string): Promise<Email> => {
    const { data } = await api.get<Email>(`/emails/${id}`);
    return data;
  },

  markAsRead: async (id: string, isRead: boolean): Promise<void> => {
    await api.patch(`/emails/${id}/read`, { isRead });
  },

  markAsFlagged: async (id: string, isFlagged: boolean): Promise<void> => {
    await api.patch(`/emails/${id}/flag`, { isFlagged });
  },

  moveEmail: async (id: string, folderId: string): Promise<void> => {
    await api.patch(`/emails/${id}/move`, { folderId });
  },

  send: async (emailData: SendEmailData): Promise<void> => {
    await api.post('/emails/send', emailData);
  },

  saveDraft: async (draftData: {
    accountId: string;
    to?: string[];
    cc?: string[];
    bcc?: string[];
    subject?: string;
    body?: string;
    draftId?: string;
  }): Promise<{ draft: Email }> => {
    const { data } = await api.post<{ draft: Email }>('/emails/drafts', draftData);
    return data;
  },

  deleteDraft: async (draftId: string): Promise<void> => {
    await api.delete(`/emails/drafts/${draftId}`);
  },

  getTemplates: async (accountId: string): Promise<{ templates: Array<{ id: string; subject: string; textBody: string; createdAt: string }> }> => {
    const { data } = await api.get(`/emails/accounts/${accountId}/templates`);
    return data;
  },

  saveTemplate: async (accountId: string, name: string, body: string): Promise<{ template: Email }> => {
    const { data } = await api.post<{ template: Email }>(`/emails/accounts/${accountId}/templates`, { name, body });
    return data;
  },

  deleteTemplate: async (templateId: string): Promise<void> => {
    await api.delete(`/emails/templates/${templateId}`);
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/emails/${id}`);
  },

  downloadAttachment: (emailId: string, attachmentIndex: number, filename: string): void => {
    const token = localStorage.getItem('token');
    const url = `${API_BASE_URL}/emails/${emailId}/attachments/${attachmentIndex}`;
    
    // Use fetch with auth header
    fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })
      .then((response) => response.blob())
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      })
      .catch((error) => {
        console.error('Download failed:', error);
      });
  },
};

// Admin API
export const adminApi = {
  getUsers: async (): Promise<UserWithCount[]> => {
    const { data } = await api.get<UserWithCount[]>('/admin/users');
    return data;
  },

  getUserDetails: async (id: string): Promise<User & { 
    emailAccounts?: Array<{
      id: string;
      emailAddress: string;
      displayName?: string;
      imapHost: string;
      imapPort: number;
      smtpHost: string;
      smtpPort: number;
      username: string;
      isActive?: boolean;
      lastSyncAt?: string;
    }>;
    updatedAt?: string;
  }> => {
    const { data } = await api.get(`/admin/users/${id}`);
    return data;
  },

  createUser: async (userData: CreateUserData): Promise<User> => {
    const { data } = await api.post<User>('/admin/users', userData);
    return data;
  },

  updateUser: async (id: string, userData: UpdateUserData): Promise<User> => {
    const { data } = await api.put<User>(`/admin/users/${id}`, userData);
    return data;
  },

  deleteUser: async (id: string): Promise<void> => {
    await api.delete(`/admin/users/${id}`);
  },

  getSettings: async (): Promise<ServerSettings> => {
    const { data } = await api.get<ServerSettings>('/admin/settings');
    return data;
  },

  updateSettings: async (settings: Partial<ServerSettings>): Promise<ServerSettings> => {
    const { data } = await api.put<ServerSettings>('/admin/settings', settings);
    return data;
  },
};

// Settings API
export const settingsApi = {
  getSettings: async () => {
    const { data } = await api.get('/settings');
    return data;
  },

  updateSettings: async <T extends keyof import('../types/settings').UserSettings>(
    category: T,
    updates: Partial<import('../types/settings').UserSettings[T]>
  ) => {
    const { data } = await api.patch(`/settings/${category}`, updates);
    return data;
  },

  resetCategory: async (category: keyof import('../types/settings').UserSettings) => {
    const { data } = await api.post(`/settings/${category}/reset`);
    return data;
  },

  resetAll: async () => {
    const { data } = await api.post('/settings/reset');
    return data;
  },
};

export default api;
