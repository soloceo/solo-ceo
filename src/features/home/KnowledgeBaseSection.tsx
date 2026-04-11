import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { useT } from "../../i18n/context";
import { useAppSettings, invalidateSettingsCache } from "../../hooks/useAppSettings";
import { useUIStore } from "../../store/useUIStore";
import { BookOpen, ChevronDown, ChevronRight, X, CheckCircle2 } from "lucide-react";
import type { Principle, KnowledgeCategory } from "../../data/evolution-knowledge";
/* Lazy-load the 53KB knowledge data — only fetched when this component first renders */

export function KnowledgeBaseSection() {
  const { t, lang } = useT();
  const { settings, save } = useAppSettings();
  const setHideMobileNav = useUIStore((s) => s.setHideMobileNav);

  const [categories, setCategories] = useState<KnowledgeCategory[]>([]);
  const [principleExpanded, setPrincipleExpanded] = useState(false);
  const [showAllPrinciples, setShowAllPrinciples] = useState(false);
  const [selectedPrinciple, setSelectedPrinciple] = useState<(Principle & { catEmoji: string }) | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("../../data/evolution-knowledge").then(m => {
      if (!cancelled) setCategories(m.KNOWLEDGE_CATEGORIES);
    });
    return () => { cancelled = true; };
  }, []);

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

  if (!todayPrinciple) return null;

  return (
    <>
      <section>
        {/* Header */}
        <div className="mb-3">
          <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-bold)" } as React.CSSProperties}>
              {t("home.dailyLesson")}
            </span>
            <span className="text-[11px] px-1.5 py-0.5 rounded-full"
              style={{ background: "var(--color-bg-tertiary)", color: "var(--color-text-secondary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
              {categories.find((c) => c.principles.some((p) => p.id === todayPrinciple.id))?.name[lang as "zh" | "en"]}
            </span>
          </div>
          <button
            onClick={() => setShowAllPrinciples(true)}
            className="flex items-center gap-1.5 text-[13px] press-feedback"
            style={{ color: "var(--color-accent)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}
          >
            <BookOpen size={12} />
            {t("home.browseAllPrinciples").replace("{count}", String(allPrinciples.length))}
          </button>
          </div>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--color-text-quaternary)" }}>{t("home.principle.desc")}</p>
        </div>

        {/* Card */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setPrincipleExpanded((v) => !v)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPrincipleExpanded((v) => !v); } }}
          className="card overflow-hidden cursor-pointer transition-colors hover:bg-[var(--color-bg-tertiary)] press-feedback"
        >
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-[16px] mb-2" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-bold)", lineHeight: 1.3 } as React.CSSProperties}>
                  {todayPrinciple.name[lang as "zh" | "en"]}
                </h3>
                <p className="text-[13px] leading-relaxed line-clamp-2" style={{ color: "var(--color-text-tertiary)" }}>
                  {todayPrinciple.core[lang as "zh" | "en"]}
                </p>
              </div>
              <div className="shrink-0 mt-1">
                {principleExpanded ? <ChevronDown size={14} style={{ color: "var(--color-text-quaternary)" }} /> : <ChevronRight size={14} style={{ color: "var(--color-text-quaternary)" }} />}
              </div>
            </div>
          </div>

          {/* Study CTA */}
          <div className="flex items-center justify-between px-4 pb-3.5">
            <button
              onClick={(e) => { e.stopPropagation(); recordStudy(todayPrinciple.id); }}
              className="flex items-center gap-1.5 text-[13px] px-3 py-1.5 rounded-full transition-colors press-feedback"
              style={{ background: "var(--color-bg-tertiary)", color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}
            >
              <CheckCircle2 size={13} />
              {t("home.markStudied")}
            </button>
            {(studyCounts[todayPrinciple.id] || 0) > 0 && (
              <span className="text-[12px] tabular-nums" style={{ color: "var(--color-text-quaternary)" }}>
                {t("home.studied")} ×{studyCounts[todayPrinciple.id]}
              </span>
            )}
          </div>

          {/* Expanded detail */}
          <AnimatePresence>
            {principleExpanded && todayPrinciple.explanation && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
                className="overflow-hidden"
              >
                {/* Whitespace separator instead of divider */}
                <div style={{ height: 1, margin: "0 16px", background: "var(--color-line-secondary)" }} />
                <div className="flex flex-col">
                  <p className="text-[14px] leading-relaxed px-4 py-3.5" style={{ color: "var(--color-text-secondary)" }}>
                    {todayPrinciple.explanation[lang as "zh" | "en"]}
                  </p>
                  {todayPrinciple.actionSteps && todayPrinciple.actionSteps.length > 0 && (
                    <PrincipleList icon="→" color="var(--color-accent)" label={t("home.actionSteps")} items={todayPrinciple.actionSteps} lang={lang} />
                  )}
                  {todayPrinciple.checks && todayPrinciple.checks.length > 0 && (
                    <PrincipleList icon="✓" color="var(--color-success)" label={t("home.selfCheck")} items={todayPrinciple.checks} lang={lang} bullet="☐" />
                  )}
                  {todayPrinciple.antiPatterns && todayPrinciple.antiPatterns.length > 0 && (
                    <PrincipleList icon="✗" color="var(--color-danger)" label={t("home.antiPatterns")} items={todayPrinciple.antiPatterns} lang={lang} bullet="✗" />
                  )}
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
                        {selectedPrinciple.name[lang as "zh" | "en"]}
                      </h3>
                    </div>
                    <p className="text-[14px] mb-3" style={{ color: "var(--color-text-tertiary)", lineHeight: 1.5 }}>
                      {selectedPrinciple.core[lang as "zh" | "en"]}
                    </p>
                    <div className="card overflow-hidden">
                      <div className="flex flex-col">
                        {selectedPrinciple.explanation && (
                          <div className="px-4 py-3.5 text-[14px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                            {selectedPrinciple.explanation[lang as "zh" | "en"]}
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
                            {cat.name[lang as "zh" | "en"]}
                          </span>
                          <span className="text-[12px] tabular-nums px-1.5 py-0.5 rounded-full" style={{ color: "var(--color-text-tertiary)", background: "var(--color-bg-tertiary)" }}>
                            {cat.principles.length}
                          </span>
                        </div>
                        <div className="card overflow-hidden">
                          <div className="flex flex-col">
                            {cat.principles.map((p) => {
                              const isToday = p.id === todayPrinciple.id;
                              const coreText = p.core[lang as "zh" | "en"];
                              const truncated = coreText.length > 50 ? coreText.slice(0, 50) + "…" : coreText;
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
                                      {p.name[lang as "zh" | "en"]}
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
    <div className="px-4 py-3.5">
      <h4 className="text-[11px] mb-2.5 flex items-center gap-1.5" style={{ color, fontWeight: "var(--font-weight-semibold)", textTransform: "uppercase", letterSpacing: "0.05em" } as React.CSSProperties}>
        <span>{icon}</span> {label}
      </h4>
      <div className="flex flex-col gap-2">
        {items.map((s, i) => (
          <div key={i} className="flex items-start gap-2 text-[13px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
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
