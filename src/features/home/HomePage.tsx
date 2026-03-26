import React, { useEffect, useState, useCallback, useRef, lazy, Suspense } from "react";
import { useT } from "../../i18n/context";
import { useRealtimeRefresh } from "../../hooks/useRealtimeRefresh";
import { usePullToRefresh } from "../../hooks/usePullToRefresh";
import { useSettingsStore } from "../../store/useSettingsStore";
import { KPIGrid } from "./KPIGrid";
import { TodayFocus, type FocusItem } from "./TodayFocus";

const DailyProtocol = lazy(() => import("../../components/DailyProtocol"));
const BreakthroughFull = lazy(() => import("../../components/Breakthrough"));
const TodayPrinciple = lazy(() => import("../../components/TodayPrinciple"));

/* ── Types ──────────────────────────────────────────────────────── */
type DashboardData = {
  todayFocus: FocusItem[];
  manualTodayEvents: FocusItem[];
  clientsCount: number;
  mrr: number;
  activeTasks: number;
  leadsCount: number;
  ytdRevenue?: number;
  todayIncome?: number;
};

/* ── Helpers ────────────────────────────────────────────────────── */
function greeting(t: (k: any) => string) {
  const h = new Date().getHours();
  if (h < 6) return t("home.greeting.late" as any);
  if (h < 12) return t("home.greeting.morning" as any);
  if (h < 14) return t("home.greeting.noon" as any);
  if (h < 18) return t("home.greeting.afternoon" as any);
  return t("home.greeting.evening" as any);
}

function todayStr(lang: string) {
  return new Date().toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", {
    year: "numeric", month: "long", day: "numeric", weekday: "short",
  });
}

const manualIdFromKey = (k: string) => k.replace("manual-", "");

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
        className="absolute text-[11px] tabular-nums"
        style={{ color: allDone ? "var(--color-success)" : "var(--color-text-secondary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}
      >
        {completed}/{total}
      </span>
    </div>
  );
}

/* ── Tab IDs for bottom section ─────────────────────────────────── */
type InsightTab = "protocol" | "breakthrough" | "principle";

/* ── Component ──────────────────────────────────────────────────── */
export default function HomePage() {
  const { t, lang } = useT();
  const { operatorName } = useSettingsStore();

  const [data, setData] = useState<DashboardData>({
    todayFocus: [], manualTodayEvents: [],
    clientsCount: 0, mrr: 0, activeTasks: 0, leadsCount: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/dashboard");
      setData(await res.json());
    } catch (e) {
      console.error("Failed to fetch dashboard:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);
  useRealtimeRefresh(["leads", "clients", "tasks", "finance_transactions", "today_focus_state", "today_focus_manual", "payment_milestones"], fetchData);

  const scrollRef = useRef<HTMLDivElement>(null);
  usePullToRefresh(scrollRef, fetchData);

  /* ── Focus handlers ── */
  const handleUpdateStatus = async (key: string, status: "pending" | "completed") => {
    await fetch("/api/today-focus/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ focusKey: key, status }),
    });
    setData((prev) => ({
      ...prev,
      todayFocus: prev.todayFocus.map((i) => (i.key === key ? { ...i, status } : i)),
      manualTodayEvents: prev.manualTodayEvents.map((i) => (i.key === key ? { ...i, status } : i)),
    }));
  };

  const handleSaveManual = async (form: { type: string; title: string; note: string }, editKey?: string) => {
    const isEdit = Boolean(editKey);
    await fetch(
      isEdit ? `/api/today-focus/manual/${manualIdFromKey(editKey!)}` : "/api/today-focus/manual",
      {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: form.type, title: form.title.trim(), note: form.note.trim() }),
      },
    );
    await fetchData();
  };

  const handleDeleteManual = async (item: FocusItem) => {
    await fetch(`/api/today-focus/manual/${manualIdFromKey(item.key)}`, { method: "DELETE" });
    await fetchData();
  };

  /* ── Progress calculation ── */
  const allFocusItems = [...data.todayFocus, ...data.manualTodayEvents];
  const totalFocus = allFocusItems.length;
  const completedFocus = allFocusItems.filter((i) => i.status === "completed").length;

  /* ── Insight tabs ── */
  const [insightTab, setInsightTab] = useState<InsightTab>("protocol");

  const insightTabs: { id: InsightTab; labelKey: string }[] = [
    { id: "protocol", labelKey: "home.protocol.title" },
    { id: "breakthrough", labelKey: "home.breakthrough.title" },
    { id: "principle", labelKey: "home.principle.title" },
  ];

  const displayName = operatorName.trim() || "Solo CEO";

  return (
    <div ref={scrollRef} className="mobile-page page-wrap">
      <div className="page-stack">
        {/* ── Header: Greeting + Progress Ring + Date ── */}
        <div className="flex items-center gap-3">
          <ProgressRing completed={completedFocus} total={totalFocus} />
          <div className="flex-1 min-w-0">
            <p className="text-[11px]" style={{ color: "var(--color-text-quaternary)" }}>{greeting(t)}</p>
            <h1 className="text-[17px] tracking-tight truncate" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-bold)" } as React.CSSProperties}>
              {displayName}
            </h1>
          </div>
          <span className="text-[11px] shrink-0" style={{ color: "var(--color-text-quaternary)" }}>{todayStr(lang)}</span>
        </div>

        {/* ── KPI Stat Bar ── */}
        <KPIGrid
          mrr={data.mrr || 0}
          ytdRevenue={data.ytdRevenue || 0}
          todayIncome={data.todayIncome || 0}
          clientsCount={data.clientsCount || 0}
          leadsCount={data.leadsCount || 0}
          activeTasks={data.activeTasks || 0}
          loading={loading}
        />

        {/* ── Today's Focus (list style) ── */}
        <TodayFocus
          todayFocus={data.todayFocus}
          manualEvents={data.manualTodayEvents}
          loading={loading}
          onUpdateStatus={handleUpdateStatus}
          onSaveManual={handleSaveManual}
          onDeleteManual={handleDeleteManual}
        />

        {/* ── Insight Tabs ── */}
        <section>
          <div className="segment-switcher mb-3">
            {insightTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setInsightTab(tab.id)}
                data-active={insightTab === tab.id}
              >
                {t(tab.labelKey as any)}
              </button>
            ))}
          </div>
          <div className="card overflow-hidden">
            <div className="p-4">
              <Suspense fallback={null}>
                {insightTab === "protocol" && <DailyProtocol />}
                {insightTab === "breakthrough" && <BreakthroughFull />}
                {insightTab === "principle" && <TodayPrinciple />}
              </Suspense>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
