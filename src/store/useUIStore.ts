import { create } from "zustand";
import { persist } from "zustand/middleware";

type TabId = "home" | "work" | "clients" | "finance";
type ViewMode = "vertical" | "horizontal";

interface UIState {
  activeTab: TabId;
  sidebarExpanded: boolean;
  darkMode: boolean;
  commandPaletteOpen: boolean;
  hideMobileNav: boolean;
  tasksViewMode: ViewMode;
  salesViewMode: ViewMode;

  // Toast
  toastMessage: string;

  setActiveTab: (tab: TabId) => void;
  toggleSidebar: () => void;
  toggleDarkMode: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setHideMobileNav: (hidden: boolean) => void;
  setTasksViewMode: (mode: ViewMode) => void;
  setSalesViewMode: (mode: ViewMode) => void;
  showToast: (msg: string, duration?: number) => void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      activeTab: "home",
      sidebarExpanded: false,
      darkMode: false,
      commandPaletteOpen: false,
      hideMobileNav: false,
      tasksViewMode: "vertical",
      salesViewMode: "vertical",
      toastMessage: "",

      setActiveTab: (tab) => set({ activeTab: tab }),
      toggleSidebar: () => set((s) => ({ sidebarExpanded: !s.sidebarExpanded })),
      toggleDarkMode: () =>
        set((s) => {
          const next = !s.darkMode;
          document.documentElement.classList.toggle("dark", next);
          return { darkMode: next };
        }),
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
      setHideMobileNav: (hidden) => set({ hideMobileNav: hidden }),
      setTasksViewMode: (mode) => set({ tasksViewMode: mode }),
      setSalesViewMode: (mode) => set({ salesViewMode: mode }),
      showToast: (msg, duration = 3000) => {
        clearTimeout(toastTimer);
        set({ toastMessage: msg });
        toastTimer = setTimeout(() => set({ toastMessage: "" }), duration);
      },
    }),
    {
      name: "solo-ceo-ui",
      partialize: (state) => ({
        darkMode: state.darkMode,
        sidebarExpanded: state.sidebarExpanded,
        tasksViewMode: state.tasksViewMode,
        salesViewMode: state.salesViewMode,
      }),
      onRehydrate: (_state, _options) => {
        return (rehydratedState) => {
          if (rehydratedState?.darkMode) {
            document.documentElement.classList.add("dark");
          }
        };
      },
    },
  ),
);
