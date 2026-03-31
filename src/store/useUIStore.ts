import { create } from "zustand";
import { persist } from "zustand/middleware";

type TabId = "home" | "work" | "leads" | "clients" | "finance" | "settings";
type ViewMode = "vertical" | "horizontal";
type ThemeMode = "light" | "dark" | "auto";

/** Apply the .dark class to <html> and update meta theme-color for iOS status bar */
function applyTheme(mode: ThemeMode) {
  const isDark =
    mode === "dark" ||
    (mode === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);

  // Update both theme-color meta tags so iOS Safari status bar matches on next load.
  // Safari reads media-matched <meta> at load time; we keep both in sync for refresh.
  const metaLight = document.querySelector<HTMLMetaElement>('meta[name="theme-color"][media*="light"]');
  const metaDark = document.querySelector<HTMLMetaElement>('meta[name="theme-color"][media*="dark"]');
  if (metaLight) metaLight.content = isDark ? "#1f1e1d" : "#faf9f5";
  if (metaDark) metaDark.content = isDark ? "#1f1e1d" : "#faf9f5";
}

interface UIState {
  activeTab: TabId;
  sidebarExpanded: boolean;
  /** @deprecated — use themeMode instead. Kept for migration. */
  darkMode: boolean;
  themeMode: ThemeMode;
  commandPaletteOpen: boolean;
  hideMobileNav: boolean;
  tasksViewMode: ViewMode;
  salesViewMode: ViewMode;

  glassMode: boolean;
  setGlassMode: (v: boolean) => void;

  // Toast (supports stacking — newest toast replaces previous)
  toastMessage: string;
  toastAction: (() => void) | null;
  toastActionLabel: string;
  toastId: number;

  setActiveTab: (tab: TabId) => void;
  toggleSidebar: () => void;
  /** @deprecated — use setThemeMode instead */
  toggleDarkMode: () => void;
  setThemeMode: (mode: ThemeMode) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setHideMobileNav: (hidden: boolean) => void;
  setTasksViewMode: (mode: ViewMode) => void;
  setSalesViewMode: (mode: ViewMode) => void;
  showToast: (msg: string, duration?: number, action?: { label: string; fn: () => void }) => void;
  clearToast: () => void;
}

// Monotonic toast ID to prevent stale timer clearing wrong toast
let toastCounter = 0;
let toastTimer: ReturnType<typeof setTimeout> | undefined;

// System preference listener (set up once after store creation)
let mediaQueryCleanup: (() => void) | undefined;

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      activeTab: "home",
      sidebarExpanded: false,
      darkMode: false,
      themeMode: "auto" as ThemeMode,
      commandPaletteOpen: false,
      hideMobileNav: false,
      tasksViewMode: "vertical",
      salesViewMode: "vertical",
      glassMode: false,
      toastMessage: "",
      toastAction: null,
      toastActionLabel: "",
      toastId: 0,

      setActiveTab: (tab) => set({ activeTab: tab }),
      toggleSidebar: () => set((s) => ({ sidebarExpanded: !s.sidebarExpanded })),

      toggleDarkMode: () => {
        // Legacy compat: cycle light → dark → light
        const current = get().themeMode;
        const next: ThemeMode = current === "dark" ? "light" : "dark";
        applyTheme(next);
        set({ themeMode: next, darkMode: next === "dark" });
      },

      setThemeMode: (mode) => {
        applyTheme(mode);
        set({ themeMode: mode, darkMode: mode === "dark" });
        // Re-register or remove system listener
        setupSystemListener(mode);
      },

      setGlassMode: (v) => {
        document.documentElement.dataset.glass = v ? "true" : "false";
        set({ glassMode: v });
      },

      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
      setHideMobileNav: (hidden) => set({ hideMobileNav: hidden }),
      setTasksViewMode: (mode) => set({ tasksViewMode: mode }),
      setSalesViewMode: (mode) => set({ salesViewMode: mode }),
      showToast: (msg, duration = 3000, action) => {
        clearTimeout(toastTimer);
        const id = ++toastCounter;
        set({
          toastMessage: msg,
          toastAction: action?.fn || null,
          toastActionLabel: action?.label || "",
          toastId: id,
        });
        toastTimer = setTimeout(() => {
          // Only clear if this toast is still the active one
          if (get().toastId === id) {
            set({ toastMessage: "", toastAction: null, toastActionLabel: "", toastId: 0 });
          }
        }, duration);
      },
      clearToast: () => {
        clearTimeout(toastTimer);
        set({ toastMessage: "", toastAction: null, toastActionLabel: "", toastId: 0 });
      },
    }),
    {
      name: "solo-ceo-ui",
      partialize: (state) => ({
        darkMode: state.darkMode,
        themeMode: state.themeMode,
        glassMode: state.glassMode,
        sidebarExpanded: state.sidebarExpanded,
        tasksViewMode: state.tasksViewMode,
        salesViewMode: state.salesViewMode,
      }),
      onRehydrateStorage: () => {
        return (rehydratedState: UIState | undefined) => {
          if (!rehydratedState) return;

          // Migration: if themeMode doesn't exist yet, derive from darkMode
          let mode: ThemeMode = rehydratedState.themeMode;
          if (!mode) {
            mode = rehydratedState.darkMode ? "dark" : "auto";
            rehydratedState.themeMode = mode;
          }

          applyTheme(mode);
          setupSystemListener(mode);

          // Rehydrate glass mode
          if (rehydratedState.glassMode) {
            document.documentElement.dataset.glass = "true";
          }
        };
      },
    },
  ),
);

/** Set up or tear down the system preference change listener */
function setupSystemListener(mode: ThemeMode) {
  // Clean up any existing listener
  mediaQueryCleanup?.();
  mediaQueryCleanup = undefined;

  if (mode === "auto") {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      // Only react if still in auto mode
      if (useUIStore.getState().themeMode === "auto") {
        applyTheme("auto");
      }
    };
    mq.addEventListener("change", handler);
    mediaQueryCleanup = () => mq.removeEventListener("change", handler);
  }
}
