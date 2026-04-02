import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useT } from "../../i18n/context";
import type { ProtocolStep } from "../../data/evolution-protocol";

interface ProtocolSectionProps {
  title: string;
  steps: ProtocolStep[];
  lang: string;
}

function formatTimeRange(r?: [number, number]): string {
  if (!r) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(r[0])}:00-${pad(r[1] === 24 ? 0 : r[1])}:00`;
}

function getCurrentStepIndex(steps: ProtocolStep[]): number {
  const h = new Date().getHours();
  for (let i = steps.length - 1; i >= 0; i--) {
    const r = steps[i].timeRange;
    if (r && h >= r[0]) return i;
  }
  return 0;
}

export function ProtocolSection({ title, steps, lang }: ProtocolSectionProps) {
  const { t } = useT();
  const currentIdx = getCurrentStepIndex(steps);
  const [expanded, setExpanded] = useState(false);
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const l = lang as "zh" | "en";

  const currentStep = steps[currentIdx];
  const nextStep = currentIdx < steps.length - 1 ? steps[currentIdx + 1] : null;

  return (
    <section>
      {/* Header + Timeline dots */}
      <div className="mb-3">
        <div className="flex items-center justify-between">
          <span
            className="text-[15px]"
            style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-bold)" } as React.CSSProperties}
          >
            {title}
          </span>
          <div className="flex items-center gap-1.5">
          {steps.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === currentIdx ? 16 : 6,
                height: 6,
                borderRadius: 3,
                background: i < currentIdx
                  ? "var(--color-text-quaternary)"
                  : i === currentIdx
                    ? "var(--color-accent)"
                    : "var(--color-border-secondary)",
                transition: "all 0.3s ease",
              }}
            />
          ))}
          </div>
        </div>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--color-text-quaternary)" }}>{t("home.protocol.desc")}</p>
      </div>

      {/* Main card — current period */}
      <div className="card overflow-hidden">
        <div className="px-4 py-4">
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className="text-[11px]  px-2 py-0.5 rounded-[var(--radius-4)]"
              style={{
                color: "var(--color-text-on-color)",
                background: "var(--color-accent)",
                fontWeight: "var(--font-weight-bold)",
              } as React.CSSProperties}
            >
              {currentStep.time[l]}
            </span>
            <span className="text-[11px] tabular-nums" style={{ color: "var(--color-text-quaternary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
              {formatTimeRange(currentStep.timeRange)}
            </span>
          </div>
          <div
            className="text-[15px] mt-2"
            style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}
          >
            {currentStep.title[l]}
          </div>
          <p className="text-[13px] mt-1.5 leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
            {currentStep.description[l]}
          </p>

          {/* Next up — subtle preview, whitespace separation instead of border */}
          {nextStep && (
            <div className="flex items-center gap-2 mt-4 pt-3" style={{ borderTop: "1px solid var(--color-line-secondary)" }}>
              <span className="text-[11px] shrink-0" style={{ color: "var(--color-text-quaternary)" }}>
                {t("home.protocolNext")}
              </span>
              <span
                className="text-[11px]  px-1.5 py-0.5 rounded-[var(--radius-4)]"
                style={{
                  color: "var(--color-text-tertiary)",
                  background: "var(--color-bg-tertiary)",
                  fontWeight: "var(--font-weight-bold)",
                } as React.CSSProperties}
              >
                {nextStep.time[l]}
              </span>
              <span className="text-[11px] tabular-nums" style={{ color: "var(--color-text-quaternary)" }}>
                {formatTimeRange(nextStep.timeRange)}
              </span>
              <span className="text-[12px] truncate" style={{ color: "var(--color-text-tertiary)" }}>
                {nextStep.title[l]}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Expand toggle */}
      <button
        onClick={() => { setExpanded(!expanded); setExpandedStepId(null); }}
        className="flex items-center gap-1.5 mt-2.5 px-1 py-1 press-feedback"
      >
        <span className="text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>
          {t("home.allProtocolSteps")}
        </span>
        <ChevronDown
          size={13}
          style={{
            color: "var(--color-text-quaternary)",
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
          }}
        />
      </button>

      {/* Full timeline list */}
      {expanded && (
        <div className="mt-1 card overflow-hidden">
          {steps.map((step, i) => {
            const isCurrent = i === currentIdx;
            const isPast = i < currentIdx;
            const isOpen = expandedStepId === step.id;
            const isLast = i === steps.length - 1;
            return (
              <button
                key={step.id}
                onClick={() => setExpandedStepId(isOpen ? null : step.id)}
                className="flex gap-3 w-full text-left px-3 py-2.5 press-feedback transition-colors hover:bg-[var(--color-bg-tertiary)]"
              >
                {/* Vertical timeline rail */}
                <div className="flex flex-col items-center shrink-0" style={{ width: 12 }}>
                  <div
                    style={{
                      width: isCurrent ? 10 : 6,
                      height: isCurrent ? 10 : 6,
                      borderRadius: "50%",
                      background: isCurrent
                        ? "var(--color-accent)"
                        : isPast
                          ? "var(--color-text-quaternary)"
                          : "var(--color-border-secondary)",
                      border: isCurrent ? "2px solid color-mix(in srgb, var(--color-accent) 30%, transparent)" : "none",
                      marginTop: 4,
                      flexShrink: 0,
                    }}
                  />
                  {!isLast && (
                    <div
                      style={{
                        width: 1.5,
                        flex: 1,
                        minHeight: 16,
                        background: isPast
                          ? "var(--color-text-quaternary)"
                          : "var(--color-border-secondary)",
                        marginTop: 4,
                      }}
                    />
                  )}
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0 pb-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[11px] shrink-0 "
                      style={{
                        color: isCurrent ? "var(--color-accent)" : isPast ? "var(--color-text-quaternary)" : "var(--color-text-tertiary)",
                        fontWeight: "var(--font-weight-bold)",
                      } as React.CSSProperties}
                    >
                      {step.time[l]}
                    </span>
                    <span className="text-[11px] tabular-nums shrink-0" style={{ color: "var(--color-text-quaternary)" }}>
                      {formatTimeRange(step.timeRange)}
                    </span>
                    <span
                      className="text-[13px] truncate"
                      style={{
                        color: isPast ? "var(--color-text-quaternary)" : "var(--color-text-primary)",
                        fontWeight: isCurrent ? "var(--font-weight-semibold)" : "var(--font-weight-medium)",
                      } as React.CSSProperties}
                    >
                      {step.title[l]}
                    </span>
                  </div>
                  {isOpen && (
                    <p className="text-[12px] mt-1 leading-relaxed" style={{ color: "var(--color-text-tertiary)" }}>
                      {step.description[l]}
                    </p>
                  )}
                </div>
                <ChevronDown
                  size={13}
                  className="shrink-0 mt-1"
                  style={{
                    color: "var(--color-text-quaternary)",
                    transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s ease",
                  }}
                />
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
