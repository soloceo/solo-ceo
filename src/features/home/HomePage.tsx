import React, { useEffect, useState, useCallback, useRef, lazy, Suspense, useMemo } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { useT } from "../../i18n/context";
import { useRealtimeRefresh } from "../../hooks/useRealtimeRefresh";
import { usePullToRefresh } from "../../hooks/usePullToRefresh";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useUIStore } from "../../store/useUIStore";
import { useAppSettings, invalidateSettingsCache } from "../../hooks/useAppSettings";
import { KPIGrid } from "./KPIGrid";
import { MonthlyGoal } from "./MonthlyGoal";
import type { ActivityItem } from "./ActivityTimeline";
import { WeeklyReport } from "./WeeklyReport";
import { TodayFocus, type FocusItem } from "./TodayFocus";
import { BarChart3, Flame, ChevronDown, ChevronRight, BookOpen, Circle, CheckCircle2, X } from "lucide-react";
import { KNOWLEDGE_CATEGORIES } from "../../data/evolution-knowledge";
import type { Principle } from "../../data/evolution-knowledge";
import { PROTOCOL_STEPS } from "../../data/evolution-protocol";
import { PHASES } from "../../data/breakthrough-tasks";

const WidgetGrid = lazy(() => import("./widgets/WidgetGrid"));

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
  monthlyIncome?: number;
  recentActivity?: ActivityItem[];
  mrrSeries?: { name: string; mrr: number }[];
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
  const { operatorName } = useSettingsStore();
  const showToast = useUIStore((s) => s.showToast);
  const setHideMobileNav = useUIStore((s) => s.setHideMobileNav);

  const [data, setData] = useState<DashboardData>({
    todayFocus: [], manualTodayEvents: [],
    clientsCount: 0, mrr: 0, activeTasks: 0, leadsCount: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/dashboard");
      const raw = await res.json();
      setData({
        ...raw,
        todayFocus: Array.isArray(raw.todayFocus) ? raw.todayFocus : [],
        manualTodayEvents: Array.isArray(raw.manualTodayEvents) ? raw.manualTodayEvents : [],
        recentActivity: Array.isArray(raw.recentActivity) ? raw.recentActivity : [],
        mrrSeries: Array.isArray(raw.mrrSeries) ? raw.mrrSeries : [],
      });
    } catch {
      showToast(t("home.loadFailed" as any));
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
    const res = await fetch("/api/today-focus/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ focusKey: key, status }),
    });
    if (!res.ok) {
      showToast(t("common.updateFailed" as any) || "Update failed");
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
    const res = await fetch(
      isEdit ? `/api/today-focus/manual/${manualIdFromKey(editKey!)}` : "/api/today-focus/manual",
      {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: form.type, title: form.title.trim(), note: form.note.trim() }),
      },
    );
    if (!res.ok) {
      showToast(t("common.saveFailed" as any) || "Save failed");
      throw new Error("Save failed");
    }
    await fetchData();
  };

  const handleDeleteManual = async (item: FocusItem) => {
    const res = await fetch(`/api/today-focus/manual/${manualIdFromKey(item.key)}`, { method: "DELETE" });
    if (!res.ok) {
      showToast(t("common.deleteFailed" as any) || "Delete failed");
      throw new Error("Delete failed");
    }
    await fetchData();
  };

  /* ── Progress calculation ── */
  const allFocusItems = [...data.todayFocus, ...data.manualTodayEvents];
  const totalFocus = allFocusItems.length;
  const completedFocus = allFocusItems.filter((i) => i.status === "completed").length;

  /* ── Inline insight sections state ── */
  const { settings, loaded: settingsLoaded, save } = useAppSettings();

  // Principle card state
  const [principleExpanded, setPrincipleExpanded] = useState(false);
  const [showAllPrinciples, setShowAllPrinciples] = useState(false);
  const [selectedPrinciple, setSelectedPrinciple] = useState<(Principle & { catEmoji: string }) | null>(null);

  // Hide mobile tab bar when principles sheet is open
  useEffect(() => {
    setHideMobileNav(showAllPrinciples);
    return () => setHideMobileNav(false);
  }, [showAllPrinciples, setHideMobileNav]);

  const allPrinciples = useMemo(
    () => KNOWLEDGE_CATEGORIES.flatMap((c) => c.principles.map((p) => ({ ...p, catEmoji: c.emoji }))),
    [],
  );

  const todayPrinciple = useMemo(() => {
    // Rotate through all principles by day-of-year for variety
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    const idx = dayOfYear % allPrinciples.length;
    return allPrinciples[idx];
  }, [allPrinciples]);

  // Protocol state
  const protocolState: { date: string; checks: Record<string, boolean> } = useMemo(() => {
    try {
      const raw = settings?.evolution_protocol ? JSON.parse(settings.evolution_protocol) : null;
      const today = new Date().toISOString().slice(0, 10);
      if (raw && raw.date === today) return raw;
      return { date: today, checks: {} };
    } catch { return { date: new Date().toISOString().slice(0, 10), checks: {} }; }
  }, [settings?.evolution_protocol]);

  const protocolStreak: { count: number; lastDate: string } = useMemo(() => {
    try { return settings?.protocol_streak ? JSON.parse(settings.protocol_streak) : { count: 0, lastDate: "" }; } catch { return { count: 0, lastDate: "" }; }
  }, [settings?.protocol_streak]);

  const protocolDone = PROTOCOL_STEPS.filter((s) => protocolState.checks[s.id]).length;

  const toggleProtocolStep = async (stepId: string) => {
    const today = new Date().toISOString().slice(0, 10);
    const newChecks = { ...protocolState.checks, [stepId]: !protocolState.checks[stepId] };
    const newState = { date: today, checks: newChecks };
    await save("evolution_protocol", JSON.stringify(newState));

    // Update streak
    const allDone = PROTOCOL_STEPS.every((s) => newChecks[s.id]);
    let newStreak = { ...protocolStreak };
    if (allDone) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      newStreak = {
        count: protocolStreak.lastDate === yesterday ? protocolStreak.count + 1 : 1,
        lastDate: today,
      };
    } else if (protocolStreak.lastDate === today) {
      // Was completed, now unchecking — reduce streak
      newStreak = { count: Math.max(0, protocolStreak.count - 1), lastDate: "" };
    }
    await save("protocol_streak", JSON.stringify(newStreak));
    invalidateSettingsCache();
  };

  // Breakthrough state
  const [breakthroughExpanded, setBreakthroughExpanded] = useState(false);
  const [activePhaseIdx, setActivePhaseIdx] = useState(0);

  const breakthroughTasks: Record<string, Record<string, boolean>> = useMemo(() => {
    try { return settings?.breakthrough_tasks ? JSON.parse(settings.breakthrough_tasks) : {}; } catch { return {}; }
  }, [settings?.breakthrough_tasks]);

  // Find current phase (first phase not fully complete)
  const currentPhaseIdx = useMemo(() => {
    for (let i = 0; i < PHASES.length; i++) {
      const phase = PHASES[i];
      const done = phase.tasks.filter((t) => breakthroughTasks[phase.id]?.[t.id]).length;
      if (done < phase.tasks.length) return i;
    }
    return PHASES.length - 1;
  }, [breakthroughTasks]);

  useEffect(() => { setActivePhaseIdx(currentPhaseIdx); }, [currentPhaseIdx]);

  const activePhase = PHASES[activePhaseIdx];
  const phaseDone = activePhase.tasks.filter((t) => breakthroughTasks[activePhase.id]?.[t.id]).length;
  const phaseTotal = activePhase.tasks.length;
  const phasePct = phaseTotal > 0 ? Math.round((phaseDone / phaseTotal) * 100) : 0;

  const toggleBreakthroughTask = async (phaseId: string, taskId: string) => {
    const phaseTasks = { ...(breakthroughTasks[phaseId] || {}) };
    phaseTasks[taskId] = !phaseTasks[taskId];
    const newAll = { ...breakthroughTasks, [phaseId]: phaseTasks };
    await save("breakthrough_tasks", JSON.stringify(newAll));
    invalidateSettingsCache();
  };

  const [reportOpen, setReportOpen] = useState(false);
  const displayName = operatorName.trim() || "Solo CEO";

  return (
    <div ref={scrollRef} className="mobile-page page-wrap">
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
              title={t("home.report.generate" as any)}
            >
              <BarChart3 size={14} />
              <span className="text-[13px] hidden sm:inline" style={{ fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
                {t("home.report.generate" as any)}
              </span>
            </button>
            <span className="text-[13px]" style={{ color: "var(--color-text-quaternary)" }}>{todayStr(lang)}</span>
          </div>
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
          mrrSeries={(data as any).mrrSeries}
        />

        {/* ── Monthly Revenue Goal ── */}
        <MonthlyGoal monthlyIncome={data.monthlyIncome || 0} loading={loading} />

        {/* ── Today's Focus (list style) ── */}
        <TodayFocus
          todayFocus={data.todayFocus}
          manualEvents={data.manualTodayEvents}
          loading={loading}
          onUpdateStatus={handleUpdateStatus}
          onSaveManual={handleSaveManual}
          onDeleteManual={handleDeleteManual}
          openFormTrigger={fabTrigger}
        />

        {/* ═══════════════════════════════════════════════════════════
            Growth System — 三位一体：原则 → 协议 → 突围
            叙事逻辑：先武装思想，再执行节奏，最后推进战线
        ═══════════════════════════════════════════════════════════ */}

        {/* ── 思想武装：今日原则 ── */}
        <section>
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-bold)" } as React.CSSProperties}>
                {lang === "zh" ? "每日一课" : "Daily Lesson"}
              </span>
              <span className="text-[11px] px-1.5 py-0.5 rounded-[var(--radius-4)]"
                style={{ background: "var(--color-bg-tertiary)", color: "var(--color-text-secondary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
                {KNOWLEDGE_CATEGORIES.find((c) => c.principles.some((p) => p.id === todayPrinciple.id))?.name[lang as "zh" | "en"]}
              </span>
            </div>
            <button
              onClick={() => setShowAllPrinciples(true)}
              className="flex items-center gap-1.5 text-[13px] press-feedback"
              style={{ color: "var(--color-accent)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}
            >
              <BookOpen size={12} />
              {lang === "zh" ? `浏览全部原则 ${allPrinciples.length}条` : `All ${allPrinciples.length} Principles`}
            </button>
          </div>

          {/* Card */}
          <div className="card overflow-hidden">
            <button
              onClick={() => setPrincipleExpanded((v) => !v)}
              className="w-full text-left press-feedback px-3 py-2.5"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-[15px] mb-1" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-bold)" } as React.CSSProperties}>
                    {todayPrinciple.name[lang as "zh" | "en"]}
                  </h3>
                  <p className="text-[14px] leading-relaxed line-clamp-2" style={{ color: "var(--color-text-secondary)" }}>
                    {todayPrinciple.core[lang as "zh" | "en"]}
                  </p>
                </div>
                <div className="shrink-0 mt-0.5">
                  {principleExpanded ? <ChevronDown size={14} style={{ color: "var(--color-text-quaternary)" }} /> : <ChevronRight size={14} style={{ color: "var(--color-text-quaternary)" }} />}
                </div>
              </div>
            </button>

            {/* 展开：深度解读 */}
            <AnimatePresence>
              {principleExpanded && todayPrinciple.explanation && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ type: "spring", damping: 30, stiffness: 320 }}
                  className="overflow-hidden"
                >
                  <div className="px-3 pb-3" style={{ borderTop: "1px solid var(--color-line-secondary)" }}>
                    <p className="text-[14px] leading-relaxed pt-3 mb-3" style={{ color: "var(--color-text-secondary)" }}>
                      {todayPrinciple.explanation[lang as "zh" | "en"]}
                    </p>
                    {todayPrinciple.actionSteps && todayPrinciple.actionSteps.length > 0 && (
                      <div className="mb-3 rounded-[var(--radius-8)] p-3" style={{ background: "var(--color-bg-secondary)" }}>
                        <h4 className="text-[12px] mb-2 flex items-center gap-1.5" style={{ color: "var(--color-accent)", fontWeight: "var(--font-weight-semibold)", textTransform: "uppercase", letterSpacing: "0.03em" } as React.CSSProperties}>
                          <span>→</span> {lang === "zh" ? "行动指南" : "Action Steps"}
                        </h4>
                        <div className="flex flex-col gap-1.5">
                          {todayPrinciple.actionSteps.map((s, i) => (
                            <div key={i} className="flex items-start gap-2 text-[13px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                              <span className="shrink-0 text-[11px] mt-0.5" style={{ color: "var(--color-accent)" }}>{i + 1}.</span>
                              <span>{s[lang as "zh" | "en"]}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {todayPrinciple.checks && todayPrinciple.checks.length > 0 && (
                      <div className="mb-3 rounded-[var(--radius-8)] p-3" style={{ background: "color-mix(in srgb, var(--color-success) 6%, var(--color-bg-secondary))" }}>
                        <h4 className="text-[12px] mb-2 flex items-center gap-1.5" style={{ color: "var(--color-success)", fontWeight: "var(--font-weight-semibold)", textTransform: "uppercase", letterSpacing: "0.03em" } as React.CSSProperties}>
                          <span>✓</span> {lang === "zh" ? "自检清单" : "Self-Check"}
                        </h4>
                        <div className="flex flex-col gap-1.5">
                          {todayPrinciple.checks.map((c, i) => (
                            <div key={i} className="flex items-start gap-2 text-[13px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                              <span className="shrink-0 mt-0.5" style={{ color: "var(--color-success)" }}>☐</span>
                              <span>{c[lang as "zh" | "en"]}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {todayPrinciple.antiPatterns && todayPrinciple.antiPatterns.length > 0 && (
                      <div className="rounded-[var(--radius-8)] p-3" style={{ background: "color-mix(in srgb, var(--color-danger) 5%, var(--color-bg-secondary))" }}>
                        <h4 className="text-[12px] mb-2 flex items-center gap-1.5" style={{ color: "var(--color-danger)", fontWeight: "var(--font-weight-semibold)", textTransform: "uppercase", letterSpacing: "0.03em" } as React.CSSProperties}>
                          <span>✗</span> {lang === "zh" ? "常见误区" : "Anti-Patterns"}
                        </h4>
                        <div className="flex flex-col gap-1.5">
                          {todayPrinciple.antiPatterns.map((a, i) => (
                            <div key={i} className="flex items-start gap-2 text-[13px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                              <span className="shrink-0 mt-0.5" style={{ color: "var(--color-danger)" }}>✗</span>
                              <span>{a[lang as "zh" | "en"]}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* ── 执行节奏：每日协议 ── */}
        <section>
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-bold)" } as React.CSSProperties}>
                {lang === "zh" ? "每日协议" : "Daily Protocol"}
              </span>
              {protocolDone > 0 && (
                <span className="text-[13px] tabular-nums px-1.5 py-0.5 rounded-[var(--radius-4)]"
                  style={{
                    background: protocolDone === PROTOCOL_STEPS.length ? "var(--color-success)" : "var(--color-accent)",
                    color: "#fff",
                    fontWeight: "var(--font-weight-semibold)",
                  } as React.CSSProperties}>
                  {protocolDone}/{PROTOCOL_STEPS.length}
                </span>
              )}
              {protocolDone === 0 && (
                <span className="text-[13px] tabular-nums" style={{ color: "var(--color-text-quaternary)" }}>
                  {protocolDone}/{PROTOCOL_STEPS.length}
                </span>
              )}
            </div>
            {protocolStreak.count > 0 && (
              <span className="flex items-center gap-1 text-[13px] px-2 py-0.5 rounded-[var(--radius-4)]"
                style={{
                  color: "var(--color-accent)",
                  background: "color-mix(in srgb, var(--color-accent) 10%, transparent)",
                  fontWeight: "var(--font-weight-semibold)",
                } as React.CSSProperties}>
                <Flame size={11} /> {protocolStreak.count} {lang === "zh" ? "天连续" : "day streak"}
              </span>
            )}
          </div>

          {/* 协议步骤卡片 */}
          <div className="card overflow-hidden divide-y divide-[var(--color-line-secondary)]">
            {PROTOCOL_STEPS.map((step, i) => {
              const done = !!protocolState.checks[step.id];
              const h = new Date().getHours();
              const isCurrent = (i === 0 && h >= 5 && h < 9) || (i === 1 && h >= 9 && h < 12) || (i === 2 && h >= 12 && h < 14) || (i === 3 && h >= 14 && h < 20) || (i === 4 && h >= 20);
              return (
                <button
                  key={step.id}
                  onClick={() => toggleProtocolStep(step.id)}
                  className="flex items-start gap-3 w-full text-left px-3 py-2.5 press-feedback"
                  style={{
                    opacity: done ? 0.6 : 1,
                    borderLeft: isCurrent && !done ? "3px solid var(--color-accent)" : "3px solid transparent",
                  }}
                >
                  {/* Check circle */}
                  <div
                    className="shrink-0 rounded-full flex items-center justify-center mt-0.5"
                    style={{
                      width: 22,
                      height: 22,
                      background: done ? "var(--color-accent)" : "transparent",
                      border: done ? "none" : "2px solid var(--color-border-secondary)",
                    }}
                  >
                    {done && <CheckCircle2 size={14} style={{ color: "#fff" }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] shrink-0 uppercase tracking-wide px-2 py-0.5 rounded-[var(--radius-4)]"
                        style={{
                          color: done ? "var(--color-text-quaternary)" : isCurrent ? "#fff" : "var(--color-text-secondary)",
                          background: done ? "var(--color-bg-tertiary)" : isCurrent ? "var(--color-accent)" : "var(--color-bg-tertiary)",
                          fontWeight: "var(--font-weight-bold)",
                        } as React.CSSProperties}>
                        {step.time[lang as "zh" | "en"]}
                      </span>
                      <span
                        className="text-[14px]"
                        style={{
                          color: done ? "var(--color-text-quaternary)" : "var(--color-text-primary)",
                          fontWeight: "var(--font-weight-semibold)",
                          textDecoration: done ? "line-through" : "none",
                        } as React.CSSProperties}
                      >
                        {step.title[lang as "zh" | "en"]}
                      </span>
                    </div>
                    <p
                      className="text-[13px] mt-1 leading-relaxed"
                      style={{
                        color: done ? "var(--color-text-quaternary)" : "var(--color-text-tertiary)",
                      }}
                    >
                      {step.description[lang as "zh" | "en"]}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── 推进战线：突围进度 ── */}
        <section>
          {/* Header */}
          <button
            onClick={() => setBreakthroughExpanded((v) => !v)}
            className="w-full text-left press-feedback mb-2"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[16px]">{activePhase.strategy.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-bold)" } as React.CSSProperties}>
                    {lang === "zh" ? "突围" : "Breakthrough"} · {activePhase.label[lang as "zh" | "en"]}
                  </span>
                  <span className="text-[13px] tabular-nums" style={{ color: "var(--color-text-quaternary)" }}>
                    {phaseDone}/{phaseTotal}
                  </span>
                </div>
              </div>
              <span className="text-[15px] tabular-nums shrink-0" style={{ color: phasePct === 100 ? "var(--color-success)" : "var(--color-accent)", fontWeight: "var(--font-weight-bold)" } as React.CSSProperties}>
                {phasePct}%
              </span>
              {breakthroughExpanded ? <ChevronDown size={14} style={{ color: "var(--color-text-quaternary)" }} /> : <ChevronRight size={14} style={{ color: "var(--color-text-quaternary)" }} />}
            </div>
            {/* 进度条 */}
            <div className="rounded-full overflow-hidden" style={{ height: 6, background: "var(--color-bg-quaternary)" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.max(phasePct, 2)}%`,
                  background: phasePct === 100
                    ? "var(--color-success)"
                    : "linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 70%, var(--color-warning)))",
                }}
              />
            </div>
          </button>
          <AnimatePresence>
            {breakthroughExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ type: "spring", damping: 30, stiffness: 320 }}
                className="overflow-hidden"
              >
                {/* Phase pills */}
                <div
                  className="flex gap-1.5 mb-3"
                  style={{
                    overflowX: "auto",
                    scrollbarWidth: "none",
                    WebkitOverflowScrolling: "touch",
                  }}
                >
                  {PHASES.map((phase, idx) => {
                    const phTasks = phase.tasks;
                    const phDone = phTasks.filter((t) => breakthroughTasks[phase.id]?.[t.id]).length;
                    const isActive = idx === activePhaseIdx;
                    return (
                      <button
                        key={phase.id}
                        onClick={(e) => { e.stopPropagation(); setActivePhaseIdx(idx); }}
                        className="py-1.5 px-3 rounded-full text-[13px] transition-colors shrink-0 flex items-center gap-1.5 press-feedback"
                        style={{
                          background: isActive ? "var(--color-accent)" : "var(--color-bg-quaternary)",
                          color: isActive ? "#fff" : "var(--color-text-secondary)",
                          fontWeight: "var(--font-weight-medium)",
                        } as React.CSSProperties}
                      >
                        <span>{phase.strategy.emoji}</span>
                        <span>{phase.label[lang as "zh" | "en"]}</span>
                        <span className="tabular-nums" style={{ opacity: 0.7 }}>{phDone}/{phTasks.length}</span>
                      </button>
                    );
                  })}
                </div>
                {/* Task checklist */}
                <div className="card overflow-hidden divide-y divide-[var(--color-line-secondary)]">
                  {activePhase.tasks.map((task) => {
                    const checked = !!breakthroughTasks[activePhase.id]?.[task.id];
                    return (
                      <button
                        key={task.id}
                        onClick={(e) => { e.stopPropagation(); toggleBreakthroughTask(activePhase.id, task.id); }}
                        className="flex items-start gap-3 text-left text-[14px] w-full px-3 py-2.5 press-feedback"
                        style={{
                          color: checked ? "var(--color-text-quaternary)" : "var(--color-text-primary)",
                        }}
                      >
                        {checked
                          ? <CheckCircle2 size={18} className="shrink-0 mt-0.5" style={{ color: "var(--color-accent)" }} />
                          : <Circle size={18} className="shrink-0 mt-0.5" style={{ color: "var(--color-border-secondary)" }} />
                        }
                        <span className="leading-relaxed" style={{ textDecoration: checked ? "line-through" : "none", opacity: checked ? 0.5 : 1 }}>
                          {task.title[lang as "zh" | "en"]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* ── Widgets ── */}
        <Suspense fallback={null}>
          <WidgetGrid />
        </Suspense>
      </div>

      {/* ── All Principles Sheet ── */}
      {createPortal(<AnimatePresence>
        {showAllPrinciples && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0"
              style={{ zIndex: 699, background: "var(--color-bg-primary)" }}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-0 flex flex-col"
              style={{ zIndex: 700, background: "var(--color-bg-primary)", paddingTop: "max(12px, var(--mobile-header-pt, env(safe-area-inset-top, 0px)))" }}
            >
              {/* Header */}
              <div className="flex items-center justify-between shrink-0 px-5 py-3 border-b"
                style={{ borderColor: "var(--color-border-primary)" }}>
                <button
                  onClick={() => { setShowAllPrinciples(false); setSelectedPrinciple(null); }}
                  className="text-[15px] press-feedback"
                  style={{ color: "var(--color-text-secondary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}
                >
                  <X size={18} />
                </button>
                <span className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-bold)" } as React.CSSProperties}>
                  {lang === "zh" ? "全部原则" : "All Principles"}
                </span>
                <span style={{ width: 18 }} />
              </div>

              {/* Scrollable content */}
              <div className="overflow-y-auto flex-1">
                {selectedPrinciple ? (
                  /* ── Principle detail view ── */
                  <div className="px-4 py-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)" }}>
                    <button
                      onClick={() => setSelectedPrinciple(null)}
                      className="flex items-center gap-1 text-[14px] mb-3 press-feedback"
                      style={{ color: "var(--color-accent)" }}
                    >
                      <ChevronRight size={12} style={{ transform: "rotate(180deg)" }} />
                      {lang === "zh" ? "返回列表" : "Back"}
                    </button>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[18px]">{selectedPrinciple.catEmoji}</span>
                      <h3 className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-bold)" } as React.CSSProperties}>
                        {selectedPrinciple.name[lang as "zh" | "en"]}
                      </h3>
                    </div>
                    <p className="text-[15px] mb-3" style={{ color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
                      {selectedPrinciple.core[lang as "zh" | "en"]}
                    </p>
                    {selectedPrinciple.explanation && (
                      <div className="text-[14px] leading-relaxed mb-4 rounded-[var(--radius-8)] p-3"
                        style={{ color: "var(--color-text-secondary)", background: "var(--color-bg-secondary)" }}>
                        {selectedPrinciple.explanation[lang as "zh" | "en"]}
                      </div>
                    )}
                    {selectedPrinciple.actionSteps && selectedPrinciple.actionSteps.length > 0 && (
                      <div className="mb-3 rounded-[var(--radius-8)] p-3" style={{ background: "var(--color-bg-secondary)" }}>
                        <h4 className="text-[13px] mb-2 flex items-center gap-1.5" style={{ color: "var(--color-accent)", fontWeight: "var(--font-weight-semibold)", textTransform: "uppercase", letterSpacing: "0.03em" } as React.CSSProperties}>
                          <span>→</span> {lang === "zh" ? "行动指南" : "Action Steps"}
                        </h4>
                        <div className="flex flex-col gap-2">
                          {selectedPrinciple.actionSteps.map((s, i) => (
                            <div key={i} className="flex items-start gap-2 text-[14px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                              <span className="shrink-0 text-[12px] mt-0.5" style={{ color: "var(--color-accent)" }}>{i + 1}.</span>
                              <span>{s[lang as "zh" | "en"]}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {selectedPrinciple.checks && selectedPrinciple.checks.length > 0 && (
                      <div className="mb-3 rounded-[var(--radius-8)] p-3" style={{ background: "color-mix(in srgb, var(--color-success) 6%, var(--color-bg-secondary))" }}>
                        <h4 className="text-[13px] mb-2 flex items-center gap-1.5" style={{ color: "var(--color-success)", fontWeight: "var(--font-weight-semibold)", textTransform: "uppercase", letterSpacing: "0.03em" } as React.CSSProperties}>
                          <span>✓</span> {lang === "zh" ? "自检清单" : "Self-Check"}
                        </h4>
                        <div className="flex flex-col gap-2">
                          {selectedPrinciple.checks.map((c, i) => (
                            <div key={i} className="flex items-start gap-2 text-[14px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                              <span className="shrink-0 mt-0.5" style={{ color: "var(--color-success)" }}>☐</span>
                              <span>{c[lang as "zh" | "en"]}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {selectedPrinciple.antiPatterns && selectedPrinciple.antiPatterns.length > 0 && (
                      <div className="rounded-[var(--radius-8)] p-3" style={{ background: "color-mix(in srgb, var(--color-danger) 5%, var(--color-bg-secondary))" }}>
                        <h4 className="text-[13px] mb-2 flex items-center gap-1.5" style={{ color: "var(--color-danger)", fontWeight: "var(--font-weight-semibold)", textTransform: "uppercase", letterSpacing: "0.03em" } as React.CSSProperties}>
                          <span>✗</span> {lang === "zh" ? "常见误区" : "Anti-Patterns"}
                        </h4>
                        <div className="flex flex-col gap-2">
                          {selectedPrinciple.antiPatterns.map((a, i) => (
                            <div key={i} className="flex items-start gap-2 text-[14px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                              <span className="shrink-0 mt-0.5" style={{ color: "var(--color-danger)" }}>✗</span>
                              <span>{a[lang as "zh" | "en"]}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* ── Principle list by category ── */
                  <div className="px-4 py-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)" }}>
                    {KNOWLEDGE_CATEGORIES.map((cat, catIdx) => (
                      <div key={cat.id}>
                        {catIdx > 0 && (
                          <div className="my-4" style={{ borderTop: "1px solid var(--color-border-primary)" }} />
                        )}
                        <div className="flex items-center gap-2 mb-3 px-1">
                          <span className="text-[17px]">{cat.emoji}</span>
                          <span className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-bold)" } as React.CSSProperties}>
                            {cat.name[lang as "zh" | "en"]}
                          </span>
                          <span className="text-[13px] tabular-nums px-1.5 py-0.5 rounded-[var(--radius-4)]" style={{ color: "var(--color-text-tertiary)", background: "var(--color-bg-tertiary)" }}>
                            {cat.principles.length}
                          </span>
                        </div>
                        <div className="flex flex-col gap-2">
                          {cat.principles.map((p) => {
                            const isToday = p.id === todayPrinciple.id;
                            const coreText = p.core[lang as "zh" | "en"];
                            const truncated = coreText.length > 50 ? coreText.slice(0, 50) + "…" : coreText;
                            return (
                              <button
                                key={p.id}
                                onClick={() => setSelectedPrinciple({ ...p, catEmoji: cat.emoji })}
                                className="w-full text-left rounded-[var(--radius-8)] press-feedback"
                                style={{
                                  padding: "10px 12px",
                                  background: isToday
                                    ? "color-mix(in srgb, var(--color-accent) 8%, transparent)"
                                    : "var(--color-bg-secondary)",
                                  border: isToday ? "1px solid color-mix(in srgb, var(--color-accent) 20%, transparent)" : "1px solid transparent",
                                }}
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[14px] flex-1 min-w-0 truncate" style={{
                                    color: "var(--color-text-primary)",
                                    fontWeight: "var(--font-weight-semibold)",
                                  } as React.CSSProperties}>
                                    {p.name[lang as "zh" | "en"]}
                                  </span>
                                  {isToday && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-[var(--radius-4)] shrink-0"
                                      style={{ background: "var(--color-accent)", color: "#fff", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
                                      {lang === "zh" ? "今日" : "Today"}
                                    </span>
                                  )}
                                  <ChevronRight size={12} style={{ color: "var(--color-text-quaternary)" }} className="shrink-0" />
                                </div>
                                <p className="text-[13px] leading-relaxed" style={{ color: "var(--color-text-tertiary)" }}>
                                  {truncated}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>, document.body)}

      {/* ── Weekly Report Modal ── */}
      <WeeklyReport open={reportOpen} onClose={() => setReportOpen(false)} />
    </div>
  );
}
