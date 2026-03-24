import React, { useState, useEffect, useCallback } from "react";
import { useT } from "../i18n/context";
import { PHASES } from "../data/breakthrough-tasks";

/**
 * Compact Breakthrough progress card for embedding in Home dashboard.
 * Shows current phase progress + a daily motivational reminder.
 */
export default function BreakthroughProgress() {
  const { t, lang } = useT();
  const L = useCallback((o: { zh: string; en: string }) => o[lang] || o.en, [lang]);

  const [taskChecks, setTaskChecks] = useState<Record<string, Record<string, boolean>>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/settings");
        const data = await res.json();
        if (data.breakthrough_tasks) setTaskChecks(JSON.parse(data.breakthrough_tasks));
      } catch {}
      setLoaded(true);
    })();
  }, []);

  if (!loaded) return null;

  // Calculate overall progress across all phases
  let totalTasks = 0;
  let totalDone = 0;
  const phaseStats = PHASES.map((p) => {
    const checks = taskChecks[p.id] || {};
    const done = p.tasks.filter((tk) => checks[tk.id]).length;
    totalTasks += p.tasks.length;
    totalDone += done;
    return { ...p, done, total: p.tasks.length, pct: p.tasks.length ? Math.round((done / p.tasks.length) * 100) : 0 };
  });

  const overallPct = totalTasks ? Math.round((totalDone / totalTasks) * 100) : 0;

  return (
    <section>
      <h3 className="section-label mb-2">{t("home.breakthrough.title" as any)}</h3>

      <div className="card p-4 space-y-3">
        {/* Overall progress */}
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>
            {t("home.breakthrough.overall" as any, { done: totalDone, total: totalTasks })}
          </span>
          <span className="text-[12px] font-bold tabular-nums" style={{ color: overallPct === 100 ? "var(--success)" : "var(--accent)" }}>
            {overallPct}%
          </span>
        </div>
        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-alt)" }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${overallPct}%`, background: overallPct === 100 ? "var(--success)" : "var(--accent)" }}
          />
        </div>

        {/* Per-phase mini bars */}
        <div className="grid grid-cols-3 gap-2">
          {phaseStats.map((p) => (
            <div key={p.id} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium truncate" style={{ color: "var(--text-secondary)" }}>{L(p.label)}</span>
                <span className="text-[10px] tabular-nums" style={{ color: "var(--text-tertiary)" }}>{p.done}/{p.total}</span>
              </div>
              <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "var(--surface-alt)" }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${p.pct}%`, background: p.pct === 100 ? "var(--success)" : "var(--accent)" }} />
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
