import React, { useState, useEffect, useCallback } from "react";
import { useT } from "../i18n/context";
import { useToast } from "../hooks/useToast";
import { Toast } from "./Money";
import { motion, AnimatePresence } from "motion/react";
import {
  CheckSquare, Square, RotateCcw, ChevronDown, ChevronRight,
  Award, AlertTriangle, HelpCircle,
} from "lucide-react";
import { KNOWLEDGE_CATEGORIES } from "../data/evolution-knowledge";
import { PROTOCOL_STEPS } from "../data/evolution-protocol";

type Seg = "knowledge" | "protocol";

export default function Evolution() {
  const { t, lang } = useT();
  const { toast, showToast } = useToast();
  const [seg, setSeg] = useState<Seg>("knowledge");

  const [mastered, setMastered] = useState<Record<string, boolean>>({});
  const [protocol, setProtocol] = useState<{ date: string; checks: boolean[] }>({
    date: "", checks: [false, false, false, false, false],
  });
  const [loaded, setLoaded] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/settings");
        const data = await res.json();
        if (data.evolution_mastered) setMastered(JSON.parse(data.evolution_mastered));
        if (data.evolution_protocol) {
          const p = JSON.parse(data.evolution_protocol);
          if (p.date === today) setProtocol(p);
        }
      } catch {}
      setLoaded(true);
    })();
  }, [today]);

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

  const persistProtocol = useCallback(async (next: { date: string; checks: boolean[] }) => {
    setProtocol(next);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evolution_protocol: JSON.stringify(next) }),
      });
    } catch {}
  }, []);

  const L = useCallback((o: { zh: string; en: string }) => o[lang] || o.en, [lang]);

  return (
    <div className="mobile-page max-w-[1680px] mx-auto min-h-full px-4 py-3 md:px-6 md:py-4 lg:px-8 lg:py-5">
      {toast && <Toast message={toast} />}

      <div className="flex items-center justify-between mb-5">
        <h1 className="page-title">{t("evolution.title" as any)}</h1>
      </div>

      <div className="segment-switcher mb-5">
        {(["knowledge", "protocol"] as Seg[]).map((s) => (
          <button key={s} data-active={seg === s} onClick={() => setSeg(s)}>
            {t(`evolution.seg.${s}` as any)}
          </button>
        ))}
      </div>

      {loaded && seg === "knowledge" && (
        <KnowledgeModule mastered={mastered} onPersist={persistMastered} L={L} t={t} />
      )}
      {loaded && seg === "protocol" && (
        <DailyProtocol protocol={protocol} today={today} onPersist={persistProtocol} L={L} t={t} showToast={showToast} />
      )}
    </div>
  );
}

/* ── Knowledge Module ── */
function KnowledgeModule({
  mastered, onPersist, L, t,
}: {
  mastered: Record<string, boolean>;
  onPersist: (v: Record<string, boolean>) => void;
  L: (o: { zh: string; en: string }) => string;
  t: (k: string, v?: Record<string, string | number>) => string;
}) {
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [openPrinciple, setOpenPrinciple] = useState<string | null>(null);

  return (
    <div className="space-y-3 pb-28">
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
                              : <ChevronRight size={13} className="mt-0.5 shrink-0" style={{ color: "var(--text-tertiary)" }} />
                            }
                            <div className="min-w-0">
                              <div className="font-medium text-[13px]">{L(pr.name)}</div>
                              <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>{L(pr.core)}</p>
                            </div>
                          </button>
                          <button
                            onClick={() => {
                              const next = { ...mastered };
                              if (isMastered) delete next[pr.id]; else next[pr.id] = true;
                              onPersist(next);
                            }}
                            className="badge shrink-0 cursor-pointer transition-colors"
                            style={isMastered
                              ? { background: "var(--success)", color: "#fff", border: "none" }
                              : { background: "var(--surface-alt)", color: "var(--text-tertiary)" }
                            }
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

/* ── Daily Protocol ── */
function DailyProtocol({
  protocol, today, onPersist, L, t, showToast,
}: {
  protocol: { date: string; checks: boolean[] };
  today: string;
  onPersist: (v: { date: string; checks: boolean[] }) => void;
  L: (o: { zh: string; en: string }) => string;
  t: (k: string, v?: Record<string, string | number>) => string;
  showToast: (m: string) => void;
}) {
  const checks = protocol.checks;
  const done = checks.filter(Boolean).length;
  const pct = Math.round((done / 5) * 100);

  const toggle = (idx: number) => {
    const next = [...checks];
    next[idx] = !next[idx];
    onPersist({ date: today, checks: next });
  };

  const reset = () => {
    onPersist({ date: today, checks: [false, false, false, false, false] });
  };

  return (
    <div className="space-y-4 pb-28">
      {/* progress card */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>
            {t("evolution.protocolProgress" as any)} — {done}/5
          </span>
          <button onClick={reset} className="btn-ghost text-[12px]" style={{ color: "var(--danger)" }}>
            <RotateCcw size={12} />
            {t("evolution.resetProtocol" as any)}
          </button>
        </div>
        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-alt)" }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${pct}%`, background: done === 5 ? "var(--success)" : "var(--accent)" }}
          />
        </div>
        {done === 5 && (
          <div className="mt-2 text-[12px] font-medium" style={{ color: "var(--success)" }}>
            {t("evolution.allDone" as any)}
          </div>
        )}
      </div>

      {/* steps */}
      {PROTOCOL_STEPS.map((step, idx) => {
        const checked = checks[idx];
        return (
          <button
            key={step.id}
            onClick={() => toggle(idx)}
            className="card w-full flex items-start gap-3 p-4 text-left transition-colors"
            style={checked ? { borderColor: "var(--success)", background: "var(--success-light)" } : {}}
          >
            {checked ? (
              <CheckSquare size={18} className="shrink-0 mt-0.5" style={{ color: "var(--success)" }} />
            ) : (
              <Square size={18} className="shrink-0 mt-0.5" style={{ color: "var(--border-strong)" }} />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="badge" style={{ color: "var(--accent)" }}>{L(step.time)}</span>
                <span className={`font-medium text-[13px] ${checked ? "line-through" : ""}`} style={checked ? { color: "var(--text-tertiary)" } : {}}>
                  {L(step.title)}
                </span>
              </div>
              <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>{L(step.description)}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
