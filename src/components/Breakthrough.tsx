import React, { useState, useCallback } from "react";
import { useT } from "../i18n/context";
import {
  CheckSquare, Square, RotateCcw,
} from "lucide-react";
import { PHASES, type Freq } from "../data/breakthrough-tasks";
import { useAppSettings, invalidateSettingsCache } from "../hooks/useAppSettings";

const freqKey = (f: Freq) =>
  f === "daily" ? "breakthrough.freq.daily" : f === "weekly" ? "breakthrough.freq.weekly" : "breakthrough.freq.once";

const freqColor = (f: Freq) =>
  f === "daily" ? "var(--color-accent)" : f === "weekly" ? "var(--color-warning)" : "var(--color-text-secondary)";

/**
 * Breakthrough task tracker — phase switcher + task checklist.
 * Used inside Home accordion. No page wrapper needed.
 */
export default function Breakthrough() {
  const { t, lang } = useT();
  const L = useCallback((o: { zh: string; en: string }) => o[lang] || o.en, [lang]);

  const { settings, loaded, save } = useAppSettings();
  const [taskChecks, setTaskChecks] = useState<Record<string, Record<string, boolean>>>({});
  const [inited, setInited] = useState(false);

  // Initialize from shared settings cache
  if (loaded && !inited) {
    if (settings?.breakthrough_tasks) {
      try { setTaskChecks(JSON.parse(settings.breakthrough_tasks)); } catch {}
    }
    setInited(true);
  }

  const persist = useCallback(async (next: Record<string, Record<string, boolean>>) => {
    setTaskChecks(next);
    invalidateSettingsCache();
    await save("breakthrough_tasks", JSON.stringify(next));
  }, [save]);

  const [confirmReset, setConfirmReset] = useState(false);
  const [phase, setPhase] = useState(PHASES[0].id);
  const current = PHASES.find((p) => p.id === phase) || PHASES[0];
  const phaseChecks = taskChecks[phase] || {};
  const done = current.tasks.filter((tk) => phaseChecks[tk.id]).length;
  const pct = current.tasks.length ? Math.round((done / current.tasks.length) * 100) : 0;

  // Overall progress
  let totalTasks = 0, totalDone = 0;
  for (const p of PHASES) {
    const c = taskChecks[p.id] || {};
    totalTasks += p.tasks.length;
    totalDone += p.tasks.filter(tk => c[tk.id]).length;
  }
  const overallPct = totalTasks ? Math.round((totalDone / totalTasks) * 100) : 0;

  const toggle = (taskId: string) => {
    const next = { ...taskChecks, [phase]: { ...phaseChecks, [taskId]: !phaseChecks[taskId] } };
    persist(next);
  };

  const reset = () => {
    if (!confirmReset) { setConfirmReset(true); return; }
    setConfirmReset(false);
    persist({ ...taskChecks, [phase]: {} });
  };

  if (!inited) return null;

  return (
    <div className="space-y-3">
      {/* Overall progress */}
      <div className="flex items-center justify-between">
        <span className="text-[15px]" style={{ color: "var(--color-text-secondary)", fontWeight: "var(--font-weight-medium)" }}>
          {t("home.breakthrough.overall" as any, { done: totalDone, total: totalTasks })}
        </span>
        <span className="text-[13px] tabular-nums" style={{ color: overallPct === 100 ? "var(--color-success)" : "var(--color-accent)", fontWeight: "var(--font-weight-bold)" }}>
          {overallPct}%
        </span>
      </div>
      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-bg-tertiary)" }}>
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${overallPct}%`, background: overallPct === 100 ? "var(--color-success)" : "var(--color-accent)" }} />
      </div>

      {/* Phase switcher */}
      <div className="segment-switcher">
        {PHASES.map((p) => (
          <button key={p.id} data-active={phase === p.id} onClick={() => setPhase(p.id)}>
            {L(p.label)}
          </button>
        ))}
      </div>

      {/* Phase progress + reset */}
      <div className="flex items-center justify-between">
        <span className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
          {t("breakthrough.progress" as any, { done, total: current.tasks.length })}
        </span>
        {confirmReset ? (
          <div className="flex items-center gap-1">
            <button onClick={reset} className="text-[13px] px-2 py-0.5 rounded-[var(--radius-8)] transition-colors" style={{ background: "var(--color-danger)", color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{t("common.confirm" as any)}</button>
            <button onClick={() => setConfirmReset(false)} className="text-[13px] px-2 py-0.5 rounded-[var(--radius-8)] transition-colors hover:bg-[var(--color-bg-quaternary)]" style={{ color: "var(--color-text-tertiary)" }}>{t("common.cancel" as any)}</button>
          </div>
        ) : (
          <button onClick={reset} className="btn-ghost compact text-[13px] px-2" style={{ color: "var(--color-text-secondary)" }}>
            <RotateCcw size={16} />
          </button>
        )}
      </div>

      {/* Strategy hint */}
      <div className="flex items-start gap-2 px-3 py-3 rounded-[var(--radius-12)]" style={{ background: "var(--color-bg-tertiary)" }}>
        <span className="text-sm shrink-0">{current.strategy.emoji}</span>
        <div>
          <div className="text-[13px]" style={{ fontWeight: "var(--font-weight-semibold)" }}>{L(current.strategy.title)}</div>
          <p className="text-[13px] leading-relaxed mt-0.5" style={{ color: "var(--color-text-secondary)" }}>{L(current.strategy.content)}</p>
        </div>
      </div>

      {/* Task list */}
      <div className="card overflow-hidden">
        {current.tasks.map((tk) => {
          const checked = !!phaseChecks[tk.id];
          return (
            <button key={tk.id} onClick={() => toggle(tk.id)} className="list-item w-full text-left">
              {checked
                ? <CheckSquare size={16} className="shrink-0" style={{ color: "var(--color-accent)" }} />
                : <Square size={16} className="shrink-0" style={{ color: "var(--color-border-secondary)" }} />
              }
              <span className={`flex-1 text-[15px] leading-snug ${checked ? "line-through" : ""}`} style={checked ? { color: "var(--color-text-secondary)" } : {}}>
                {L(tk.title)}
              </span>
              <span className="badge shrink-0 text-[13px]" style={{ color: freqColor(tk.freq), background: "transparent", border: `1px solid ${freqColor(tk.freq)}` }}>
                {t(freqKey(tk.freq) as any)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
