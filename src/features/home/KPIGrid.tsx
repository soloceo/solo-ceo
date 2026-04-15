import React, { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { TrendingUp, Users, Briefcase, User, Target, Check, Edit2 } from "lucide-react";
import { useCountUp } from "../../hooks/useCountUp";
import { useT } from "../../i18n/context";
import { useAppSettings } from "../../hooks/useAppSettings";
import { celebrate } from "../../lib/celebrate";

interface KPIGridProps {
  monthlyIncome: number;
  todayIncome: number;
  clientsCount: number;
  leadsCount: number;
  workTasks: number;
  personalTasks: number;
  loading: boolean;
}

const GOAL_KEY = "MONTHLY_REVENUE_GOAL";

export function KPIGrid({ monthlyIncome, todayIncome, clientsCount, leadsCount, workTasks, personalTasks, loading }: KPIGridProps) {
  const { t } = useT();
  const { settings, loaded, save } = useAppSettings();
  const animIncome = useCountUp(monthlyIncome);
  const animClients = useCountUp(clientsCount);
  const animWork = useCountUp(workTasks);
  const animPersonal = useCountUp(personalTasks);

  // Pop key — bumps whenever monthly income increases (not on edits/decreases).
  // The motion.span keyed off this re-mounts and replays its spring-in.
  const prevIncomeRef = useRef(monthlyIncome);
  const [incomePopKey, setIncomePopKey] = useState(0);
  useEffect(() => {
    if (monthlyIncome > prevIncomeRef.current) setIncomePopKey((k) => k + 1);
    prevIncomeRef.current = monthlyIncome;
  }, [monthlyIncome]);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const goal = Number(settings?.[GOAL_KEY] || 0);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSave = () => {
    const parsed = parseFloat(draft);
    const val = isNaN(parsed) ? 0 : Math.max(0, Math.round(parsed));
    save(GOAL_KEY, String(val));
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) handleSave();
    if (e.key === "Escape") setEditing(false);
  };

  // Goal progress
  const hasGoal = loaded && goal > 0 && isFinite(goal);
  const progress = hasGoal ? Math.min(1, monthlyIncome / goal) : 0;
  const percentage = Math.round(progress * 100);
  const achieved = monthlyIncome >= goal;
  const diff = Math.abs(monthlyIncome - goal);

  // Celebrate the moment the user first crosses their monthly goal.
  // Guarded by a ref so a re-render (or loading flip) doesn't refire.
  const celebratedGoalRef = useRef(false);
  useEffect(() => {
    if (!hasGoal || !loaded || loading) return;
    if (achieved && !celebratedGoalRef.current) {
      celebratedGoalRef.current = true;
      celebrate("milestone");
    }
    // If the user edits their goal upward and drops back below, allow re-celebration.
    if (!achieved && celebratedGoalRef.current) {
      celebratedGoalRef.current = false;
    }
  }, [achieved, hasGoal, loaded, loading]);

  const statusText = !hasGoal
    ? ""
    : achieved
      ? monthlyIncome === goal
        ? t("home.goal.achieved")
        : String(t("home.goal.exceeded") || "").replace("${amount}", `$${diff.toLocaleString()}`)
      : String(t("home.goal.remaining") || "").replace("${amount}", `$${diff.toLocaleString()}`);

  const barColor = achieved ? "var(--color-success)" : "var(--color-accent)";

  return (
    <div className="flex flex-col" style={{ gap: 16 }}>
      {/* ── Hero metric — Monthly Income + Goal ── */}
      <div className="card card-glow p-4">
        {/* Top row: label + actions */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center rounded-full" style={{
              width: 24, height: 24,
              background: "var(--color-bg-tertiary)",
            }}>
              <TrendingUp size={12} style={{ color: "var(--color-text-tertiary)" }} />
            </div>
            <span className="text-[12px] " style={{ color: "var(--color-text-tertiary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
              {t("home.kpi.monthlyIncome")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {hasGoal && (
              <motion.span
                className="text-[12px] tabular-nums px-2 py-0.5 rounded-[var(--radius-4)]"
                style={{
                  background: "var(--color-bg-tertiary)",
                  color: achieved ? "var(--color-success)" : "var(--color-text-secondary)",
                  fontWeight: "var(--font-weight-bold)",
                } as React.CSSProperties}
                animate={achieved ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                transition={achieved
                  ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
                  : { duration: 0.2 }}
              >
                {percentage}%
              </motion.span>
            )}
            {editing ? (
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <span className="text-[14px]" style={{ color: "var(--color-text-quaternary)" }}>$</span>
                <input
                  ref={inputRef}
                  type="number"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleSave}
                  placeholder={t("home.goal.placeholder")}
                  className="input-base compact px-2 text-[14px] w-24"
                />
              </div>
            ) : (
              <button
                onClick={() => { setDraft(hasGoal ? String(goal) : ""); setEditing(true); }}
                className="flex items-center gap-1 text-[12px] px-1.5 py-1 rounded-[var(--radius-6)] transition-colors hover:bg-[var(--color-bg-quaternary)]"
                style={{ color: "var(--color-text-tertiary)" }}
                title={hasGoal ? t("home.goal.editGoal") : t("home.goal.setGoal")}
              >
                {hasGoal ? (
                  <Edit2 size={11} />
                ) : (
                  <>
                    <Target size={11} />
                    <span style={{ fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{t("home.goal.setGoal")}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Income amount — larger, bolder */}
        <div className="flex items-baseline gap-2.5">
          <motion.div
            key={incomePopKey}
            initial={incomePopKey === 0 ? false : { scale: 0.92 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 14 }}
            className="text-[32px] tabular-nums tracking-tight"
            style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-bold)", lineHeight: 1.1, transformOrigin: "left center" } as React.CSSProperties}
          >
            {loading ? "—" : `$${animIncome.toLocaleString()}`}
          </motion.div>
          {hasGoal && !loading && (
            <span className="text-[15px] tabular-nums" style={{ color: "var(--color-text-quaternary)" }}>
              / ${goal.toLocaleString()}
            </span>
          )}
        </div>

        {/* Today income badge */}
        {todayIncome > 0 && (
          <div className="text-[12px] tabular-nums mt-1" style={{ color: "var(--color-success)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
            +${todayIncome.toLocaleString()} {t("home.kpi.today")}
          </div>
        )}

        {/* Goal progress bar */}
        {hasGoal && !loading && (
          <div className="mt-4">
            <div className="progress-track" style={{ height: 6 }}>
              <div
                className="progress-fill"
                style={{ width: `${percentage}%`, background: barColor, borderRadius: "var(--radius-2)" }}
              />
            </div>
            <div className="flex items-center justify-end mt-1.5">
              <div className="flex items-center gap-1">
                {achieved && <Check size={11} style={{ color: "var(--color-success)" }} />}
                <span
                  className="text-[11px]"
                  style={{ color: achieved ? "var(--color-success)" : "var(--color-text-tertiary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}
                >
                  {statusText}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Secondary metrics — 3 columns, whitespace separated ── */}
      <div className="grid grid-cols-3" style={{ gap: 16 }}>
        {[
          { icon: Users, color: "var(--color-text-tertiary)", label: t("home.kpi.activeClients"), value: animClients, sub: leadsCount > 0 ? `+${leadsCount} ${t("home.kpi.leads")}` : null, subColor: "var(--color-text-tertiary)" },
          { icon: Briefcase, color: "var(--color-text-tertiary)", label: t("home.kpi.workTasks"), value: animWork, sub: null, subColor: "" },
          { icon: User, color: "var(--color-text-tertiary)", label: t("home.kpi.personalTasks"), value: animPersonal, sub: null, subColor: "" },
        ].map((kpi, i) => (
          <div key={i} className="card card-glow p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <kpi.icon size={13} style={{ color: kpi.color }} />
              <span className="text-[11px] " style={{ color: "var(--color-text-quaternary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
                {kpi.label}
              </span>
            </div>
            <div className="text-[22px] tabular-nums" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-bold)", lineHeight: 1.1 } as React.CSSProperties}>
              {loading ? "—" : kpi.value}
            </div>
            {kpi.sub && (
              <div className="text-[11px] mt-1" style={{ color: kpi.subColor }}>
                {kpi.sub}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
