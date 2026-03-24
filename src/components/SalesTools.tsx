import React, { useState, useCallback, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  X, Copy, ChevronDown, ChevronRight, DollarSign, Loader2, Globe,
  Mail, MessageSquare, Sparkles,
} from "lucide-react";
import { useT } from "../i18n/context";
import { useToast } from "../hooks/useToast";
import { Toast } from "./Money";
import { EMAIL_TEMPLATES, SCRIPT_SCENARIOS, PRICING_TIERS, PRICING_STAGES } from "../data/breakthrough-templates";

const CreatePage = lazy(() => import("./Create"));

type Seg = "emails" | "scripts" | "ai";

const SEG_CONFIG: { id: Seg; icon: React.ReactNode; labelKey: string }[] = [
  { id: "emails", icon: <Mail size={16} />, labelKey: "pipeline.emailTemplates" },
  { id: "scripts", icon: <MessageSquare size={16} />, labelKey: "pipeline.scripts" },
  { id: "ai", icon: <Sparkles size={16} />, labelKey: "pipeline.aiContent" },
];

export default function SalesToolsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang } = useT();
  const { toast, showToast } = useToast();
  const [seg, setSeg] = useState<Seg>("emails");
  const L = useCallback((o: { zh: string; en: string }) => o[lang] || o.en, [lang]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 modal-backdrop" onClick={onClose} />
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="relative w-full max-w-lg flex flex-col overflow-hidden"
        style={{ background: "var(--bg)", borderLeft: "1px solid var(--border)" }}
      >
        {toast && <Toast message={toast} />}

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <h2 className="text-[15px] font-bold">{t("pipeline.salesTools" as any)}</h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={16} /></button>
        </div>

        {/* Tab bar — icon + text, horizontal pills */}
        <div className="flex gap-1 px-4 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          {SEG_CONFIG.map(s => (
            <button
              key={s.id}
              onClick={() => setSeg(s.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all"
              style={seg === s.id
                ? { background: "var(--accent)", color: "#fff" }
                : { background: "var(--surface-alt)", color: "var(--text-secondary)" }
              }
            >
              {s.icon} {t(s.labelKey as any)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {seg === "emails" && <EmailArsenal L={L} t={t} showToast={showToast} />}
          {seg === "scripts" && <ScriptVault L={L} t={t} showToast={showToast} />}
          {seg === "ai" && (
            <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="animate-spin" style={{ color: "var(--accent)" }} /></div>}>
              <CreatePage />
            </Suspense>
          )}
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}

/* ── Reusable copy button ── */
function CopyBtn({ text, showToast, t, size = 11 }: { text: string; showToast: (m: string) => void; t: (k: string) => string; size?: number }) {
  const copy = async () => { await navigator.clipboard.writeText(text); showToast(t("breakthrough.copied" as any)); };
  return <button onClick={copy} className="btn-ghost p-1 shrink-0 opacity-60 hover:opacity-100 transition-opacity"><Copy size={size} /></button>;
}

/* ── Bilingual content block ── */
function BilingualBlock({ zh, en, showToast, t, type = "body" }: {
  zh: string; en: string; showToast: (m: string) => void; t: (k: string) => string; type?: "subject" | "body";
}) {
  if (type === "subject") {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <div className="flex-1 text-[13px] px-3 py-2 rounded-lg font-medium" style={{ background: "var(--surface-alt)" }}>{zh}</div>
          <CopyBtn text={zh} showToast={showToast} t={t} size={16} />
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex-1 text-[13px] px-3 py-2 rounded-lg" style={{ background: "var(--surface-alt)", color: "var(--text-secondary)" }}>{en}</div>
          <CopyBtn text={en} showToast={showToast} t={t} size={16} />
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="relative">
        <div className="flex items-center gap-1 mb-1"><span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>中文</span></div>
        <pre className="text-[11px] leading-relaxed px-3 py-3 rounded-lg whitespace-pre-wrap" style={{ background: "var(--surface-alt)", color: "var(--text-secondary)" }}>{zh}</pre>
        <div className="absolute top-6 right-1.5"><CopyBtn text={zh} showToast={showToast} t={t} /></div>
      </div>
      <div className="relative">
        <div className="flex items-center gap-1 mb-1"><span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>EN</span></div>
        <pre className="text-[11px] leading-relaxed px-3 py-3 rounded-lg whitespace-pre-wrap" style={{ background: "var(--surface-alt)", color: "var(--text-secondary)" }}>{en}</pre>
        <div className="absolute top-6 right-1.5"><CopyBtn text={en} showToast={showToast} t={t} /></div>
      </div>
    </div>
  );
}

/* ── Email Arsenal ── */
function EmailArsenal({ L, t, showToast }: { L: (o: { zh: string; en: string }) => string; t: (k: string) => string; showToast: (m: string) => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="py-3">
      <p className="px-5 text-[11px] mb-3" style={{ color: "var(--text-secondary)" }}>{t("pipeline.emailsHint" as any)}</p>
      {EMAIL_TEMPLATES.map((tpl) => {
        const isOpen = expandedId === tpl.id;
        return (
          <div key={tpl.id} style={{ borderBottom: "1px solid var(--border)" }}>
            <button
              onClick={() => setExpandedId(isOpen ? null : tpl.id)}
              className="w-full flex items-center gap-2.5 px-5 py-3 text-left transition-colors"
              style={{ background: isOpen ? "var(--surface-alt)" : undefined }}
            >
              {isOpen ? <ChevronDown size={16} style={{ color: "var(--text-secondary)" }} /> : <ChevronRight size={16} style={{ color: "var(--text-secondary)" }} />}
              <span className="flex-1 font-semibold text-[13px]">{L(tpl.label)}</span>
              <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>中/EN</span>
            </button>
            <AnimatePresence>
              {isOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                  <div className="px-5 pb-4 space-y-3">
                    <div className="section-label mt-2">{t("breakthrough.copySubject" as any)}</div>
                    <BilingualBlock zh={tpl.subject.zh} en={tpl.subject.en} showToast={showToast} t={t} type="subject" />
                    <div className="section-label">{t("breakthrough.copyBody" as any)}</div>
                    <BilingualBlock zh={tpl.body.zh} en={tpl.body.en} showToast={showToast} t={t} type="body" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

/* ── Script Vault ── */
function ScriptVault({ L, t, showToast }: { L: (o: { zh: string; en: string }) => string; t: (k: string) => string; showToast: (m: string) => void }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="py-3">
      <p className="px-5 text-[11px] mb-3" style={{ color: "var(--text-secondary)" }}>{t("pipeline.scriptsHint" as any)}</p>

      {/* Scenarios */}
      {SCRIPT_SCENARIOS.map((sc) => (
        <div key={sc.id} style={{ borderBottom: "1px solid var(--border)" }}>
          <button
            onClick={() => setOpen(open === sc.id ? null : sc.id)}
            className="w-full flex items-center gap-2.5 px-5 py-3 text-left transition-colors"
            style={{ background: open === sc.id ? "var(--surface-alt)" : undefined }}
          >
            {open === sc.id ? <ChevronDown size={16} style={{ color: "var(--text-secondary)" }} /> : <ChevronRight size={16} style={{ color: "var(--text-secondary)" }} />}
            <span className="flex-1 font-medium text-[13px]">{L(sc.title)}</span>
            <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>中/EN</span>
          </button>
          <AnimatePresence>
            {open === sc.id && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                <div className="px-5 pb-4">
                  <BilingualBlock zh={sc.content.zh} en={sc.content.en} showToast={showToast} t={t} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}

      {/* Pricing reference — compact */}
      <div className="px-5 pt-5 pb-8 space-y-4">
        <div className="section-label flex items-center gap-1.5">
          <DollarSign size={16} /> {t("breakthrough.pricingRef" as any)}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {PRICING_TIERS.map((tier) => (
            <div key={tier.id} className="card p-3 space-y-1" style={tier.tag ? { borderColor: "var(--accent)", borderWidth: 2 } : {}}>
              <div className="flex items-center justify-between">
                <span className="font-bold text-[13px]">{L(tier.name)}</span>
                {tier.tag && <span className="text-[11px] font-bold" style={{ color: "var(--accent)" }}>{L(tier.tag)}</span>}
              </div>
              <div className="text-[16px] font-bold" style={{ color: "var(--accent)" }}>{tier.price}</div>
              <ul className="space-y-0.5">
                {tier.features.slice(0, 3).map((f, i) => (
                  <li key={i} className="text-[11px]" style={{ color: "var(--text-secondary)" }}>✓ {L(f)}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Pricing roadmap — horizontal */}
        <div className="flex gap-2 overflow-x-auto">
          {PRICING_STAGES.map((s) => (
            <div key={s.id} className="card p-3 min-w-[140px] shrink-0 space-y-1">
              <div className="font-semibold text-[11px]">{L(s.stage)}</div>
              <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{L(s.period)}</div>
              <div className="text-[13px] font-bold" style={{ color: "var(--success)" }}>{L(s.target)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
