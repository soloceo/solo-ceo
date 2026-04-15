import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { useT } from "../../i18n/context";
import { useAppSettings, invalidateSettingsCache } from "../../hooks/useAppSettings";
import { useUIStore } from "../../store/useUIStore";
import { BookOpen, Clock, ChevronDown, ChevronRight, X, CheckCircle2 } from "lucide-react";
import type { Principle, KnowledgeCategory } from "../../data/evolution-knowledge";
import type { ProtocolStep } from "../../data/evolution-protocol";

/* ── Protocol helpers ── */
function formatTimeRange(r?: [number, number]): string {
  if (!r) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(r[0])}:00–${pad(r[1] === 24 ? 0 : r[1])}:00`;
}

function getCurrentStepIndex(steps: ProtocolStep[]): number {
  const h = new Date().getHours();
  for (let i = steps.length - 1; i >= 0; i--) {
    const r = steps[i].timeRange;
    if (r && h >= r[0]) return i;
  }
  return 0;
}

/* ── Expanded panel type ── */
type ExpandedPanel = null | "lesson" | "protocol";

export function KnowledgeBaseSection() {
  const { t, lang } = useT();
  const l = lang as "zh" | "en";
  const { settings, save } = useAppSettings();
  const setHideMobileNav = useUIStore((s) => s.setHideMobileNav);

  /* Knowledge data (lazy) */
  const [categories, setCategories] = useState<KnowledgeCategory[]>([]);
  const [protocolSteps, setProtocolSteps] = useState<ProtocolStep[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      import("../../data/evolution-knowledge"),
      import("../../data/evolution-protocol"),
    ]).then(([km, pm]) => {
      if (!cancelled) {
        setCategories(km.KNOWLEDGE_CATEGORIES);
        setProtocolSteps(pm.PROTOCOL_STEPS);
      }
    });
    return () => { cancelled = true; };
  }, []);

  /* All principles sheet */
  const [showAllPrinciples, setShowAllPrinciples] = useState(false);
  const [selectedPrinciple, setSelectedPrinciple] = useState<(Principle & { catEmoji: string }) | null>(null);

  useEffect(() => {
    setHideMobileNav(showAllPrinciples);
    return () => setHideMobileNav(false);
  }, [showAllPrinciples, setHideMobileNav]);

  const allPrinciples = useMemo(
    () => categories.flatMap((c) => c.principles.map((p) => ({ ...p, catEmoji: c.emoji }))),
    [categories],
  );

  const studyCounts: Record<string, number> = useMemo(() => {
    try { return settings?.principle_study_counts ? JSON.parse(settings.principle_study_counts) : {}; } catch { return {}; }
  }, [settings?.principle_study_counts]);

  const recordStudy = async (principleId: string) => {
    const newCounts = { ...studyCounts, [principleId]: (studyCounts[principleId] || 0) + 1 };
    await save("principle_study_counts", JSON.stringify(newCounts));
    invalidateSettingsCache();
  };

  const todayPrinciple = useMemo(() => {
    if (allPrinciples.length === 0) return null;
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    const idx = dayOfYear % allPrinciples.length;
    return allPrinciples[idx];
  }, [allPrinciples]);

  /* Protocol current step */
  const currentIdx = useMemo(() => getCurrentStepIndex(protocolSteps), [protocolSteps]);
  const currentStep = protocolSteps[currentIdx];
  const nextStep = currentIdx < protocolSteps.length - 1 ? protocolSteps[currentIdx + 1] : null;

  /* Expand state */
  const [expanded, setExpanded] = useState<ExpandedPanel>(null);
  const [showFullTimeline, setShowFullTimeline] = useState(false);
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);

  const toggle = (panel: "lesson" | "protocol") => {
    setExpanded((prev) => (prev === panel ? null : panel));
    setShowFullTimeline(false);
    setExpandedStepId(null);
  };

  if (!todayPrinciple || protocolSteps.length === 0) return null;

  return (
    <>
      <section>
        {/* ── Compact dual-row card ── */}
        <div className="card card-glow overflow-hidden">
          {/* Row 1: Daily Protocol */}
          <button
            onClick={() => toggle("protocol")}
            className="flex items-center gap-3 w-full text-left px-4 py-3 transition-colors hover:bg-[var(--color-bg-tertiary)] press-feedback"
          >
            <Clock size={14} className="shrink-0" style={{ color: "var(--color-text-tertiary)" }} />
            <span className="text-[12px] shrink-0 px-1.5 py-0.5 rounded-[var(--radius-4)]"
              style={{ color: "var(--color-text-on-color)", background: "var(--color-accent)", fontWeight: "var(--font-weight-bold)" } as React.CSSProperties}>
              {currentStep.time[l]}
            </span>
            <span className="text-[13px] flex-1 min-w-0 truncate" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>
              {currentStep.title[l]}
            </span>
            <span className="text-[11px] tabular-nums shrink-0" style={{ color: "var(--color-text-quaternary)" }}>
              {formatTimeRange(currentStep.timeRange)}
            </span>
            <ChevronDown
              size={13}
              className="shrink-0"
              style={{
                color: "var(--color-text-quaternary)",
                transform: expanded === "protocol" ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s ease",
              }}
            />
          </button>

          {/* Protocol expanded detail */}
          <AnimatePresence>
            {expanded === "protocol" && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
                className="overflow-hidden"
              >
                <div style={{ height: 1, background: "var(--color-line-tertiary)" }} />
                <div className="px-4 py-4">
                  {/* Current step description */}
                  <p className="text-[13px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                    {currentStep.description[l]}
                  </p>

                  {/* Next step preview */}
                  {nextStep && (
                    <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: "1px solid var(--color-line-tertiary)" }}>
                      <span className="text-[11px] shrink-0" style={{ color: "var(--color-text-quaternary)" }}>
                        {t("home.protocolNext")}
                      </span>
                      <span className="text-[11px] px-1.5 py-0.5 rounded-[var(--radius-4)] shrink-0"
                        style={{ color: "var(--color-text-tertiary)", background: "var(--color-bg-tertiary)", fontWeight: "var(--font-weight-bold)" } as React.CSSProperties}>
                        {nextStep.time[l]}
                      </span>
                      <span className="text-[12px] truncate" style={{ color: "var(--color-text-tertiary)" }}>
                        {nextStep.title[l]}
                      </span>
                      <span className="text-[11px] tabular-nums shrink-0" style={{ color: "var(--color-text-quaternary)" }}>
                        {formatTimeRange(nextStep.timeRange)}
                      </span>
                    </div>
                  )}

                  {/* Full timeline toggle */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowFullTimeline(!showFullTimeline); setExpandedStepId(null); }}
                    className="flex items-center gap-1.5 mt-3 press-feedback"
                  >
                    <span className="text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>
                      {t("home.allProtocolSteps")}
                    </span>
                    <ChevronDown
                      size={12}
                      style={{
                        color: "var(--color-text-quaternary)",
                        transform: showFullTimeline ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s ease",
                      }}
                    />
                  </button>

                  {/* Full timeline */}
                  <AnimatePresence>
                    {showFullTimeline && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="mt-2 rounded-[var(--radius-base)] overflow-hidden" style={{ border: "1px solid var(--color-line-tertiary)" }}>
                          {protocolSteps.map((step, i) => {
                            const isCurrent = i === currentIdx;
                            const isPast = i < currentIdx;
                            const isOpen = expandedStepId === step.id;
                            const isLast = i === protocolSteps.length - 1;
                            return (
                              <button
                                key={step.id}
                                onClick={(e) => { e.stopPropagation(); setExpandedStepId(isOpen ? null : step.id); }}
                                className="flex gap-3 w-full text-left px-3 py-2 press-feedback transition-colors hover:bg-[var(--color-bg-tertiary)]"
                                style={!isLast ? { borderBottom: "1px solid var(--color-line-tertiary)" } : undefined}
                              >
                                {/* Timeline dot */}
                                <div className="flex flex-col items-center shrink-0" style={{ width: 12 }}>
                                  <div style={{
                                    width: isCurrent ? 10 : 6,
                                    height: isCurrent ? 10 : 6,
                                    borderRadius: "50%",
                                    background: isCurrent ? "var(--color-accent)" : isPast ? "var(--color-text-quaternary)" : "var(--color-border-secondary)",
                                    border: isCurrent ? "2px solid color-mix(in srgb, var(--color-accent) 30%, transparent)" : "none",
                                    marginTop: 5,
                                    flexShrink: 0,
                                  }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] shrink-0" style={{
                                      color: isCurrent ? "var(--color-accent)" : isPast ? "var(--color-text-quaternary)" : "var(--color-text-tertiary)",
                                      fontWeight: "var(--font-weight-bold)",
                                    } as React.CSSProperties}>
                                      {step.time[l]}
                                    </span>
                                    <span className="text-[11px] tabular-nums shrink-0" style={{ color: "var(--color-text-quaternary)" }}>
                                      {formatTimeRange(step.timeRange)}
                                    </span>
                                    <span className="text-[12px] truncate" style={{
                                      color: isPast ? "var(--color-text-quaternary)" : "var(--color-text-primary)",
                                      fontWeight: isCurrent ? "var(--font-weight-semibold)" : "var(--font-weight-medium)",
                                    } as React.CSSProperties}>
                                      {step.title[l]}
                                    </span>
                                  </div>
                                  {isOpen && (
                                    <p className="text-[12px] mt-1 leading-relaxed" style={{ color: "var(--color-text-tertiary)" }}>
                                      {step.description[l]}
                                    </p>
                                  )}
                                </div>
                                <ChevronDown size={12} className="shrink-0 mt-1" style={{
                                  color: "var(--color-text-quaternary)",
                                  transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                                  transition: "transform 0.2s ease",
                                }} />
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Divider */}
          <div style={{ height: 1, background: "var(--color-line-tertiary)" }} />

          {/* Row 2: Daily Lesson */}
          <button
            onClick={() => toggle("lesson")}
            className="flex items-center gap-3 w-full text-left px-4 py-3 transition-colors hover:bg-[var(--color-bg-tertiary)] press-feedback"
          >
            <BookOpen size={14} className="shrink-0" style={{ color: "var(--color-accent)" }} />
            <span className="text-[12px] shrink-0" style={{ color: "var(--color-text-tertiary)" }}>
              {t("home.dailyLesson")}
            </span>
            <span className="text-[13px] flex-1 min-w-0 truncate" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>
              {todayPrinciple.name[l]}
            </span>
            {(studyCounts[todayPrinciple.id] || 0) > 0 && (
              <span className="text-[11px] tabular-nums shrink-0" style={{ color: "var(--color-text-quaternary)" }}>
                ×{studyCounts[todayPrinciple.id]}
              </span>
            )}
            <ChevronDown
              size={13}
              className="shrink-0"
              style={{
                color: "var(--color-text-quaternary)",
                transform: expanded === "lesson" ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s ease",
              }}
            />
          </button>

          {/* Lesson expanded detail */}
          <AnimatePresence>
            {expanded === "lesson" && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
                className="overflow-hidden"
              >
                <div style={{ height: 1, background: "var(--color-line-tertiary)" }} />
                <div className="px-4 py-4">
                  {/* Core insight */}
                  <p className="text-[13px] leading-relaxed mb-3" style={{ color: "var(--color-text-secondary)" }}>
                    {todayPrinciple.core[l]}
                  </p>

                  {/* Explanation */}
                  {todayPrinciple.explanation && (
                    <p className="text-[13px] leading-relaxed mb-3" style={{ color: "var(--color-text-tertiary)" }}>
                      {todayPrinciple.explanation[l]}
                    </p>
                  )}

                  {/* Action steps */}
                  {todayPrinciple.actionSteps && todayPrinciple.actionSteps.length > 0 && (
                    <PrincipleList icon="→" color="var(--color-accent)" label={t("home.actionSteps")} items={todayPrinciple.actionSteps} lang={lang} />
                  )}
                  {todayPrinciple.checks && todayPrinciple.checks.length > 0 && (
                    <PrincipleList icon="✓" color="var(--color-success)" label={t("home.selfCheck")} items={todayPrinciple.checks} lang={lang} bullet="☐" />
                  )}
                  {todayPrinciple.antiPatterns && todayPrinciple.antiPatterns.length > 0 && (
                    <PrincipleList icon="✗" color="var(--color-danger)" label={t("home.antiPatterns")} items={todayPrinciple.antiPatterns} lang={lang} bullet="✗" />
                  )}

                  {/* Actions row */}
                  <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: "1px solid var(--color-line-tertiary)" }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); recordStudy(todayPrinciple.id); }}
                      className="flex items-center gap-1.5 text-[13px] px-3 py-1.5 rounded-full transition-colors press-feedback"
                      style={{ background: "var(--color-bg-tertiary)", color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}
                    >
                      <CheckCircle2 size={13} />
                      {t("home.markStudied")}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowAllPrinciples(true); }}
                      className="flex items-center gap-1 text-[12px] press-feedback"
                      style={{ color: "var(--color-accent)" }}
                    >
                      <BookOpen size={11} />
                      {t("home.browseAllPrinciples").replace("{count}", String(allPrinciples.length))}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* ── All Principles Sheet ── */}
      {createPortal(<AnimatePresence>
        {showAllPrinciples && (
          <motion.div key="kb-panel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div
              className="fixed inset-0"
              style={{ zIndex: "var(--layer-dialog-overlay)", background: "var(--color-bg-primary)" }}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-0 flex flex-col"
              style={{ zIndex: "var(--layer-dialog)", background: "var(--color-bg-primary)", paddingTop: "max(12px, var(--mobile-header-pt, env(safe-area-inset-top, 0px)))" }}
            >
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
                  {t("home.allPrinciples")}
                </span>
                <span style={{ width: 18 }} />
              </div>

              <div className="overflow-y-auto flex-1">
                {selectedPrinciple ? (
                  <div className="px-4 py-3" style={{ paddingBottom: "24px" }}>
                    <button
                      onClick={() => setSelectedPrinciple(null)}
                      className="flex items-center gap-1 text-[14px] mb-3 press-feedback"
                      style={{ color: "var(--color-accent)" }}
                    >
                      <ChevronRight size={12} style={{ transform: "rotate(180deg)" }} />
                      {t("home.back")}
                    </button>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[18px]">{selectedPrinciple.catEmoji}</span>
                      <h3 className="text-[17px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-bold)" } as React.CSSProperties}>
                        {selectedPrinciple.name[l]}
                      </h3>
                    </div>
                    <p className="text-[14px] mb-3" style={{ color: "var(--color-text-tertiary)", lineHeight: 1.5 }}>
                      {selectedPrinciple.core[l]}
                    </p>
                    <div className="card overflow-hidden">
                      <div className="flex flex-col">
                        {selectedPrinciple.explanation && (
                          <div className="px-4 py-4 text-[14px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                            {selectedPrinciple.explanation[l]}
                          </div>
                        )}
                        {selectedPrinciple.actionSteps && selectedPrinciple.actionSteps.length > 0 && (
                          <PrincipleList icon="→" color="var(--color-accent)" label={t("home.actionSteps")} items={selectedPrinciple.actionSteps} lang={lang} />
                        )}
                        {selectedPrinciple.checks && selectedPrinciple.checks.length > 0 && (
                          <PrincipleList icon="✓" color="var(--color-success)" label={t("home.selfCheck")} items={selectedPrinciple.checks} lang={lang} bullet="☐" />
                        )}
                        {selectedPrinciple.antiPatterns && selectedPrinciple.antiPatterns.length > 0 && (
                          <PrincipleList icon="✗" color="var(--color-danger)" label={t("home.antiPatterns")} items={selectedPrinciple.antiPatterns} lang={lang} bullet="✗" />
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => recordStudy(selectedPrinciple.id)}
                      className="flex items-center gap-1 text-[14px] mt-3 press-feedback"
                      style={{ color: "var(--color-accent)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}
                    >
                      <BookOpen size={14} />
                      {t("home.studied")}
                      {(studyCounts[selectedPrinciple.id] || 0) > 0 && (
                        <span className="text-[13px] tabular-nums" style={{ color: "var(--color-text-quaternary)" }}>
                          ×{studyCounts[selectedPrinciple.id]}
                        </span>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="px-4 py-3" style={{ paddingBottom: "24px" }}>
                    {categories.map((cat, catIdx) => (
                      <div key={cat.id}>
                        {catIdx > 0 && <div style={{ height: 20 }} />}
                        <div className="flex items-center gap-2 mb-2.5 px-1">
                          <span className="text-[17px]">{cat.emoji}</span>
                          <span className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-bold)" } as React.CSSProperties}>
                            {cat.name[l]}
                          </span>
                          <span className="text-[12px] tabular-nums px-1.5 py-0.5 rounded-full" style={{ color: "var(--color-text-tertiary)", background: "var(--color-bg-tertiary)" }}>
                            {cat.principles.length}
                          </span>
                        </div>
                        <div className="card overflow-hidden">
                          <div className="flex flex-col">
                            {cat.principles.map((p) => {
                              const isToday = p.id === todayPrinciple.id;
                              const coreText = p.core[l];
                              const truncated = coreText.length > 50 ? coreText.slice(0, 50) + "..." : coreText;
                              return (
                                <button
                                  key={p.id}
                                  onClick={() => setSelectedPrinciple({ ...p, catEmoji: cat.emoji })}
                                  className="w-full text-left px-4 py-3 press-feedback transition-colors hover:bg-[var(--color-bg-tertiary)]"
                                  style={isToday ? { background: "color-mix(in srgb, var(--color-accent) 6%, transparent)" } : undefined}
                                >
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-[14px] flex-1 min-w-0 truncate" style={{
                                      color: "var(--color-text-primary)",
                                      fontWeight: "var(--font-weight-semibold)",
                                    } as React.CSSProperties}>
                                      {p.name[l]}
                                    </span>
                                    {isToday && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0"
                                        style={{ background: "var(--color-accent)", color: "var(--color-text-on-color)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
                                        {t("home.today")}
                                      </span>
                                    )}
                                    {(studyCounts[p.id] || 0) > 0 && (
                                      <span className="text-[11px] tabular-nums shrink-0" style={{ color: "var(--color-text-quaternary)" }}>
                                        ×{studyCounts[p.id]}
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
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>, document.body)}
    </>
  );
}

/* ── Shared sub-component for principle detail lists ── */
function PrincipleList({ icon, color, label, items, lang, bullet }: {
  icon: string;
  color: string;
  label: string;
  items: Array<{ zh: string; en: string }>;
  lang: string;
  bullet?: string;
}) {
  return (
    <div className="mb-2">
      <h4 className="text-[11px] mb-1.5 flex items-center gap-1.5" style={{ color, fontWeight: "var(--font-weight-semibold)", textTransform: "uppercase", letterSpacing: "0.05em" } as React.CSSProperties}>
        <span>{icon}</span> {label}
      </h4>
      <div className="flex flex-col gap-1.5">
        {items.map((s, i) => (
          <div key={i} className="flex items-start gap-2 text-[12px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
            <span className="shrink-0 text-[11px] mt-0.5 tabular-nums" style={{ color }}>
              {bullet || `${i + 1}.`}
            </span>
            <span>{s[lang as "zh" | "en"]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
