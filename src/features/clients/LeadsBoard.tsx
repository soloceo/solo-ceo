import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Plus, Trash2, Edit2, X, Mail, UserPlus, LayoutGrid, AlignJustify,
  ChevronDown, GripVertical, PanelRightClose,
} from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { motion, AnimatePresence } from "motion/react";
import { createPortal } from "react-dom";
import { useT } from "../../i18n/context";
import { useRealtimeRefresh } from "../../hooks/useRealtimeRefresh";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useUIStore } from "../../store/useUIStore";
import { Skeleton } from "../../components/ui";

const LEADS_TABLES = ['leads', 'plans'] as const;

const EMPTY_LEAD = { name: "", industry: "", needs: "", website: "", column: "new", source: "" };

/* ── Constants ─────────────────────────────────────────────────── */
export const LEAD_COL_IDS = [
  { id: "new", color: "var(--color-text-secondary)" },
  { id: "contacted", color: "var(--color-info, #3b82f6)" },
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
  const { t } = useT();
  const showToast = useUIStore((s) => s.showToast);
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
  const [converting, setConverting] = useState(false);
  const [showConvert, setShowConvert] = useState(false);
  const isMobile = useIsMobile();
  const viewMode = useUIStore((s) => s.salesViewMode);
  const setViewMode = useUIStore((s) => s.setSalesViewMode);
  const [convertForm, setConvertForm] = useState({ plan_tier: "", status: "Active", mrr: "", subscription_start_date: new Date().toISOString().split("T")[0] });
  const [plans, setPlans] = useState<any[]>([]);
  const [form, setForm] = useState(EMPTY_LEAD);

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
    if (lead) { setEditId(lead.id); setForm({ name: lead.name, industry: lead.industry, needs: lead.needs, website: lead.website || "", column: lead.column || col, source: lead.source || "" }); }
    else { setEditId(null); setForm({ ...EMPTY_LEAD, column: col }); }
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
      <div className="flex flex-wrap gap-2 items-center mb-4">
        <div className="segment-switcher">
          {([["vertical", <LayoutGrid size={16} key="v" />, "Board view"], ["horizontal", <AlignJustify size={16} key="h" />, "List view"]] as const).map(([m, icon, label]) => (
            <button key={m} onClick={() => setViewMode(m)} data-active={viewMode === m} aria-label={label}>{icon}</button>
          ))}
        </div>
        <button onClick={() => setShowFunnel(f => !f)} className={`btn-ghost compact gap-1 ${showFunnel ? "ring-1" : ""}`} style={showFunnel ? { color: "var(--color-accent)", borderColor: "var(--color-accent)" } : undefined}>
          <ChevronDown size={16} style={{ transform: showFunnel ? "rotate(180deg)" : undefined, transition: "transform 0.2s" }} /> {t("pipeline.funnel.title" as any)}
        </button>
        <div className="flex-1" />
        <button onClick={() => openPanel(null, "new")} className="btn-primary compact"><Plus size={16} /> {t("pipeline.addLead" as any)}</button>
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
            <div key={i} className="flex-1 min-w-[220px] max-w-[320px] space-y-2">
              <Skeleton className="h-4 w-20" />
              <div className="space-y-1.5 p-1.5 rounded-[var(--radius-12)]" style={{ background: "var(--color-bg-tertiary)" }}>
                <Skeleton className="h-[72px] rounded-[var(--radius-12)]" />
                <Skeleton className="h-[72px] rounded-[var(--radius-12)]" />
              </div>
            </div>
          ))}
        </div>
      ) : viewMode === "vertical" ? (
        <div className="flex-1 overflow-x-auto overflow-y-hidden ios-scroll pb-4 -mx-4 px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8 snap-x snap-mandatory lg:snap-none">
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
      {createPortal(<AnimatePresence>
        {showPanel && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="fixed inset-0" style={{ zIndex: 699, background: "var(--color-overlay-primary)" }} onClick={() => setShowPanel(false)} />
            <motion.div
              initial={{ x: isMobile ? 0 : "100%", y: isMobile ? "100%" : 0 }}
              animate={{ x: 0, y: 0 }}
              exit={{ x: isMobile ? 0 : "100%", y: isMobile ? "100%" : 0 }}
              transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
              role="dialog"
              aria-modal="true"
              aria-label="Lead detail"
              className={isMobile ? "fixed inset-0 flex flex-col" : "fixed top-0 right-0 h-full w-full max-w-[440px] lg:max-w-[520px] flex flex-col border-l"}
              style={{ zIndex: 700, background: "var(--color-bg-primary)", borderColor: "var(--color-border-primary)", boxShadow: "var(--shadow-high)", paddingTop: isMobile ? "var(--mobile-header-pt, env(safe-area-inset-top, 0px))" : undefined }}
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
                  <FL label={t("pipeline.form.name" as any)}><input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="input-base w-full px-3 py-2 text-[15px]" /></FL>
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
              </div>
              <div className="flex items-center justify-between px-5 py-3 border-t pb-safe" style={{ borderColor: "var(--color-border-primary)" }}>
                <div className="flex gap-2">
                  {editId && <button type="button" onClick={() => setDeleteId(editId)} className="btn-ghost text-[15px]" style={{ color: "var(--color-danger)" }}><Trash2 size={16} /> {t("common.delete" as any)}</button>}
                  {editId && <button type="button" onClick={() => { setConvertForm({ plan_tier: "", status: "Active", mrr: "", subscription_start_date: new Date().toISOString().split("T")[0] }); setShowConvert(true); }} className="btn-ghost text-[15px]" style={{ color: "var(--color-success)" }}><UserPlus size={16} /> {t("pipeline.convert.btn" as any)}</button>}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowPanel(false)} className="btn-secondary text-[15px]">{t("common.cancel" as any)}</button>
                  <button type="button" onClick={saveLead} className="btn-primary text-[15px]">{editId ? t("common.save" as any) : t("common.create" as any)}</button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>, document.body)}

      {/* Delete confirm */}
      {deleteId && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 710, background: "var(--color-overlay-primary)", paddingBottom: "max(env(safe-area-inset-bottom, 0px), 16px)" }}>
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
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 710, background: "var(--color-overlay-primary)", paddingBottom: "max(env(safe-area-inset-bottom, 0px), 16px)" }}>
          <div className="card-elevated w-full max-w-md p-5 space-y-4" role="dialog" aria-modal="true" aria-label="Convert lead">
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] flex items-center gap-2" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" as any }}><UserPlus size={16} style={{ color: "var(--color-success)" }} /> {t("pipeline.convert.title" as any)}</h3>
              <button onClick={() => setShowConvert(false)} className="btn-icon" aria-label="Close dialog"><X size={18} /></button>
            </div>
            <FL label={t("pipeline.convert.plan" as any)}><select value={convertForm.plan_tier} onChange={e => { const v = e.target.value; const p = plans.find((x: any) => x.name === v); setConvertForm(prev => ({ ...prev, plan_tier: v, mrr: p ? String(p.price) : prev.mrr })); }} className="input-base w-full px-3 py-2 text-[15px]"><option value="">{t("pipeline.convert.planSelect" as any)}</option>{plans.map((p: any) => <option key={p.id} value={p.name}>{p.name}</option>)}</select></FL>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FL label={t("common.status" as any)}><select value={convertForm.status} onChange={e => setConvertForm(p => ({ ...p, status: e.target.value }))} className="input-base w-full px-3 py-2 text-[15px]"><option value="Active">{t("common.active" as any)}</option><option value="Paused">{t("common.paused" as any)}</option></select></FL>
              <FL label={t("pipeline.convert.mrr" as any)}><input type="number" min="0" value={convertForm.mrr} onChange={e => setConvertForm(p => ({ ...p, mrr: e.target.value }))} className="input-base w-full px-3 py-2 text-[15px]" /></FL>
            </div>
            <FL label={t("pipeline.convert.startDate" as any)}><input type="date" value={convertForm.subscription_start_date} onChange={e => setConvertForm(p => ({ ...p, subscription_start_date: e.target.value }))} className="input-base w-full px-3 py-2 text-[15px]" /></FL>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowConvert(false)} className="btn-secondary text-[15px]">{t("common.cancel" as any)}</button>
              <button onClick={convertLead} disabled={converting} className="text-[15px] px-4 py-2 rounded-[var(--radius-6)] flex items-center gap-1.5 disabled:opacity-50" style={{ background: "var(--color-success)", color: "var(--color-text-on-color)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>
                <UserPlus size={16} /> {t("common.confirm" as any)}
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </>
  );
}

/* ── Lead column (kanban) ───────────────────────────────────────── */
function LeadColumn({ col, items, onAdd, onEdit, onDelete, emptyText }: { col: { id: string; title: string; color: string }; items: any[]; onAdd: () => void; onEdit: (l: any) => void; onDelete: (id: number) => void; emptyText: string }) {
  return (
    <div className="flex flex-col min-w-[240px] flex-1 max-w-[320px] shrink-0 h-full snap-start">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-[var(--radius-2)]" style={{ background: col.color }} />
          <h3 className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" as any }}>{col.title}</h3>
          <span className="text-[13px] tabular-nums" style={{ color: "var(--color-text-secondary)", fontWeight: "var(--font-weight-medium)" as any }}>{items.length}</span>
        </div>
        <button onClick={onAdd} className="btn-icon-sm" aria-label="Add lead"><Plus size={14} /></button>
      </div>
      <Droppable droppableId={col.id}>
        {(provided, snapshot) => (
          <div {...provided.droppableProps} ref={provided.innerRef}
            className="flex flex-col flex-1 min-h-0 rounded-[var(--radius-12)] overflow-hidden"
            style={{ background: snapshot.isDraggingOver ? "var(--color-accent-tint)" : "var(--color-bg-tertiary)", borderTop: `2px solid ${col.color}`, transition: "background 0.15s" }}>
            <div className="flex-1 overflow-y-auto p-1.5 space-y-1 ios-scroll">
              {!items.length && (
                <div className="py-8 flex flex-col items-center gap-1.5">
                  <UserPlus size={20} style={{ color: "var(--color-text-quaternary)" }} />
                  <span className="text-[13px]" style={{ color: "var(--color-text-quaternary)" }}>{emptyText}</span>
                </div>
              )}
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
  const card = (
    <div ref={provided.innerRef} {...provided.draggableProps}
      style={{ ...(provided.draggableProps.style as React.CSSProperties), touchAction: snapshot.isDragging ? "none" : "auto", ...(snapshot.isDragging ? { boxShadow: "var(--shadow-high)" } : {}) }}
      onClick={() => onEdit(lead)}
      className={`group card-interactive cursor-pointer p-3 press-feedback ${snapshot.isDragging ? "rotate-[2deg] scale-[1.02] z-[1100]" : ""}`}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <span {...provided.dragHandleProps} style={{ touchAction: "none" }} className="shrink-0 mt-0.5 cursor-grab active:cursor-grabbing">
          <GripVertical size={14} style={{ color: "var(--color-text-quaternary)", opacity: 0.5 }} />
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="text-[15px] truncate" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{lead.name}</h4>
          <p className="text-[13px] truncate mt-0.5" style={{ color: "var(--color-text-secondary)" }}>{lead.industry}</p>
        </div>
        {lead.source && <span className="badge">{lead.source}</span>}
      </div>
      <p className="text-[13px] line-clamp-2 mb-2" style={{ color: "var(--color-text-secondary)" }}>{lead.needs}</p>
      <div className="flex items-center justify-between">
        <span className="badge"><Mail size={16} /> —</span>
        <button onClick={e => { e.stopPropagation(); onDelete(lead.id); }} className="btn-icon-sm lg:opacity-0 lg:group-hover:opacity-100 transition-opacity" aria-label="Delete lead"><Trash2 size={14} /></button>
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
            <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: "var(--color-border-primary)", borderTop: `2px solid ${col.color}` }}>
              <div className="flex items-center gap-2"><h3 className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" as any }}>{col.title}</h3><span className="text-[13px] tabular-nums" style={{ color: "var(--color-text-secondary)", fontWeight: "var(--font-weight-medium)" as any }}>{items.length}</span></div>
              <button onClick={() => onAdd(null, col.id)} className="btn-icon-sm" aria-label="Add lead"><Plus size={14} /></button>
            </div>
            {!items.length ? <div className="px-4 py-4 flex items-center justify-center gap-2 text-[14px]" style={{ color: "var(--color-text-quaternary)" }}><UserPlus size={14} />{emptyText}</div> : (
              <div className="overflow-x-auto ios-scroll"><div className="flex gap-2 p-3 min-w-max">
                {items.map((lead: any) => (
                  <div key={lead.id} role="button" tabIndex={0} onClick={() => onEdit(lead, col.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onEdit(lead, col.id); } }} className="w-[200px] shrink-0 cursor-pointer card-interactive p-3 group">
                    <h4 className="text-[15px] truncate mb-1" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" }}>{lead.name}</h4>
                    <p className="text-[13px] truncate mb-1" style={{ color: "var(--color-text-secondary)" }}>{lead.industry}</p>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t" style={{ borderColor: "var(--color-border-primary)" }} onClick={e => e.stopPropagation()}>
                      <select value={col.id} onChange={e => onMove(lead.id, e.target.value)} className="input-base compact cursor-pointer text-[15px] px-2" style={{ fontWeight: "var(--font-weight-medium)" as any }}>{columns.map((c: any) => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
                      <button onClick={() => onDelete(lead.id)} className="btn-icon-sm lg:opacity-0 lg:group-hover:opacity-100 transition-opacity" aria-label="Delete lead"><Trash2 size={14} /></button>
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

export default LeadsView;
