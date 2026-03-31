import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface WidgetLayout {
  id: string;
  enabled: boolean;
  order: number;
}

interface WidgetState {
  layout: WidgetLayout[];
  setLayout: (layout: WidgetLayout[]) => void;
  toggleWidget: (id: string) => void;
  reorder: (fromIndex: number, toIndex: number) => void;
}

const DEFAULT_LAYOUT: WidgetLayout[] = [
  { id: "energy", enabled: true, order: 0 },
  { id: "mini-calendar", enabled: true, order: 1 },
  { id: "activity", enabled: true, order: 2 },
  { id: "countdown", enabled: false, order: 3 },
];

export const useWidgetStore = create<WidgetState>()(
  persist(
    (set) => ({
      layout: DEFAULT_LAYOUT,
      setLayout: (layout) => set({ layout }),
      toggleWidget: (id) =>
        set((s) => ({
          layout: s.layout.map((w) =>
            w.id === id ? { ...w, enabled: !w.enabled } : w
          ),
        })),
      reorder: (fromIndex, toIndex) =>
        set((s) => {
          const arr = [...s.layout];
          const [moved] = arr.splice(fromIndex, 1);
          arr.splice(toIndex, 0, moved);
          return { layout: arr.map((w, i) => ({ ...w, order: i })) };
        }),
    }),
    {
      name: "solo-ceo-widgets",
      version: 8,
      migrate: (persisted: Record<string, unknown>, version: number) => {
        if (version < 8) {
          // v8: remove pomodoro + quick-note
          const layout = ((persisted.layout || DEFAULT_LAYOUT) as Array<{ id: string }>)
            .filter((w) => w.id !== "pomodoro" && w.id !== "quick-note" && w.id !== "learning");
          return { ...persisted, layout };
        }
        return persisted;
      },
    },
  ),
);
