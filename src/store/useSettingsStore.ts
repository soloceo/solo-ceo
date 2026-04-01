import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  operatorName: string;
  operatorAvatar: string;
  language: string;
  currency: string;
  timezone: string;

  // Connection state
  isOnline: boolean;
  syncStatus: "idle" | "syncing";
  pendingOps: number;

  setOperator: (name: string, avatar?: string) => void;
  setLanguage: (lang: string) => void;
  setCurrency: (currency: string) => void;
  setTimezone: (tz: string) => void;
  setOnline: (online: boolean) => void;
  setSyncStatus: (status: "idle" | "syncing") => void;
  setPendingOps: (count: number) => void;
  resetForSignOut: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      operatorName: "",
      operatorAvatar: "",
      language: "zh",
      currency: "USD",
      timezone: typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "America/New_York",
      isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
      syncStatus: "idle",
      pendingOps: 0,

      setOperator: (name, avatar) =>
        set((s) => ({
          operatorName: name,
          operatorAvatar: avatar ?? s.operatorAvatar,
        })),
      setLanguage: (lang) => set({ language: lang }),
      setCurrency: (currency) => set({ currency }),
      setTimezone: (tz) => set({ timezone: tz }),
      setOnline: (online) => set({ isOnline: online }),
      setSyncStatus: (status) => set({ syncStatus: status }),
      setPendingOps: (count) => set({ pendingOps: count }),
      /** Reset all user-specific state on sign-out */
      resetForSignOut: () => set({
        operatorName: '',
        operatorAvatar: '',
        currency: 'USD',
        timezone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'America/New_York',
        pendingOps: 0,
        syncStatus: 'idle',
      }),
    }),
    {
      name: "solo-ceo-settings",
      partialize: (state) => ({
        operatorName: state.operatorName,
        operatorAvatar: state.operatorAvatar,
        language: state.language,
        currency: state.currency,
        timezone: state.timezone,
      }),
    },
  ),
);
