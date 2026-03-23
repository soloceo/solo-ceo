import React, { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  X, Copy, ChevronDown, ChevronRight, DollarSign,
} from "lucide-react";
import { useT } from "../i18n/context";
import { useToast } from "../hooks/useToast";
import { Toast } from "./Money";
import { EMAIL_TEMPLATES, SCRIPT_SCENARIOS, PRICING_TIERS, PRICING_STAGES } from "../data/breakthrough-templates";

type Seg = "emails" | "scripts";

/**
 * Sales tools slide-over panel — email templates + scripts/pricing.
 * Triggered from Pipeline header via a toolbar button.
 */
export default function SalesToolsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang } = useT();
  const { toast, showToast } = useToast();
  const [seg, setSeg] = useState<Seg>("emails");
  const L = useCallback((o: { zh: string; en: string }) => o[lang] || o.en, [lang]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* panel */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="relative w-full max-w-lg flex flex-col overflow-hidden"
        style={{ background: "var(--bg)", borderLeft: "1px solid var(--border)" }}
      >
        {toast && <Toast message={toast} />}

        {/* header */}
        <div className="flex items-center justify-between px-5 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <h2 className="text-[15px] font-semibold">{t("pipeline.salesTools" as any)}</h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={16} /></button>
        </div>

        {/* segment switcher */}
        <div className="px-5 pt-3">
          <div className="segment-switcher">
            {(["emails", "scripts"] as Seg[]).map((s) => (
              <button key={s} data-active={seg === s} onClick={() => setSeg(s)}>
                {s === "emails" ? t("pipeline.emailTemplates" as any) : t("pipeline.scripts" as any)}
              </button>
            ))}
          </div>
        </div>

        {/* content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {seg === "emails" && <EmailArsenal L={L} t={t} showToast={showToast} />}
          {seg === "scripts" && <ScriptVault L={L} t={t} showToast={showToast} />}
        </div>
      </motion.div>
    </div>,
    document.body,
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
    <div className="space-y-4 pb-8">
      {EMAIL_TEMPLATES.map((tpl) => (
        <div key={tpl.id} className="card p-4 space-y-3">
          <h3 className="font-semibold text-[14px]">{L(tpl.label)}</h3>
          <div>
            <div className="section-label mb-1.5">{t("breakthrough.copySubject" as any)}</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 text-[13px] px-3 py-2 rounded-lg" style={{ background: "var(--surface-alt)", color: "var(--text-secondary)" }}>
                {L(tpl.subject)}
              </div>
              <button onClick={() => copyText(L(tpl.subject))} className="btn-ghost p-2 shrink-0"><Copy size={14} /></button>
            </div>
          </div>
          <div>
            <div className="section-label mb-1.5">{t("breakthrough.copyBody" as any)}</div>
            <div className="relative">
              <pre className="text-[12px] leading-relaxed px-3 py-3 rounded-lg whitespace-pre-wrap" style={{ background: "var(--surface-alt)", color: "var(--text-secondary)" }}>
                {L(tpl.body)}
              </pre>
              <button onClick={() => copyText(L(tpl.body))} className="btn-ghost absolute top-2 right-2 p-1.5"><Copy size={13} /></button>
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
    <div className="space-y-5 pb-8">
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
                    <button onClick={() => copyText(L(sc.content))} className="btn-ghost absolute top-2 right-6 p-1.5"><Copy size={13} /></button>
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
            <div key={tier.id} className="card p-4 space-y-2" style={tier.tag ? { borderColor: "var(--accent)", borderWidth: 2 } : {}}>
              <div className="flex items-center justify-between">
                <span className="font-bold text-[14px]">{L(tier.name)}</span>
                {tier.tag && <span className="badge" style={{ color: "var(--accent)", background: "var(--accent-light)" }}>{L(tier.tag)}</span>}
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
