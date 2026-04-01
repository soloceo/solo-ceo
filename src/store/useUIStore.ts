import { create } from "zustand";
import { persist } from "zustand/middleware";

export type TabId = "home" | "work" | "leads" | "clients" | "finance" | "settings";
type ViewMode = "vertical" | "horizontal";
type ThemeMode = "light" | "dark" | "auto";
export type VisualTheme = "default" | "neo-brutalist";

export const VISUAL_THEMES: { id: VisualTheme; labelKey: string }[] = [
  { id: "default", labelKey: "settings.themeDefault" },
  { id: "neo-brutalist", labelKey: "settings.themeNeoBrutalist" },
];

/** Meta theme-color per visual theme (light / dark) */
const META_THEME_COLORS: Record<VisualTheme, { light: string; dark: string }> = {
  default:          { light: "#faf9f5", dark: "#1f1e1d" },
  "neo-brutalist":  { light: "#eeeeee", dark: "#0a0a0a" },
};

/** Apply the .dark class to <html> and update meta theme-color for iOS status bar */
function applyTheme(mode: ThemeMode) {
  const isDark =
    mode === "dark" ||
    (mode === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);

  // Force Safari to re-read theme-color by removing and re-inserting the meta tag.
  const old = document.querySelector('meta[name="theme-color"]');
  if (old) old.remove();
  const meta = document.createElement("meta");
  meta.name = "theme-color";
  const vt = (document.documentElement.getAttribute("data-theme") as VisualTheme) || "default";
  const colors = META_THEME_COLORS[vt] || META_THEME_COLORS.default;
  meta.content = isDark ? colors.dark : colors.light;
  document.head.appendChild(meta);
}

/** Apply the visual theme via data-theme attribute on <html> */
function applyVisualTheme(theme: VisualTheme) {
  if (theme === "default") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }
}

interface UIState {
  activeTab: TabId;
  sidebarExpanded: boolean;
  /** @deprecated — use themeMode instead. Kept for migration. */
  darkMode: boolean;
  themeMode: ThemeMode;
  visualTheme: VisualTheme;
  commandPaletteOpen: boolean;
  hideMobileNav: boolean;
  tasksViewMode: ViewMode;
  salesViewMode: ViewMode;

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
  setVisualTheme: (theme: VisualTheme) => void;
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
      visualTheme: "default" as VisualTheme,
      commandPaletteOpen: false,
      hideMobileNav: false,
      tasksViewMode: "vertical",
      salesViewMode: "vertical",
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

      setVisualTheme: (theme) => {
        applyVisualTheme(theme);
        set({ visualTheme: theme });
        // Re-apply dark/light to update meta theme-color for new visual theme
        applyTheme(get().themeMode);
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
        visualTheme: state.visualTheme,
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

          // Apply visual theme first (so meta theme-color reads correct data-theme)
          const vt: VisualTheme = rehydratedState.visualTheme || "default";
          applyVisualTheme(vt);

          applyTheme(mode);
          setupSystemListener(mode);
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
