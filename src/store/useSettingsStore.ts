import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ProfileFields {
  operatorName: string;
  operatorAvatar: string;
  businessName: string;
  businessDescription: string;
  businessTitle: string;
  businessEmail: string;
  businessPhone: string;
  businessWebsite: string;
  businessLocation: string;
}

interface SettingsState extends ProfileFields {
  language: string;
  currency: string;
  timezone: string;

  // Connection state
  isOnline: boolean;
  syncStatus: "idle" | "syncing";
  pendingOps: number;

  setOperator: (name: string, avatar?: string) => void;
  setProfileField: (field: keyof ProfileFields, value: string) => void;
  setLanguage: (lang: string) => void;
  setCurrency: (currency: string) => void;
  setTimezone: (tz: string) => void;
  setOnline: (online: boolean) => void;
  setSyncStatus: (status: "idle" | "syncing") => void;
  setPendingOps: (count: number) => void;
  resetForSignOut: () => void;
}

const PROFILE_DEFAULTS: ProfileFields = {
  operatorName: "",
  operatorAvatar: "",
  businessName: "",
  businessDescription: "",
  businessTitle: "",
  businessEmail: "",
  businessPhone: "",
  businessWebsite: "",
  businessLocation: "",
};

/** Settings key → Supabase app_settings key mapping */
export const PROFILE_SYNC_KEYS: Record<keyof ProfileFields, string> = {
  operatorName: "OPERATOR_NAME",
  operatorAvatar: "OPERATOR_AVATAR",
  businessName: "BUSINESS_NAME",
  businessDescription: "BUSINESS_DESCRIPTION",
  businessTitle: "BUSINESS_TITLE",
  businessEmail: "BUSINESS_EMAIL",
  businessPhone: "BUSINESS_PHONE",
  businessWebsite: "BUSINESS_WEBSITE",
  businessLocation: "BUSINESS_LOCATION",
};

// ── Pre-seed demo profile for first-time visitors ──
// Must run BEFORE Zustand persist reads localStorage, so the store picks up demo data on first load.
// Only writes if no settings exist yet (first visit). seedData() in db/api.ts handles business data.
(() => {
  try {
    if (typeof localStorage === 'undefined') return;
    const existing = localStorage.getItem('solo-ceo-settings');
    if (existing) return; // Already has settings — don't overwrite
    const demoProfile = {
      state: {
        operatorName: '李明',
        operatorAvatar: '',
        businessTitle: '品牌设计师',
        businessName: 'Ming Design Studio',
        businessDescription: '北美独立品牌设计工作室，服务中小企业品牌视觉——Logo、VI系统、官网、社交媒体设计。订阅制+项目制双模式。',
        businessEmail: '',
        businessPhone: '',
        businessWebsite: '',
        businessLocation: 'Toronto, ON, Canada',
        language: 'zh',
        currency: 'USD',
        timezone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'America/Toronto',
      },
      version: 0,
    };
    try { localStorage.setItem('solo-ceo-settings', JSON.stringify(demoProfile)); } catch { /* quota exceeded */ }
  } catch { /* SSR or restricted env */ }
})();

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...PROFILE_DEFAULTS,
      language: "zh",
      currency: "USD",
      timezone: typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "America/Toronto",
      isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
      syncStatus: "idle",
      pendingOps: 0,

      setOperator: (name, avatar) =>
        set((s) => ({
          operatorName: name,
          operatorAvatar: avatar ?? s.operatorAvatar,
        })),
      setProfileField: (field, value) => set({ [field]: value }),
      setLanguage: (lang) => set({ language: lang }),
      setCurrency: (currency) => set({ currency }),
      setTimezone: (tz) => set({ timezone: tz }),
      setOnline: (online) => set({ isOnline: online }),
      setSyncStatus: (status) => set({ syncStatus: status }),
      setPendingOps: (count) => set({ pendingOps: count }),
      resetForSignOut: () => set({
        ...PROFILE_DEFAULTS,
        language: 'zh',
        currency: 'USD',
        timezone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'America/New_York',
        pendingOps: 0,
        syncStatus: 'idle',
      }),
    }),
    {
      name: "solo-ceo-settings",
      partialize: (state) => ({
        ...Object.fromEntries(
          Object.keys(PROFILE_DEFAULTS).map(k => [k, state[k as keyof ProfileFields]])
        ),
        language: state.language,
        currency: state.currency,
        timezone: state.timezone,
      }),
    },
  ),
);
