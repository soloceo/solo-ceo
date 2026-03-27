import React, { useState, useCallback, useMemo } from "react";
import { ChevronDown, ChevronRight, Award, HelpCircle, AlertTriangle, BookOpen, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useT } from "../i18n/context";
import { KNOWLEDGE_CATEGORIES } from "../data/evolution-knowledge";
import { useAppSettings, invalidateSettingsCache } from "../hooks/useAppSettings";

/**
 * "Today's Principle" card for Home dashboard.
 * Shows one random unmastered principle per day. Expandable to full knowledge library.
 */
export default function TodayPrinciple() {
  const { t, lang } = useT();
  const L = useCallback((o: { zh: string; en: string }) => o[lang] || o.en, [lang]);

  const [mastered, setMastered] = useState<Record<string, boolean>>({});
  const [inited, setInited] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [expandedPr, setExpandedPr] = useState<string | null>(null);

  const { settings, loaded, save } = useAppSettings();

  if (loaded && !inited) {
    if (settings?.evolution_mastered) {
      try { setMastered(JSON.parse(settings.evolution_mastered)); } catch {}
    }
    setInited(true);
  }

  const persistMastered = useCallback(async (next: Record<string, boolean>) => {
    setMastered(next);
    invalidateSettingsCache();
    await save("evolution_mastered", JSON.stringify(next));
  }, [save]);

  // Pick today's principle — stable per day, prioritize unmastered
  const todayPrinciple = useMemo(() => {
    const all = KNOWLEDGE_CATEGORIES.flatMap(c => c.principles.map(p => ({ ...p, catEmoji: c.emoji, catName: c.name })));
    const unmastered = all.filter(p => !mastered[p.id]);
    const pool = unmastered.length > 0 ? unmastered : all;
    const dayIdx = new Date().getDate() % pool.length;
    return pool[dayIdx];
  }, [mastered]);

  const allPrinciples = KNOWLEDGE_CATEGORIES.flatMap(c => c.principles);
  const totalMastered = allPrinciples.filter(p => mastered[p.id]).length;

  if (!inited) return null;

  const isMastered = mastered[todayPrinciple.id];

  return (
    <section>
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="section-label flex items-center gap-1.5">
            <BookOpen size={16} /> {t("home.principle.title" as any)}
          </h3>
          <p className="text-[13px] mt-0.5" style={{ color: "var(--color-text-secondary)" }}>{t("home.principle.desc" as any)}</p>
        </div>
        <span className="text-[13px] tabular-nums shrink-0" style={{ color: "var(--color-text-secondary)", fontWeight: "var(--font-weight-medium)" }}>
          {t("home.principle.progress" as any, { done: totalMastered, total: allPrinciples.length })}
        </span>
      </div>

      {/* Today's principle card */}
      <div className="card overflow-hidden">
        <button
          onClick={() => setExpanded(p => !p)}
          className="w-full flex items-start gap-3 px-4 py-4 text-left transition-colors"
          style={{ background: expanded ? "var(--color-bg-tertiary)" : undefined }}
        >
          <span className="text-lg shrink-0 mt-0.5">{todayPrinciple.catEmoji}</span>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] mb-0.5" style={{ fontWeight: "var(--font-weight-semibold)" }}>{L(todayPrinciple.name)}</div>
            <p className="text-[15px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>{L(todayPrinciple.core)}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isMastered && <Award size={16} style={{ color: "var(--color-success)" }} />}
            {expanded ? <ChevronDown size={16} style={{ color: "var(--color-text-secondary)" }} /> : <ChevronRight size={16} style={{ color: "var(--color-text-secondary)" }} />}
          </div>
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-5 space-y-4" style={{ borderTop: "1px solid var(--color-border-primary)" }}>
                {/* Deep explanation */}
                {todayPrinciple.explanation && (
                  <div className="space-y-2 pt-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-8)]" style={{ background: "color-mix(in srgb, var(--color-accent) 12%, transparent)" }}>
                        <BookOpen size={16} style={{ color: "var(--color-accent)" }} />
                      </div>
                      <span className="text-[15px]" style={{ fontWeight: "var(--font-weight-semibold)" }}>{t("evolution.explanation" as any)}</span>
                    </div>
                    <p className="text-[15px] leading-[1.8]" style={{ color: "var(--color-text-secondary)" }}>{L(todayPrinciple.explanation)}</p>
                  </div>
                )}

                {/* Action steps */}
                {todayPrinciple.actionSteps && todayPrinciple.actionSteps.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-8)]" style={{ background: "color-mix(in srgb, var(--color-success) 12%, transparent)" }}>
                        <Check size={16} style={{ color: "var(--color-success)" }} />
                      </div>
                      <span className="text-[15px]" style={{ color: "var(--color-success)", fontWeight: "var(--font-weight-semibold)" }}>{t("evolution.actionSteps" as any)}</span>
                    </div>
                    <div className="space-y-2">
                      {todayPrinciple.actionSteps.map((s, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-[var(--radius-12)]" style={{ background: "var(--color-bg-tertiary)" }}>
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[13px]" style={{ background: "var(--color-success)", color: "var(--color-text-primary)", fontWeight: "var(--font-weight-bold)" }}>{i + 1}</span>
                          <p className="text-[15px] leading-relaxed" style={{ color: "var(--color-text-primary)" }}>{L(s)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Two-column: checks + anti-patterns */}
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="p-3 rounded-[var(--radius-16)]" style={{ background: "var(--color-bg-tertiary)" }}>
                    <div className="flex items-center gap-2 mb-2">
                      <HelpCircle size={16} style={{ color: "var(--color-accent)" }} />
                      <span className="text-[13px]" style={{ fontWeight: "var(--font-weight-semibold)" }}>{t("evolution.checkQuestions" as any)}</span>
                    </div>
                    <ul className="space-y-2">
                      {todayPrinciple.checks.map((c, i) => (
                        <li key={i} className="text-[15px] flex items-start gap-2 leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                          <span className="shrink-0 mt-0.5" style={{ color: "var(--color-accent)" }}>&#10148;</span> {L(c)}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-3 rounded-[var(--radius-16)]" style={{ background: "color-mix(in srgb, var(--color-danger) 4%, transparent)" }}>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle size={16} style={{ color: "var(--color-danger)" }} />
                      <span className="text-[13px]" style={{ color: "var(--color-danger)", fontWeight: "var(--font-weight-semibold)" }}>{t("evolution.antiPatterns" as any)}</span>
                    </div>
                    <ul className="space-y-2">
                      {todayPrinciple.antiPatterns.map((a, i) => (
                        <li key={i} className="text-[15px] flex items-start gap-2 leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                          <span className="shrink-0 mt-0.5" style={{ color: "var(--color-danger)" }}>&#10006;</span> {L(a)}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* mastery toggle + collapse */}
                <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid var(--color-border-primary)" }}>
                  <button
                    onClick={() => {
                      const next = { ...mastered };
                      if (isMastered) delete next[todayPrinciple.id]; else next[todayPrinciple.id] = true;
                      persistMastered(next);
                    }}
                    className="badge cursor-pointer transition-colors"
                    style={isMastered
                      ? { background: "var(--color-success)", color: "var(--color-text-primary)", border: "none" }
                      : { background: "var(--color-bg-tertiary)", color: "var(--color-text-secondary)" }}
                  >
                    {isMastered && <Award size={16} />}
                    {isMastered ? t("evolution.mastered" as any) : t("evolution.markMastered" as any)}
                  </button>
                  <button
                    onClick={() => setShowAll(p => !p)}
                    className="btn-ghost text-[13px]"
                    style={{ color: "var(--color-accent)", fontWeight: "var(--font-weight-medium)" }}
                  >
                    {showAll ? t("home.principle.collapse" as any) : t("home.principle.viewAll" as any)}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Full knowledge library (expandable) */}
      <AnimatePresence>
        {showAll && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 mt-3">
              {KNOWLEDGE_CATEGORIES.map(cat => {
                const mc = cat.principles.filter(p => mastered[p.id]).length;
                const isOpen = openCat === cat.id;
                return (
                  <div key={cat.id} className="card overflow-hidden">
                    <button
                      onClick={() => setOpenCat(isOpen ? null : cat.id)}
                      className="w-full flex items-center gap-2.5 px-4 py-3 transition-colors"
                      style={{ background: isOpen ? "var(--color-bg-tertiary)" : undefined }}
                    >
                      <span>{cat.emoji}</span>
                      <span className="flex-1 text-left text-[15px]" style={{ fontWeight: "var(--font-weight-semibold)" }}>{L(cat.name)}</span>
                      <span className="text-[13px]" style={{ color: mc === cat.principles.length ? "var(--color-success)" : "var(--color-text-secondary)", fontWeight: "var(--font-weight-medium)" }}>
                        {mc}/{cat.principles.length}
                      </span>
                      {isOpen ? <ChevronDown size={16} style={{ color: "var(--color-text-secondary)" }} /> : <ChevronRight size={16} style={{ color: "var(--color-text-secondary)" }} />}
                    </button>
                    {isOpen && cat.principles.map(pr => {
                      const isExpanded = expandedPr === pr.id;
                      return (
                        <div key={pr.id} style={{ borderTop: "1px solid var(--color-border-primary)" }}>
                          {/* Principle header — clickable (div to avoid nested button) */}
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => setExpandedPr(isExpanded ? null : pr.id)}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpandedPr(isExpanded ? null : pr.id); } }}
                            className="w-full flex items-center gap-2 px-4 py-3 text-left transition-colors cursor-pointer"
                            style={{ background: isExpanded ? "var(--color-bg-tertiary)" : undefined }}
                          >
                            <span className="flex-1 text-[15px] min-w-0" style={{ fontWeight: "var(--font-weight-medium)" }}>{L(pr.name)}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const next = { ...mastered };
                                if (mastered[pr.id]) delete next[pr.id]; else next[pr.id] = true;
                                persistMastered(next);
                              }}
                              className="badge shrink-0 cursor-pointer text-[13px]"
                              style={mastered[pr.id]
                                ? { background: "var(--color-success)", color: "var(--color-text-primary)", border: "none" }
                                : { background: "var(--color-bg-tertiary)", color: "var(--color-text-secondary)" }}
                            >
                              {mastered[pr.id] ? <><Award size={16} /> {t("evolution.mastered" as any)}</> : t("evolution.markMastered" as any)}
                            </button>
                            {isExpanded ? <ChevronDown size={16} style={{ color: "var(--color-text-secondary)" }} /> : <ChevronRight size={16} style={{ color: "var(--color-text-secondary)" }} />}
                          </div>

                          {/* Expanded detail */}
                          <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ type: "spring", damping: 25, stiffness: 200 }}
                              className="overflow-hidden"
                            >
                            <div className="px-4 pt-3 pb-5 space-y-4" style={{ borderTop: "1px solid var(--color-border-primary)" }}>
                              {/* Core idea — highlighted card */}
                              <div className="p-4 rounded-[var(--radius-16)]" style={{ background: "var(--color-bg-tertiary)", borderLeft: "3px solid var(--color-accent)" }}>
                                <p className="text-[15px] leading-relaxed" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" }}>{L(pr.core)}</p>
                              </div>

                              {/* Deep explanation */}
                              {pr.explanation && (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <div className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-8)]" style={{ background: "color-mix(in srgb, var(--color-accent) 12%, transparent)" }}>
                                      <BookOpen size={16} style={{ color: "var(--color-accent)" }} />
                                    </div>
                                    <span className="text-[15px]" style={{ fontWeight: "var(--font-weight-semibold)" }}>{t("evolution.explanation" as any)}</span>
                                  </div>
                                  <p className="text-[15px] leading-[1.8]" style={{ color: "var(--color-text-secondary)" }}>{L(pr.explanation)}</p>
                                </div>
                              )}

                              {/* Action steps — numbered cards */}
                              {pr.actionSteps && pr.actionSteps.length > 0 && (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <div className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-8)]" style={{ background: "color-mix(in srgb, var(--color-success) 12%, transparent)" }}>
                                      <Check size={16} style={{ color: "var(--color-success)" }} />
                                    </div>
                                    <span className="text-[15px]" style={{ color: "var(--color-success)", fontWeight: "var(--font-weight-semibold)" }}>{t("evolution.actionSteps" as any)}</span>
                                  </div>
                                  <div className="space-y-2">
                                    {pr.actionSteps.map((s: any, i: number) => (
                                      <div key={i} className="flex items-start gap-3 p-3 rounded-[var(--radius-12)]" style={{ background: "var(--color-bg-tertiary)" }}>
                                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[13px]" style={{ background: "var(--color-success)", color: "var(--color-text-primary)", fontWeight: "var(--font-weight-bold)" }}>{i + 1}</span>
                                        <p className="text-[15px] leading-relaxed" style={{ color: "var(--color-text-primary)" }}>{L(s)}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Two-column: checks + anti-patterns */}
                              <div className="grid md:grid-cols-2 gap-3">
                                {/* Daily checks */}
                                <div className="p-3 rounded-[var(--radius-16)]" style={{ background: "var(--color-bg-tertiary)" }}>
                                  <div className="flex items-center gap-2 mb-2">
                                    <HelpCircle size={16} style={{ color: "var(--color-accent)" }} />
                                    <span className="text-[13px]" style={{ fontWeight: "var(--font-weight-semibold)" }}>{t("evolution.checkQuestions" as any)}</span>
                                  </div>
                                  <ul className="space-y-2">
                                    {pr.checks.map((c: any, i: number) => (
                                      <li key={i} className="text-[15px] flex items-start gap-2 leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                                        <span className="shrink-0 mt-0.5" style={{ color: "var(--color-accent)" }}>&#10148;</span> {L(c)}
                                      </li>
                                    ))}
                                  </ul>
                                </div>

                                {/* Anti-patterns */}
                                <div className="p-3 rounded-[var(--radius-16)]" style={{ background: "color-mix(in srgb, var(--color-danger) 4%, transparent)" }}>
                                  <div className="flex items-center gap-2 mb-2">
                                    <AlertTriangle size={16} style={{ color: "var(--color-danger)" }} />
                                    <span className="text-[13px]" style={{ color: "var(--color-danger)", fontWeight: "var(--font-weight-semibold)" }}>{t("evolution.antiPatterns" as any)}</span>
                                  </div>
                                  <ul className="space-y-2">
                                    {pr.antiPatterns.map((a: any, i: number) => (
                                      <li key={i} className="text-[15px] flex items-start gap-2 leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                                        <span className="shrink-0 mt-0.5" style={{ color: "var(--color-danger)" }}>&#10006;</span> {L(a)}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            </div>
                            </motion.div>
                          )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
