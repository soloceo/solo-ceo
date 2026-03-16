import React, { useState, useEffect, useRef, useMemo } from "react";
import { useT } from "../i18n/context";
import { useRealtimeRefresh } from "../hooks/useRealtimeRefresh";
import { useIsMobile } from "../hooks/useIsMobile";
import { useToast } from "../hooks/useToast";
import { createPortal } from "react-dom";
import {
  Plus, Mail, Sparkles, Loader2, X, Check, Edit2, Trash2,
  UserPlus, LayoutGrid, AlignJustify, ChevronDown,
  Search, Filter, PlayCircle, PauseCircle, Layers, PanelRightClose, Phone,
  DollarSign, CircleCheck, Clock, AlertCircle, ChevronUp, Download,
  FolderOpen, ExternalLink,
} from "lucide-react";
import { GoogleGenAI } from "@google/genai";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useVirtualizer } from "@tanstack/react-virtual";
import { motion, AnimatePresence } from "motion/react";

/* ── Helpers ────────────────────────────────────────────────────── */
const getAI = () => {
  const key = localStorage.getItem("GEMINI_API_KEY") || import.meta.env.VITE_GEMINI_API_KEY;
  return new GoogleGenAI({ apiKey: key });
};
const cleanCopy = (t: string) =>
  (t || "").replace(/```[\s\S]*?```/g, m => m.replace(/```/g, ""))
    .replace(/^#{1,6}\s*/gm, "").replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1").replace(/^[-*]\s+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n").replace(/^以下是.*$/gim, "")
    .replace(/^当然可以.*$/gim, "").trim();

/* ── Finance helpers (shared with Money) ── */
const calcTaxAmount = (amount: number, mode: string, rate: number): number => {
  if (mode === "none" || !rate) return 0;
  if (mode === "exclusive") return Math.round((amount * rate) / 100 * 100) / 100;
  if (mode === "inclusive") return Math.round((amount * rate) / (100 + rate) * 100) / 100;
  return 0;
};
const CATEGORY_I18N: Record<string, string> = { "收入": "money.cat.income", "软件支出": "money.cat.software", "外包支出": "money.cat.outsource", "应收": "money.cat.receivable", "应付": "money.cat.payable", "其他支出": "money.cat.other" };
const STATUS_I18N: Record<string, string> = { "已完成": "money.st.completed", "待收款 (应收)": "money.st.receivable", "待支付 (应付)": "money.st.payable" };
const catLabel = (cat: string, t: (k: any) => string) => { const key = CATEGORY_I18N[cat]; return key ? t(key as any) : cat; };
const stLabel = (st: string, t: (k: any) => string) => { const key = STATUS_I18N[st]; return key ? t(key as any) : st; };
const TX_CATEGORIES = ["收入", "软件支出", "外包支出", "应收", "应付", "其他支出"];
const TX_STATUSES = ["已完成", "待收款 (应收)", "待支付 (应付)"];

const LEAD_COL_IDS = [
  { id: "new", color: "var(--text-tertiary)" },
  { id: "contacted", color: "var(--accent)" },
  { id: "proposal", color: "var(--warning)" },
  { id: "won", color: "var(--success)" },
  { id: "lost", color: "var(--danger)" },
] as const;

type Segment = "leads" | "clients";

/* ── Main ───────────────────────────────────────────────────────── */
export default function Pipeline() {
  const { t } = useT();
  const [segment, setSegment] = useState<Segment>("leads");

  return (
    <div className="mobile-page max-w-[1680px] mx-auto min-h-full flex flex-col px-4 py-3 md:px-6 md:py-4 lg:px-8 lg:py-5 relative">
      <header className="flex items-center justify-between mb-4">
        <h1 className="page-title">{t("pipeline.pageTitle" as any)}</h1>
        <div className="segment-switcher">
          {(["leads", "clients"] as const).map(s => (
            <button key={s} onClick={() => setSegment(s)} data-active={segment === s}>
              {s === "leads" ? t("pipeline.leads" as any) : t("pipeline.clients" as any)}
            </button>
          ))}
        </div>
      </header>
      {segment === "leads" ? <LeadsView /> : <ClientsView />}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   LEADS VIEW
   ══════════════════════════════════════════════════════════════════ */
export function LeadsView() {
  const { t } = useT();
  const LEAD_COLS = useMemo(() => LEAD_COL_IDS.map(c => ({
    ...c,
    title: t(`pipeline.col.${c.id}` as any),
  })), [t]);
  const [leads, setLeads] = useState<any>({ new: [], contacted: [], proposal: [], won: [], lost: [] });
  const [showFunnel, setShowFunnel] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showPanel, setShowPanel] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [converting, setConverting] = useState(false);
  const [showConvert, setShowConvert] = useState(false);
  const [toast, showToast] = useToast();
  const [outreach, setOutreach] = useState("cold_email");
  const isMobile = useIsMobile();
  const [viewMode, setViewMode] = useState<"vertical" | "horizontal">(() =>
    (localStorage.getItem("sales_view_mode") as any) || "vertical",
  );
  const [convertForm, setConvertForm] = useState({ plan_tier: "", status: "Active", mrr: "", subscription_start_date: new Date().toISOString().split("T")[0] });
  const [plans, setPlans] = useState<any[]>([]);
  const emptyLead = { name: "", industry: "", needs: "", website: "", column: "new", aiDraft: "", source: "", language: "zh" };
  const [form, setForm] = useState(emptyLead);

  const fetchPlans = async () => { try { setPlans(await (await fetch("/api/plans")).json()); } catch {} };

  const fetchLeads = async () => {
    try {
      const res = await fetch("/api/leads");
      const data = await res.json();
      setLeads({ new: data.filter((l: any) => l.column === "new"), contacted: data.filter((l: any) => l.column === "contacted"), proposal: data.filter((l: any) => l.column === "proposal"), won: data.filter((l: any) => l.column === "won"), lost: data.filter((l: any) => l.column === "lost") });
    } catch { showToast(t("pipeline.toast.loadFailed" as any)); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchLeads(); fetchPlans(); }, []);
  useRealtimeRefresh(['leads', 'plans'], fetchLeads);
  useEffect(() => {
    const show = isMobile && (showPanel || showConvert);
    window.dispatchEvent(new CustomEvent("mobile-nav-visibility", { detail: { hidden: show } }));
    return () => { window.dispatchEvent(new CustomEvent("mobile-nav-visibility", { detail: { hidden: false } })); };
  }, [showPanel, showConvert, isMobile]);

  const openPanel = (lead: any = null, col = "new") => {
    if (lead) { setEditId(lead.id); setForm({ name: lead.name, industry: lead.industry, needs: lead.needs, website: lead.website || "", column: lead.column || col, aiDraft: lead.aiDraft || "", source: lead.source || "", language: lead.language || "zh" }); }
    else { setEditId(null); setForm({ ...emptyLead, column: col }); }
    setShowPanel(true);
  };

  const saveLead = async () => {
    try {
      if (editId) { await fetch(`/api/leads/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }); showToast(t("pipeline.toast.leadUpdated" as any)); }
      else { await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }); showToast(t("pipeline.toast.leadAdded" as any)); }
      setShowPanel(false); fetchLeads();
    } catch { showToast(t("common.saveFailed" as any)); }
  };

  const deleteLead = async (id: number) => {
    try { await fetch(`/api/leads/${id}`, { method: "DELETE" }); setShowPanel(false); setDeleteId(null); showToast(t("pipeline.toast.leadDeleted" as any)); fetchLeads(); } catch { showToast(t("common.deleteFailed" as any)); }
  };

  const onDragEnd = async (result: any) => {
    if (!result.destination) return;
    const { source: s, destination: d } = result;
    if (s.droppableId !== d.droppableId) {
      const src = [...leads[s.droppableId]], dst = [...leads[d.droppableId]];
      const [moved] = src.splice(s.index, 1); moved.column = d.droppableId; dst.splice(d.index, 0, moved);
      setLeads({ ...leads, [s.droppableId]: src, [d.droppableId]: dst });
      try { await fetch(`/api/leads/${moved.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(moved) }); } catch { showToast(t("common.updateFailed" as any)); fetchLeads(); }
    } else { const col = [...leads[s.droppableId]]; const [moved] = col.splice(s.index, 1); col.splice(d.index, 0, moved); setLeads({ ...leads, [s.droppableId]: col }); }
  };

  const generateOutreach = async () => {
    if (!form.name) { showToast(t("pipeline.ai.needName" as any)); return; }
    setGenerating(true);
    try {
      const ai = getAI();
      const modeGuide: Record<string, string> = { linkedin_dm: "写成 LinkedIn 私信：更短、更自然。", follow_up: "写成跟进消息：对方已看过前面信息但没回复。", reactivation: "写成重新激活旧线索的消息。", cold_email: "写成首次冷开发邮件：结构完整，CTA 低阻力。" };
      const prompt = `你是顶级 B2B 销售文案专家。\n我们的服务：专业品牌设计、设计外包、订阅制设计。\n客户名称：${form.name}\n行业：${form.industry}\n需求：${form.needs}\n网址/简介：${form.website}\n场景：${outreach}\n${modeGuide[outreach]}\n语言：${form.language === "en" ? "English" : "中文"}\n\n要求：短、准、专业，可直接发送。不要 Markdown 符号。`;
      const res = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt });
      setForm(p => ({ ...p, aiDraft: cleanCopy(res.text || t("pipeline.ai.genFailed" as any)) })); showToast(t("pipeline.ai.generated" as any));
    } catch { showToast(t("pipeline.ai.genFailed" as any)); }
    finally { setGenerating(false); }
  };

  const convertLead = async () => {
    if (!editId) return; setConverting(true);
    try {
      await fetch(`/api/leads/${editId}/convert`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan_tier: convertForm.plan_tier, status: convertForm.status, mrr: Number(convertForm.mrr || 0), subscription_start_date: convertForm.subscription_start_date }) });
      setShowConvert(false); setShowPanel(false); showToast(t("pipeline.convert.success" as any)); fetchLeads();
    } catch { showToast(t("pipeline.convert.failed" as any)); }
    finally { setConverting(false); }
  };

  return (
    <>
      {toast && <Toast msg={toast} />}

      <div className="flex flex-wrap gap-2 items-center mb-4">
        <div className="segment-switcher">
          {([["vertical", <LayoutGrid size={13} key="v" />], ["horizontal", <AlignJustify size={13} key="h" />]] as const).map(([m, icon]) => (
            <button key={m} onClick={() => { setViewMode(m as any); localStorage.setItem("sales_view_mode", m as string); }} data-active={viewMode === m}>{icon}</button>
          ))}
        </div>
        <button onClick={() => setShowFunnel(f => !f)} className={`btn-ghost text-[13px] gap-1 ${showFunnel ? "ring-1" : ""}`} style={showFunnel ? { color: "var(--accent)", borderColor: "var(--accent)" } : undefined}>
          <ChevronDown size={13} style={{ transform: showFunnel ? "rotate(180deg)" : undefined, transition: "transform 0.2s" }} /> {t("pipeline.funnel.title" as any)}
        </button>
        <div className="flex-1" />
        <button onClick={() => openPanel(null, "new")} className="btn-primary text-[13px]"><Plus size={13} /> {t("pipeline.addLead" as any)}</button>
      </div>

      {/* Funnel chart */}
      {showFunnel && (() => {
        const total = LEAD_COLS.reduce((s, col) => s + (leads[col.id]?.length || 0), 0);
        if (total === 0) return null;
        return (
          <div className="card p-4 mb-4">
            <h3 className="section-label mb-3">{t("pipeline.funnel.title" as any)}</h3>
            <div className="space-y-2">
              {LEAD_COLS.filter(col => col.id !== "lost").map((col, i) => {
                const count = leads[col.id]?.length || 0;
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                const maxW = 100 - i * 12;
                return (
                  <div key={col.id} className="flex items-center gap-3" style={{ paddingLeft: `${i * 6}%`, paddingRight: `${i * 6}%` }}>
                    <div className="flex-1 rounded-md h-8 flex items-center justify-between px-3 text-[12px] font-medium transition-all" style={{ background: `color-mix(in srgb, ${col.color} 15%, transparent)`, color: col.color, maxWidth: `${maxW}%` }}>
                      <span>{col.title}</span>
                      <span className="tabular-nums">{count} ({pct}%)</span>
                    </div>
                  </div>
                );
              })}
              {/* Lost row */}
              {(leads.lost?.length || 0) > 0 && (
                <div className="flex items-center gap-3 mt-1 pt-1 border-t" style={{ borderColor: "var(--border)" }}>
                  <div className="flex-1 rounded-md h-7 flex items-center justify-between px-3 text-[11px] font-medium" style={{ background: "color-mix(in srgb, var(--danger) 10%, transparent)", color: "var(--danger)" }}>
                    <span>{t("pipeline.col.lost" as any)}</span>
                    <span className="tabular-nums">{leads.lost.length} ({Math.round((leads.lost.length / total) * 100)}%)</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {loading ? (
        <div className="flex flex-1 items-center justify-center"><Loader2 size={24} className="animate-spin" style={{ color: "var(--text-tertiary)" }} /></div>
      ) : viewMode === "vertical" ? (
        <div className="flex-1 overflow-x-auto overflow-y-hidden ios-scroll pb-4 -mx-4 px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
          <div className="flex h-full gap-3 min-w-max">
            <DragDropContext onDragEnd={onDragEnd}>
              {LEAD_COLS.map(col => <LeadColumn key={col.id} col={col} items={leads[col.id]} onAdd={() => openPanel(null, col.id)} onEdit={(l: any) => openPanel(l, col.id)} onDelete={(id: number) => setDeleteId(id)} emptyText={t("pipeline.emptyCol" as any)} />)}
            </DragDropContext>
          </div>
        </div>
      ) : (
        <LeadSwimlane leads={leads} columns={LEAD_COLS} onAdd={openPanel} onEdit={openPanel} onDelete={(id: number) => setDeleteId(id)} emptyText={t("pipeline.emptyCol" as any)} onMove={async (id: number, col: string) => {
          try { await fetch(`/api/leads/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ column: col }) }); fetchLeads(); } catch { showToast(t("pipeline.toast.moveFailed" as any)); }
        }} />
      )}

      {/* ═══ Lead Side Panel ═══ */}
      <AnimatePresence>
        {showPanel && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.3)" }} onClick={() => setShowPanel(false)} />
            <motion.div
              initial={{ x: isMobile ? 0 : "100%", y: isMobile ? "100%" : 0 }}
              animate={{ x: 0, y: 0 }}
              exit={{ x: isMobile ? 0 : "100%", y: isMobile ? "100%" : 0 }}
              transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
              className={isMobile ? "fixed inset-0 z-50 flex flex-col" : "fixed top-0 right-0 z-50 h-full w-full max-w-[520px] flex flex-col border-l"}
              style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-lg)", paddingTop: isMobile ? "env(safe-area-inset-top, 0px)" : undefined }}
            >
              <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>{editId ? <Edit2 size={14} /> : <Plus size={14} />}</div>
                  <span className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>{editId ? t("pipeline.panel.editLead" as any) : t("pipeline.panel.newLead" as any)}</span>
                </div>
                <button onClick={() => setShowPanel(false)} className="btn-ghost p-1">{isMobile ? <X size={16} /> : <PanelRightClose size={16} />}</button>
              </div>
              <div className="flex-1 overflow-y-auto ios-scroll p-5 space-y-4">
                <div className="space-y-3">
                  <FL label={t("pipeline.form.name" as any)}><input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="input-base w-full px-3 py-2 text-[13px]" /></FL>
                  <div className="grid grid-cols-2 gap-3">
                    <FL label={t("pipeline.form.industry" as any)}><input value={form.industry} onChange={e => setForm(p => ({ ...p, industry: e.target.value }))} className="input-base w-full px-3 py-2 text-[13px]" /></FL>
                    <FL label={t("pipeline.form.source" as any)}>
                      <input list="source-presets" value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))} placeholder={t("pipeline.form.sourcePlaceholder" as any)} className="input-base w-full px-3 py-2 text-[13px]" />
                      <datalist id="source-presets">
                        {["LinkedIn", "Twitter / X", "Instagram", t("pipeline.source.referral" as any), t("pipeline.source.website" as any), t("pipeline.source.event" as any), t("pipeline.source.coldOutreach" as any), t("pipeline.source.other" as any)].map(s => <option key={s} value={s} />)}
                      </datalist>
                    </FL>
                  </div>
                  <FL label={t("pipeline.form.needs" as any)}><input value={form.needs} onChange={e => setForm(p => ({ ...p, needs: e.target.value }))} className="input-base w-full px-3 py-2 text-[13px]" /></FL>
                  <FL label={t("pipeline.form.stage" as any)}>
                    <select value={form.column} onChange={e => setForm(p => ({ ...p, column: e.target.value }))} className="input-base w-full px-3 py-2 text-[13px]">
                      {LEAD_COLS.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                  </FL>
                </div>
                <div className="border-t" style={{ borderColor: "var(--border)" }} />
                <FL label={t("pipeline.form.website" as any)}><textarea value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} placeholder={t("pipeline.form.websitePlaceholder" as any)} className="input-base w-full h-16 px-3 py-2 text-[13px] resize-none" /></FL>
                <div className="flex gap-2">
                  <FL label={t("pipeline.form.scene" as any)} className="flex-1">
                    <select value={outreach} onChange={e => setOutreach(e.target.value)} className="input-base w-full px-3 py-2 text-[13px]">
                      <option value="cold_email">{t("pipeline.scene.coldEmail" as any)}</option><option value="linkedin_dm">{t("pipeline.scene.linkedin" as any)}</option><option value="follow_up">{t("pipeline.scene.followUp" as any)}</option><option value="reactivation">{t("pipeline.scene.reactivation" as any)}</option>
                    </select>
                  </FL>
                  <FL label={t("pipeline.form.language" as any)} className="w-24">
                    <select value={form.language} onChange={e => setForm(p => ({ ...p, language: e.target.value }))} className="input-base w-full px-3 py-2 text-[13px]">
                      <option value="zh">中文</option><option value="en">EN</option>
                    </select>
                  </FL>
                </div>
                <button type="button" onClick={generateOutreach} disabled={generating} className="btn-primary w-full text-[13px] disabled:opacity-50">
                  {generating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} {generating ? t("pipeline.ai.generating" as any) : t("pipeline.ai.generate" as any)}
                </button>
                <FL label={t("pipeline.form.draftLabel" as any)}>
                  <textarea value={form.aiDraft} onChange={e => setForm(p => ({ ...p, aiDraft: e.target.value }))} placeholder={t("pipeline.form.draftPlaceholder" as any)} className="input-base w-full h-32 px-3 py-2 text-[13px] resize-none" />
                </FL>
                {form.aiDraft && <button onClick={() => { navigator.clipboard.writeText(form.aiDraft); showToast(t("common.copied" as any)); }} className="btn-ghost text-[11px] w-full">{t("pipeline.ai.copyDraft" as any)}</button>}
              </div>
              <div className="flex items-center justify-between px-5 py-3 border-t pb-safe" style={{ borderColor: "var(--border)" }}>
                <div className="flex gap-2">
                  {editId && <button type="button" onClick={() => setDeleteId(editId)} className="btn-ghost text-[12px]" style={{ color: "var(--danger)" }}><Trash2 size={13} /> {t("common.delete" as any)}</button>}
                  {editId && <button type="button" onClick={() => { setConvertForm({ plan_tier: "", status: "Active", mrr: "", subscription_start_date: new Date().toISOString().split("T")[0] }); setShowConvert(true); }} className="btn-ghost text-[12px]" style={{ color: "var(--success)" }}><UserPlus size={13} /> {t("pipeline.convert.btn" as any)}</button>}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowPanel(false)} className="btn-secondary text-[13px]">{t("common.cancel" as any)}</button>
                  <button type="button" onClick={saveLead} className="btn-primary text-[13px]">{editId ? t("common.save" as any) : t("common.create" as any)}</button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
          <div className="card-elevated w-full max-w-sm p-5">
            <h3 className="text-[15px] font-semibold mb-2" style={{ color: "var(--text)" }}>{t("pipeline.delete.title" as any)}</h3>
            <p className="text-[13px] mb-4" style={{ color: "var(--text-secondary)" }}>{t("pipeline.delete.warning" as any)}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteId(null)} className="btn-secondary text-[13px]">{t("common.cancel" as any)}</button>
              <button onClick={() => deleteLead(deleteId)} className="text-[13px] font-semibold px-4 py-2 rounded-lg text-white" style={{ background: "var(--danger)" }}>{t("pipeline.delete.confirm" as any)}</button>
            </div>
          </div>
        </div>
      )}

      {/* Convert modal */}
      {showConvert && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
          <div className="card-elevated w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-semibold flex items-center gap-2" style={{ color: "var(--text)" }}><UserPlus size={16} style={{ color: "var(--success)" }} /> {t("pipeline.convert.title" as any)}</h3>
              <button onClick={() => setShowConvert(false)} className="btn-ghost p-1"><X size={14} /></button>
            </div>
            <FL label={t("pipeline.convert.plan" as any)}><select value={convertForm.plan_tier} onChange={e => { const v = e.target.value; const p = plans.find((x: any) => x.name === v); setConvertForm(prev => ({ ...prev, plan_tier: v, mrr: p ? String(p.price) : prev.mrr })); }} className="input-base w-full px-3 py-2 text-[13px]"><option value="">{t("pipeline.convert.planSelect" as any)}</option>{plans.map((p: any) => <option key={p.id} value={p.name}>{p.name}</option>)}</select></FL>
            <div className="grid grid-cols-2 gap-3">
              <FL label={t("common.status" as any)}><select value={convertForm.status} onChange={e => setConvertForm(p => ({ ...p, status: e.target.value }))} className="input-base w-full px-3 py-2 text-[13px]"><option value="Active">Active</option><option value="Paused">Paused</option></select></FL>
              <FL label={t("pipeline.convert.mrr" as any)}><input type="number" min="0" value={convertForm.mrr} onChange={e => setConvertForm(p => ({ ...p, mrr: e.target.value }))} className="input-base w-full px-3 py-2 text-[13px]" /></FL>
            </div>
            <FL label={t("pipeline.convert.startDate" as any)}><input type="date" value={convertForm.subscription_start_date} onChange={e => setConvertForm(p => ({ ...p, subscription_start_date: e.target.value }))} className="input-base w-full px-3 py-2 text-[13px]" /></FL>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowConvert(false)} className="btn-secondary text-[13px]">{t("common.cancel" as any)}</button>
              <button onClick={convertLead} disabled={converting} className="text-[13px] font-semibold px-4 py-2 rounded-lg text-white flex items-center gap-1.5 disabled:opacity-50" style={{ background: "var(--success)" }}>
                {converting ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />} {t("common.confirm" as any)}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════
   CLIENTS VIEW
   ══════════════════════════════════════════════════════════════════ */
export function ClientsView() {
  const { t } = useT();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPanel, setShowPanel] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [toast, showToast] = useToast();
  const [search, setSearch] = useState("");
  const [filterSt, setFilterSt] = useState("All");
  const [filterBilling, setFilterBilling] = useState("All");
  const [filterPlan, setFilterPlan] = useState("All");
  const isMobile = useIsMobile();
  const [plans, setPlans] = useState<any[]>([]);
  const emptyClient = { name: "", company_name: "", contact_name: "", contact_email: "", contact_phone: "", billing_type: "subscription" as "subscription" | "project", plan: "", status: "Active", mrr: "", project_fee: "", subscription_start_date: new Date().toISOString().split("T")[0], project_end_date: "", paused_at: "", resumed_at: "", cancelled_at: "", mrr_effective_from: new Date().toISOString().split("T")[0], tax_mode: "none" as "none" | "exclusive" | "inclusive", tax_rate: "", drive_folder_url: "" };
  const [form, setForm] = useState(emptyClient);
  const parentRef = useRef<HTMLDivElement>(null);

  /* ── Milestones state ── */
  const [milestones, setMilestones] = useState<any[]>([]);
  const [msLoading, setMsLoading] = useState(false);
  const [showAddMs, setShowAddMs] = useState(false);
  const [editMsId, setEditMsId] = useState<number | null>(null);
  const [markPaidId, setMarkPaidId] = useState<number | null>(null);
  const [markPaidMethod, setMarkPaidMethod] = useState("bank_transfer");
  const emptyMs = { label: "", amount: "", percentage: "", due_date: "", note: "" };
  const [msForm, setMsForm] = useState(emptyMs);

  const PAYMENT_METHODS = ["bank_transfer", "wechat", "alipay", "cash", "paypal", "stripe", "other"] as const;

  const [finTxs, setFinTxs] = useState<any[]>([]);

  /* ── Transaction editing state ── */
  const [showTxForm, setShowTxForm] = useState(false);
  const [editTxId, setEditTxId] = useState<number | null>(null);
  const emptyTx = { date: new Date().toISOString().split("T")[0], desc: "", category: "收入", amount: "", status: "已完成", taxMode: "none" as "none" | "exclusive" | "inclusive", taxRate: "" };
  const [txForm, setTxForm] = useState(emptyTx);

  const fetchPlans = async () => { try { setPlans(await (await fetch("/api/plans")).json()); } catch {} };
  const fetchClients = async () => { try { const res = await fetch("/api/clients"); setClients(await res.json()); } catch { showToast(t("pipeline.toast.clientLoadFailed" as any)); } finally { setLoading(false); } };
  const fetchFinance = async () => { try { const res = await fetch("/api/finance"); setFinTxs(await res.json()); } catch {} };

  const fetchMilestones = async (clientId: number) => {
    setMsLoading(true);
    try { const res = await fetch(`/api/clients/${clientId}/milestones`); setMilestones(await res.json()); }
    catch { setMilestones([]); }
    finally { setMsLoading(false); }
  };

  const saveMilestone = async () => {
    if (!editId) return;
    const body = { label: msForm.label, amount: Number(msForm.amount) || 0, percentage: Number(msForm.percentage) || 0, due_date: msForm.due_date || null, note: msForm.note };
    try {
      if (editMsId) { await fetch(`/api/milestones/${editMsId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
      else { await fetch(`/api/clients/${editId}/milestones`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
      showToast(t("pipeline.milestones.saved" as any));
      setShowAddMs(false); setEditMsId(null); setMsForm(emptyMs);
      fetchMilestones(editId);
    } catch { showToast(t("common.saveFailed" as any)); }
  };

  const deleteMilestone = async (msId: number) => {
    try { await fetch(`/api/milestones/${msId}`, { method: "DELETE" }); showToast(t("pipeline.milestones.deleted" as any)); if (editId) fetchMilestones(editId); }
    catch { showToast(t("common.deleteFailed" as any)); }
  };

  const confirmMarkPaid = async () => {
    if (!markPaidId) return;
    try {
      await fetch(`/api/milestones/${markPaidId}/mark-paid`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payment_method: markPaidMethod }) });
      showToast(t("pipeline.milestones.autoFinance" as any));
      setMarkPaidId(null); setMarkPaidMethod("bank_transfer");
      if (editId) fetchMilestones(editId);
    } catch { showToast(t("common.saveFailed" as any)); }
  };

  const applyPreset = (preset: "deposit" | "midway" | "final") => {
    const fee = Number(form.project_fee) || 0;
    const pctMap = { deposit: 30, midway: 40, final: 30 };
    const pct = pctMap[preset];
    setMsForm(p => ({
      ...p,
      label: t(`pipeline.milestones.presets.${preset}` as any),
      percentage: String(pct),
      amount: String(Math.round(fee * pct / 100)),
    }));
  };

  const saveTx = async () => {
    if (!editId) return;
    const isIncome = txForm.category === "收入" || txForm.category === "应收";
    const amt = Math.abs(Number(txForm.amount));
    const rate = Number(txForm.taxRate) || 0;
    const taxAmount = calcTaxAmount(amt, txForm.taxMode, rate);
    const txData = { date: txForm.date, description: txForm.desc, category: txForm.category, amount: amt, type: isIncome ? "income" : "expense", status: txForm.status, tax_mode: txForm.taxMode, tax_rate: rate, tax_amount: taxAmount, client_id: editId, client_name: form.company_name || form.name };
    try {
      if (editTxId) { await fetch(`/api/finance/${editTxId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(txData) }); }
      else { await fetch("/api/finance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(txData) }); }
      showToast(t("pipeline.tx.saved" as any));
      setShowTxForm(false); setEditTxId(null); setTxForm(emptyTx);
      fetchFinance();
    } catch { showToast(t("common.saveFailed" as any)); }
  };

  const deleteTx = async (txId: number) => {
    try { await fetch(`/api/finance/${txId}`, { method: "DELETE" }); showToast(t("pipeline.tx.deleted" as any)); fetchFinance(); }
    catch { showToast(t("common.deleteFailed" as any)); }
  };

  const clientTxs = useMemo(() =>
    editId ? finTxs.filter(tx => tx.client_id === editId).sort((a: any, b: any) => (b.date || "").localeCompare(a.date || "")) : [],
    [finTxs, editId]
  );

  useEffect(() => { fetchClients(); fetchPlans(); fetchFinance(); }, []);
  useRealtimeRefresh(['clients', 'plans', 'payment_milestones', 'finance_transactions'], () => { fetchClients(); fetchFinance(); if (editId && form.billing_type === "project") fetchMilestones(editId); });
  useEffect(() => {
    const show = isMobile && showPanel;
    window.dispatchEvent(new CustomEvent("mobile-nav-visibility", { detail: { hidden: show } }));
    return () => { window.dispatchEvent(new CustomEvent("mobile-nav-visibility", { detail: { hidden: false } })); };
  }, [showPanel, isMobile]);

  const openPanel = (c: any = null) => {
    setMilestones([]); setShowAddMs(false); setEditMsId(null); setMarkPaidId(null); setMsForm(emptyMs);
    setShowTxForm(false); setEditTxId(null); setTxForm(emptyTx);
    if (c) {
      setEditId(c.id);
      setForm({ name: c.name, company_name: c.company_name || "", contact_name: c.contact_name || "", contact_email: c.contact_email || "", contact_phone: c.contact_phone || "", billing_type: c.billing_type || "subscription", plan: c.plan_tier || c.plan, status: c.status, mrr: String(c.mrr).replace(/[^0-9.-]+/g, ""), project_fee: String(c.project_fee || "").replace(/[^0-9.-]+/g, ""), subscription_start_date: c.subscription_start_date || (c.joined_at ? String(c.joined_at).split(" ")[0] : ""), project_end_date: c.project_end_date || "", paused_at: c.paused_at || "", resumed_at: c.resumed_at || "", cancelled_at: c.cancelled_at || "", mrr_effective_from: c.mrr_effective_from || c.subscription_start_date || "", tax_mode: (c.tax_mode || "none") as any, tax_rate: String(c.tax_rate || ""), drive_folder_url: c.drive_folder_url || "" });
      if ((c.billing_type || "subscription") === "project") fetchMilestones(c.id);
    }
    else { setEditId(null); setForm(emptyClient); }
    setShowPanel(true);
  };

  const saveClient = async () => {
    const d = { name: form.name, company_name: form.company_name, contact_name: form.contact_name, contact_email: form.contact_email, contact_phone: form.contact_phone, billing_type: form.billing_type, plan_tier: form.billing_type === "subscription" ? form.plan : "", status: form.status, mrr: form.billing_type === "subscription" ? (Number(form.mrr) || 0) : 0, project_fee: form.billing_type === "project" ? (Number(form.project_fee) || 0) : 0, subscription_start_date: form.subscription_start_date, project_end_date: form.project_end_date, paused_at: form.paused_at, resumed_at: form.resumed_at, cancelled_at: form.cancelled_at, mrr_effective_from: form.mrr_effective_from, tax_mode: form.tax_mode, tax_rate: Number(form.tax_rate) || 0, drive_folder_url: form.drive_folder_url };
    try {
      if (editId) { await fetch(`/api/clients/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }); showToast(t("pipeline.toast.clientUpdated" as any)); }
      else { await fetch("/api/clients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }); showToast(t("pipeline.toast.clientAdded" as any)); }
      setShowPanel(false); fetchClients();
    } catch { showToast(t("common.saveFailed" as any)); }
  };

  const deleteClient = async (id: number) => { try { await fetch(`/api/clients/${id}`, { method: "DELETE" }); setShowPanel(false); showToast(t("pipeline.toast.clientDeleted" as any)); fetchClients(); } catch { showToast(t("common.deleteFailed" as any)); } };

  const uniquePlanTiers = [...new Set(clients.filter(c => c.billing_type === "subscription" && c.plan_tier).map(c => c.plan_tier))];
  const filtered = clients.filter(c => {
    const q = search.toLowerCase();
    const ms = c.name.toLowerCase().includes(q) || (c.company_name || "").toLowerCase().includes(q) || (c.contact_name || "").toLowerCase().includes(q) || (c.contact_email || "").toLowerCase().includes(q);
    const mf = filterSt === "All" || c.status === filterSt;
    const mb = filterBilling === "All" || c.billing_type === filterBilling;
    const mp = filterPlan === "All" || c.plan_tier === filterPlan;
    return ms && mf && mb && mp;
  });
  const activeN = filtered.filter(c => c.status === "Active").length;
  const pausedN = filtered.filter(c => c.status === "Paused").length;
  // 合同总额 = subscription lifetimeRevenue + project fees
  const contractTotal = filtered.reduce((s, c) => {
    if (c.billing_type === "project") return s + Number(c.project_fee || 0);
    return s + Number(c.lifetimeRevenue || 0);
  }, 0);
  // 已到账 = 所有已完成收入（含订阅月付虚拟行 + 真实交易记录）
  const filteredIds = new Set(filtered.map(c => c.id));
  const totalReceived = finTxs
    .filter((tx: any) => tx.type === "income" && (tx.status || "已完成") === "已完成" && filteredIds.has(tx.client_id))
    .reduce((s: number, tx: any) => s + Number(tx.amount || 0), 0);

  const exportClientsCSV = () => {
    const headers = ["Name", "Contact", "Email", "Phone", "Billing", "Plan", "MRR", "Project Fee", "Status", "Start Date"];
    const rows = filtered.map((c: any) => [
      c.name || "", c.contact_name || "", c.contact_email || "", c.contact_phone || "",
      c.billing_type === "project" ? "Project" : "Subscription",
      c.plan_tier || "", c.mrr || "", c.project_fee || "",
      c.status || "", c.subscription_start_date || "",
    ]);
    const csv = [headers, ...rows].map(r => r.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `clients-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(t("pipeline.clients.csvExported" as any));
  };

  const rowV = useVirtualizer({ count: filtered.length, getScrollElement: () => parentRef.current, estimateSize: () => 72, overscan: 6 });
  const vItems = rowV.getVirtualItems();
  const padTop = vItems.length > 0 ? vItems[0].start : 0;
  const padBot = vItems.length > 0 ? rowV.getTotalSize() - vItems[vItems.length - 1].end : 0;

  return (
    <>
      {toast && <Toast msg={toast} />}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="stat-card"><div className="flex items-center gap-2 mb-1"><div className="flex h-6 w-6 items-center justify-center rounded-md" style={{ background: "color-mix(in srgb, var(--success) 12%, transparent)" }}><PlayCircle size={13} style={{ color: "var(--success)" }} /></div><span className="text-[11px] font-medium" style={{ color: "var(--text-tertiary)" }}>{t("common.active" as any)}</span></div><span className="text-xl font-semibold tabular-nums" style={{ color: "var(--text)" }}>{activeN}</span></div>
        <div className="stat-card"><div className="flex items-center gap-2 mb-1"><div className="flex h-6 w-6 items-center justify-center rounded-md" style={{ background: "color-mix(in srgb, var(--warning) 12%, transparent)" }}><PauseCircle size={13} style={{ color: "var(--warning)" }} /></div><span className="text-[11px] font-medium" style={{ color: "var(--text-tertiary)" }}>{t("common.paused" as any)}</span></div><span className="text-xl font-semibold tabular-nums" style={{ color: "var(--text)" }}>{pausedN}</span></div>
        <div className="stat-card"><div className="flex items-center gap-2 mb-1"><div className="flex h-6 w-6 items-center justify-center rounded-md" style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)" }}><Layers size={13} style={{ color: "var(--accent)" }} /></div><span className="text-[11px] font-medium" style={{ color: "var(--text-tertiary)" }}>{t("pipeline.clients.contractTotal" as any)}</span></div><span className="text-xl font-semibold tabular-nums" style={{ color: "var(--text)" }}>${contractTotal.toLocaleString()}</span></div>
        <div className="stat-card"><div className="flex items-center gap-2 mb-1"><div className="flex h-6 w-6 items-center justify-center rounded-md" style={{ background: "color-mix(in srgb, var(--success) 12%, transparent)" }}><CircleCheck size={13} style={{ color: "var(--success)" }} /></div><span className="text-[11px] font-medium" style={{ color: "var(--text-tertiary)" }}>{t("pipeline.clients.totalReceived" as any)}</span></div><span className="text-xl font-semibold tabular-nums" style={{ color: "var(--success)" }}>${totalReceived.toLocaleString()}</span></div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
        <div className="relative flex-1 md:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={14} style={{ color: "var(--text-tertiary)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("pipeline.clients.search" as any)} className="input-base w-full pl-9 pr-3 py-2 text-[13px]" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter size={13} style={{ color: "var(--text-tertiary)" }} />
          <select value={filterSt} onChange={e => setFilterSt(e.target.value)} className="input-base px-2 py-1.5 text-[13px]">
            <option value="All">{t("common.all" as any)}</option><option value="Active">{t("common.active" as any)}</option><option value="Paused">{t("common.paused" as any)}</option>
          </select>
          <select value={filterBilling} onChange={e => setFilterBilling(e.target.value)} className="input-base px-2 py-1.5 text-[13px]">
            <option value="All">{t("pipeline.filter.billingAll" as any)}</option>
            <option value="subscription">{t("pipeline.clients.billingSubscription" as any)}</option>
            <option value="project">{t("pipeline.clients.billingProject" as any)}</option>
          </select>
          {uniquePlanTiers.length > 0 && (
            <select value={filterPlan} onChange={e => setFilterPlan(e.target.value)} className="input-base px-2 py-1.5 text-[13px]">
              <option value="All">{t("pipeline.filter.planAll" as any)}</option>
              {uniquePlanTiers.map(p => <option key={p} value={p}>{p === "Basic" ? t("pipeline.convert.planBasic" as any) : p === "Pro" ? t("pipeline.convert.planPro" as any) : p === "Enterprise" ? t("pipeline.convert.planEnterprise" as any) : p}</option>)}
            </select>
          )}
        </div>
        <div className="flex-1" />
        <button onClick={exportClientsCSV} className="btn-ghost text-[13px]" style={{ border: "1px solid var(--border)" }}><Download size={13} /> CSV</button>
        <button onClick={() => openPanel()} className="btn-primary text-[13px]"><Plus size={13} /> {t("pipeline.addClient" as any)}</button>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2 flex-1 overflow-y-auto ios-scroll pb-4">
        {!filtered.length && <div className="py-10 text-center text-[13px]" style={{ color: "var(--text-tertiary)" }}>{t("pipeline.clients.noMatch" as any)}</div>}
        {filtered.map(c => {
          const plan = c.plan_tier === "Basic" ? t("pipeline.convert.planBasic" as any) : c.plan_tier === "Pro" ? t("pipeline.convert.planPro" as any) : c.plan_tier === "Enterprise" ? t("pipeline.convert.planEnterprise" as any) : (c.plan_tier || c.plan);
          return (
            <button key={c.id} onClick={() => openPanel(c)} className="w-full text-left card-interactive p-3 flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>{(c.company_name || c.name).charAt(0).toUpperCase()}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2"><span className="text-[13px] font-medium truncate" style={{ color: "var(--text)" }}>{c.company_name || c.name}</span>
                  <span className="badge" style={c.status === "Active" ? { background: "var(--success-light)", color: "var(--success)" } : { background: "var(--warning-light)", color: "var(--warning)" }}>{c.status === "Active" ? t("common.active" as any) : t("common.paused" as any)}</span>
                </div>
                {c.contact_name && <div className="text-[11px] mt-0.5 truncate" style={{ color: "var(--text-secondary)" }}>{c.contact_name}{c.contact_phone ? ` · ${c.contact_phone}` : ""}</div>}
                <div className="text-[11px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                  {c.billing_type === "project"
                    ? <>{t("pipeline.clients.billingProject" as any)} · {t("pipeline.clients.contract" as any)} <strong style={{ color: "var(--text)" }}>${Number(c.project_fee || 0).toLocaleString()}</strong></>
                    : <>{plan} · <strong style={{ color: "var(--text)" }}>${Number(c.mrr || 0).toLocaleString()}</strong>{t("pipeline.clients.perMonth" as any)}</>
                  }
                  {(() => { const cR = finTxs.filter((tx: any) => tx.type === "income" && (tx.status || "已完成") === "已完成" && tx.client_id === c.id).reduce((s: number, tx: any) => s + Number(tx.amount || 0), 0); return cR > 0 ? <> · <span style={{ color: "var(--success)" }}>{t("pipeline.clients.received" as any)} ${cR.toLocaleString()}</span></> : null; })()}
                  {c.tax_mode && c.tax_mode !== "none" && <> · <span style={{ color: "var(--accent)" }}>{c.tax_mode === "exclusive" ? t("money.form.taxExclBtn" as any) : t("money.form.taxIncl" as any)} {c.tax_rate}%</span></>}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Desktop table */}
      <div ref={parentRef} className="hidden md:block card flex-1 overflow-auto min-h-[400px]">
        <table className="w-full text-left min-w-[1000px]">
          <thead className="sticky top-0 z-10" style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
            <tr className="section-label">
              <th className="px-4 py-3 font-semibold">{t("pipeline.clients.table.name" as any)}</th><th className="px-4 py-3 font-semibold">{t("pipeline.clients.table.contact" as any)}</th><th className="px-4 py-3 font-semibold">{t("pipeline.clients.table.type" as any)}</th><th className="px-4 py-3 font-semibold">{t("pipeline.clients.table.plan" as any)}</th><th className="px-4 py-3 font-semibold">{t("pipeline.clients.table.status" as any)}</th><th className="px-4 py-3 font-semibold">{t("pipeline.clients.table.expectedActual" as any)}</th><th className="px-4 py-3 font-semibold">{t("pipeline.clients.taxSetting" as any)}</th><th className="px-4 py-3 font-semibold">{t("pipeline.clients.table.joined" as any)}</th><th className="px-4 py-3 text-right font-semibold">{t("pipeline.clients.table.actions" as any)}</th>
            </tr>
          </thead>
          <tbody className="text-[13px]">
            {padTop > 0 && <tr><td style={{ height: padTop, padding: 0 }} colSpan={9} /></tr>}
            {vItems.map(vr => {
              const c = filtered[vr.index];
              const plan = c.plan_tier === "Basic" ? t("pipeline.convert.planBasic" as any) : c.plan_tier === "Pro" ? t("pipeline.convert.planPro" as any) : c.plan_tier === "Enterprise" ? t("pipeline.convert.planEnterprise" as any) : (c.plan_tier || c.plan);
              const displayName = c.company_name || c.name;
              const displayInitial = displayName.charAt(0).toUpperCase();
              return (
                <tr key={c.id} data-index={vr.index} ref={rowV.measureElement} className="group border-b transition-colors cursor-pointer" style={{ borderColor: "var(--border)" }}
                  onClick={() => openPanel(c)}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-alt)")} onMouseLeave={e => (e.currentTarget.style.background = "")}>
                  <td className="px-4 py-3"><div className="flex items-center gap-2.5"><div className="flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>{displayInitial}</div><span className="font-medium" style={{ color: "var(--text)" }}>{displayName}</span></div></td>
                  <td className="px-4 py-3"><div className="min-w-0">{c.contact_name && <span className="text-[13px] block truncate" style={{ color: "var(--text)" }}>{c.contact_name}</span>}{c.contact_email && <span className="text-[11px] block truncate" style={{ color: "var(--text-tertiary)" }}>{c.contact_email}</span>}</div></td>
                  <td className="px-4 py-3"><span className="badge" style={c.billing_type === "project" ? { background: "color-mix(in srgb, var(--warning) 12%, transparent)", color: "var(--warning)" } : { background: "color-mix(in srgb, var(--accent) 12%, transparent)", color: "var(--accent)" }}>{c.billing_type === "project" ? t("pipeline.clients.billingProject" as any) : t("pipeline.clients.billingSubscription" as any)}</span></td>
                  <td className="px-4 py-3"><span className="badge">{c.billing_type === "project" ? "—" : plan}</span></td>
                  <td className="px-4 py-3"><span className="badge" style={c.status === "Active" ? { background: "var(--success-light)", color: "var(--success)" } : { background: "var(--warning-light)", color: "var(--warning)" }}>{c.status}</span></td>
                  <td className="px-4 py-3 font-medium tabular-nums" style={{ color: "var(--text)" }}>
                    <div>${c.billing_type === "project" ? Number(c.project_fee || 0).toLocaleString() : Number(c.lifetimeRevenue || 0).toLocaleString()}</div>
                    {(() => { const cReceived = finTxs.filter((tx: any) => tx.type === "income" && (tx.status || "已完成") === "已完成" && tx.client_id === c.id).reduce((s: number, tx: any) => s + Number(tx.amount || 0), 0); return cReceived > 0 ? <div className="text-[10px]" style={{ color: "var(--success)" }}>{t("pipeline.clients.received" as any)} ${cReceived.toLocaleString()}</div> : null; })()}
                    {c.billing_type === "subscription" && <div className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>${Number(c.mrr || 0).toLocaleString()}{t("pipeline.clients.perMonth" as any)}</div>}
                  </td>
                  <td className="px-4 py-3">{c.tax_mode && c.tax_mode !== "none" ? <span className="badge" style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)", color: "var(--accent)" }}>{c.tax_mode === "exclusive" ? t("money.form.taxExclBtn" as any) : t("money.form.taxIncl" as any)} {c.tax_rate}%</span> : <span style={{ color: "var(--text-tertiary)" }}>—</span>}</td>
                  <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{c.joined_at ? c.joined_at.split(" ")[0] : ""}</td>
                  <td className="px-4 py-3 text-right"><button onClick={e => { e.stopPropagation(); openPanel(c); }} className="btn-ghost text-[11px] opacity-0 group-hover:opacity-100"><Edit2 size={11} /> {t("common.edit" as any)}</button></td>
                </tr>
              );
            })}
            {padBot > 0 && <tr><td style={{ height: padBot, padding: 0 }} colSpan={9} /></tr>}
          </tbody>
        </table>
        {!filtered.length && <div className="p-8 text-center text-[13px]" style={{ color: "var(--text-tertiary)" }}>{t("pipeline.clients.noMatch" as any)}</div>}
      </div>

      {/* ═══ Client Side Panel ═══ */}
      <AnimatePresence>
        {showPanel && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.3)" }} onClick={() => setShowPanel(false)} />
            <motion.div
              initial={{ x: isMobile ? 0 : "100%", y: isMobile ? "100%" : 0 }}
              animate={{ x: 0, y: 0 }}
              exit={{ x: isMobile ? 0 : "100%", y: isMobile ? "100%" : 0 }}
              transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
              className={isMobile ? "fixed inset-0 z-50 flex flex-col" : "fixed top-0 right-0 z-50 h-full w-full max-w-[480px] flex flex-col border-l"}
              style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-lg)", paddingTop: isMobile ? "env(safe-area-inset-top, 0px)" : undefined }}
            >
              <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md" style={{ background: "var(--accent-light)", color: "var(--accent)" }}><UserPlus size={14} /></div>
                  <span className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>{editId ? t("pipeline.panel.editClient" as any) : t("pipeline.panel.newClient" as any)}</span>
                </div>
                <button onClick={() => setShowPanel(false)} className="btn-ghost p-1">{isMobile ? <X size={16} /> : <PanelRightClose size={16} />}</button>
              </div>
              <div className="flex-1 overflow-y-auto ios-scroll p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <FL label={t("pipeline.clients.companyName" as any)}><input required value={form.company_name} onChange={e => setForm(p => ({ ...p, company_name: e.target.value, name: e.target.value || p.contact_name }))} className="input-base w-full px-3 py-2 text-[13px]" /></FL>
                  <FL label={t("pipeline.clients.contactName" as any)}><input value={form.contact_name} onChange={e => setForm(p => ({ ...p, contact_name: e.target.value, name: p.company_name || e.target.value }))} className="input-base w-full px-3 py-2 text-[13px]" /></FL>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FL label={t("pipeline.clients.contactEmail" as any)}><input type="email" value={form.contact_email} onChange={e => setForm(p => ({ ...p, contact_email: e.target.value }))} className="input-base w-full px-3 py-2 text-[13px]" /></FL>
                  <FL label={t("pipeline.clients.contactPhone" as any)}><input type="tel" value={form.contact_phone} onChange={e => setForm(p => ({ ...p, contact_phone: e.target.value }))} className="input-base w-full px-3 py-2 text-[13px]" /></FL>
                </div>
                {/* Google Drive folder link */}
                <FL label={t("pipeline.clients.driveFolder" as any)}>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <FolderOpen size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-tertiary)" }} />
                      <input value={form.drive_folder_url} onChange={e => setForm(p => ({ ...p, drive_folder_url: e.target.value }))} placeholder={t("pipeline.clients.drivePlaceholder" as any)} className="input-base w-full pl-9 pr-3 py-2 text-[13px]" />
                    </div>
                    {form.drive_folder_url && (
                      <button type="button" onClick={() => window.open(form.drive_folder_url, '_blank')} className="btn-ghost flex items-center gap-1 px-2.5 shrink-0 text-[11px] font-medium" style={{ color: "var(--accent)" }}>
                        <ExternalLink size={12} /> {t("pipeline.clients.openDrive" as any)}
                      </button>
                    )}
                  </div>
                </FL>
                <div className="border-t" style={{ borderColor: "var(--border)" }} />
                {/* Billing type switcher */}
                <FL label={t("pipeline.clients.billingType" as any)}>
                  <div className="segment-switcher">
                    {(["subscription", "project"] as const).map(bt => (
                      <button key={bt} onClick={() => setForm(p => ({ ...p, billing_type: bt }))} data-active={form.billing_type === bt}>
                        {bt === "subscription" ? t("pipeline.clients.billingSubscription" as any) : t("pipeline.clients.billingProject" as any)}
                      </button>
                    ))}
                  </div>
                </FL>
                {form.billing_type === "subscription" ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <FL label={t("pipeline.convert.plan" as any)}><select value={form.plan} onChange={e => { const v = e.target.value; const p = plans.find((x: any) => x.name === v); setForm(prev => ({ ...prev, plan: v, mrr: p ? String(p.price) : prev.mrr })); }} className="input-base w-full px-3 py-2 text-[13px]"><option value="">{t("pipeline.convert.planSelect" as any)}</option>{plans.map((p: any) => <option key={p.id} value={p.name}>{p.name}</option>)}</select></FL>
                      <FL label={t("common.status" as any)}><select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className="input-base w-full px-3 py-2 text-[13px]"><option value="Active">Active</option><option value="Paused">Paused</option></select></FL>
                    </div>
                    <FL label={t("pipeline.convert.mrr" as any)}><input type="number" required min="0" value={form.mrr} onChange={e => setForm(p => ({ ...p, mrr: e.target.value }))} className="input-base w-full px-3 py-2 text-[13px]" /></FL>
                    {/* Tax settings — after amount */}
                    <FL label={t("pipeline.clients.taxSetting" as any)}>
                      <div className="flex gap-2 mb-2">
                        {([["none", t("money.form.taxNone" as any)], ["exclusive", t("money.form.taxExclBtn" as any)], ["inclusive", t("money.form.taxIncl" as any)]] as [string, string][]).map(([mode, label]) => (
                          <button key={mode} type="button" onClick={() => setForm(p => ({ ...p, tax_mode: mode as any }))}
                            className="flex-1 py-1.5 rounded-lg text-[12px] font-medium transition-all"
                            style={form.tax_mode === mode ? { background: "var(--text)", color: "var(--bg)" } : { background: "var(--surface-alt)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                            {label}
                          </button>
                        ))}
                      </div>
                      {form.tax_mode !== "none" && (
                        <div className="flex gap-2">
                          {[13, 6, 3].map(r => (
                            <button key={r} type="button" onClick={() => setForm(p => ({ ...p, tax_rate: String(r) }))}
                              className="px-3 py-1.5 rounded-md text-[11px] font-medium transition-all"
                              style={Number(form.tax_rate) === r ? { background: "var(--accent-light)", color: "var(--accent)", border: "1px solid var(--accent)" } : { background: "var(--surface-alt)", color: "var(--text-secondary)" }}>
                              {r}%
                            </button>
                          ))}
                          <input type="number" min="0" max="100" step="0.01" value={form.tax_rate} onChange={e => setForm(p => ({ ...p, tax_rate: e.target.value }))} placeholder={t("money.form.customTaxPlaceholder" as any)} className="input-base flex-1 px-3 py-1.5 text-[11px] min-w-0" />
                        </div>
                      )}
                    </FL>
                    <div className="border-t" style={{ borderColor: "var(--border)" }} />
                    <span className="section-label">{t("pipeline.clients.timeline" as any)}</span>
                    <div className="grid grid-cols-2 gap-3">
                      <FL label={t("pipeline.clients.start" as any)}><input type="date" value={form.subscription_start_date} onChange={e => setForm(p => ({ ...p, subscription_start_date: e.target.value }))} className="input-base w-full px-3 py-2 text-[13px]" /></FL>
                      <FL label={t("pipeline.clients.pause" as any)}><input type="date" value={form.paused_at} onChange={e => setForm(p => ({ ...p, paused_at: e.target.value }))} className="input-base w-full px-3 py-2 text-[13px]" /></FL>
                      <FL label={t("pipeline.clients.resume" as any)}><input type="date" value={form.resumed_at} onChange={e => setForm(p => ({ ...p, resumed_at: e.target.value }))} className="input-base w-full px-3 py-2 text-[13px]" /></FL>
                      <FL label={t("pipeline.clients.cancel" as any)}><input type="date" value={form.cancelled_at} onChange={e => setForm(p => ({ ...p, cancelled_at: e.target.value }))} className="input-base w-full px-3 py-2 text-[13px]" /></FL>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <FL label={t("pipeline.clients.projectFee" as any)}><input type="number" required min="0" value={form.project_fee} onChange={e => setForm(p => ({ ...p, project_fee: e.target.value }))} className="input-base w-full px-3 py-2 text-[13px]" /></FL>
                      <FL label={t("common.status" as any)}><select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className="input-base w-full px-3 py-2 text-[13px]"><option value="Active">Active</option><option value="Paused">Paused</option></select></FL>
                    </div>
                    {/* Tax settings — after amount */}
                    <FL label={t("pipeline.clients.taxSetting" as any)}>
                      <div className="flex gap-2 mb-2">
                        {([["none", t("money.form.taxNone" as any)], ["exclusive", t("money.form.taxExclBtn" as any)], ["inclusive", t("money.form.taxIncl" as any)]] as [string, string][]).map(([mode, label]) => (
                          <button key={mode} type="button" onClick={() => setForm(p => ({ ...p, tax_mode: mode as any }))}
                            className="flex-1 py-1.5 rounded-lg text-[12px] font-medium transition-all"
                            style={form.tax_mode === mode ? { background: "var(--text)", color: "var(--bg)" } : { background: "var(--surface-alt)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                            {label}
                          </button>
                        ))}
                      </div>
                      {form.tax_mode !== "none" && (
                        <div className="flex gap-2">
                          {[13, 6, 3].map(r => (
                            <button key={r} type="button" onClick={() => setForm(p => ({ ...p, tax_rate: String(r) }))}
                              className="px-3 py-1.5 rounded-md text-[11px] font-medium transition-all"
                              style={Number(form.tax_rate) === r ? { background: "var(--accent-light)", color: "var(--accent)", border: "1px solid var(--accent)" } : { background: "var(--surface-alt)", color: "var(--text-secondary)" }}>
                              {r}%
                            </button>
                          ))}
                          <input type="number" min="0" max="100" step="0.01" value={form.tax_rate} onChange={e => setForm(p => ({ ...p, tax_rate: e.target.value }))} placeholder={t("money.form.customTaxPlaceholder" as any)} className="input-base flex-1 px-3 py-1.5 text-[11px] min-w-0" />
                        </div>
                      )}
                    </FL>
                    <div className="border-t" style={{ borderColor: "var(--border)" }} />
                    <span className="section-label">{t("pipeline.clients.projectTimeline" as any)}</span>
                    <div className="grid grid-cols-2 gap-3">
                      <FL label={t("pipeline.clients.projectStart" as any)}><input type="date" value={form.subscription_start_date} onChange={e => setForm(p => ({ ...p, subscription_start_date: e.target.value }))} className="input-base w-full px-3 py-2 text-[13px]" /></FL>
                      <FL label={t("pipeline.clients.projectEnd" as any)}><input type="date" value={form.project_end_date} onChange={e => setForm(p => ({ ...p, project_end_date: e.target.value }))} className="input-base w-full px-3 py-2 text-[13px]" /></FL>
                    </div>

                    {/* ═══ Payment Milestones ═══ */}
                    {editId && (
                      <>
                        <div className="border-t" style={{ borderColor: "var(--border)" }} />
                        <div className="flex items-center justify-between">
                          <span className="section-label flex items-center gap-1.5"><DollarSign size={13} /> {t("pipeline.milestones.title" as any)}</span>
                          <button onClick={() => { setShowAddMs(true); setEditMsId(null); setMsForm(emptyMs); }} className="btn-ghost text-[11px] flex items-center gap-1" style={{ color: "var(--accent)" }}><Plus size={12} /> {t("pipeline.milestones.add" as any)}</button>
                        </div>

                        {/* Progress bar */}
                        {milestones.length > 0 && (() => {
                          const totalAmt = milestones.reduce((s: number, m: any) => s + Number(m.amount || 0), 0);
                          const paidAmt = milestones.filter((m: any) => m.status === "paid").reduce((s: number, m: any) => s + Number(m.amount || 0), 0);
                          const pct = totalAmt > 0 ? Math.round(paidAmt / totalAmt * 100) : 0;
                          return (
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                                  {milestones.filter((m: any) => m.status === "paid").length}/{milestones.length} {t("pipeline.milestones.status.paid" as any).toLowerCase()} · ${paidAmt.toLocaleString()} / ${totalAmt.toLocaleString()}
                                </span>
                                <span className="text-[11px] font-semibold tabular-nums" style={{ color: pct === 100 ? "var(--success)" : "var(--accent)" }}>{pct}%</span>
                              </div>
                              <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-alt)" }}>
                                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: pct === 100 ? "var(--success)" : "var(--accent)" }} />
                              </div>
                            </div>
                          );
                        })()}

                        {/* Milestone list */}
                        {msLoading ? (
                          <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin" style={{ color: "var(--text-tertiary)" }} /></div>
                        ) : milestones.length === 0 && !showAddMs ? (
                          <div className="text-center py-4 text-[12px]" style={{ color: "var(--text-tertiary)" }}>{t("pipeline.milestones.noPlan" as any)}</div>
                        ) : (
                          <div className="space-y-2">
                            {milestones.map((ms: any) => (
                              <div key={ms.id} className="rounded-lg p-3 space-y-2" style={{ background: "var(--surface-alt)", border: "1px solid var(--border)" }}>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    {ms.status === "paid" ? <CircleCheck size={14} style={{ color: "var(--success)" }} /> : ms.status === "overdue" ? <AlertCircle size={14} style={{ color: "var(--danger)" }} /> : <Clock size={14} style={{ color: "var(--text-tertiary)" }} />}
                                    <span className="text-[13px] font-medium" style={{ color: "var(--text)" }}>{ms.label}</span>
                                    <span className="badge text-[10px]" style={
                                      ms.status === "paid" ? { background: "var(--success-light)", color: "var(--success)" }
                                      : ms.status === "overdue" ? { background: "color-mix(in srgb, var(--danger) 12%, transparent)", color: "var(--danger)" }
                                      : { background: "color-mix(in srgb, var(--warning) 12%, transparent)", color: "var(--warning)" }
                                    }>{t(`pipeline.milestones.status.${ms.status}` as any)}</span>
                                  </div>
                                  <span className="text-[13px] font-semibold tabular-nums" style={{ color: "var(--text)" }}>${Number(ms.amount || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex items-center gap-3 text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                                  {ms.percentage > 0 && <span>{ms.percentage}%</span>}
                                  {ms.due_date && <span>{t("pipeline.milestones.dueDate" as any)}: {ms.due_date}</span>}
                                  {ms.paid_date && <span>{t("pipeline.milestones.paidDate" as any)}: {ms.paid_date}</span>}
                                  {ms.payment_method && <span>{t(`pipeline.milestones.method.${ms.payment_method}` as any)}</span>}
                                </div>
                                {ms.note && <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{ms.note}</div>}
                                {ms.status !== "paid" && (
                                  <div className="flex items-center gap-2 pt-1">
                                    <button onClick={() => { setMarkPaidId(ms.id); setMarkPaidMethod("bank_transfer"); }} className="text-[11px] font-medium px-2.5 py-1 rounded-md flex items-center gap-1" style={{ background: "var(--success-light)", color: "var(--success)" }}>
                                      <CircleCheck size={11} /> {t("pipeline.milestones.markPaid" as any)}
                                    </button>
                                    <button onClick={() => { setEditMsId(ms.id); setMsForm({ label: ms.label, amount: String(ms.amount), percentage: String(ms.percentage || ""), due_date: ms.due_date || "", note: ms.note || "" }); setShowAddMs(true); }} className="btn-ghost text-[11px] p-1"><Edit2 size={11} /></button>
                                    <button onClick={() => deleteMilestone(ms.id)} className="btn-ghost text-[11px] p-1" style={{ color: "var(--danger)" }}><Trash2 size={11} /></button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add / Edit milestone form */}
                        <AnimatePresence>
                          {showAddMs && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                              <div className="rounded-lg p-3 space-y-3" style={{ background: "var(--surface-alt)", border: "1px solid var(--accent)", borderStyle: "dashed" }}>
                                <div className="flex items-center justify-between">
                                  <span className="text-[12px] font-semibold" style={{ color: "var(--text)" }}>{editMsId ? t("common.edit" as any) : t("pipeline.milestones.add" as any)}</span>
                                  <button onClick={() => { setShowAddMs(false); setEditMsId(null); setMsForm(emptyMs); }} className="btn-ghost p-0.5"><X size={13} /></button>
                                </div>
                                {/* Preset buttons */}
                                {!editMsId && (
                                  <div className="flex gap-1.5">
                                    {(["deposit", "midway", "final"] as const).map(p => (
                                      <button key={p} onClick={() => applyPreset(p)} className="text-[10px] font-medium px-2 py-1 rounded-md transition-colors" style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)", color: "var(--accent)" }}>
                                        {t(`pipeline.milestones.presets.${p}` as any)}
                                      </button>
                                    ))}
                                  </div>
                                )}
                                <FL label={t("pipeline.milestones.label" as any)}><input value={msForm.label} onChange={e => setMsForm(p => ({ ...p, label: e.target.value }))} className="input-base w-full px-3 py-2 text-[13px]" placeholder={t("pipeline.milestones.presets.deposit" as any)} /></FL>
                                <div className="grid grid-cols-2 gap-3">
                                  <FL label={t("pipeline.milestones.amount" as any)}><input type="number" min="0" value={msForm.amount} onChange={e => { const amt = e.target.value; const fee = Number(form.project_fee) || 1; setMsForm(p => ({ ...p, amount: amt, percentage: fee > 0 ? String(Math.round(Number(amt) / fee * 100)) : p.percentage })); }} className="input-base w-full px-3 py-2 text-[13px]" /></FL>
                                  <FL label={t("pipeline.milestones.percentage" as any)}><input type="number" min="0" max="100" value={msForm.percentage} onChange={e => { const pct = e.target.value; const fee = Number(form.project_fee) || 0; setMsForm(p => ({ ...p, percentage: pct, amount: fee > 0 ? String(Math.round(fee * Number(pct) / 100)) : p.amount })); }} className="input-base w-full px-3 py-2 text-[13px]" /></FL>
                                </div>
                                <FL label={t("pipeline.milestones.dueDate" as any)}><input type="date" value={msForm.due_date} onChange={e => setMsForm(p => ({ ...p, due_date: e.target.value }))} className="input-base w-full px-3 py-2 text-[13px]" /></FL>
                                <FL label={t("pipeline.milestones.note" as any)}><input value={msForm.note} onChange={e => setMsForm(p => ({ ...p, note: e.target.value }))} className="input-base w-full px-3 py-2 text-[13px]" /></FL>
                                <div className="flex justify-end gap-2">
                                  <button onClick={() => { setShowAddMs(false); setEditMsId(null); setMsForm(emptyMs); }} className="btn-secondary text-[12px]">{t("common.cancel" as any)}</button>
                                  <button onClick={saveMilestone} disabled={!msForm.label || !msForm.amount} className="btn-primary text-[12px]">{t("common.save" as any)}</button>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Mark Paid confirmation modal */}
                        {markPaidId && (
                          <div className="rounded-lg p-3 space-y-3" style={{ background: "color-mix(in srgb, var(--success) 6%, var(--surface))", border: "1px solid var(--success)" }}>
                            <div className="text-[12px] font-medium" style={{ color: "var(--text)" }}>{t("pipeline.milestones.markPaidConfirm" as any)}</div>
                            <FL label={t("pipeline.milestones.paymentMethod" as any)}>
                              <select value={markPaidMethod} onChange={e => setMarkPaidMethod(e.target.value)} className="input-base w-full px-3 py-2 text-[13px]">
                                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{t(`pipeline.milestones.method.${m}` as any)}</option>)}
                              </select>
                            </FL>
                            <div className="flex justify-end gap-2">
                              <button onClick={() => setMarkPaidId(null)} className="btn-secondary text-[12px]">{t("common.cancel" as any)}</button>
                              <button onClick={confirmMarkPaid} className="text-[12px] font-semibold px-3 py-1.5 rounded-lg text-white" style={{ background: "var(--success)" }}>
                                <Check size={12} className="inline mr-1" />{t("pipeline.milestones.markPaid" as any)}
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}

                {/* ═══ Financial Transactions ═══ */}
                {editId && (
                  <>
                    <div className="border-t" style={{ borderColor: "var(--border)" }} />
                    <div className="flex items-center justify-between">
                      <span className="section-label flex items-center gap-1.5"><DollarSign size={13} /> {t("pipeline.tx.title" as any)}</span>
                      <button onClick={() => { setShowTxForm(true); setEditTxId(null); setTxForm({ ...emptyTx, taxMode: (form.tax_mode || "none") as any, taxRate: form.tax_rate || "" }); }} className="btn-ghost text-[11px] flex items-center gap-1" style={{ color: "var(--accent)" }}><Plus size={12} /> {t("pipeline.tx.add" as any)}</button>
                    </div>

                    {/* Summary bar */}
                    {clientTxs.length > 0 && (() => {
                      const received = clientTxs.filter((tx: any) => tx.type === "income" && (tx.status || "已完成") === "已完成").reduce((s: number, tx: any) => s + Number(tx.amount || 0), 0);
                      const pending = clientTxs.filter((tx: any) => (tx.status || "").includes("应收")).reduce((s: number, tx: any) => s + Number(tx.amount || 0), 0);
                      const expense = clientTxs.filter((tx: any) => tx.type === "expense" && (tx.status || "已完成") === "已完成").reduce((s: number, tx: any) => s + Number(tx.amount || 0), 0);
                      return (
                        <div className="flex items-center gap-3 text-[11px] font-medium">
                          <span style={{ color: "var(--success)" }}>{t("pipeline.tx.received" as any)} ${received.toLocaleString()}</span>
                          {pending > 0 && <span style={{ color: "var(--warning)" }}>{t("pipeline.tx.pending" as any)} ${pending.toLocaleString()}</span>}
                          {expense > 0 && <span style={{ color: "var(--text-secondary)" }}>{t("pipeline.tx.expense" as any)} ${expense.toLocaleString()}</span>}
                        </div>
                      );
                    })()}

                    {/* Transaction list */}
                    {clientTxs.length > 0 ? (
                      <div className="space-y-2">
                        {clientTxs.map((tx: any) => (
                          <div key={tx.id} className="rounded-lg p-3 space-y-1" style={{ background: "var(--surface-alt)", border: "1px solid var(--border)" }}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span className="text-[12px] font-semibold shrink-0" style={{ color: tx.type === "income" ? "var(--success)" : "var(--text)" }}>
                                  {tx.type === "income" ? "+" : "-"}${Math.abs(tx.amount).toLocaleString()}
                                </span>
                                <span className="text-[12px] font-medium truncate" style={{ color: "var(--text)" }}>{tx.description || tx.desc}</span>
                              </div>
                              {!tx.source && (
                                <div className="flex items-center gap-1 shrink-0">
                                  <button onClick={() => { setEditTxId(tx.id); setTxForm({ date: tx.date, desc: tx.description || tx.desc, category: tx.category, amount: String(Math.abs(tx.amount)), status: tx.status || "已完成", taxMode: tx.tax_mode || "none", taxRate: tx.tax_rate ? String(tx.tax_rate) : "" }); setShowTxForm(true); }} className="btn-ghost p-1"><Edit2 size={11} /></button>
                                  <button onClick={() => deleteTx(tx.id)} className="btn-ghost p-1" style={{ color: "var(--danger)" }}><Trash2 size={11} /></button>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>{tx.date}</span>
                              <span className="badge text-[9px]">{catLabel(tx.category, t)}</span>
                              <span className="badge text-[9px]" style={{
                                background: (tx.status || "已完成") === "已完成" ? "var(--success-light)" : (tx.status || "").includes("应收") ? "var(--warning-light)" : "var(--danger-light)",
                                color: (tx.status || "已完成") === "已完成" ? "var(--success)" : (tx.status || "").includes("应收") ? "var(--warning)" : "var(--danger)",
                              }}>{stLabel(tx.status || "已完成", t)}</span>
                              {tx.source === "client_subscription" && <span className="badge text-[9px]" style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)", color: "var(--accent)" }}>{t("money.badge.subscription" as any)}</span>}
                              {tx.source === "client_project" && <span className="badge text-[9px]" style={{ background: "color-mix(in srgb, var(--warning) 12%, transparent)", color: "var(--warning)" }}>{t("money.badge.project" as any)}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : !showTxForm && (
                      <div className="text-center py-3 text-[12px]" style={{ color: "var(--text-tertiary)" }}>{t("pipeline.tx.empty" as any)}</div>
                    )}

                    {/* Add/Edit transaction form */}
                    <AnimatePresence>
                      {showTxForm && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                          <div className="rounded-lg p-3 space-y-3" style={{ background: "var(--surface-alt)", border: "1px solid var(--accent)", borderStyle: "dashed" }}>
                            <div className="flex items-center justify-between">
                              <span className="text-[12px] font-semibold" style={{ color: "var(--text)" }}>{editTxId ? t("common.edit" as any) : t("pipeline.tx.add" as any)}</span>
                              <button onClick={() => { setShowTxForm(false); setEditTxId(null); setTxForm(emptyTx); }} className="btn-ghost p-0.5"><X size={13} /></button>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <FL label={t("pipeline.tx.date" as any)}><input type="date" value={txForm.date} onChange={e => setTxForm(p => ({ ...p, date: e.target.value }))} className="input-base w-full px-3 py-2 text-[13px]" /></FL>
                              <FL label={t("pipeline.tx.category" as any)}><select value={txForm.category} onChange={e => setTxForm(p => ({ ...p, category: e.target.value }))} className="input-base w-full px-3 py-2 text-[13px]">{TX_CATEGORIES.map(c => <option key={c} value={c}>{catLabel(c, t)}</option>)}</select></FL>
                            </div>
                            <FL label={t("pipeline.tx.description" as any)}><input value={txForm.desc} onChange={e => setTxForm(p => ({ ...p, desc: e.target.value }))} className="input-base w-full px-3 py-2 text-[13px]" /></FL>
                            <div className="grid grid-cols-2 gap-3">
                              <FL label={t("pipeline.tx.amount" as any)}>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px]" style={{ color: "var(--text-tertiary)" }}>$</span>
                                  <input type="number" min="0" step="0.01" value={txForm.amount} onChange={e => setTxForm(p => ({ ...p, amount: e.target.value }))} className="input-base w-full pl-7 pr-3 py-2 text-[13px]" />
                                </div>
                              </FL>
                              <FL label={t("pipeline.tx.status" as any)}><select value={txForm.status} onChange={e => setTxForm(p => ({ ...p, status: e.target.value }))} className="input-base w-full px-3 py-2 text-[13px]">{TX_STATUSES.map(s => <option key={s} value={s}>{stLabel(s, t)}</option>)}</select></FL>
                            </div>
                            {/* Tax */}
                            <FL label={t("pipeline.clients.taxSetting" as any)}>
                              <div className="flex gap-2 mb-2">
                                {([["none", t("money.form.taxNone" as any)], ["exclusive", t("money.form.taxExclBtn" as any)], ["inclusive", t("money.form.taxIncl" as any)]] as [string, string][]).map(([mode, label]) => (
                                  <button key={mode} type="button" onClick={() => setTxForm(p => ({ ...p, taxMode: mode as any }))}
                                    className="flex-1 py-1.5 rounded-lg text-[12px] font-medium transition-all"
                                    style={txForm.taxMode === mode ? { background: "var(--text)", color: "var(--bg)" } : { background: "var(--surface-alt)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                                    {label}
                                  </button>
                                ))}
                              </div>
                              {txForm.taxMode !== "none" && (
                                <div className="flex gap-2">
                                  {[13, 6, 3].map(r => (
                                    <button key={r} type="button" onClick={() => setTxForm(p => ({ ...p, taxRate: String(r) }))}
                                      className="px-3 py-1.5 rounded-md text-[11px] font-medium transition-all"
                                      style={Number(txForm.taxRate) === r ? { background: "var(--accent-light)", color: "var(--accent)", border: "1px solid var(--accent)" } : { background: "var(--surface-alt)", color: "var(--text-secondary)" }}>
                                      {r}%
                                    </button>
                                  ))}
                                  <input type="number" min="0" max="100" step="0.01" value={txForm.taxRate} onChange={e => setTxForm(p => ({ ...p, taxRate: e.target.value }))} placeholder={t("money.form.customTaxPlaceholder" as any)} className="input-base flex-1 px-3 py-1.5 text-[11px] min-w-0" />
                                </div>
                              )}
                            </FL>
                            <div className="flex justify-end gap-2">
                              <button onClick={() => { setShowTxForm(false); setEditTxId(null); setTxForm(emptyTx); }} className="btn-secondary text-[12px]">{t("common.cancel" as any)}</button>
                              <button onClick={saveTx} disabled={!txForm.desc || !txForm.amount} className="btn-primary text-[12px]">{t("common.save" as any)}</button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}
              </div>
              <div className="flex items-center justify-between px-5 py-3 border-t pb-safe" style={{ borderColor: "var(--border)" }}>
                {editId ? <button type="button" onClick={() => deleteClient(editId)} className="btn-ghost text-[12px]" style={{ color: "var(--danger)" }}><Trash2 size={13} /> {t("common.delete" as any)}</button> : <div />}
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowPanel(false)} className="btn-secondary text-[13px]">{t("common.cancel" as any)}</button>
                  <button type="button" onClick={saveClient} className="btn-primary text-[13px]">{editId ? t("common.save" as any) : t("common.create" as any)}</button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

/* ── Shared sub-components ──────────────────────────────────────── */
function Toast({ msg }: { msg: string }) {
  return <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 px-4 py-2 rounded-lg z-[9999] flex items-center gap-2 text-[13px] font-medium" style={{ background: "var(--text)", color: "var(--bg)", boxShadow: "var(--shadow-lg)" }}><Check size={14} style={{ color: "var(--success)" }} /> {msg}</div>;
}

function FL({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`flex flex-col gap-1 ${className || ""}`}><span className="section-label">{label}</span>{children}</label>;
}

/* ── Lead column (kanban) ───────────────────────────────────────── */
function LeadColumn({ col, items, onAdd, onEdit, onDelete, emptyText }: { col: { id: string; title: string; color: string }; items: any[]; onAdd: () => void; onEdit: (l: any) => void; onDelete: (id: number) => void; emptyText: string }) {
  return (
    <div className="flex flex-col w-[280px] shrink-0 h-full">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: col.color }} />
          <h3 className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>{col.title}</h3>
          <span className="text-[11px] font-medium tabular-nums" style={{ color: "var(--text-tertiary)" }}>{items.length}</span>
        </div>
        <button onClick={onAdd} className="btn-ghost p-0.5"><Plus size={13} /></button>
      </div>
      <Droppable droppableId={col.id}>
        {(provided, snapshot) => (
          <div {...provided.droppableProps} ref={provided.innerRef}
            className="flex flex-col flex-1 min-h-0 rounded-xl overflow-hidden"
            style={{ background: snapshot.isDraggingOver ? "var(--accent-light)" : "var(--surface-alt)", borderTop: `2px solid ${col.color}`, transition: "background 0.15s" }}>
            <div className="flex-1 overflow-y-auto p-1.5 space-y-1 ios-scroll">
              {!items.length && <div className="py-8 text-center text-[11px]" style={{ color: "var(--text-tertiary)" }}>{emptyText}</div>}
              {items.map((lead: any, i: number) => (
                // @ts-expect-error React 19 type issue
                <Draggable key={lead.id.toString()} draggableId={lead.id.toString()} index={i}>
                  {(prov: any, snap: any) => <LeadCard lead={lead} provided={prov} snapshot={snap} onEdit={onEdit} onDelete={onDelete} />}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          </div>
        )}
      </Droppable>
    </div>
  );
}

function LeadCard({ lead, provided, snapshot, onEdit, onDelete }: any) {
  const hasDraft = Boolean(lead.aiDraft);
  const card = (
    <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}
      style={{ ...provided.draggableProps.style, touchAction: "none" } as React.CSSProperties}
      onClick={() => onEdit(lead)}
      className={`group card-interactive cursor-pointer p-3 ${snapshot.isDragging ? "rotate-[2deg] scale-[1.02] !shadow-lg z-[9999]" : ""}`}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="min-w-0">
          <h4 className="text-[13px] font-medium truncate" style={{ color: "var(--text)" }}>{lead.name}</h4>
          <p className="text-[11px] truncate mt-0.5" style={{ color: "var(--text-tertiary)" }}>{lead.industry}</p>
        </div>
        {lead.source && <span className="badge">{lead.source}</span>}
      </div>
      <p className="text-[11px] line-clamp-2 mb-1.5" style={{ color: "var(--text-secondary)" }}>{lead.needs}</p>
      <div className="flex items-center justify-between">
        <span className="badge" style={hasDraft ? { background: "var(--success-light)", color: "var(--success)" } : undefined}><Mail size={9} /> {hasDraft ? "Draft" : "—"}</span>
        <button onClick={e => { e.stopPropagation(); onDelete(lead.id); }} className="p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--text-tertiary)" }}><Trash2 size={11} /></button>
      </div>
    </div>
  );
  return snapshot.isDragging ? createPortal(card, document.body) : card;
}

function LeadSwimlane({ leads, columns, onAdd, onEdit, onDelete, onMove, emptyText }: any) {
  return (
    <div className="flex-1 overflow-y-auto ios-scroll space-y-2 pb-4">
      {columns.map((col: any) => {
        const items: any[] = leads[col.id] || [];
        return (
          <div key={col.id} className="card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: "var(--border)", borderTop: `2px solid ${col.color}` }}>
              <div className="flex items-center gap-2"><h3 className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>{col.title}</h3><span className="text-[11px] font-medium tabular-nums" style={{ color: "var(--text-tertiary)" }}>{items.length}</span></div>
              <button onClick={() => onAdd(null, col.id)} className="btn-ghost p-0.5"><Plus size={13} /></button>
            </div>
            {!items.length ? <div className="px-4 py-4 text-[12px] text-center" style={{ color: "var(--text-tertiary)" }}>{emptyText}</div> : (
              <div className="overflow-x-auto ios-scroll"><div className="flex gap-2 p-2.5 min-w-max">
                {items.map((lead: any) => (
                  <div key={lead.id} onClick={() => onEdit(lead, col.id)} className="w-[200px] shrink-0 cursor-pointer card-interactive p-3 group">
                    <h4 className="text-[13px] font-medium truncate mb-1" style={{ color: "var(--text)" }}>{lead.name}</h4>
                    <p className="text-[11px] truncate mb-1" style={{ color: "var(--text-tertiary)" }}>{lead.industry}</p>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t" style={{ borderColor: "var(--border)" }} onClick={e => e.stopPropagation()}>
                      <select value={col.id} onChange={e => onMove(lead.id, e.target.value)} className="appearance-none text-[10px] font-medium pl-2 pr-4 py-0.5 rounded-md cursor-pointer input-base">{columns.map((c: any) => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
                      <button onClick={() => onDelete(lead.id)} className="p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--text-tertiary)" }}><Trash2 size={11} /></button>
                    </div>
                  </div>
                ))}
              </div></div>
            )}
          </div>
        );
      })}
    </div>
  );
}
