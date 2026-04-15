import { create } from "zustand";
import { persist } from "zustand/middleware";
import { applyFullTheme } from "../themes";
import { syncPref } from "../lib/settings-sync";

export type TabId = "home" | "work" | "leads" | "clients" | "finance" | "settings";
type ViewMode = "vertical" | "horizontal";
type ThemeMode = "light" | "dark" | "auto";

/**
 * Quick-create intent types. Pages match on `type` and open their create panel.
 * Mapping to their host tab lives in QUICK_CREATE_TAB_MAP below.
 */
export type QuickCreateType = "lead" | "task" | "client" | "transaction" | "biz-transaction";

/** Type → target tab. `null` means "keep current tab" (e.g., pressing "N" on home → task panel). */
const QUICK_CREATE_TAB_MAP: Record<QuickCreateType, TabId | null> = {
  lead: "leads",
  task: "work",
  client: "clients",
  transaction: "finance",
  "biz-transaction": "finance",
};

interface PendingQuickCreate {
  type: QuickCreateType;
  /** Monotonic token — guarantees a fresh value even when the same type is fired twice
   *  in a row, so a reactive useEffect on this field re-fires and the target page opens. */
  token: number;
}

interface UIState {
  activeTab: TabId;
  sidebarExpanded: boolean;
  /** @deprecated — use themeMode instead. Kept for migration. */
  darkMode: boolean;
  themeMode: ThemeMode;
  /** Visual style ID (e.g. "default", "neobrutalism") */
  styleId: string;
  /** Color palette ID (e.g. "default", "ocean", "rose") */
  paletteId: string;
  /** @deprecated — legacy, kept for migration from V3.0 → V3.1 */
  themeId?: string;
  commandPaletteOpen: boolean;
  hideMobileNav: boolean;
  tasksViewMode: ViewMode;
  salesViewMode: ViewMode;

  // Toast (supports stacking — newest toast replaces previous)
  toastMessage: string;
  toastAction: (() => void) | null;
  toastActionLabel: string;
  toastId: number;

  /**
   * Durable pending intent from the quick-create FAB / command palette / "N" shortcut.
   * Replaces the old fire-and-forget `quick-create` CustomEvent, which lost events when
   * the target page was still being lazy-loaded. Pages read this reactively in a useEffect
   * and consume via `clearPendingQuickCreate` — works whether the page is already mounted
   * or has yet to finish its chunk fetch.
   */
  pendingQuickCreate: PendingQuickCreate | null;

  setActiveTab: (tab: TabId) => void;
  toggleSidebar: () => void;
  /** @deprecated — use setThemeMode instead */
  toggleDarkMode: () => void;
  setThemeMode: (mode: ThemeMode) => void;
  setStyleId: (id: string) => void;
  setPaletteId: (id: string) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setHideMobileNav: (hidden: boolean) => void;
  setTasksViewMode: (mode: ViewMode) => void;
  setSalesViewMode: (mode: ViewMode) => void;
  showToast: (msg: string, duration?: number, action?: { label: string; fn: () => void }) => void;
  clearToast: () => void;
  /** Set a pending quick-create intent. Also switches to the target tab (unless `opts.keepTab`),
   *  so the handoff is atomic — no window between tab change and intent set. */
  setPendingQuickCreate: (type: QuickCreateType, opts?: { keepTab?: boolean }) => void;
  clearPendingQuickCreate: () => void;
}

// Monotonic token for pending quick-create intents. Module-scoped so it survives store resets.
let quickCreateTokenCounter = 0;

// Monotonic toast ID to prevent stale timer clearing wrong toast
let toastCounter = 0;
let toastTimer: ReturnType<typeof setTimeout> | undefined;

// System preference listener (set up once after store creation)
let mediaQueryCleanup: (() => void) | undefined;

/** Palette IDs that were valid in the old single-themeId system */
const LEGACY_PALETTE_IDS = new Set(["default", "ocean", "rose", "forest", "midnight"]);

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      activeTab: "home",
      sidebarExpanded: false,
      darkMode: false,
      themeMode: "auto" as ThemeMode,
      styleId: "default",
      paletteId: "default",
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
        applyFullTheme(get().styleId, get().paletteId, next);
        set({ themeMode: next, darkMode: next === "dark" });
      },

      setThemeMode: (mode) => {
        applyFullTheme(get().styleId, get().paletteId, mode);
        set({ themeMode: mode, darkMode: mode === "dark" });
        setupSystemListener(mode);
        syncPref("THEME_MODE", mode);
      },

      setStyleId: (id) => {
        applyFullTheme(id, get().paletteId, get().themeMode);
        set({ styleId: id });
        syncPref("STYLE_ID", id);
      },

      setPaletteId: (id) => {
        applyFullTheme(get().styleId, id, get().themeMode);
        set({ paletteId: id });
        syncPref("PALETTE_ID", id);
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
        styleId: state.styleId,
        paletteId: state.paletteId,
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

          // Migration: old single themeId → styleId + paletteId
          const legacy = (rehydratedState as any).themeId as string | undefined;
          if (legacy && !rehydratedState.styleId) {
            if (legacy === "neobrutalism") {
              rehydratedState.styleId = "neobrutalism";
              rehydratedState.paletteId = "default";
            } else if (LEGACY_PALETTE_IDS.has(legacy)) {
              rehydratedState.styleId = "default";
              rehydratedState.paletteId = legacy;
            }
          }

          // Ensure defaults
          if (!rehydratedState.styleId) rehydratedState.styleId = "default";
          if (!rehydratedState.paletteId) rehydratedState.paletteId = "default";

          applyFullTheme(rehydratedState.styleId, rehydratedState.paletteId, mode);
          setupSystemListener(mode);
        };
      },
    },
  ),
);

// Cross-tab sync: when another tab changes localStorage, rehydrate and apply theme
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== 'solo-ceo-ui' || !e.newValue) return;
    try {
      const { state } = JSON.parse(e.newValue);
      if (state) {
        // Only merge persisted data keys — never overwrite action functions
        const { themeMode, styleId, paletteId, sidebarExpanded, tasksViewMode, salesViewMode, darkMode } = state;
        const safeState: Record<string, unknown> = {};
        if (themeMode !== undefined) safeState.themeMode = themeMode;
        if (styleId !== undefined) safeState.styleId = styleId;
        if (paletteId !== undefined) safeState.paletteId = paletteId;
        if (sidebarExpanded !== undefined) safeState.sidebarExpanded = sidebarExpanded;
        if (tasksViewMode !== undefined) safeState.tasksViewMode = tasksViewMode;
        if (salesViewMode !== undefined) safeState.salesViewMode = salesViewMode;
        if (darkMode !== undefined) safeState.darkMode = darkMode;
        useUIStore.setState(safeState);
        applyFullTheme(styleId || 'default', paletteId || 'default', themeMode || 'auto');
      }
    } catch { /* malformed — ignore */ }
  });
}

/** Set up or tear down the system preference change listener */
function setupSystemListener(mode: ThemeMode) {
  mediaQueryCleanup?.();
  mediaQueryCleanup = undefined;

  if (mode === "auto") {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const state = useUIStore.getState();
      if (state.themeMode === "auto") {
        applyFullTheme(state.styleId, state.paletteId, "auto");
      }
    };
    mq.addEventListener("change", handler);
    mediaQueryCleanup = () => mq.removeEventListener("change", handler);
  }
}
