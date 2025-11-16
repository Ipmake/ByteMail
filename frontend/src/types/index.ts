export interface User {
  id: string;
  username: string;
  email?: string;
  isAdmin: boolean;
  createdAt: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface EmailAccount {
  id: string;
  emailAddress: string;
  displayName?: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  username: string;
  isActive: boolean;
  lastSyncAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmailAccountData {
  emailAddress: string;
  displayName?: string;
  imapHost: string;
  imapPort?: number;
  imapSecure?: boolean;
  smtpHost: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  username: string;
  password: string;
}

export interface Folder {
  id: string;
  emailAccountId: string;
  name: string;
  path: string;
  delimiter: string;
  specialUse?: string;
  unreadCount: number;
  totalCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface EmailAddress {
  name?: string;
  address: string;
}

export interface Email {
  id: string;
  emailAccountId: string;
  folderId: string;
  messageId: string;
  uid: number;
  subject?: string;
  from: EmailAddress[];
  to?: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  replyTo?: EmailAddress[];
  date?: string;
  receivedDate?: string;
  flags: string[];
  isRead: boolean;
  isFlagged: boolean;
  hasAttachments: boolean;
  size: number;
  textBody?: string;
  htmlBody?: string;
  headers?: Record<string, unknown>;
  attachments?: Array<{
    filename: string;
    contentType: string;
    size: number;
  }>;
  inReplyTo?: string;
  references: string[];
  createdAt: string;
  updatedAt: string;
  folder?: {
    id: string;
    name: string;
    path: string;
  };
}

export interface EmailListResponse {
  emails: Email[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SendEmailData {
  accountId: string;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
  inReplyTo?: string;
  references?: string[];
  attachments?: Array<{
    filename: string;
    content: string;
    contentType: string;
    size: number;
  }>;
}

export interface ServerSettings {
  id: string;
  restrictedServer?: string;
  restrictedDomain?: string;
  allowMultipleAccounts: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserWithCount extends User {
  _count: {
    emailAccounts: number;
  };
  updatedAt: string;
}

export interface CreateUserData {
  username: string;
  password: string;
  email?: string;
  isAdmin?: boolean;
}

export interface UpdateUserData {
  username?: string;
  email?: string;
  isAdmin?: boolean;
  password?: string;
}
