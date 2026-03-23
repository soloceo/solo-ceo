import React, { useState, useEffect, useCallback, useMemo } from "react";
import { ChevronDown, ChevronRight, Award, HelpCircle, AlertTriangle, BookOpen } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useT } from "../i18n/context";
import { KNOWLEDGE_CATEGORIES } from "../data/evolution-knowledge";

/**
 * "Today's Principle" card for Home dashboard.
 * Shows one random unmastered principle per day. Expandable to full knowledge library.
 */
export default function TodayPrinciple() {
  const { t, lang } = useT();
  const L = useCallback((o: { zh: string; en: string }) => o[lang] || o.en, [lang]);

  const [mastered, setMastered] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [openCat, setOpenCat] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/settings");
        const data = await res.json();
        if (data.evolution_mastered) setMastered(JSON.parse(data.evolution_mastered));
      } catch {}
      setLoaded(true);
    })();
  }, []);

  const persistMastered = useCallback(async (next: Record<string, boolean>) => {
    setMastered(next);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evolution_mastered: JSON.stringify(next) }),
      });
    } catch {}
  }, []);

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

  if (!loaded) return null;

  const isMastered = mastered[todayPrinciple.id];

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="section-label flex items-center gap-1.5">
          <BookOpen size={11} /> {t("home.principle.title" as any)}
        </h3>
        <span className="text-[11px] font-medium tabular-nums" style={{ color: "var(--text-tertiary)" }}>
          {t("home.principle.progress" as any, { done: totalMastered, total: allPrinciples.length })}
        </span>
      </div>

      {/* Today's principle card */}
      <div className="card overflow-hidden">
        <button
          onClick={() => setExpanded(p => !p)}
          className="w-full flex items-start gap-3 px-4 py-3.5 text-left transition-colors"
          style={{ background: expanded ? "var(--surface-alt)" : undefined }}
        >
          <span className="text-lg shrink-0 mt-0.5">{todayPrinciple.catEmoji}</span>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[13px] mb-0.5">{L(todayPrinciple.name)}</div>
            <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>{L(todayPrinciple.core)}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isMastered && <Award size={12} style={{ color: "var(--success)" }} />}
            {expanded ? <ChevronDown size={13} style={{ color: "var(--text-tertiary)" }} /> : <ChevronRight size={13} style={{ color: "var(--text-tertiary)" }} />}
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
              <div className="px-4 pb-4 space-y-3" style={{ borderTop: "1px solid var(--border)" }}>
                {/* check questions */}
                <div className="pt-3">
                  <div className="section-label flex items-center gap-1 mb-1.5">
                    <HelpCircle size={10} /> {t("evolution.checkQuestions" as any)}
                  </div>
                  <ul className="space-y-1">
                    {todayPrinciple.checks.map((c, i) => (
                      <li key={i} className="text-[12px] flex items-start gap-1.5" style={{ color: "var(--text-secondary)" }}>
                        <span style={{ color: "var(--accent)" }}>?</span> {L(c)}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* anti-patterns */}
                <div>
                  <div className="section-label flex items-center gap-1 mb-1.5" style={{ color: "var(--danger)" }}>
                    <AlertTriangle size={10} /> {t("evolution.antiPatterns" as any)}
                  </div>
                  <ul className="space-y-1">
                    {todayPrinciple.antiPatterns.map((a, i) => (
                      <li key={i} className="text-[12px] flex items-start gap-1.5" style={{ color: "var(--text-secondary)" }}>
                        <span style={{ color: "var(--danger)" }}>✗</span> {L(a)}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* mastery toggle */}
                <div className="flex items-center justify-between pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                  <button
                    onClick={() => {
                      const next = { ...mastered };
                      if (isMastered) delete next[todayPrinciple.id]; else next[todayPrinciple.id] = true;
                      persistMastered(next);
                    }}
                    className="badge cursor-pointer transition-colors"
                    style={isMastered
                      ? { background: "var(--success)", color: "#fff", border: "none" }
                      : { background: "var(--surface-alt)", color: "var(--text-tertiary)" }}
                  >
                    {isMastered && <Award size={10} />}
                    {isMastered ? t("evolution.mastered" as any) : t("evolution.markMastered" as any)}
                  </button>
                  <button
                    onClick={() => setShowAll(p => !p)}
                    className="btn-ghost text-[11px] font-medium"
                    style={{ color: "var(--accent)" }}
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
                      style={{ background: isOpen ? "var(--surface-alt)" : undefined }}
                    >
                      <span>{cat.emoji}</span>
                      <span className="flex-1 text-left font-semibold text-[13px]">{L(cat.name)}</span>
                      <span className="text-[10px] font-medium" style={{ color: mc === cat.principles.length ? "var(--success)" : "var(--text-tertiary)" }}>
                        {mc}/{cat.principles.length}
                      </span>
                      {isOpen ? <ChevronDown size={13} style={{ color: "var(--text-tertiary)" }} /> : <ChevronRight size={13} style={{ color: "var(--text-tertiary)" }} />}
                    </button>
                    {isOpen && cat.principles.map(pr => (
                      <div key={pr.id} className="flex items-center gap-2 px-4 py-2.5" style={{ borderTop: "1px solid var(--border)" }}>
                        <span className="flex-1 text-[12px] min-w-0 truncate">{L(pr.name)}</span>
                        <button
                          onClick={() => {
                            const next = { ...mastered };
                            if (mastered[pr.id]) delete next[pr.id]; else next[pr.id] = true;
                            persistMastered(next);
                          }}
                          className="badge shrink-0 cursor-pointer text-[10px]"
                          style={mastered[pr.id]
                            ? { background: "var(--success)", color: "#fff", border: "none" }
                            : { background: "var(--surface-alt)", color: "var(--text-tertiary)" }}
                        >
                          {mastered[pr.id] ? <><Award size={9} /> {t("evolution.mastered" as any)}</> : t("evolution.markMastered" as any)}
                        </button>
                      </div>
                    ))}
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
