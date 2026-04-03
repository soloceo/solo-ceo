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
  const { operatorName } = useSettingsStore();
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
          <div className="flex flex-col" style={{ gap: 28 }}>
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
              <HomeMemoSection />
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
