import { create } from "zustand";

interface EmailAddress {
    name?: string;
    address: string;
}

interface ComposeData {
    to: EmailAddress[];
    cc: EmailAddress[];
    bcc: EmailAddress[];
    subject: string;
    body: string;
    attachments: { file: File; name: string; size: number; type: string }[];
    isHtml: boolean;
    priority: 'low' | 'normal' | 'high';
    requestReadReceipt: boolean;
}

interface ComposeStore {
    mode: 'new' | 'reply' | 'forward' | 'draft' | null;
    emailId: string | null;
    accountId: string | null;
    folderPath: string | null;
    isOpen: boolean;
    initialData: Partial<ComposeData> | null;
    openCompose: (mode: 'new' | 'reply' | 'forward' | 'draft', options?: {
        emailId?: string;
        accountId?: string;
        folderPath?: string;
        initialData?: Partial<ComposeData>;
    }) => void;
    closeCompose: () => void;
}

export const useComposeStore = create<ComposeStore>((set) => ({
    mode: null,
    emailId: null,
    accountId: null,
    folderPath: null,
    isOpen: false,
    initialData: null,
    openCompose: (mode, options = {}) => set({ 
        mode, 
        emailId: options.emailId || null,
        accountId: options.accountId || null,
        folderPath: options.folderPath || null,
        initialData: options.initialData || null,
        isOpen: true 
    }),
    closeCompose: () => set({ 
        mode: null, 
        emailId: null, 
        accountId: null,
        folderPath: null,
        initialData: null,
        isOpen: false 
    }),
}));
