import { create } from "zustand";
import type { EmailAccount, Folder } from "../types";

// Extend EmailAccount with idle connection status
export interface EmailAccountWithIdle extends EmailAccount {
  isIdleConnected: boolean;
}

interface AccountStore {
  accounts: EmailAccountWithIdle[] | null;
  folders: Record<string, Folder[]>; // accountId -> Folder[]
  
  // Actions
  setAccounts: (accounts: EmailAccount[]) => void;
  updateAccountIdleStatus: (accountId: string, isIdleConnected: boolean) => void;
  setFolders: (accountId: string, folders: Folder[]) => void;
  clearFolders: (accountId: string) => void;
  clearAll: () => void;
}

export const useAccountStore = create<AccountStore>((set) => ({
  accounts: null,
  folders: {},

  setAccounts: (accounts) =>
    set({
      accounts: accounts.map((acc) => ({
        ...acc,
        isIdleConnected: false,
      })),
    }),

  updateAccountIdleStatus: (accountId, isIdleConnected) =>
    set((state) => ({
      accounts: state.accounts?.map((acc) =>
        acc.id === accountId ? { ...acc, isIdleConnected } : acc
      ) || null,
    })),

  setFolders: (accountId, folders) =>
    set((state) => ({
      folders: {
        ...state.folders,
        [accountId]: folders,
      },
    })),

  clearFolders: (accountId) =>
    set((state) => {
      const newFolders = { ...state.folders };
      delete newFolders[accountId];
      return { folders: newFolders };
    }),

  clearAll: () =>
    set({
      accounts: null,
      folders: {},
    }),
}));
