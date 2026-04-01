import React, { useEffect, useState, useCallback, useRef, lazy, Suspense, useMemo } from "react";
import { useT } from "../../i18n/context";
import { useRealtimeRefresh } from "../../hooks/useRealtimeRefresh";
import { usePullToRefresh } from "../../hooks/usePullToRefresh";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useUIStore } from "../../store/useUIStore";
import { useAppSettings, invalidateSettingsCache } from "../../hooks/useAppSettings";
import { useDueReminders } from "../../hooks/useDueReminders";
import { KPIGrid } from "./KPIGrid";
import { MonthlyGoal } from "./MonthlyGoal";
import type { ActivityItem } from "./ActivityTimeline";
import { WeeklyReport } from "./WeeklyReport";
import { TodayFocus, type FocusItem } from "./TodayFocus";
import { KnowledgeBaseSection } from "./KnowledgeBaseSection";
import { ProtocolSection } from "./ProtocolSection";
import { BreakthroughSection } from "./BreakthroughSection";
import { BarChart3 } from "lucide-react";
import { PROTOCOL_STEPS } from "../../data/evolution-protocol";
import { todayDateKey, dateToKey } from "../../lib/date-utils";
import { api } from "../../lib/api";

const WidgetGrid = lazy(() => import("./widgets/WidgetGrid"));

/* ── Types ──────────────────────────────────────────────────────── */
type DashboardData = {
  todayFocus: FocusItem[];
  manualTodayEvents: FocusItem[];
  clientsCount: number;
  mrr: number;
  activeTasks: number;
  workTasks: number;
  personalTasks: number;
  leadsCount: number;
  ytdRevenue?: number;
  todayIncome?: number;
  monthlyIncome?: number;
  recentActivity?: ActivityItem[];
  mrrSeries?: { name: string; mrr: number }[];
};

/* ── Helpers ────────────────────────────────────────────────────── */
function greeting(t: (k: string) => string) {
  const h = new Date().getHours();
  if (h < 6) return t("home.greeting.late");
  if (h < 12) return t("home.greeting.morning");
  if (h < 14) return t("home.greeting.noon");
  if (h < 18) return t("home.greeting.afternoon");
  return t("home.greeting.evening");
}

function todayStr(lang: string) {
  return new Date().toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", {
    year: "numeric", month: "long", day: "numeric", weekday: "short",
  });
}

const manualIdFromKey = (k: string) => k.replace("manual-", "");

const DASHBOARD_TABLES = ["leads", "clients", "tasks", "finance_transactions", "today_focus_state", "today_focus_manual", "payment_milestones"] as const;

/* ── Progress Ring ─────────────────────────────────────────────── */
function ProgressRing({ completed, total }: { completed: number; total: number }) {
  const size = 44;
  const stroke = 3.5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? completed / total : 0;
  const offset = circumference * (1 - progress);
  const allDone = total > 0 && completed === total;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" strokeWidth={stroke}
          stroke="var(--color-bg-quaternary)"
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" strokeWidth={stroke}
          stroke={allDone ? "var(--color-success)" : "var(--color-accent)"}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <span
        className="absolute text-[13px] tabular-nums"
        style={{ color: allDone ? "var(--color-success)" : "var(--color-text-secondary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}
      >
        {completed}/{total}
      </span>
    </div>
  );
}

/* ── Component ──────────────────────────────────────────────────── */
export default function HomePage() {
  const { t, lang } = useT();
  useDueReminders(lang, t);
  const { operatorName } = useSettingsStore();
  const showToast = useUIStore((s) => s.showToast);

  const [data, setData] = useState<DashboardData>({
    todayFocus: [], manualTodayEvents: [],
    clientsCount: 0, mrr: 0, activeTasks: 0, workTasks: 0, personalTasks: 0, leadsCount: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const raw = await api.get<any>("/api/dashboard");
      setData({
        ...raw,
        todayFocus: Array.isArray(raw.todayFocus) ? raw.todayFocus : [],
        manualTodayEvents: Array.isArray(raw.manualTodayEvents) ? raw.manualTodayEvents : [],
        recentActivity: Array.isArray(raw.recentActivity) ? raw.recentActivity : [],
        mrrSeries: Array.isArray(raw.mrrSeries) ? raw.mrrSeries : [],
      });
    } catch (e) {
      console.warn('[HomePage] fetchData', e);
      showToast(t("home.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);
  useRealtimeRefresh(DASHBOARD_TABLES, fetchData);

  const scrollRef = useRef<HTMLDivElement>(null);
  usePullToRefresh(scrollRef, fetchData);

  /* ── FAB quick-create handler → opens TodayFocus form ── */
  const [fabTrigger, setFabTrigger] = useState(0);
  useEffect(() => {
    const handler = (e: Event) => {
      const type = (e as CustomEvent).detail?.type;
      if (type === "task") setFabTrigger((n) => n + 1);
    };
    window.addEventListener("quick-create", handler);
    return () => window.removeEventListener("quick-create", handler);
  }, []);

  /* ── Focus handlers ── */
  const handleUpdateStatus = async (key: string, status: "pending" | "completed") => {
    try {
      await api.post("/api/today-focus/state", { focusKey: key, status });
    } catch {
      showToast(t("common.updateFailed") || "Update failed");
      return;
    }
    setData((prev) => ({
      ...prev,
      todayFocus: prev.todayFocus.map((i) => (i.key === key ? { ...i, status } : i)),
      manualTodayEvents: prev.manualTodayEvents.map((i) => (i.key === key ? { ...i, status } : i)),
    }));
  };

  const handleSaveManual = async (form: { type: string; title: string; note: string }, editKey?: string) => {
    const isEdit = Boolean(editKey);
    const payload = { type: form.type, title: form.title.trim(), note: form.note.trim() };
    try {
      if (isEdit) {
        await api.put(`/api/today-focus/manual/${manualIdFromKey(editKey!)}`, payload);
      } else {
        await api.post("/api/today-focus/manual", payload);
      }
    } catch {
      showToast(t("common.saveFailed") || "Save failed");
      throw new Error("Save failed");
    }
    await fetchData();
  };

  const handleDeleteManual = async (item: FocusItem) => {
    try {
      await api.del(`/api/today-focus/manual/${manualIdFromKey(item.key)}`);
    } catch {
      showToast(t("common.deleteFailed") || "Delete failed");
      throw new Error("Delete failed");
    }
    await fetchData();
  };

  /* ── Progress calculation ── */
  const allFocusItems = [...data.todayFocus, ...data.manualTodayEvents];
  const totalFocus = allFocusItems.length;
  const completedFocus = allFocusItems.filter((i) => i.status === "completed").length;

  /* ── Inline insight sections state ── */
  const { settings, save } = useAppSettings();

  // Protocol state
  const protocolState: { date: string; checks: Record<string, boolean> } = useMemo(() => {
    try {
      const raw = settings?.evolution_protocol ? JSON.parse(settings.evolution_protocol) : null;
      const today = todayDateKey();
      if (raw && raw.date === today) return raw;
      return { date: today, checks: {} };
    } catch { return { date: todayDateKey(), checks: {} }; }
  }, [settings?.evolution_protocol]);

  const protocolStreak: { count: number; lastDate: string } = useMemo(() => {
    try { return settings?.protocol_streak ? JSON.parse(settings.protocol_streak) : { count: 0, lastDate: "" }; } catch { return { count: 0, lastDate: "" }; }
  }, [settings?.protocol_streak]);

  const protocolDone = PROTOCOL_STEPS.filter((s) => protocolState.checks[s.id]).length;

  const toggleProtocolStep = async (stepId: string) => {
    const today = todayDateKey();
    const newChecks = { ...protocolState.checks, [stepId]: !protocolState.checks[stepId] };
    const newState = { date: today, checks: newChecks };
    await save("evolution_protocol", JSON.stringify(newState));

    // Update streak
    const allDone = PROTOCOL_STEPS.every((s) => newChecks[s.id]);
    let newStreak = { ...protocolStreak };
    if (allDone) {
      const yesterday = dateToKey(new Date(Date.now() - 86400000));
      newStreak = {
        count: protocolStreak.lastDate === yesterday ? protocolStreak.count + 1 : 1,
        lastDate: today,
      };
    } else if (protocolStreak.lastDate === today) {
      newStreak = { count: Math.max(0, protocolStreak.count - 1), lastDate: "" };
    }
    await save("protocol_streak", JSON.stringify(newStreak));
    invalidateSettingsCache();
  };

  const [reportOpen, setReportOpen] = useState(false);
  const displayName = operatorName.trim() || "Solo CEO";

  /* ── Dual-panel swipe state ── */
  const [homeView, setHomeView] = useState<"dashboard" | "widgets">("dashboard");
  const swipeRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number; decided: boolean; isHorizontal: boolean }>({ x: 0, y: 0, decided: false, isHorizontal: false });

  // Sync tab indicator when user swipes on mobile
  const handleSwipeScroll = useCallback(() => {
    const el = swipeRef.current;
    if (!el) return;
    const ratio = el.scrollLeft / el.clientWidth;
    setHomeView(ratio > 0.5 ? "widgets" : "dashboard");
  }, []);

  // Tab button click → scroll to panel
  const switchPanel = useCallback((panel: "dashboard" | "widgets") => {
    setHomeView(panel);
    const el = swipeRef.current;
    if (!el) return;
    el.scrollTo({ left: panel === "widgets" ? el.clientWidth : 0, behavior: "smooth" });
  }, []);

  // Touch gesture handlers — decide horizontal vs vertical intent
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY, decided: false, isHorizontal: false };
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const ref = touchStartRef.current;
    if (ref.decided) {
      // If we decided this is a horizontal swipe, prevent vertical scroll
      if (ref.isHorizontal) e.preventDefault();
      return;
    }
    const t = e.touches[0];
    const dx = Math.abs(t.clientX - ref.x);
    const dy = Math.abs(t.clientY - ref.y);
    // Need at least 8px of movement to decide direction
    if (dx + dy < 8) return;
    ref.decided = true;
    ref.isHorizontal = dx > dy * 1.2; // bias slightly toward vertical (natural scroll)
  }, []);

  return (
    <div ref={scrollRef} className="mobile-page max-w-[1680px] mx-auto min-h-full p-4 md:p-6 lg:p-8 relative">
      <div className="page-stack">
        {/* ── Header: Greeting + Progress Ring + Date ── */}
        <div className="flex items-center gap-3">
          <ProgressRing completed={completedFocus} total={totalFocus} />
          <div className="flex-1 min-w-0">
            <p className="text-[13px]" style={{ color: "var(--color-text-quaternary)" }}>{greeting(t)}</p>
            <h1 className="text-[17px] tracking-tight truncate" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-bold)" } as React.CSSProperties}>
              {displayName}
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setReportOpen(true)}
              className="flex items-center gap-1 px-2 py-1 rounded-[var(--radius-4)] transition-colors hover:bg-[var(--color-bg-quaternary)]"
              style={{ color: "var(--color-text-quaternary)" }}
              title={t("home.report.generate")}
            >
              <BarChart3 size={14} />
              <span className="text-[13px] hidden sm:inline" style={{ fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
                {t("home.report.generate")}
              </span>
            </button>
            <span className="text-[13px]" style={{ color: "var(--color-text-quaternary)" }}>{todayStr(lang)}</span>
          </div>
        </div>

        {/* ── Panel Tabs ── */}
        <div className="page-tabs">
          {(["dashboard", "widgets"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => switchPanel(tab)}
              data-active={homeView === tab}
            >
              {tab === "dashboard"
                ? t("home.tab.dashboard")
                : t("home.tab.widgets")}
            </button>
          ))}
        </div>

        {/* ── Swipeable Panel Container ── */}
        <div
          ref={swipeRef}
          onScroll={handleSwipeScroll}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          className="home-swipe-container"
        >
            {/* ── Panel 1: Dashboard ── */}
            <div className="home-swipe-panel">
              <div className="flex flex-col" style={{ gap: 20 }}>

              {/* ═══ PRIMARY: KPIs + Goal — the first thing you see ═══ */}
              <KPIGrid
                mrr={data.mrr || 0}
                ytdRevenue={data.ytdRevenue || 0}
                todayIncome={data.todayIncome || 0}
                clientsCount={data.clientsCount || 0}
                leadsCount={data.leadsCount || 0}
                workTasks={data.workTasks || 0}
                personalTasks={data.personalTasks || 0}
                loading={loading}
              />
              <MonthlyGoal monthlyIncome={data.monthlyIncome || 0} loading={loading} />

              {/* ═══ SECONDARY: Today's action items ═══ */}
              <div className="section-gap">
                <TodayFocus
                  todayFocus={data.todayFocus}
                  manualEvents={data.manualTodayEvents}
                  loading={loading}
                  onUpdateStatus={handleUpdateStatus}
                  onSaveManual={handleSaveManual}
                  onDeleteManual={handleDeleteManual}
                  openFormTrigger={fabTrigger}
                />
              </div>

              {/* ═══ TERTIARY: Growth System — 原则 → 协议 → 突围 ═══ */}
              <div className="section-gap flex flex-col" style={{ gap: 16 }}>
                <KnowledgeBaseSection />
                <ProtocolSection
                  title={t("home.dailyProtocol")}
                  steps={PROTOCOL_STEPS}
                  state={protocolState}
                  streak={protocolStreak}
                  doneCount={protocolDone}
                  onToggle={toggleProtocolStep}
                  lang={lang}
                />
                <BreakthroughSection />
              </div>

            </div>
          </div>

          {/* ── Panel 2: Widgets ── */}
          <div className="home-swipe-panel">
            <div style={{ minHeight: 200 }}>
              <Suspense fallback={null}>
                <WidgetGrid />
              </Suspense>
            </div>
          </div>
        </div>

        {/* Swipe dots indicator (mobile only) */}
        <div className="flex items-center justify-center gap-1.5 md:hidden" style={{ marginTop: -8 }}>
          {(["dashboard", "widgets"] as const).map((p) => (
            <div
              key={p}
              className="rounded-full transition-all"
              style={{
                width: homeView === p ? 16 : 6,
                height: 6,
                background: homeView === p ? "var(--color-accent)" : "var(--color-bg-quaternary)",
              }}
            />
          ))}
        </div>
      </div>

      {/* ── Weekly Report Modal ── */}
      <WeeklyReport open={reportOpen} onClose={() => setReportOpen(false)} />
    </div>
  );
}

