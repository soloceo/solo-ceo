import React from "react";
import { CheckCircle2, Flame } from "lucide-react";
import { useT } from "../../i18n/context";
import type { ProtocolStep } from "../../data/evolution-protocol";

interface ProtocolSectionProps {
  title: string;
  steps: ProtocolStep[];
  state: { date: string; checks: Record<string, boolean> };
  streak: { count: number; lastDate: string };
  doneCount: number;
  onToggle: (id: string) => void;
  lang: string;
}

export function ProtocolSection({ title, steps, state, streak, doneCount, onToggle, lang }: ProtocolSectionProps) {
  const { t } = useT();
  const h = new Date().getHours();
  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-bold)" } as React.CSSProperties}>
            {title}
          </span>
          <span
            className="text-[13px] tabular-nums px-1.5 py-0.5 rounded-[var(--radius-4)]"
            style={doneCount > 0 ? {
              background: doneCount === steps.length ? "var(--color-success)" : "var(--color-accent)",
              color: "var(--color-text-on-color)",
              fontWeight: "var(--font-weight-semibold)",
            } as React.CSSProperties : { color: "var(--color-text-quaternary)" }}
          >
            {doneCount}/{steps.length}
          </span>
        </div>
        {streak.count > 0 && (
          <span className="flex items-center gap-1 text-[13px] px-2 py-0.5 rounded-[var(--radius-4)]"
            style={{
              color: "var(--color-accent)",
              background: "color-mix(in srgb, var(--color-accent) 10%, transparent)",
              fontWeight: "var(--font-weight-semibold)",
            } as React.CSSProperties}>
            <Flame size={11} /> {streak.count} {t("home.dayStreak")}
          </span>
        )}
      </div>
      <div className="card overflow-hidden divide-y divide-[var(--color-line-secondary)]">
        {steps.map((step) => {
          const done = !!state.checks[step.id];
          const isCurrent = step.timeRange ? h >= step.timeRange[0] && h < step.timeRange[1] : false;
          return (
            <button
              key={step.id}
              onClick={() => onToggle(step.id)}
              className="flex items-start gap-3 w-full text-left px-3 py-2.5 press-feedback transition-colors hover:bg-[var(--color-bg-tertiary)]"
              style={{
                opacity: done ? 0.6 : 1,
                borderLeft: isCurrent && !done ? "3px solid var(--color-accent)" : "3px solid transparent",
              }}
            >
              <div
                className="shrink-0 rounded-full flex items-center justify-center mt-0.5"
                style={{
                  width: 22, height: 22,
                  background: done ? "var(--color-accent)" : "transparent",
                  border: done ? "none" : "2px solid var(--color-border-secondary)",
                }}
              >
                {done && <CheckCircle2 size={14} style={{ color: "var(--color-text-on-color)" }} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] shrink-0 uppercase tracking-wide px-2 py-0.5 rounded-[var(--radius-4)]"
                    style={{
                      color: done ? "var(--color-text-quaternary)" : isCurrent ? "var(--color-text-on-color)" : "var(--color-text-secondary)",
                      background: done ? "var(--color-bg-tertiary)" : isCurrent ? "var(--color-accent)" : "var(--color-bg-tertiary)",
                      fontWeight: "var(--font-weight-bold)",
                    } as React.CSSProperties}>
                    {step.time[lang as "zh" | "en"]}
                  </span>
                  <span className="text-[14px]" style={{
                    color: done ? "var(--color-text-quaternary)" : "var(--color-text-primary)",
                    fontWeight: "var(--font-weight-semibold)",
                    textDecoration: done ? "line-through" : "none",
                  } as React.CSSProperties}>
                    {step.title[lang as "zh" | "en"]}
                  </span>
                </div>
                <p className="text-[13px] mt-1 leading-relaxed" style={{ color: done ? "var(--color-text-quaternary)" : "var(--color-text-tertiary)" }}>
                  {step.description[lang as "zh" | "en"]}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
