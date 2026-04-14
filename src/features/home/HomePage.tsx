import React, { useEffect, useState, useRef, lazy, Suspense } from "react";
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
import { BreakthroughSection } from "./BreakthroughSection";
import { HomeMemoSection } from "./HomeMemoSection";
import { BarChart3 } from "lucide-react";
import { api } from "../../lib/api";
import PeepIllustration from "../../components/ui/PeepIllustration";
import type { PeepName } from "../../components/ui/PeepIllustration";

const WidgetGrid = lazy(() => import("./widgets/WidgetGrid"));

/* ── Types ──────────────────────────────────────────────────────── */
type DashboardData = {
  todayFocus: FocusItem[];
  dueTodayItems: FocusItem[];
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

/** Pick a peep illustration based on time of day */
function greetingPeep(): PeepName {
  const h = new Date().getHours();
  if (h < 6) return "reflecting";        // late night — contemplative
  if (h < 12) return "coffee";           // morning — coffee run
  if (h < 14) return "astro";              // noon — space explorer
  if (h < 18) return "looking-ahead";    // afternoon — planning ahead
  return "new-beginnings";               // evening — relax with a book
}

function todayStr(lang: string) {
  return new Date().toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", {
    year: "numeric", month: "long", day: "numeric", weekday: "short",
  });
}

const DASHBOARD_TABLES = ["leads", "clients", "tasks", "finance_transactions", "today_focus_state", "today_focus_manual", "payment_milestones"] as const;

/* ── Component ──────────────────────────────────────────────────── */
export default function HomePage() {
  const { t, lang } = useT();
  useDueReminders(lang, t);
  const operatorName = useSettingsStore((s) => s.operatorName);
  const showToast = useUIStore((s) => s.showToast);

  const [data, setData] = useState<DashboardData>({
    todayFocus: [], dueTodayItems: [], manualTodayEvents: [],
    clientsCount: 0, mrr: 0, activeTasks: 0, workTasks: 0, personalTasks: 0, leadsCount: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const raw = await api.get<any>("/api/dashboard");
      setData({
        ...raw,
        todayFocus: Array.isArray(raw.todayFocus) ? raw.todayFocus : [],
        dueTodayItems: Array.isArray(raw.dueTodayItems) ? raw.dueTodayItems : [],
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


  /* ── Inline insight sections state ── */
  const { settings } = useAppSettings();


  const [reportOpen, setReportOpen] = useState(false);
  const displayName = operatorName.trim() || "Solo CEO";

  const [homeView, setHomeView] = useState<"dashboard" | "widgets">("dashboard");

  return (
    <div ref={scrollRef} className="mobile-page max-w-[1680px] mx-auto min-h-full p-4 md:px-6 md:pb-6 md:pt-0 lg:px-8 lg:pb-8 lg:pt-0 relative">
      <div className="page-stack">
        {/* ── Header: Greeting card with peep bust ── */}
        <div
          className="card relative overflow-hidden p-4"
          style={{ minHeight: 100 }}
        >
          {/* Left: greeting text */}
          <div className="relative z-[1] flex-1 min-w-0" style={{ maxWidth: "60%" }}>
            <div className="flex items-center gap-2">
              <p className="text-[14px]" style={{ color: "var(--color-text-tertiary)" }}>{greeting(t)}</p>
            </div>
            <h1 className="text-[24px] tracking-tight truncate mt-1" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-bold)" } as React.CSSProperties}>
              {displayName}
            </h1>
            <p className="text-[12px] mt-1" style={{ color: "var(--color-text-quaternary)" }}>{todayStr(lang)}</p>
          </div>

          {/* Right: peep illustration — clear, not overlapping report btn */}
          <div className="absolute right-8 bottom-0 z-0">
            <PeepIllustration name={greetingPeep()} size={105} />
          </div>

          {/* Report button — floated top-right */}
          <button
            onClick={() => setReportOpen(true)}
            className="absolute top-3 right-3 z-[2] flex items-center justify-center rounded-[var(--radius-8)] transition-colors hover:bg-[var(--color-bg-tertiary)]"
            style={{ width: 32, height: 32, color: "var(--color-text-tertiary)" }}
            title={t("home.report.generate")}
          >
            <BarChart3 size={15} />
          </button>
        </div>

        {/* ── Daily Briefing — compact banner ── */}
        <KnowledgeBaseSection />

        {/* ── Panel Tabs ── */}
        <div className="page-tabs">
          {(["dashboard", "widgets"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setHomeView(tab)}
              data-active={homeView === tab}
            >
              {tab === "dashboard"
                ? t("home.tab.dashboard")
                : t("home.tab.widgets")}
            </button>
          ))}
        </div>

        {homeView === "dashboard" && (
          <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:gap-4">
              {/* ── Left column: KPI + Today Focus ── */}
              <div className="flex flex-col gap-4 min-w-0">
                <KPIGrid
                  monthlyIncome={data.monthlyIncome || 0}
                  todayIncome={data.todayIncome || 0}
                  clientsCount={data.clientsCount || 0}
                  leadsCount={data.leadsCount || 0}
                  workTasks={data.workTasks || 0}
                  personalTasks={data.personalTasks || 0}
                  loading={loading}
                />
                <TodayFocus
                  todayFocus={data.todayFocus}
                  dueTodayItems={data.dueTodayItems}
                  loading={loading}
                />
              </div>
              {/* ── Right column: Memo Calendar ── */}
              <div className="min-w-0">
                <HomeMemoSection />
              </div>
              {/* ── Full width bottom ── */}
              <div className="lg:col-span-2">
                <BreakthroughSection />
              </div>
          </div>
        )}

        {homeView === "widgets" && (
          <div style={{ minHeight: 200 }}>
            <Suspense fallback={null}>
              <WidgetGrid />
            </Suspense>
          </div>
        )}
      </div>

      {/* ── Weekly Report Modal ── */}
      <WeeklyReport open={reportOpen} onClose={() => setReportOpen(false)} />
    </div>
  );
}
