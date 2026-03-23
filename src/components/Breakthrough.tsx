import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useT } from "../i18n/context";
import { useToast } from "../hooks/useToast";
import { Toast } from "./Money";
import { motion, AnimatePresence } from "motion/react";
import {
  CheckSquare, Square, RotateCcw, Copy, ChevronDown, ChevronRight,
  Mail, MessageSquare, DollarSign, Zap,
} from "lucide-react";
import { PHASES, DAILY_REMINDERS, type Freq } from "../data/breakthrough-tasks";
import { EMAIL_TEMPLATES, SCRIPT_SCENARIOS, PRICING_TIERS, PRICING_STAGES } from "../data/breakthrough-templates";

type Seg = "tasks" | "emails" | "scripts";

const freqKey = (f: Freq) =>
  f === "daily" ? "breakthrough.freq.daily" : f === "weekly" ? "breakthrough.freq.weekly" : "breakthrough.freq.once";

const freqColor = (f: Freq) =>
  f === "daily" ? "var(--accent)" : f === "weekly" ? "var(--warning)" : "var(--text-tertiary)";

export default function Breakthrough() {
  const { t, lang } = useT();
  const { toast, showToast } = useToast();
  const [seg, setSeg] = useState<Seg>("tasks");

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

  const persist = useCallback(async (next: Record<string, Record<string, boolean>>) => {
    setTaskChecks(next);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ breakthrough_tasks: JSON.stringify(next) }),
      });
    } catch {}
  }, []);

  const L = useCallback((o: { zh: string; en: string }) => o[lang] || o.en, [lang]);

  return (
    <div className="mobile-page max-w-[1680px] mx-auto min-h-full px-4 py-3 md:px-6 md:py-4 lg:px-8 lg:py-5">
      {toast && <Toast message={toast} />}

      <div className="flex items-center justify-between mb-5">
        <h1 className="page-title">{t("breakthrough.title" as any)}</h1>
      </div>

      <div className="segment-switcher mb-5">
        {(["tasks", "emails", "scripts"] as Seg[]).map((s) => (
          <button key={s} data-active={seg === s} onClick={() => setSeg(s)}>
            {t(`breakthrough.seg.${s}` as any)}
          </button>
        ))}
      </div>

      {loaded && seg === "tasks" && (
        <TaskTracker checks={taskChecks} onPersist={persist} L={L} t={t} lang={lang} showToast={showToast} />
      )}
      {seg === "emails" && <EmailArsenal L={L} t={t} showToast={showToast} />}
      {seg === "scripts" && <ScriptVault L={L} t={t} showToast={showToast} />}
    </div>
  );
}

/* ── Task Tracker ── */
function TaskTracker({
  checks, onPersist, L, t, lang, showToast,
}: {
  checks: Record<string, Record<string, boolean>>;
  onPersist: (v: Record<string, Record<string, boolean>>) => void;
  L: (o: { zh: string; en: string }) => string;
  t: (k: string, v?: Record<string, string | number>) => string;
  lang: string;
  showToast: (m: string) => void;
}) {
  const [phase, setPhase] = useState(PHASES[0].id);
  const current = PHASES.find((p) => p.id === phase) || PHASES[0];
  const phaseChecks = checks[phase] || {};
  const done = current.tasks.filter((tk) => phaseChecks[tk.id]).length;
  const pct = current.tasks.length ? Math.round((done / current.tasks.length) * 100) : 0;

  // Daily reminder — stable per day
  const reminder = useMemo(() => {
    const dayIdx = new Date().getDate() % DAILY_REMINDERS.length;
    return DAILY_REMINDERS[dayIdx];
  }, []);

  const toggle = (taskId: string) => {
    const next = { ...checks, [phase]: { ...phaseChecks, [taskId]: !phaseChecks[taskId] } };
    onPersist(next);
  };

  const reset = () => {
    if (!confirm(t("breakthrough.resetConfirm" as any))) return;
    onPersist({ ...checks, [phase]: {} });
  };

  return (
    <div className="space-y-4 md:space-y-5 pb-28">
      {/* phase switcher */}
      <div className="segment-switcher">
        {PHASES.map((p) => (
          <button key={p.id} data-active={phase === p.id} onClick={() => setPhase(p.id)}>
            {L(p.label)}
            <span className="ml-1 opacity-50 text-[10px]">{L(p.weeks)}</span>
          </button>
        ))}
      </div>

      {/* progress card */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>
            {t("breakthrough.progress" as any, { done, total: current.tasks.length })}
          </span>
          <button onClick={reset} className="btn-ghost text-[12px]" style={{ color: "var(--danger)" }}>
            <RotateCcw size={12} />
            {t("breakthrough.resetPhase" as any)}
          </button>
        </div>
        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-alt)" }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${pct}%`, background: pct === 100 ? "var(--success)" : "var(--accent)" }}
          />
        </div>
      </div>

      {/* strategy card */}
      <div className="card p-4" style={{ borderLeft: "3px solid var(--accent)" }}>
        <div className="flex items-start gap-2">
          <span className="text-lg shrink-0">{current.strategy.emoji}</span>
          <div>
            <div className="font-semibold text-[13px] mb-1">{L(current.strategy.title)}</div>
            <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {L(current.strategy.content)}
            </p>
          </div>
        </div>
      </div>

      {/* task list */}
      <div className="card overflow-hidden">
        {current.tasks.map((tk, i) => {
          const checked = !!phaseChecks[tk.id];
          return (
            <button
              key={tk.id}
              onClick={() => toggle(tk.id)}
              className="list-item w-full text-left"
            >
              {checked ? (
                <CheckSquare size={18} className="shrink-0" style={{ color: "var(--accent)" }} />
              ) : (
                <Square size={18} className="shrink-0" style={{ color: "var(--border-strong)" }} />
              )}
              <span className={`flex-1 text-[13px] leading-snug ${checked ? "line-through" : ""}`} style={checked ? { color: "var(--text-tertiary)" } : {}}>
                {L(tk.title)}
              </span>
              <span
                className="badge shrink-0"
                style={{ color: freqColor(tk.freq), background: "transparent", border: `1px solid ${freqColor(tk.freq)}` }}
              >
                {t(freqKey(tk.freq) as any)}
              </span>
            </button>
          );
        })}
      </div>

      {/* daily reminder */}
      <div className="card-flat p-4 flex items-start gap-3" style={{ background: "var(--accent-light)", border: "1px solid var(--accent)", borderRadius: 12 }}>
        <Zap size={16} className="shrink-0 mt-0.5" style={{ color: "var(--accent)" }} />
        <p className="text-[12px] leading-relaxed font-medium" style={{ color: "var(--accent)" }}>
          {L(reminder)}
        </p>
      </div>
    </div>
  );
}

/* ── Email Arsenal ── */
function EmailArsenal({
  L, t, showToast,
}: {
  L: (o: { zh: string; en: string }) => string;
  t: (k: string) => string;
  showToast: (m: string) => void;
}) {
  const copyText = async (text: string) => {
    await navigator.clipboard.writeText(text);
    showToast(t("breakthrough.copied" as any));
  };

  return (
    <div className="space-y-4 pb-28">
      {EMAIL_TEMPLATES.map((tpl) => (
        <div key={tpl.id} className="card p-4 space-y-3">
          <h3 className="font-semibold text-[14px]">{L(tpl.label)}</h3>

          <div>
            <div className="section-label mb-1.5">{t("breakthrough.copySubject" as any)}</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 text-[13px] px-3 py-2 rounded-lg" style={{ background: "var(--surface-alt)", color: "var(--text-secondary)" }}>
                {L(tpl.subject)}
              </div>
              <button onClick={() => copyText(L(tpl.subject))} className="btn-ghost p-2 shrink-0">
                <Copy size={14} />
              </button>
            </div>
          </div>

          <div>
            <div className="section-label mb-1.5">{t("breakthrough.copyBody" as any)}</div>
            <div className="relative">
              <pre className="text-[12px] leading-relaxed px-3 py-3 rounded-lg whitespace-pre-wrap" style={{ background: "var(--surface-alt)", color: "var(--text-secondary)" }}>
                {L(tpl.body)}
              </pre>
              <button onClick={() => copyText(L(tpl.body))} className="btn-ghost absolute top-2 right-2 p-1.5">
                <Copy size={13} />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Script Vault ── */
function ScriptVault({
  L, t, showToast,
}: {
  L: (o: { zh: string; en: string }) => string;
  t: (k: string) => string;
  showToast: (m: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);

  const copyText = async (text: string) => {
    await navigator.clipboard.writeText(text);
    showToast(t("breakthrough.copied" as any));
  };

  return (
    <div className="space-y-5 pb-28">
      {/* scenarios accordion */}
      <div className="card overflow-hidden">
        {SCRIPT_SCENARIOS.map((sc) => (
          <div key={sc.id} style={{ borderBottom: "1px solid var(--border)" }}>
            <button
              onClick={() => setOpen(open === sc.id ? null : sc.id)}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-left transition-colors"
              style={{ background: open === sc.id ? "var(--surface-alt)" : undefined }}
            >
              {open === sc.id ? <ChevronDown size={14} style={{ color: "var(--text-tertiary)" }} /> : <ChevronRight size={14} style={{ color: "var(--text-tertiary)" }} />}
              <span className="flex-1 font-medium text-[13px]">{L(sc.title)}</span>
            </button>
            <AnimatePresence>
              {open === sc.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-3 relative">
                    <pre className="text-[12px] leading-relaxed px-3 py-3 rounded-lg whitespace-pre-wrap" style={{ background: "var(--surface-alt)", color: "var(--text-secondary)" }}>
                      {L(sc.content)}
                    </pre>
                    <button onClick={() => copyText(L(sc.content))} className="btn-ghost absolute top-2 right-6 p-1.5">
                      <Copy size={13} />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      {/* pricing tiers */}
      <div>
        <div className="section-label flex items-center gap-1.5 mb-3">
          <DollarSign size={12} /> {t("breakthrough.pricingRef" as any)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {PRICING_TIERS.map((tier) => (
            <div
              key={tier.id}
              className="card p-4 space-y-2"
              style={tier.tag ? { borderColor: "var(--accent)", borderWidth: 2 } : {}}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-[14px]">{L(tier.name)}</span>
                {tier.tag && (
                  <span className="badge" style={{ color: "var(--accent)", background: "var(--accent-light)" }}>
                    {L(tier.tag)}
                  </span>
                )}
              </div>
              <div className="text-[20px] font-bold" style={{ color: "var(--accent)" }}>{tier.price}</div>
              <ul className="space-y-1">
                {tier.features.map((f, i) => (
                  <li key={i} className="text-[12px] flex items-start gap-1.5" style={{ color: "var(--text-secondary)" }}>
                    <span style={{ color: "var(--success)" }}>✓</span> {L(f)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* pricing roadmap */}
      <div>
        <div className="section-label mb-3">{L({ zh: "📈 定价路线图", en: "📈 Pricing Roadmap" })}</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {PRICING_STAGES.map((s) => (
            <div key={s.id} className="card p-4 space-y-1.5">
              <div className="font-semibold text-[13px]">{L(s.stage)}</div>
              <div className="badge" style={{ color: "var(--accent)" }}>{L(s.period)}</div>
              <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>{L(s.strategy)}</p>
              <div className="text-[14px] font-bold" style={{ color: "var(--success)" }}>{L(s.target)}</div>
              <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>{L(s.focus)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
