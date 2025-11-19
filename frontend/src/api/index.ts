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
import { useSocketStore } from '../stores/socketStore';

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

// Helper to get socketId from socket store
const getSocketId = (): string | null => {
  const socket = useSocketStore.getState().socket;
  return socket?.id || null;
};

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
};

// Emails API
export const emailsApi = {
  getFolders: async (accountId: string, socketId?: string): Promise<Folder[]> => {
    const sid = socketId || getSocketId();
    const { data } = await api.get<Folder[]>(`/emails/accounts/${accountId}/folders`, {
      params: { socketId: sid }
    });
    return data;
  },

  createFolder: async (accountId: string, name: string, socketId?: string): Promise<Folder> => {
    const sid = socketId || getSocketId();
    const { data } = await api.post<Folder>(`/emails/accounts/${accountId}/folders`, { 
      name,
      socketId: sid 
    });
    return data;
  },

  renameFolder: async (folderId: string, newName: string, socketId?: string): Promise<void> => {
    const sid = socketId || getSocketId();
    await api.patch(`/emails/folders/${folderId}/rename`, { 
      newName,
      socketId: sid 
    });
  },

  deleteFolder: async (folderId: string, socketId?: string): Promise<void> => {
    const sid = socketId || getSocketId();
    await api.delete(`/emails/folders/${folderId}`, {
      params: { socketId: sid }
    });
  },

  getEmails: async (
    folderId: string,
    page = 1,
    limit = 50,
    search?: string,
    socketId?: string
  ): Promise<EmailListResponse> => {
    const sid = socketId || getSocketId();
    const { data } = await api.get<EmailListResponse>(
      `/emails/folders/${folderId}/emails`,
      {
        params: {
          page,
          limit,
          ...(search && { search }),
          ...(sid && { socketId: sid }),
        }
      }
    );
    return data;
  },

  getById: async (id: string, socketId?: string): Promise<Email> => {
    const sid = socketId || getSocketId();
    const { data } = await api.get<Email>(`/emails/${id}`, {
      params: { socketId: sid }
    });
    return data;
  },

  getByUid: async (accountId: string, folderPath: string, uid: number, socketId?: string): Promise<Email> => {
    const sid = socketId || getSocketId();
    const { data } = await api.get<{ email: Email }>(
      `/emails/${accountId}/${encodeURIComponent(folderPath)}/${uid}`,
      {
        params: { socketId: sid }
      }
    );
    return data.email;
  },

  markAsRead: async (id: string, isRead: boolean, socketId?: string): Promise<void> => {
    const sid = socketId || getSocketId();
    await api.patch(`/emails/${id}/read`, { 
      isRead,
      socketId: sid 
    });
  },

  markAsReadByUid: async (accountId: string, folderPath: string, uid: number, isRead: boolean, socketId?: string): Promise<void> => {
    const sid = socketId || getSocketId();
    await api.put(
      `/emails/${accountId}/${encodeURIComponent(folderPath)}/${uid}/read`,
      { 
        isRead,
        socketId: sid 
      }
    );
  },

  markAsFlagged: async (id: string, isFlagged: boolean, socketId?: string): Promise<void> => {
    const sid = socketId || getSocketId();
    await api.patch(`/emails/${id}/flag`, { 
      isFlagged,
      socketId: sid 
    });
  },

  markAsFlaggedByUid: async (accountId: string, folderPath: string, uid: number, isFlagged: boolean, socketId?: string): Promise<void> => {
    const sid = socketId || getSocketId();
    await api.put(
      `/emails/${accountId}/${encodeURIComponent(folderPath)}/${uid}/flag`,
      { 
        isFlagged,
        socketId: sid 
      }
    );
  },

  deleteByUid: async (accountId: string, folderPath: string, uid: number, socketId?: string): Promise<void> => {
    const sid = socketId || getSocketId();
    await api.delete(
      `/emails/${accountId}/${encodeURIComponent(folderPath)}/${uid}`,
      {
        params: { socketId: sid }
      }
    );
  },

  moveEmail: async (id: string, folderId: string, socketId?: string): Promise<void> => {
    const sid = socketId || getSocketId();
    await api.patch(`/emails/${id}/move`, { 
      folderId,
      socketId: sid 
    });
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
