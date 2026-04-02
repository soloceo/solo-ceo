import React, { useState, useEffect, useRef } from "react";
import { Target, Check, Edit2, TrendingUp } from "lucide-react";
import { useT } from "../../i18n/context";
import { useAppSettings } from "../../hooks/useAppSettings";

interface MonthlyGoalProps {
  monthlyIncome: number;
  loading: boolean;
}

const GOAL_KEY = "MONTHLY_REVENUE_GOAL";

export function MonthlyGoal({ monthlyIncome, loading }: MonthlyGoalProps) {
  const { t } = useT();
  const { settings, loaded, save } = useAppSettings();
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

  if (!loaded || loading) return null;

  // No goal set — clear CTA with description
  if (!goal) {
    return (
      <div className="card px-4 py-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-8)]"
            style={{ background: "var(--color-bg-tertiary)", color: "var(--color-text-tertiary)" }}
          >
            <Target size={20} />
          </div>
          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <span className="text-[15px]" style={{ color: "var(--color-text-quaternary)" }}>$</span>
                <input
                  ref={inputRef}
                  type="number"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleSave}
                  placeholder={t("home.goal.placeholder")}
                  className="input-base compact px-2 text-[15px] w-32"
                />
              </div>
            ) : (
              <button
                onClick={() => { setDraft(""); setEditing(true); }}
                className="text-left w-full"
              >
                <div className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>
                  {t("home.goal.setGoal")}
                </div>
                <div className="text-[12px] mt-0.5" style={{ color: "var(--color-text-tertiary)" }}>
                  {t("home.goal.setGoalHint")}
                </div>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Goal exists — show progress
  const progress = Math.min(1, monthlyIncome / goal);
  const percentage = Math.round(progress * 100);
  const achieved = monthlyIncome >= goal;
  const diff = Math.abs(monthlyIncome - goal);

  const statusText = achieved
    ? monthlyIncome === goal
      ? t("home.goal.achieved")
      : String(t("home.goal.exceeded") || "").replace("${amount}", `$${diff.toLocaleString()}`)
    : String(t("home.goal.remaining") || "").replace("${amount}", `$${diff.toLocaleString()}`);

  const barColor = achieved ? "var(--color-success)" : "var(--color-accent)";

  return (
    <div className="card px-4 py-3.5">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <div
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-4)]"
            style={{ background: `color-mix(in srgb, ${barColor} 10%, transparent)`, color: barColor }}
          >
            {achieved ? <Check size={14} /> : <Target size={14} />}
          </div>
          <span className="text-[14px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>
            {t("home.goal.title")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Percentage badge */}
          <span
            className="text-[12px] tabular-nums px-1.5 py-0.5 rounded-[var(--radius-4)]"
            style={{
              background: "var(--color-bg-tertiary)",
              color: achieved ? "var(--color-success)" : "var(--color-text-secondary)",
              fontWeight: "var(--font-weight-bold)",
            } as React.CSSProperties}
          >
            {percentage}%
          </span>
          {editing ? (
            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <span className="text-[15px]" style={{ color: "var(--color-text-quaternary)" }}>$</span>
              <input
                ref={inputRef}
                type="number"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleSave}
                className="input-base compact px-2 text-[15px] w-24"
              />
            </div>
          ) : (
            <button
              onClick={() => { setDraft(String(goal)); setEditing(true); }}
              className="btn-icon-sm"
              aria-label="Edit goal"
              title={t("home.goal.editGoal")}
            >
              <Edit2 size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="progress-track mb-2.5">
        <div
          className="progress-fill"
          style={{ width: `${percentage}%`, background: barColor }}
        />
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[15px] tabular-nums select-all" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>
            ${monthlyIncome.toLocaleString()}
          </span>
          <span className="text-[13px] tabular-nums" style={{ color: "var(--color-text-quaternary)" }}>
            / ${goal.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {achieved && <TrendingUp size={12} style={{ color: "var(--color-success)" }} />}
          <span
            className="text-[12px]"
            style={{ color: achieved ? "var(--color-success)" : "var(--color-text-tertiary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}
          >
            {statusText}
          </span>
        </div>
      </div>
    </div>
  );
}
