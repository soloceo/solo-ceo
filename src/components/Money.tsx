import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useT } from "../i18n/context";
import { useRealtimeRefresh } from "../hooks/useRealtimeRefresh";
import { useIsMobile } from "../hooks/useIsMobile";
import { useToast } from "../hooks/useToast";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus,
  Edit2,
  X,
  Check,
  Trash2,
  Package,
  Sparkles,
  Loader2,
  Users,
  Clock,
  PanelRightClose,
} from "lucide-react";
import { GoogleGenAI } from "@google/genai";

/* ── Helpers ────────────────────────────────────────────────────── */
const getAIClient = () => {
  const storedKey = localStorage.getItem("GEMINI_API_KEY");
  const apiKey = storedKey || import.meta.env.VITE_GEMINI_API_KEY;
  return new GoogleGenAI({ apiKey });
};

const cleanAiText = (text: string) =>
  (text || "")
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, ""))
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/* ── Shared sub-components ─────────────────────────────────────── */
export function Toast({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 px-5 py-3 rounded-xl shadow-lg z-[9999] flex items-center gap-2 text-[13px] font-medium" style={{ background: "var(--text)", color: "var(--bg)" }}>
      <Check size={16} style={{ color: "var(--success)" }} /> {message}
    </div>
  );
}

function FL({ children }: { children: React.ReactNode }) {
  return <label className="section-label block mb-1">{children}</label>;
}

/* ═══════════════════════════════════════════════════════════════════
   Money — default export (Plans only)
   ═══════════════════════════════════════════════════════════════════ */
export default function Money() {
  const { t } = useT();
  const [toast, showToast] = useToast();

  return (
    <div className="mobile-page max-w-[1680px] mx-auto min-h-full flex flex-col px-4 py-3 md:px-6 md:py-4 lg:px-8 lg:py-5 relative">
      <Toast message={toast} />
      <header className="flex items-center justify-between mb-4">
        <h1 className="page-title">{t("nav.plans" as any)}</h1>
      </header>
      <PlansView showToast={showToast} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Plans view
   ═══════════════════════════════════════════════════════════════════ */
export function PlansView({ showToast }: { showToast: (m: string) => void }) {
  const { t } = useT();
  const [plans, setPlans] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPanel, setShowPanel] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [aiText, setAiText] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const isMobile = useIsMobile();
  const [formData, setFormData] = useState({ name: "", price: "", deliverySpeed: "", features: "" });

  const fetchPlans = useCallback(async () => {
    try { setPlans(await (await fetch("/api/plans")).json()); }
    catch { showToast(t("money.plans.loadFail" as any)); }
    finally { setIsLoading(false); }
  }, [showToast, t]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);
  useRealtimeRefresh(['plans'], fetchPlans);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("mobile-nav-visibility", { detail: { hidden: isMobile && (showPanel || isAIOpen) } }));
    return () => window.dispatchEvent(new CustomEvent("mobile-nav-visibility", { detail: { hidden: false } }));
  }, [showPanel, isAIOpen, isMobile]);

  const openPanel = (plan: any = null) => {
    if (plan) {
      setEditingPlan(plan);
      setFormData({ name: plan.name, price: String(plan.price), deliverySpeed: plan.deliverySpeed, features: plan.features.join("\n") });
    } else {
      setEditingPlan(null);
      setFormData({ name: "", price: "", deliverySpeed: "", features: "" });
    }
    setShowPanel(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = { name: formData.name, price: Number(formData.price), deliverySpeed: formData.deliverySpeed, features: formData.features.split("\n").filter((f) => f.trim()), clients: editingPlan?.clients ?? 0 };
    try {
      if (editingPlan) {
        await fetch(`/api/plans/${editingPlan.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
        showToast(t("money.plans.toast.updated" as any));
      } else {
        await fetch("/api/plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
        showToast(t("money.plans.toast.added" as any));
      }
      setShowPanel(false);
      fetchPlans();
    } catch { showToast(t("money.saveFail" as any)); }
  };

  const deletePlan = async (id: number) => {
    try { await fetch(`/api/plans/${id}`, { method: "DELETE" }); setDeleteId(null); showToast(t("money.plans.toast.deleted" as any)); fetchPlans(); }
    catch { showToast(t("money.deleteFail" as any)); }
  };

  const generateAI = async () => {
    setLoadingAI(true); setAiText(""); setIsAIOpen(true);
    try {
      const ai = getAIClient();
      const pd = plans.map(p => `【${p.name}】价格: $${p.price}/月, 活跃客户数: ${Number(p.clients || 0)}, 交付速度: ${p.deliverySpeed}, 包含服务: ${p.features.join(", ")}`).join("\n");
      const prompt = `你是一位产品化设计服务的内部定价策略顾问。请只基于下面这组内部方案数据做判断，不要假装你真的查过外部市场。\n\n当前方案：\n${pd}\n\n输出要求：\n1. 先判断当前方案结构是否清晰：入门款、主推款、利润款是否成立。\n2. 指出价格锚点是否合理。\n3. 判断每档交付承诺是否匹配价格。\n4. 给出 3 条最实用的内部优化建议。\n5. 如果某个方案更适合作为主推款，请直接指出。\n6. 不要输出 Markdown。\n7. 直接输出简洁、诚实、可执行的内部策略建议。`;
      const res = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt });
      setAiText(cleanAiText(res.text || t("money.plans.ai.fail" as any)));
    } catch { setAiText(t("money.plans.ai.error" as any)); }
    finally { setLoadingAI(false); }
  };

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      {/* Action bar */}
      <div className="flex flex-wrap gap-2">
        <button onClick={generateAI} className="btn-ghost text-[13px] gap-1.5"><Sparkles size={16} /> {t("money.plans.aiAnalysis" as any)}</button>
        <div className="flex-1" />
        <button onClick={() => openPanel()} className="btn-primary text-[13px]"><Plus size={16} /> {t("money.plans.new" as any)}</button>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-3 flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin" style={{ color: "var(--accent)" }} />
          </div>
        ) : plans.map((plan) => (
          <div key={plan.id} className="card-interactive p-5 flex flex-col group relative">
            <div className="absolute top-4 right-4 flex gap-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
              <button onClick={() => openPanel(plan)} className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors" style={{ background: "var(--surface-alt)", color: "var(--text-secondary)" }}><Edit2 size={16} /></button>
              <button onClick={() => setDeleteId(plan.id)} className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors" style={{ background: "var(--surface-alt)", color: "var(--text-secondary)" }}><Trash2 size={16} /></button>
            </div>

            <h3 className="text-[15px] font-semibold mb-1" style={{ color: "var(--text)" }}>{plan.name}</h3>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-2xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>${plan.price}</span>
              <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>{t("money.plans.perMonth" as any)}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 pb-3 mb-3 border-b" style={{ borderColor: "var(--border)" }}>
              <span className="badge gap-1"><Users size={16} style={{ color: "var(--accent)" }} />{t("money.plans.clients" as any).replace("{count}", String(Number(plan.clients || 0)))}</span>
              <span className="badge gap-1"><Clock size={16} style={{ color: "var(--warning)" }} />{plan.deliverySpeed}</span>
            </div>

            <button
              onClick={() => { navigator.clipboard.writeText(`${plan.name}｜$${plan.price}${t("money.plans.perMonth" as any)}｜${plan.deliverySpeed}｜${plan.features.join("、")}`); showToast(t("money.plans.copiedMsg" as any).replace("{name}", plan.name)); }}
              className="btn-ghost w-full mb-3 text-[13px]"
            >
              {t("money.plans.copySummary" as any)}
            </button>

            <p className="section-label mb-2">{t("money.plans.services" as any)}</p>
            <ul className="space-y-1.5 flex-1">
              {plan.features.map((f: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-[13px]" style={{ color: "var(--text-secondary)" }}>
                  <Check size={16} className="shrink-0 mt-0.5" style={{ color: "var(--accent)" }} />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Delete confirmation */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
          <div className="card-elevated p-5 max-w-sm w-full">
            <h3 className="text-[15px] font-semibold mb-2" style={{ color: "var(--text)" }}>{t("money.plans.deleteTitle" as any)}</h3>
            <p className="text-[13px] mb-4" style={{ color: "var(--text-secondary)" }}>{t("money.plans.deleteMsg" as any)}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteId(null)} className="btn-ghost text-[13px]">{t("money.cancel" as any)}</button>
              <button onClick={() => deletePlan(deleteId)} className="text-[13px] font-medium px-4 py-2 rounded-lg text-white transition-colors" style={{ background: "var(--danger)" }}>{t("money.delete.confirm" as any)}</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit plan — side panel */}
      <AnimatePresence>
        {showPanel && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50"
              className={isMobile ? "" : "modal-backdrop"} style={{ background: isMobile ? "var(--bg)" : undefined }}
              onClick={() => !isMobile && setShowPanel(false)}
            />
            <motion.div
              initial={{ x: isMobile ? 0 : "100%", y: isMobile ? "100%" : 0 }}
              animate={{ x: 0, y: 0 }}
              exit={{ x: isMobile ? 0 : "100%", y: isMobile ? "100%" : 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className={isMobile
                ? "fixed inset-0 z-50 flex flex-col"
                : "fixed top-0 right-0 z-50 h-full w-full max-w-[480px] border-l flex flex-col"
              }
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}
            >
              <div className="flex items-center justify-between px-5 py-3 border-b shrink-0" style={{ borderColor: "var(--border)", paddingTop: "var(--mobile-header-pt, max(env(safe-area-inset-top), 18px))" }}>
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--accent-light)", color: "var(--accent)" }}><Package size={16} /></div>
                  <div>
                    <h3 className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>{editingPlan ? t("money.plans.panel.edit" as any) : t("money.plans.panel.new" as any)}</h3>
                    <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{t("money.plans.panel.desc" as any)}</p>
                  </div>
                </div>
                <button onClick={() => setShowPanel(false)} className="p-1.5 rounded-lg" style={{ color: "var(--text-secondary)" }}>
                  {isMobile ? <X size={20} /> : <PanelRightClose size={20} />}
                </button>
              </div>

              <form id="plan-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 ios-scroll">
                <div><FL>{t("money.plans.form.name" as any)}</FL><input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder={t("money.plans.form.namePlaceholder" as any)} className="input-base w-full px-3 py-2 text-[13px]" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FL>{t("money.plans.form.price" as any)}</FL>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px]" style={{ color: "var(--text-secondary)" }}>$</span>
                      <input type="number" required min="0" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} placeholder="2500" className="input-base w-full pl-7 pr-3 py-2 text-[13px]" />
                    </div>
                  </div>
                  <div><FL>{t("money.plans.form.speed" as any)}</FL><input type="text" required value={formData.deliverySpeed} onChange={(e) => setFormData({ ...formData, deliverySpeed: e.target.value })} placeholder={t("money.plans.form.speedPlaceholder" as any)} className="input-base w-full px-3 py-2 text-[13px]" /></div>
                </div>
                <div><FL>{t("money.plans.form.services" as any)}</FL><textarea required value={formData.features} onChange={(e) => setFormData({ ...formData, features: e.target.value })} placeholder={t("money.plans.form.servicesPlaceholder" as any)} className="input-base w-full h-32 px-3 py-2 text-[13px] resize-none" /></div>
              </form>

              <div className="flex items-center justify-end gap-2 px-5 py-3 border-t pb-safe shrink-0" style={{ borderColor: "var(--border)" }}>
                <button type="button" onClick={() => setShowPanel(false)} className="btn-ghost text-[13px]">{t("money.cancel" as any)}</button>
                <button type="submit" form="plan-form" className="btn-primary text-[13px]">{t("money.plans.save" as any)}</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* AI analysis modal */}
      {isAIOpen && createPortal(
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--bg)" }}>
          <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "var(--border)", paddingTop: "var(--mobile-header-pt, max(env(safe-area-inset-top), 18px))" }}>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--accent-light)", color: "var(--accent)" }}><Sparkles size={16} /></div>
              <div><h3 className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>{t("money.plans.ai.title" as any)}</h3><p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{t("money.plans.ai.desc" as any)}</p></div>
            </div>
            <button onClick={() => setIsAIOpen(false)} className="p-1.5 rounded-lg" style={{ color: "var(--text-secondary)" }}><X size={20} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            {loadingAI ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 size={24} className="animate-spin" style={{ color: "var(--accent)" }} />
                <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>{t("money.plans.ai.analyzing" as any)}</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <button onClick={() => { navigator.clipboard.writeText(aiText); showToast(t("money.plans.ai.copied" as any)); }} className="btn-ghost text-[11px]">{t("money.plans.ai.copy" as any)}</button>
                </div>
                <div className="card p-5 text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>{aiText}</div>
              </div>
            )}
          </div>
          <div className="px-5 py-3 flex justify-end border-t" style={{ borderColor: "var(--border)" }}>
            <button onClick={() => setIsAIOpen(false)} className="btn-primary text-[13px]">{t("money.plans.ai.close" as any)}</button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
