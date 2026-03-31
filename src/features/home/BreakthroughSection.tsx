import React, { useState, useMemo, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useT } from "../../i18n/context";
import { useAppSettings, invalidateSettingsCache } from "../../hooks/useAppSettings";
import { ChevronDown, ChevronRight, Circle, CheckCircle2 } from "lucide-react";
import { PHASES } from "../../data/breakthrough-tasks";

export function BreakthroughSection() {
  const { t, lang } = useT();
  const { settings, save } = useAppSettings();

  const [breakthroughExpanded, setBreakthroughExpanded] = useState(false);
  const [activePhaseIdx, setActivePhaseIdx] = useState(0);

  const breakthroughTasks: Record<string, Record<string, boolean>> = useMemo(() => {
    try { return settings?.breakthrough_tasks ? JSON.parse(settings.breakthrough_tasks) : {}; } catch { return {}; }
  }, [settings?.breakthrough_tasks]);

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

  return (
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
                {t("home.breakthroughPhase")} · {activePhase.label[lang as "zh" | "en"]}
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
        {/* Progress bar */}
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
            transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
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
                      color: isActive ? "var(--color-text-on-color)" : "var(--color-text-secondary)",
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
                    className="flex items-start gap-3 text-left text-[14px] w-full px-3 py-2.5 press-feedback transition-colors hover:bg-[var(--color-bg-tertiary)]"
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
  );
}
