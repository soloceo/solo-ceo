import React, { useEffect, useState, useCallback, useRef, lazy, Suspense } from "react";
import { useT } from "../../i18n/context";
import { useRealtimeRefresh } from "../../hooks/useRealtimeRefresh";
import { usePullToRefresh } from "../../hooks/usePullToRefresh";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useUIStore } from "../../store/useUIStore";
import { useAppSettings } from "../../hooks/useAppSettings";
import { useDueReminders } from "../../hooks/useDueReminders";
import { KPIGrid } from "./KPIGrid";
import type { ActivityItem } from "./ActivityTimeline";
import { WeeklyReport } from "./WeeklyReport";
import { TodayFocus, type FocusItem } from "./TodayFocus";
import { KnowledgeBaseSection } from "./KnowledgeBaseSection";
import { ProtocolSection } from "./ProtocolSection";
import { BreakthroughSection } from "./BreakthroughSection";
import { HomeMemoSection } from "./HomeMemoSection";
import { BarChart3 } from "lucide-react";
import { PROTOCOL_STEPS } from "../../data/evolution-protocol";
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

const DASHBOARD_TABLES = ["leads", "clients", "tasks", "finance_transactions", "today_focus_state", "today_focus_manual", "payment_milestones"] as const;

/* ── Progress Ring ─────────────────────────────────────────────── */
function ProgressRing({ completed, total }: { completed: number; total: number }) {
  const size = 40;
  const stroke = 3;
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
        className="absolute text-[12px] tabular-nums"
        style={{ color: allDone ? "var(--color-success)" : "var(--color-text-secondary)", fontWeight: "var(--font-weight-bold)" } as React.CSSProperties}
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

  /* ── Focus status handler ── */
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
    }));
  };

  /* ── Progress calculation ── */
  const totalFocus = data.todayFocus.length;
  const completedFocus = data.todayFocus.filter((i) => i.status === "completed").length;

  /* ── Inline insight sections state ── */
  const { settings } = useAppSettings();


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
      if (ref.isHorizontal) e.preventDefault();
      return;
    }
    const t = e.touches[0];
    const dx = Math.abs(t.clientX - ref.x);
    const dy = Math.abs(t.clientY - ref.y);
    if (dx + dy < 8) return;
    ref.decided = true;
    ref.isHorizontal = dx > dy * 1.2;
  }, []);

  return (
    <div ref={scrollRef} className="mobile-page max-w-[1680px] mx-auto min-h-full p-4 md:p-6 lg:p-8 relative">
      <div className="page-stack">
        {/* ── Header: Greeting + Name + Date ── */}
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[13px]" style={{ color: "var(--color-text-tertiary)" }}>{greeting(t)}</p>
              <span className="text-[12px]" style={{ color: "var(--color-text-quaternary)" }}>{todayStr(lang)}</span>
            </div>
            <h1 className="text-[22px] tracking-tight truncate mt-0.5" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-bold)" } as React.CSSProperties}>
              {displayName}
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {totalFocus > 0 && <ProgressRing completed={completedFocus} total={totalFocus} />}
            <button
              onClick={() => setReportOpen(true)}
              className="flex items-center justify-center rounded-[var(--radius-8)] transition-colors hover:bg-[var(--color-bg-quaternary)]"
              style={{ width: 36, height: 36, color: "var(--color-text-tertiary)" }}
              title={t("home.report.generate")}
            >
              <BarChart3 size={16} />
            </button>
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
              <div className="flex flex-col" style={{ gap: 28 }}>

              {/* ═══ PRIMARY: Monthly Income + Goal + Stats ═══ */}
              <KPIGrid
                monthlyIncome={data.monthlyIncome || 0}
                todayIncome={data.todayIncome || 0}
                clientsCount={data.clientsCount || 0}
                leadsCount={data.leadsCount || 0}
                workTasks={data.workTasks || 0}
                personalTasks={data.personalTasks || 0}
                loading={loading}
              />

              {/* ═══ SECONDARY: Today's action items ═══ */}
              <TodayFocus
                todayFocus={data.todayFocus}
                loading={loading}
                onUpdateStatus={handleUpdateStatus}
              />

              {/* ═══ SECONDARY: Unified Memo ═══ */}
              <HomeMemoSection />

              {/* ═══ TERTIARY: Growth System ═══ */}
              <div className="flex flex-col" style={{ gap: 24 }}>
                <KnowledgeBaseSection />
                <ProtocolSection
                  title={t("home.dailyProtocol")}
                  steps={PROTOCOL_STEPS}
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
