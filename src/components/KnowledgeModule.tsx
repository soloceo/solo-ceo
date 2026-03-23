import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronDown, ChevronRight, Award, AlertTriangle, HelpCircle,
} from "lucide-react";
import { useT } from "../i18n/context";
import { KNOWLEDGE_CATEGORIES } from "../data/evolution-knowledge";

/**
 * Knowledge module for embedding in Settings.
 * Self-contained: loads + persists its own mastered state from /api/settings.
 */
export default function KnowledgeModule() {
  const { t, lang } = useT();
  const L = useCallback((o: { zh: string; en: string }) => o[lang] || o.en, [lang]);

  const [mastered, setMastered] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [openPrinciple, setOpenPrinciple] = useState<string | null>(null);

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

  if (!loaded) return null;

  const totalPrinciples = KNOWLEDGE_CATEGORIES.reduce((s, c) => s + c.principles.length, 0);
  const totalMastered = KNOWLEDGE_CATEGORIES.reduce(
    (s, c) => s + c.principles.filter((p) => mastered[p.id]).length, 0,
  );

  return (
    <div className="space-y-3">
      {/* overall progress */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>
          {t("settings.knowledge.progress" as any, { done: totalMastered, total: totalPrinciples })}
        </span>
      </div>

      {KNOWLEDGE_CATEGORIES.map((cat) => {
        const masteredCount = cat.principles.filter((p) => mastered[p.id]).length;
        const isOpen = openCat === cat.id;

        return (
          <div key={cat.id} className="card overflow-hidden">
            <button
              onClick={() => { setOpenCat(isOpen ? null : cat.id); setOpenPrinciple(null); }}
              className="w-full flex items-center gap-3 px-4 py-3.5 transition-colors"
              style={{ background: isOpen ? "var(--surface-alt)" : undefined }}
            >
              <span className="text-lg">{cat.emoji}</span>
              <span className="flex-1 text-left font-semibold text-[14px]">{L(cat.name)}</span>
              <span className="text-[11px] font-medium" style={{ color: masteredCount === cat.principles.length ? "var(--success)" : "var(--text-tertiary)" }}>
                {t("evolution.categoryProgress" as any, { done: masteredCount, total: cat.principles.length })}
              </span>
              {isOpen ? <ChevronDown size={14} style={{ color: "var(--text-tertiary)" }} /> : <ChevronRight size={14} style={{ color: "var(--text-tertiary)" }} />}
            </button>

            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  {cat.principles.map((pr) => {
                    const isMastered = !!mastered[pr.id];
                    const isExpanded = openPrinciple === pr.id;

                    return (
                      <div key={pr.id} style={{ borderTop: "1px solid var(--border)" }}>
                        <div className="px-4 py-3 flex items-start gap-2">
                          <button
                            onClick={() => setOpenPrinciple(isExpanded ? null : pr.id)}
                            className="flex-1 flex items-start gap-2 text-left min-w-0"
                          >
                            {isExpanded
                              ? <ChevronDown size={13} className="mt-0.5 shrink-0" style={{ color: "var(--text-tertiary)" }} />
                              : <ChevronRight size={13} className="mt-0.5 shrink-0" style={{ color: "var(--text-tertiary)" }} />}
                            <div className="min-w-0">
                              <div className="font-medium text-[13px]">{L(pr.name)}</div>
                              <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>{L(pr.core)}</p>
                            </div>
                          </button>
                          <button
                            onClick={() => {
                              const next = { ...mastered };
                              if (isMastered) delete next[pr.id]; else next[pr.id] = true;
                              persistMastered(next);
                            }}
                            className="badge shrink-0 cursor-pointer transition-colors"
                            style={isMastered
                              ? { background: "var(--success)", color: "#fff", border: "none" }
                              : { background: "var(--surface-alt)", color: "var(--text-tertiary)" }}
                          >
                            {isMastered && <Award size={10} />}
                            {isMastered ? t("evolution.mastered" as any) : t("evolution.markMastered" as any)}
                          </button>
                        </div>

                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.15 }}
                              className="overflow-hidden"
                            >
                              <div className="px-4 pb-3 pl-10 space-y-3">
                                <div>
                                  <div className="section-label flex items-center gap-1 mb-1.5">
                                    <HelpCircle size={10} /> {t("evolution.checkQuestions" as any)}
                                  </div>
                                  <ul className="space-y-1">
                                    {pr.checks.map((c, i) => (
                                      <li key={i} className="text-[12px] flex items-start gap-1.5" style={{ color: "var(--text-secondary)" }}>
                                        <span style={{ color: "var(--accent)" }}>?</span> {L(c)}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                                <div>
                                  <div className="section-label flex items-center gap-1 mb-1.5" style={{ color: "var(--danger)" }}>
                                    <AlertTriangle size={10} /> {t("evolution.antiPatterns" as any)}
                                  </div>
                                  <ul className="space-y-1">
                                    {pr.antiPatterns.map((a, i) => (
                                      <li key={i} className="text-[12px] flex items-start gap-1.5" style={{ color: "var(--text-secondary)" }}>
                                        <span style={{ color: "var(--danger)" }}>✗</span> {L(a)}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
