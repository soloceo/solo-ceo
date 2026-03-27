import React, { lazy, Suspense, createContext, useContext } from "react";
import { Timer, Calendar, StickyNote, Activity, CalendarClock, Battery } from "lucide-react";

const PomodoroWidget = lazy(() => import("./PomodoroWidget"));
const MiniCalendarWidget = lazy(() => import("./MiniCalendarWidget"));
const QuickNoteWidget = lazy(() => import("./QuickNoteWidget"));
const ActivityWidget = lazy(() => import("./ActivityWidget"));
const CountdownWidget = lazy(() => import("./CountdownWidget"));
const EnergyBatteryWidget = lazy(() => import("./EnergyBatteryWidget"));

/* ── Preview mode context ── */
const WidgetPreviewCtx = createContext(false);
export const WidgetPreviewProvider = WidgetPreviewCtx.Provider;
export function useWidgetPreview() { return useContext(WidgetPreviewCtx); }

export interface WidgetDef {
  id: string;
  nameKey: string;
  descKey: string;
  icon: React.ReactNode;
  component: React.LazyExoticComponent<React.ComponentType>;
}

export const WIDGET_REGISTRY: WidgetDef[] = [
  { id: "pomodoro", nameKey: "widgets.pomodoro", descKey: "widgets.pomodoroDesc", icon: <Timer size={18} />, component: PomodoroWidget },
  { id: "mini-calendar", nameKey: "widgets.calendar", descKey: "widgets.calendarDesc", icon: <Calendar size={18} />, component: MiniCalendarWidget },
  { id: "quick-note", nameKey: "widgets.quickNote", descKey: "widgets.quickNoteDesc", icon: <StickyNote size={18} />, component: QuickNoteWidget },
  { id: "activity", nameKey: "widgets.activity", descKey: "widgets.activityDesc", icon: <Activity size={18} />, component: ActivityWidget },
  { id: "countdown", nameKey: "widgets.countdown", descKey: "widgets.countdownDesc", icon: <CalendarClock size={18} />, component: CountdownWidget },
  { id: "energy", nameKey: "widgets.energy", descKey: "widgets.energyDesc", icon: <Battery size={18} />, component: EnergyBatteryWidget },
];

export function WidgetWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={<div className="card animate-pulse h-full"><div className="skeleton-bone rounded-[var(--radius-12)] h-full" /></div>}
    >
      {children}
    </Suspense>
  );
}
