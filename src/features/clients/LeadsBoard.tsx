import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Plus, Trash2, Edit2, X, UserPlus, LayoutGrid, AlignJustify,
  ChevronDown, PanelRightClose, Sparkles, Search, Copy, RefreshCw, Loader2, Download,
} from "lucide-react";
import { useLeadAI } from "./useLeadAI";
import type { LeadAnalysis } from "./useLeadAI";
import { exportCSV } from "../../lib/csv-export";
import { todayDateKey } from "../../lib/date-utils";
import {
  DndContext, DragOverlay, closestCorners,
  PointerSensor, TouchSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, AnimatePresence } from "motion/react";
import { createPortal } from "react-dom";
import { useT } from "../../i18n/context";
import { useRealtimeRefresh } from "../../hooks/useRealtimeRefresh";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useUIStore } from "../../store/useUIStore";
import { Skeleton } from "../../components/ui";

const LEADS_TABLES = ['leads', 'plans'] as const;

const EMPTY_LEAD = { name: "", industry: "", needs: "", website: "", column: "new", source: "" };

/* ── Type definitions ── */
interface Lead {
  id: number;
  name: string;
  industry?: string;
  needs?: string;
  website?: string;
  column: "new" | "contacted" | "proposal" | "won" | "lost";
  source?: string;
  [key: string]: any;
}

interface PlanRow {
  id: number;
  name: string;
  price: number;
  [key: string]: any;
}

interface LeadsState {
  new: Lead[];
  contacted: Lead[];
  proposal: Lead[];
  won: Lead[];
  lost: Lead[];
}

/* ── Constants ─────────────────────────────────────────────────── */
export const LEAD_COL_IDS = [
  { id: "new", color: "var(--color-text-secondary)" },
  { id: "contacted", color: "var(--color-info)" },
  { id: "proposal", color: "var(--color-warning)" },
  { id: "won", color: "var(--color-success)" },
  { id: "lost", color: "var(--color-danger)" },
] as const;

/* ── Shared sub-components ─────────────────────────────────────── */
export function FL({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`flex flex-col gap-1 ${className || ""}`}><span className="section-label">{label}</span>{children}</label>;
}

/* ══════════════════════════════════════════════════════════════════
   LEADS VIEW
   ══════════════════════════════════════════════════════════════════ */
export function LeadsView() {
  const { t, lang } = useT();
  const showToast = useUIStore((s) => s.showToast);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const LEAD_COLS = useMemo(() => LEAD_COL_IDS.map(c => ({
    ...c,
    title: t(`pipeline.col.${c.id}` as any),
  })), [t]);
  const [leads, setLeads] = useState<LeadsState>({ new: [], contacted: [], proposal: [], won: [], lost: [] });
  const [showFunnel, setShowFunnel] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showPanel, setShowPanel] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [converting, setConverting] = useState(false);
  const [showConvert, setShowConvert] = useState(false);
  const isMobile = useIsMobile();
  const viewMode = useUIStore((s) => s.salesViewMode);
  const setViewMode = useUIStore((s) => s.setSalesViewMode);
  const [convertForm, setConvertForm] = useState({ plan_tier: "", status: "Active", mrr: "", subscription_start_date: todayDateKey(), billing_type: "subscription" as "subscription" | "project", project_fee: "" });
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [form, setForm] = useState(EMPTY_LEAD);
  const ai = useLeadAI(lang);

  const fetchPlans = async () => { try { const d = await (await fetch("/api/plans")).json(); setPlans(Array.isArray(d) ? d : []); } catch {} };

  const fetchLeads = async () => {
    try {
      const res = await fetch("/api/leads");
      const raw = await res.json();
      const data = Array.isArray(raw) ? raw : [];
      setLeads({ new: data.filter((l: any) => l.column === "new"), contacted: data.filter((l: any) => l.column === "contacted"), proposal: data.filter((l: any) => l.column === "proposal"), won: data.filter((l: any) => l.column === "won"), lost: data.filter((l: any) => l.column === "lost") });
    } catch { showToast(t("pipeline.toast.loadFailed" as any)); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchLeads(); fetchPlans(); }, []);
  useRealtimeRefresh(LEADS_TABLES, fetchLeads);
  useEffect(() => {
    const show = isMobile && (showPanel || showConvert);
    window.dispatchEvent(new CustomEvent("mobile-nav-visibility", { detail: { hidden: show } }));
    return () => { window.dispatchEvent(new CustomEvent("mobile-nav-visibility", { detail: { hidden: false } })); };
  }, [showPanel, showConvert, isMobile]);

  /* ── Quick create listener ── */
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.type === "lead") {
        openPanel(null, "new");
      }
    };
    window.addEventListener("quick-create", handler);
    return () => window.removeEventListener("quick-create", handler);
  }, []);

  const openPanel = (lead: any = null, col = "new") => {
    if (lead) {
      setEditId(lead.id);
      setForm({ name: lead.name, industry: lead.industry, needs: lead.needs, website: lead.website || "", column: lead.column || col, source: lead.source || "" });
      ai.resetForPanel(lead.aiDraft || "");
    } else {
      setEditId(null);
      setForm({ ...EMPTY_LEAD, column: col });
      ai.resetForPanel();
    }
    setShowPanel(true);
  };

  const [nameError, setNameError] = useState(false);
  const [savingLead, setSavingLead] = useState(false);

  const saveLead = async () => {
    if (!form.name.trim()) { setNameError(true); return; }
    setNameError(false);
    setSavingLead(true);
    try {
      if (editId) { await fetch(`/api/leads/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }); showToast(t("pipeline.toast.leadUpdated" as any)); }
      else { await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }); showToast(t("pipeline.toast.leadAdded" as any)); }
      setShowPanel(false); fetchLeads();
    } catch { showToast(t("common.saveFailed" as any)); }
    finally { setSavingLead(false); }
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

  const convertLead = async () => {
    if (!editId) return; setConverting(true);
    try {
      const mrrVal = parseFloat(convertForm.mrr); const projVal = parseFloat(convertForm.project_fee);
      await fetch(`/api/leads/${editId}/convert`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan_tier: convertForm.plan_tier, status: convertForm.status, mrr: isNaN(mrrVal) ? 0 : mrrVal, subscription_start_date: convertForm.subscription_start_date, billing_type: convertForm.billing_type, project_fee: isNaN(projVal) ? 0 : projVal }) });
      setShowConvert(false); setShowPanel(false); showToast(t("pipeline.convert.success" as any)); fetchLeads();
    } catch { showToast(t("pipeline.convert.failed" as any)); }
    finally { setConverting(false); }
  };

  return (
    <>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <div className="segment-switcher">
          {([["vertical", <LayoutGrid size={14} key="v" />, "Board view"], ["horizontal", <AlignJustify size={14} key="h" />, "List view"]] as const).map(([m, icon, label]) => (
            <button key={m} onClick={() => setViewMode(m)} data-active={viewMode === m} aria-label={label}>{icon}</button>
          ))}
        </div>
        <button onClick={() => setShowFunnel(f => !f)} className={`btn-ghost compact gap-1 ${showFunnel ? "ring-1" : ""}`} style={showFunnel ? { color: "var(--color-accent)", borderColor: "var(--color-accent)" } : undefined}>
          <ChevronDown size={14} style={{ transform: showFunnel ? "rotate(180deg)" : undefined, transition: "transform 0.2s" }} /> {t("pipeline.funnel.title" as any)}
        </button>
        <div className="flex-1" />
        <button
          onClick={() => ai.handleBatchAnalyze((Object.values(leads) as any[]).flat())}
          disabled={ai.batchAnalyzing}
          className="btn-ghost compact gap-1 disabled:opacity-40"
        >
          {ai.batchAnalyzing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          <span className="hidden sm:inline">{t("pipeline.ai.analyzeAll" as any)}</span>
        </button>
        <button onClick={() => {
          const all = Object.values(leads).flat();
          exportCSV(all.map((l: any) => ({ name: l.name, industry: l.industry, source: l.source, needs: l.needs, stage: l.column })), "leads", [
            { key: "name", label: "Name" }, { key: "industry", label: "Industry" }, { key: "source", label: "Source" }, { key: "needs", label: "Needs" }, { key: "stage", label: "Stage" },
          ]);
        }} className="btn-ghost compact"><Download size={16} /></button>
        <button onClick={() => openPanel(null, "new")} className="btn-primary compact"><Plus size={16} /> <span className="hidden sm:inline">{t("pipeline.addLead" as any)}</span></button>
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
                    <div className="flex-1 rounded-[var(--radius-4)] h-8 flex items-center justify-between px-3 text-[15px] transition-all" style={{ background: `color-mix(in srgb, ${col.color} 15%, transparent)`, color: col.color, maxWidth: `${maxW}%`, fontWeight: "var(--font-weight-medium)" as any }}>
                      <span>{col.title}</span>
                      <span className="tabular-nums">{count} ({pct}%)</span>
                    </div>
                  </div>
                );
              })}
              {/* Lost row */}
              {(leads.lost?.length || 0) > 0 && (
                <div className="flex items-center gap-3 mt-1 pt-1 border-t" style={{ borderColor: "var(--color-border-primary)" }}>
                  <div className="flex-1 rounded-[var(--radius-4)] h-7 flex items-center justify-between px-3 text-[13px]" style={{ background: "color-mix(in srgb, var(--color-danger) 10%, transparent)", color: "var(--color-danger)", fontWeight: "var(--font-weight-medium)" as any }}>
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
        <div className="flex-1 flex gap-3 animate-skeleton-in">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex-1 min-w-0 space-y-2">
              <Skeleton className="h-4 w-20" />
              <div className="space-y-1.5 p-1.5 rounded-[var(--radius-12)]" style={{ background: "var(--color-bg-tertiary)" }}>
                <Skeleton className="h-[72px] rounded-[var(--radius-12)]" />
                <Skeleton className="h-[72px] rounded-[var(--radius-12)]" />
              </div>
            </div>
          ))}
        </div>
      ) : viewMode === "vertical" ? (
        <LeadKanban leads={leads} columns={LEAD_COLS} onDragEnd={onDragEnd} onAdd={openPanel} onEdit={openPanel} onDelete={(id: number) => setDeleteId(id)} emptyText={t("pipeline.emptyCol" as any)} leadScores={ai.leadScores} />
      ) : (
        <LeadSwimlane leads={leads} columns={LEAD_COLS} onDragEnd={onDragEnd} onAdd={openPanel} onEdit={openPanel} onDelete={(id: number) => setDeleteId(id)} emptyText={t("pipeline.emptyCol" as any)} onMove={async (id: number, col: string) => {
          try {
            const allLeads = Object.values(leads).flat();
            const lead = allLeads.find((l: any) => l.id === id) as Lead | undefined;
            if (!lead) return;
            await fetch(`/api/leads/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...lead, column: col }) }); fetchLeads();
          } catch { showToast(t("pipeline.toast.moveFailed" as any)); }
        }} />
      )}

      {/* ═══ Lead Side Panel ═══ */}
      {createPortal(<AnimatePresence>
        {showPanel && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }} className="fixed inset-0" style={{ zIndex: "var(--layer-dialog-overlay)", background: "var(--color-overlay-primary)", backdropFilter: "blur(2px) saturate(180%)", WebkitBackdropFilter: "blur(2px) saturate(180%)" }} onClick={() => setShowPanel(false)} />
            <motion.div
              initial={{ x: isMobile ? 0 : "100%", y: isMobile ? "100%" : 0 }}
              animate={{ x: 0, y: 0 }}
              exit={{ x: isMobile ? 0 : "100%", y: isMobile ? "100%" : 0 }}
              transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
              role="dialog"
              aria-modal="true"
              aria-label="Lead detail"
              className={isMobile ? "fixed inset-0 flex flex-col" : "fixed top-0 right-0 h-full w-full max-w-[440px] lg:max-w-[520px] flex flex-col border-l"}
              style={{ zIndex: "var(--layer-dialog)", background: "var(--color-bg-primary)", borderColor: "var(--color-border-primary)", boxShadow: "var(--shadow-high)", paddingTop: isMobile ? "var(--mobile-header-pt, env(safe-area-inset-top, 0px))" : undefined }}
            >
              <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "var(--color-border-primary)" }}>
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-6)]" style={{ background: "var(--color-accent-tint)", color: "var(--color-accent)" }}>{editId ? <Edit2 size={16} /> : <Plus size={16} />}</div>
                  <span className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" as any }}>{editId ? t("pipeline.panel.editLead" as any) : t("pipeline.panel.newLead" as any)}</span>
                </div>
                <button onClick={() => setShowPanel(false)} className="btn-icon" aria-label="Close panel">{isMobile ? <X size={18} /> : <PanelRightClose size={18} />}</button>
              </div>
              <div className="flex-1 overflow-y-auto overflow-x-hidden ios-scroll p-5 space-y-3">
                <div className="space-y-3">
                  <FL label={t("pipeline.form.name" as any)}><input required value={form.name} onChange={e => { setForm(p => ({ ...p, name: e.target.value })); setNameError(false); }} className="input-base w-full px-3 py-2 text-[15px]" style={nameError ? { borderColor: "var(--color-danger)", boxShadow: "0 0 0 2px color-mix(in srgb, var(--color-danger) 15%, transparent)" } : undefined} /></FL>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FL label={t("pipeline.form.industry" as any)}><input value={form.industry} onChange={e => setForm(p => ({ ...p, industry: e.target.value }))} className="input-base w-full px-3 py-2 text-[15px]" /></FL>
                    <FL label={t("pipeline.form.source" as any)}>
                      <input list="source-presets" value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))} placeholder={t("pipeline.form.sourcePlaceholder" as any)} className="input-base w-full px-3 py-2 text-[15px]" />
                      <datalist id="source-presets">
                        {["LinkedIn", "Twitter / X", "Instagram", t("pipeline.source.referral" as any), t("pipeline.source.website" as any), t("pipeline.source.event" as any), t("pipeline.source.coldOutreach" as any), t("pipeline.source.other" as any)].map(s => <option key={s} value={s} />)}
                      </datalist>
                    </FL>
                  </div>
                  <FL label={t("pipeline.form.needs" as any)}><input value={form.needs} onChange={e => setForm(p => ({ ...p, needs: e.target.value }))} className="input-base w-full px-3 py-2 text-[15px]" /></FL>
                  <FL label={t("pipeline.form.stage" as any)}>
                    <select value={form.column} onChange={e => setForm(p => ({ ...p, column: e.target.value }))} className="input-base w-full px-3 py-2 text-[15px]">
                      {LEAD_COLS.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                  </FL>
                </div>
                <div className="border-t" style={{ borderColor: "var(--color-border-primary)" }} />
                <FL label={t("pipeline.form.website" as any)}><textarea value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} placeholder={t("pipeline.form.websitePlaceholder" as any)} className="input-base w-full h-16 px-3 py-2 text-[15px] resize-none" /></FL>

                {/* ── AI Lead Analysis ── */}
                <div className="border-t pt-3" style={{ borderColor: "var(--color-border-primary)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[13px]" style={{ color: "var(--color-text-tertiary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>
                      {t("pipeline.ai.analysis" as any)}
                    </span>
                    <button onClick={() => ai.handleAnalyzeLead(form)} disabled={ai.aiAnalyzing} className="btn-ghost compact text-[13px] gap-1 disabled:opacity-40">
                      {ai.aiAnalyzing ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
                      {t("pipeline.ai.analyze" as any)}
                    </button>
                  </div>
                  {ai.aiAnalysis && (
                    <div className="rounded-[var(--radius-6)] p-2.5 text-[13px] mb-2" style={{
                      background: ai.aiAnalysis.score === "high" ? "color-mix(in srgb, var(--color-success) 8%, transparent)"
                        : ai.aiAnalysis.score === "medium" ? "color-mix(in srgb, var(--color-warning) 8%, transparent)"
                        : "color-mix(in srgb, var(--color-danger) 8%, transparent)",
                    }}>
                      <span className="inline-block px-1.5 py-0.5 rounded-[var(--radius-4)] text-[11px] mb-1" style={{
                        background: ai.aiAnalysis.score === "high" ? "var(--color-success)" : ai.aiAnalysis.score === "medium" ? "var(--color-warning)" : "var(--color-danger)",
                        color: "var(--color-text-on-color)", fontWeight: "var(--font-weight-semibold)",
                      } as React.CSSProperties}>
                        {ai.aiAnalysis.score === "high" ? t("pipeline.ai.scoreHigh" as any) : ai.aiAnalysis.score === "medium" ? t("pipeline.ai.scoreMedium" as any) : t("pipeline.ai.scoreLow" as any)}
                      </span>
                      <p style={{ color: "var(--color-text-secondary)" }}>{ai.aiAnalysis.reason}</p>
                    </div>
                  )}
                </div>

                {/* ── AI Outreach Email ── */}
                <div className="border-t pt-3" style={{ borderColor: "var(--color-border-primary)" }}>
                  <span className="text-[13px] block mb-2" style={{ color: "var(--color-text-tertiary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>
                    {t("pipeline.ai.generate" as any)}
                  </span>
                  <div className="flex items-center gap-2 mb-2">
                    {/* Tone */}
                    <div className="flex gap-1 flex-1">
                      {(["formal", "friendly", "direct"] as const).map(tone => (
                        <button key={tone} onClick={() => ai.setAiTone(tone)}
                          className="flex-1 text-[12px] py-1 rounded-[var(--radius-4)] transition-colors"
                          style={ai.aiTone === tone ? { background: "var(--color-accent)", color: "var(--color-brand-text)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties : { background: "var(--color-bg-tertiary)", color: "var(--color-text-tertiary)" }}
                        >
                          {tone === "formal" ? t("pipeline.ai.toneFormal" as any) : tone === "friendly" ? t("pipeline.ai.toneFriendly" as any) : t("pipeline.ai.toneDirect" as any)}
                        </button>
                      ))}
                    </div>
                    {/* Language */}
                    <div className="flex gap-1">
                      {(["zh", "en"] as const).map(l => (
                        <button key={l} onClick={() => ai.setAiLang(l)}
                          className="text-[12px] px-2 py-1 rounded-[var(--radius-4)] transition-colors"
                          style={ai.aiLang === l ? { background: "var(--color-accent)", color: "var(--color-brand-text)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties : { background: "var(--color-bg-tertiary)", color: "var(--color-text-tertiary)" }}
                        >
                          {l === "zh" ? "中文" : "EN"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => ai.handleGenerateOutreach(form)} disabled={ai.aiGenerating} className="btn-primary compact w-full text-[14px] gap-1.5 mb-2 disabled:opacity-40">
                    {ai.aiGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    {ai.aiGenerating ? t("pipeline.ai.generating" as any) : t("pipeline.ai.generate" as any)}
                  </button>
                  {ai.aiDraft && (
                    <div>
                      <pre className="text-[13px] leading-relaxed whitespace-pre-wrap rounded-[var(--radius-6)] p-3 mb-2" style={{ background: "var(--color-bg-tertiary)", color: "var(--color-text-secondary)", fontFamily: "inherit" }}>
                        {ai.aiDraft}
                      </pre>
                      <div className="flex gap-2">
                        <button onClick={() => { navigator.clipboard.writeText(ai.aiDraft); showToast(t("pipeline.ai.copyDraft" as any)); }} className="btn-ghost compact text-[13px] gap-1">
                          <Copy size={12} /> {t("pipeline.ai.copyDraft" as any)}
                        </button>
                        <button onClick={() => ai.handleGenerateOutreach(form)} disabled={ai.aiGenerating} className="btn-ghost compact text-[13px] gap-1 disabled:opacity-40">
                          <RefreshCw size={12} /> {t("common.regenerate" as any)}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between px-5 py-3 border-t pb-safe" style={{ borderColor: "var(--color-border-primary)" }}>
                <div className="flex gap-2">
                  {editId && <button type="button" onClick={() => setDeleteId(editId)} className="btn-ghost text-[15px]" style={{ color: "var(--color-danger)" }}><Trash2 size={16} /> {t("common.delete" as any)}</button>}
                  {editId && <button type="button" onClick={() => { setConvertForm({ plan_tier: "", status: "Active", mrr: "", subscription_start_date: todayDateKey() }); setShowConvert(true); }} className="btn-ghost text-[15px]" style={{ color: "var(--color-success)" }}><UserPlus size={16} /> {t("pipeline.convert.btn" as any)}</button>}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowPanel(false)} className="btn-secondary text-[15px]">{t("common.cancel" as any)}</button>
                  <button type="button" onClick={saveLead} disabled={savingLead} className="btn-primary text-[15px]">{savingLead ? t("common.loading" as any) : editId ? t("common.save" as any) : t("common.create" as any)}</button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>, document.body)}

      {/* Delete confirm */}
      {deleteId && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4 animate-fade-in" style={{ zIndex: "var(--layer-confirm)", background: "var(--color-overlay-primary)", paddingBottom: "max(env(safe-area-inset-bottom, 0px), 16px)" }}>
          <div className="card-elevated w-full max-w-sm p-5" role="dialog" aria-modal="true" aria-label="Confirm delete">
            <h3 className="text-[15px] mb-2" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" as any }}>{t("pipeline.delete.title" as any)}</h3>
            <p className="text-[15px] mb-4" style={{ color: "var(--color-text-secondary)" }}>{t("pipeline.delete.warning" as any)}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteId(null)} className="btn-secondary text-[15px]">{t("common.cancel" as any)}</button>
              <button onClick={() => deleteLead(deleteId)} className="text-[15px] px-4 py-2 rounded-[var(--radius-6)]" style={{ background: "var(--color-danger)", color: "var(--color-text-on-color)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{t("pipeline.delete.confirm" as any)}</button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Convert modal */}
      {showConvert && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4 animate-fade-in" style={{ zIndex: "var(--layer-confirm)", background: "var(--color-overlay-primary)", paddingBottom: "max(env(safe-area-inset-bottom, 0px), 16px)" }}>
          <div className="card-elevated w-full max-w-md p-5 space-y-4" role="dialog" aria-modal="true" aria-label="Convert lead">
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] flex items-center gap-2" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" as any }}><UserPlus size={16} style={{ color: "var(--color-success)" }} /> {t("pipeline.convert.title" as any)}</h3>
              <button onClick={() => setShowConvert(false)} className="btn-icon" aria-label="Close dialog"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FL label={t("pipeline.convert.billingType" as any)}><select value={convertForm.billing_type} onChange={e => setConvertForm(p => ({ ...p, billing_type: e.target.value as "subscription" | "project" }))} className="input-base w-full px-3 py-2 text-[15px]"><option value="subscription">{t("pipeline.convert.subscription" as any)}</option><option value="project">{t("pipeline.convert.project" as any)}</option></select></FL>
              <FL label={t("common.status" as any)}><select value={convertForm.status} onChange={e => setConvertForm(p => ({ ...p, status: e.target.value }))} className="input-base w-full px-3 py-2 text-[15px]"><option value="Active">{t("common.active" as any)}</option><option value="Paused">{t("common.paused" as any)}</option></select></FL>
            </div>
            <FL label={t("pipeline.convert.plan" as any)}><select value={convertForm.plan_tier} onChange={e => { const v = e.target.value; const p = plans.find((x: any) => x.name === v); setConvertForm(prev => ({ ...prev, plan_tier: v, mrr: p ? String(p.price) : prev.mrr })); }} className="input-base w-full px-3 py-2 text-[15px]"><option value="">{t("pipeline.convert.planSelect" as any)}</option>{plans.map((p: any) => <option key={p.id} value={p.name}>{p.name}</option>)}</select></FL>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {convertForm.billing_type === "subscription" ? (
                <FL label={t("pipeline.convert.mrr" as any)}><input type="number" min="0" value={convertForm.mrr} onChange={e => setConvertForm(p => ({ ...p, mrr: e.target.value }))} className="input-base w-full px-3 py-2 text-[15px]" /></FL>
              ) : (
                <FL label={t("pipeline.convert.projectFee" as any)}><input type="number" min="0" value={convertForm.project_fee} onChange={e => setConvertForm(p => ({ ...p, project_fee: e.target.value }))} className="input-base w-full px-3 py-2 text-[15px]" /></FL>
              )}
              <FL label={t("pipeline.convert.startDate" as any)}><input type="date" value={convertForm.subscription_start_date} onChange={e => setConvertForm(p => ({ ...p, subscription_start_date: e.target.value }))} className="input-base w-full px-3 py-2 text-[15px]" /></FL>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowConvert(false)} className="btn-secondary text-[15px]">{t("common.cancel" as any)}</button>
              <button onClick={convertLead} disabled={converting} className="text-[15px] px-4 py-2 rounded-[var(--radius-6)] flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed" style={{ background: "var(--color-success)", color: "var(--color-text-on-color)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>
                <UserPlus size={16} /> {t("common.confirmCreate" as any)}
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </>
  );
}

/* ── Sortable Lead Card ────────────────────────────────────────── */
function SortableLeadCard({ lead, onEdit, onDelete, score, isOverlay }: { lead: any; onEdit: (l: any) => void; onDelete: (id: number) => void; score?: LeadAnalysis; isOverlay?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id.toString(), disabled: isOverlay });
  const scoreColors: Record<string, { bg: string; color: string; label: string }> = {
    high: { bg: "var(--color-success-light)", color: "var(--color-success)", label: "高" },
    medium: { bg: "var(--color-warning-light)", color: "var(--color-warning)", label: "中" },
    low: { bg: "color-mix(in srgb, var(--color-danger) 10%, transparent)", color: "var(--color-danger)", label: "低" },
  };
  const s = score ? scoreColors[score.score] : null;
  const style: React.CSSProperties = isOverlay
    ? { boxShadow: "var(--shadow-high)", transform: "rotate(2deg) scale(1.02)", opacity: 0.95 }
    : { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, touchAction: "manipulation" };

  return (
    <div ref={isOverlay ? undefined : setNodeRef} {...(isOverlay ? {} : attributes)} {...(isOverlay ? {} : listeners)}
      style={style} onClick={() => onEdit(lead)}
      className={`group card-interactive cursor-grab active:cursor-grabbing p-3 press-feedback`}>
      <div className="flex items-start justify-between gap-2 mb-1 min-w-0">
        <div className="min-w-0 flex-1">
          <h4 className="text-[15px] truncate" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{lead.name || "—"}</h4>
          <p className="text-[13px] truncate mt-0.5" style={{ color: "var(--color-text-secondary)" }}>{lead.industry || "—"}</p>
        </div>
        {s && (
          <span className="text-[11px] px-1.5 py-0.5 rounded-[var(--radius-4)] shrink-0" style={{ background: s.bg, color: s.color, fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>
            {s.label}
          </span>
        )}
      </div>
      {lead.needs && <p className="text-[13px] line-clamp-2 mb-2" style={{ color: "var(--color-text-secondary)" }}>{lead.needs}</p>}
      <div className="flex items-center justify-between">
        {lead.source ? <span className="badge">{lead.source}</span> : <span />}
        <button onClick={e => { e.stopPropagation(); onDelete(lead.id); }} className="btn-icon-sm" aria-label="Delete lead"><Trash2 size={14} /></button>
      </div>
    </div>
  );
}

/* ── DnD helpers ───────────────────────────────────────────────── */
function findLeadColumn(leads: Record<string, any[]>, id: string): string | null {
  for (const [colId, items] of Object.entries(leads)) {
    if (items.some((l: any) => l.id.toString() === id)) return colId;
  }
  return null;
}

function useLeadDnd(leads: Record<string, any[]>, columns: any[], onDragEnd: (r: any) => void) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: isMobile ? 99999 : 5 } }),
  );
  const allLeads = useMemo(() => Object.values(leads).flat(), [leads]);
  const activeLead = activeId ? allLeads.find((l: any) => l.id.toString() === activeId) : null;

  const handleDragStart = useCallback((e: DragStartEvent) => setActiveId(e.active.id as string), []);
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const src = findLeadColumn(leads, active.id as string);
    if (!src) return;
    let dest = findLeadColumn(leads, over.id as string);
    let destIdx = 0;
    if (dest) { destIdx = leads[dest].findIndex((l: any) => l.id.toString() === (over.id as string)); }
    else if (columns.some((c: any) => c.id === over.id)) { dest = over.id as string; }
    else return;
    const srcIdx = leads[src].findIndex((l: any) => l.id.toString() === (active.id as string));
    onDragEnd({ source: { droppableId: src, index: srcIdx }, destination: { droppableId: dest, index: destIdx } });
  }, [leads, columns, onDragEnd]);

  return { sensors, activeId, activeLead, handleDragStart, handleDragEnd };
}

/* ── Lead Kanban ──────────────────────────────────────────────── */
function LeadKanban({ leads, columns, onDragEnd, onAdd, onEdit, onDelete, emptyText, leadScores }: any) {
  const { sensors, activeLead, handleDragStart, handleDragEnd } = useLeadDnd(leads, columns, onDragEnd);
  return (
    <div className="flex-1 overflow-x-auto overflow-y-hidden ios-scroll pb-4 -mx-4 px-4 md:-mx-6 md:px-6 lg:mx-0 lg:px-0 snap-x snap-mandatory lg:snap-none lg:overflow-x-visible">
      <div className="flex h-full gap-3 min-w-max lg:min-w-0">
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          {columns.map((col: any) => {
            const items = leads[col.id] || [];
            const itemIds = items.map((l: any) => l.id.toString());
            return (
              <div key={col.id} className="flex flex-col flex-1 min-w-[240px] lg:min-w-0 h-full snap-start lg:snap-align-none">
                <div className="flex items-center justify-between mb-2 px-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-[var(--radius-2)]" style={{ background: col.color }} />
                    <h3 className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" as any }}>{col.title}</h3>
                    <span className="text-[13px] tabular-nums" style={{ color: "var(--color-text-secondary)", fontWeight: "var(--font-weight-medium)" as any }}>{items.length}</span>
                  </div>
                  <button onClick={() => onAdd(null, col.id)} className="btn-icon-sm" aria-label="Add lead"><Plus size={14} /></button>
                </div>
                <SortableContext id={col.id} items={itemIds} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col flex-1 min-h-0 rounded-[var(--radius-8)] overflow-hidden"
                    style={{ background: "var(--color-bg-tertiary)", borderTop: `2px solid ${col.color}` }}>
                    <div className="flex-1 overflow-y-auto p-1.5 space-y-1 ios-scroll">
                      {!items.length && (
                        <div className="py-8 flex flex-col items-center gap-1.5">
                          <UserPlus size={20} style={{ color: "var(--color-text-quaternary)" }} />
                          <span className="text-[13px]" style={{ color: "var(--color-text-quaternary)" }}>{emptyText}</span>
                        </div>
                      )}
                      {items.map((lead: any) => (
                        <SortableLeadCard key={lead.id} lead={lead} onEdit={(l: any) => onEdit(l, col.id)} onDelete={onDelete} score={leadScores?.[lead.id]} />
                      ))}
                    </div>
                  </div>
                </SortableContext>
              </div>
            );
          })}
          <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.25, 1, 0.5, 1)" }}>
            {activeLead ? <SortableLeadCard lead={activeLead} onEdit={() => {}} onDelete={() => {}} isOverlay /> : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}

/* ── Lead Swimlane ────────────────────────────────────────────── */
function LeadSwimlane({ leads, columns, onDragEnd, onAdd, onEdit, onDelete, onMove, emptyText }: any) {
  const { sensors, activeLead, handleDragStart, handleDragEnd } = useLeadDnd(leads, columns, onDragEnd);
  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-3 pb-4">
        {columns.map((col: any) => {
          const items: any[] = leads[col.id] || [];
          const itemIds = items.map((l: any) => l.id.toString());
          return (
            <section key={col.id}>
              <div className="flex items-center justify-between mb-1 px-1">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-[var(--radius-2)]" style={{ background: col.color }} />
                  <h3 className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" as any }}>{col.title}</h3>
                  <span className="text-[13px] tabular-nums" style={{ color: "var(--color-text-tertiary)", fontWeight: "var(--font-weight-medium)" as any }}>{items.length}</span>
                </div>
                <button onClick={() => onAdd(null, col.id)} className="btn-icon-sm" aria-label="Add lead"><Plus size={14} /></button>
              </div>
              <SortableContext id={col.id} items={itemIds} strategy={verticalListSortingStrategy}>
                <div className="rounded-[var(--radius-8)] overflow-hidden"
                  style={{ background: "var(--color-bg-tertiary)", borderTop: `2px solid ${col.color}` }}>
                  {!items.length ? (
                    <button onClick={() => onAdd(null, col.id)}
                      className="py-6 w-full text-center text-[13px] transition-colors hover:bg-[var(--color-bg-quaternary)] rounded-[var(--radius-6)] mx-auto my-1.5"
                      style={{ color: "var(--color-text-quaternary)", border: "1px dashed var(--color-border-primary)", background: "transparent" }}>
                      <Plus size={15} className="mx-auto mb-0.5" style={{ opacity: 0.4 }} />{emptyText}
                    </button>
                  ) : (
                    <div className="p-1.5 space-y-1">
                      {items.map((lead: any) => {
                        const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id.toString() });
                        return (
                          <div key={lead.id} ref={setNodeRef} {...attributes} {...listeners}
                            style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, touchAction: "manipulation" }}
                            onClick={() => onEdit(lead, col.id)}
                            className="card-interactive cursor-grab active:cursor-grabbing p-3 press-feedback">
                            <div className="flex items-start justify-between gap-2 mb-1 min-w-0">
                              <div className="min-w-0 flex-1">
                                <h4 className="text-[15px] truncate" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{lead.name || "—"}</h4>
                                <p className="text-[13px] truncate mt-0.5" style={{ color: "var(--color-text-secondary)" }}>{lead.industry || "—"}</p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0" onClick={(e: any) => e.stopPropagation()}>
                                <select value={col.id} onChange={(e: any) => onMove(lead.id, e.target.value)}
                                  className="input-base compact cursor-pointer text-[13px] px-2"
                                  style={{ fontWeight: "var(--font-weight-medium)", height: "28px" } as React.CSSProperties}>
                                  {columns.map((c: any) => <option key={c.id} value={c.id}>{c.title}</option>)}
                                </select>
                              </div>
                            </div>
                            {lead.needs && <p className="text-[13px] line-clamp-2 mb-1" style={{ color: "var(--color-text-secondary)" }}>{lead.needs}</p>}
                            <div className="flex items-center justify-between mt-1">
                              {lead.source ? <span className="badge">{lead.source}</span> : <span />}
                              <button onClick={(e: any) => { e.stopPropagation(); onDelete(lead.id); }} className="btn-icon-sm" aria-label="Delete lead"><Trash2 size={14} /></button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </SortableContext>
            </section>
          );
        })}
      </div>
      <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.25, 1, 0.5, 1)" }}>
        {activeLead ? <SortableLeadCard lead={activeLead} onEdit={() => {}} onDelete={() => {}} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}

export default LeadsView;
