import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Plus, Edit2, Trash2, X, Check, Search, Filter,
  PlayCircle, PauseCircle, Layers, PanelRightClose,
  DollarSign, CircleCheck, Clock, AlertCircle, Download,
  FolderOpen, ExternalLink, UserPlus, Undo2,
  Building2, User, Mail, Phone, Link,
} from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { api } from "../../lib/api";
import { useT } from "../../i18n/context";
import { useRealtimeRefresh } from "../../hooks/useRealtimeRefresh";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useUIStore } from "../../store/useUIStore";
import { Skeleton } from "../../components/ui";
import { FL } from "./LeadsBoard";
import { STATUS_I18N, catLabel } from "../../lib/tax";
import { todayDateKey } from "../../lib/date-utils";
import { useMilestones, PAYMENT_METHODS } from "./useMilestones";
import type { MilestoneRow } from "./useMilestones";
import { useClientTransactions, TX_CATEGORIES, TX_STATUSES } from "./useClientTransactions";
import type { FinanceTransaction } from "./useClientTransactions";
import { useClientProjects } from "./useClientProjects";
import type { ProjectRow } from "./useClientProjects";

/* ── Type definitions ── */
interface ClientRow {
  id: number;
  name: string;
  company_name?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  billing_type: "subscription" | "project";
  plan_tier?: string;
  plan?: string;
  status: string;
  mrr: number;
  project_fee: number;
  subscription_start_date?: string;
  project_end_date?: string;
  paused_at?: string | null;
  resumed_at?: string | null;
  cancelled_at?: string | null;
  mrr_effective_from?: string;
  subscription_timeline?: string;
  tax_mode: "none" | "exclusive" | "inclusive";
  tax_rate: number;
  drive_folder_url?: string;
  payment_method: "auto" | "manual";
  [key: string]: unknown; // For unknown fields from API
}

interface PlanRow {
  id: number;
  name: string;
  price: number;
  [key: string]: unknown;
}

/* ── Finance helpers ── */
const stLabel = (st: string, t: (k: string) => string) => { const key = STATUS_I18N[st]; return key ? t(key) : st; };

const CLIENTS_TABLES = ['clients', 'plans', 'payment_milestones', 'finance_transactions', 'client_projects'] as const;

const createEmptyClient = () => ({
  name: "", company_name: "", contact_name: "", contact_email: "", contact_phone: "",
  billing_type: "subscription" as "subscription" | "project", plan: "", status: "Active",
  mrr: "", project_fee: "", project_name: "",
  subscription_start_date: todayDateKey(),
  project_end_date: "", paused_at: "", resumed_at: "", cancelled_at: "",
  mrr_effective_from: todayDateKey(),
  tax_mode: "none" as "none" | "exclusive" | "inclusive", tax_rate: "",
  drive_folder_url: "", payment_method: "auto" as "auto" | "manual",
  timeline: [{ type: "start", date: todayDateKey() }] as { type: string; date: string }[],
});


/* ══════════════════════════════════════════════════════════════════
   CLIENTS VIEW
   ══════════════════════════════════════════════════════════════════ */
export function ClientsView() {
  const { t } = useT();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPanel, setShowPanel] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteClientId, setDeleteClientId] = useState<number | null>(null);
  const showToast = useUIStore((s) => s.showToast);
  const [search, setSearch] = useState("");
  const [filterSt, setFilterSt] = useState("All");
  const [filterBilling, setFilterBilling] = useState("All");
  const [filterPlan, setFilterPlan] = useState("All");
  const isMobile = useIsMobile();
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [savingClient, setSavingClient] = useState(false);
  const [form, setForm] = useState(createEmptyClient);
  const parentRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  /* ── Projects hook ── */
  const proj = useClientProjects();

  /* ── Milestones hook — uses active project fee if available ── */
  const activeProjFee = proj.activeProject?.project_fee || Number(form.project_fee) || 0;
  const ms = useMilestones(editId, activeProjFee, proj.activeProjectId);

  /* ── Panel tab ── */
  const [panelTab, setPanelTab] = useState<'info' | 'billing' | 'finance'>('info');
  const [completedExpanded, setCompletedExpanded] = useState(false);
  const [deleteProjectId, setDeleteProjectId] = useState<number | null>(null);

  /* ── Transactions hook ── */
  const tx = useClientTransactions(editId);

  /* ── Billing type confirmation modal ── */
  const [billingConfirm, setBillingConfirm] = useState<{type: "subscription"|"project", message: string}|null>(null);

  /* ── Form validation ── */
  const [formErrors, setFormErrors] = useState<Record<string, boolean>>({});

  const fetchPlans = async () => { try { const d = await api.get<unknown[]>("/api/plans"); setPlans(Array.isArray(d) ? d : []); } catch { showToast(t("common.loadFailed") || "Load failed"); } };
  const fetchClients = async () => { try { const data = await api.get<unknown[]>("/api/clients"); setClients(Array.isArray(data) ? data : []); } catch { showToast(t("pipeline.toast.clientLoadFailed")); } finally { setLoading(false); } };

  useEffect(() => { void Promise.all([fetchClients(), fetchPlans(), tx.fetchFinance()]); }, []);
  useRealtimeRefresh(CLIENTS_TABLES, () => { fetchClients(); tx.fetchFinance(); if (editId) { if (form.billing_type === "project") { ms.fetchMilestones(editId); proj.fetchProjects(editId); } } });

  /* ── Pull-to-refresh listener ── */
  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail?.target === "clients") { fetchClients(); fetchPlans(); }
    };
    window.addEventListener("pull-refresh", handler);
    return () => window.removeEventListener("pull-refresh", handler);
  }, []);

  /* ── FAB quick-create listener ── */
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.type === "client") openPanel();
    };
    window.addEventListener("quick-create", handler);
    return () => window.removeEventListener("quick-create", handler);
  }, []);

  useEffect(() => {
    const show = isMobile && showPanel;
    window.dispatchEvent(new CustomEvent("mobile-nav-visibility", { detail: { hidden: show } }));
    return () => { window.dispatchEvent(new CustomEvent("mobile-nav-visibility", { detail: { hidden: false } })); };
  }, [showPanel, isMobile]);

  const openPanel = (c: ClientRow | null = null) => {
    ms.resetState();
    tx.resetState();
    proj.resetState();
    setPanelTab('info');
    setCompletedExpanded(false);
    setDeleteProjectId(null);
    if (c) {
      setEditId(c.id);
      // Parse timeline — fallback to legacy fields
      let tl: { type: string; date: string }[] = [];
      try { tl = JSON.parse(c.subscription_timeline || '[]'); } catch { tl = []; }
      if (!tl.length) {
        const sd = c.subscription_start_date || (c.joined_at ? String(c.joined_at).split("T")[0].split(" ")[0] : "");
        if (sd) tl.push({ type: "start", date: sd });
        if (c.paused_at) tl.push({ type: "pause", date: c.paused_at });
        if (c.resumed_at) tl.push({ type: "resume", date: c.resumed_at });
        if (c.cancelled_at) tl.push({ type: "cancel", date: c.cancelled_at });
      }
      setForm({ name: c.name, company_name: c.company_name || "", contact_name: c.contact_name || "", contact_email: c.contact_email || "", contact_phone: c.contact_phone || "", billing_type: c.billing_type || "subscription", plan: c.plan_tier || c.plan, status: c.status, mrr: String(c.mrr).replace(/[^0-9.-]+/g, ""), project_fee: String(c.project_fee || "").replace(/[^0-9.-]+/g, ""), subscription_start_date: tl[0]?.date || "", project_end_date: c.project_end_date || "", paused_at: c.paused_at || "", resumed_at: c.resumed_at || "", cancelled_at: c.cancelled_at || "", mrr_effective_from: tl[0]?.date || c.mrr_effective_from || "", tax_mode: (c.tax_mode || "none") as "none" | "exclusive" | "inclusive", tax_rate: String(c.tax_rate || ""), drive_folder_url: c.drive_folder_url || "", payment_method: (c.payment_method || "auto") as "auto" | "manual", timeline: tl });
      if ((c.billing_type || "subscription") === "project") {
        proj.fetchProjects(c.id);
        ms.fetchMilestones(c.id);
      }
    }
    else { setEditId(null); setForm(createEmptyClient()); }
    setShowPanel(true);
  };

  const saveClient = async () => {
    if (savingClient) return;

    // Validate required fields
    const errors: Record<string, boolean> = {};
    if (!form.company_name || form.company_name.trim() === "") {
      errors.company_name = true;
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      showToast(t("common.validationFailed") || "Please fill in all required fields");
      return;
    }

    setSavingClient(true);
    const startEvt = form.timeline.find(e => e.type === "start");
    const isProjectType = form.billing_type === "project";
    const hasProjects = isProjectType && editId && proj.projects.length > 0;
    const d: Record<string, unknown> = {
      name: form.name, company_name: form.company_name, contact_name: form.contact_name,
      contact_email: form.contact_email, contact_phone: form.contact_phone,
      billing_type: form.billing_type,
      plan_tier: !isProjectType ? form.plan : "",
      status: form.status,
      mrr: !isProjectType ? (Number(form.mrr) || 0) : 0,
      // For project clients with projects table, fee = sum of active project fees
      project_fee: isProjectType && hasProjects
        ? proj.projects.filter(p => p.status === 'active').reduce((s, p) => s + Number(p.project_fee || 0), 0)
        : (Number(form.project_fee) || 0),
      subscription_start_date: startEvt?.date || form.subscription_start_date,
      project_end_date: form.project_end_date,
      paused_at: form.timeline.filter(e => e.type === "pause").pop()?.date || "",
      resumed_at: form.timeline.filter(e => e.type === "resume").pop()?.date || "",
      cancelled_at: form.timeline.find(e => e.type === "cancel")?.date || "",
      mrr_effective_from: startEvt?.date || form.subscription_start_date,
      subscription_timeline: JSON.stringify(form.timeline),
      tax_mode: hasProjects ? "none" : form.tax_mode,
      tax_rate: hasProjects ? 0 : (Number(form.tax_rate) || 0),
      drive_folder_url: form.drive_folder_url,
      payment_method: form.payment_method,
    };
    try {
      if (editId) {
        await api.put(`/api/clients/${editId}`, d);
        showToast(t("pipeline.toast.clientUpdated"));
      } else {
        const newClient = await api.post<{ id: number }>("/api/clients", d);
        showToast(t("pipeline.toast.clientAdded"));
        // Auto-create first project for new project-type clients
        if (isProjectType && newClient?.id && Number(form.project_fee) > 0) {
          await api.post(`/api/clients/${newClient.id}/projects`, {
            name: form.project_name || form.company_name || form.name || t("pipeline.projects.defaultName"),
            project_fee: Number(form.project_fee) || 0,
            project_start_date: form.subscription_start_date || todayDateKey(),
            project_end_date: form.project_end_date || "",
            status: "active",
            tax_mode: form.tax_mode || "none",
            tax_rate: Number(form.tax_rate) || 0,
          });
        }
      }
      setShowPanel(false); fetchClients();
    } catch { showToast(t("common.saveFailed")); }
    finally { setSavingClient(false); }
  };

  const deleteClient = async (id: number) => { try { await api.del(`/api/clients/${id}`); setShowPanel(false); showToast(t("pipeline.toast.clientDeleted")); fetchClients(); } catch { showToast(t("common.deleteFailed")); } };

  const uniquePlanTiers = [...new Set(clients.filter(c => c.billing_type === "subscription" && c.plan_tier).map(c => c.plan_tier))];
  const filtered = useMemo(() => clients.filter(c => {
    const q = search.toLowerCase();
    const ms = c.name.toLowerCase().includes(q) || (c.company_name || "").toLowerCase().includes(q) || (c.contact_name || "").toLowerCase().includes(q) || (c.contact_email || "").toLowerCase().includes(q);
    const mf = filterSt === "All" || c.status === filterSt;
    const mb = filterBilling === "All" || c.billing_type === filterBilling;
    const mp = filterPlan === "All" || c.plan_tier === filterPlan;
    return ms && mf && mb && mp;
  }), [clients, search, filterSt, filterBilling, filterPlan]);
  const activeN = filtered.filter(c => c.status === "Active").length;
  const pausedN = filtered.filter(c => c.status === "Paused").length;
  // 合同总额 = subscription lifetimeRevenue + project fees
  const contractTotal = filtered.reduce((s, c) => {
    if (c.billing_type === "project") return s + Number(c.project_fee || 0);
    return s + Number(c.lifetimeRevenue || 0);
  }, 0);
  // 已到账 = 所有已完成收入（含订阅月付虚拟行 + 真实交易记录）
  const filteredIds = new Set(filtered.map(c => c.id));
  const totalReceived = tx.finTxs
    .filter((r: FinanceTransaction) => r.type === "income" && (r.status || "已完成") === "已完成" && filteredIds.has(r.client_id))
    .reduce((s: number, r: FinanceTransaction) => {
      const base = Number(r.amount || 0);
      const tax = Number(r.tax_amount || 0);
      // Exclusive tax: client pays base + tax; inclusive/none: amount is the total
      return s + (r.tax_mode === "exclusive" ? base + tax : base);
    }, 0);

  const exportClientsCSV = () => {
    const headers = ["Name", "Contact", "Email", "Phone", "Billing", "Plan", "MRR", "Project Fee", "Status", "Start Date"];
    const rows = filtered.map((c: ClientRow) => [
      c.name || "", c.contact_name || "", c.contact_email || "", c.contact_phone || "",
      c.billing_type === "project" ? "Project" : "Subscription",
      c.plan_tier || "", c.mrr || "", c.project_fee || "",
      c.status || "", c.subscription_start_date || "",
    ]);
    const csv = [headers, ...rows].map(r => r.map((v: string | number) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `clients-${todayDateKey()}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(t("pipeline.clients.csvExported"));
  };

  const rowV = useVirtualizer({ count: filtered.length, getScrollElement: () => parentRef.current, estimateSize: () => 72, overscan: 6 });
  const vItems = rowV.getVirtualItems();
  const padTop = vItems.length > 0 ? vItems[0].start : 0;
  const padBot = vItems.length > 0 ? rowV.getTotalSize() - vItems[vItems.length - 1].end : 0;

  return (
    <div>
      {loading ? (
        <div className="space-y-3 animate-skeleton-in">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-[72px] rounded-[var(--radius-12)]" />)}
          </div>
          <Skeleton className="h-10 rounded-[var(--radius-12)]" />
          <div className="card space-y-0">
            {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-[72px]" />)}
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="stat-card anim-appear"><div className="flex items-center gap-2 mb-1"><div className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-4)]" style={{ background: "var(--color-bg-tertiary)" }}><PlayCircle size={16} style={{ color: "var(--color-text-tertiary)" }} /></div><span className="text-[13px]" style={{ color: "var(--color-text-tertiary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{t("common.active")}</span></div><span className="text-[18px] tabular-nums tracking-tight" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{activeN}</span></div>
            <div className="stat-card anim-appear"><div className="flex items-center gap-2 mb-1"><div className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-4)]" style={{ background: "var(--color-bg-tertiary)" }}><PauseCircle size={16} style={{ color: "var(--color-text-tertiary)" }} /></div><span className="text-[13px]" style={{ color: "var(--color-text-tertiary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{t("common.paused")}</span></div><span className="text-[18px] tabular-nums tracking-tight" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{pausedN}</span></div>
            <div className="stat-card anim-appear"><div className="flex items-center gap-2 mb-1"><div className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-4)]" style={{ background: "var(--color-bg-tertiary)" }}><Layers size={16} style={{ color: "var(--color-text-tertiary)" }} /></div><span className="text-[13px]" style={{ color: "var(--color-text-tertiary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{t("pipeline.clients.contractTotal")}</span></div><span className="text-[18px] tabular-nums tracking-tight" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>${contractTotal.toLocaleString()}</span></div>
            <div className="stat-card anim-appear"><div className="flex items-center gap-2 mb-1"><div className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-4)]" style={{ background: "var(--color-bg-tertiary)" }}><CircleCheck size={16} style={{ color: "var(--color-text-tertiary)" }} /></div><span className="text-[13px]" style={{ color: "var(--color-text-tertiary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{t("pipeline.clients.totalReceived")}</span></div><span className="text-[18px] tabular-nums tracking-tight" style={{ color: "var(--color-success)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>${totalReceived.toLocaleString()}</span></div>
          </div>

          <div className="space-y-2 mb-3">
            {/* Unified toolbar row */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[140px]">
                <label htmlFor="client-search" className="sr-only">{t("pipeline.clients.search")}</label>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={14} style={{ color: "var(--color-text-tertiary)" }} aria-hidden="true" />
                <input id="client-search" defaultValue={search} onChange={e => { const v = e.target.value; if (searchTimerRef.current) clearTimeout(searchTimerRef.current); searchTimerRef.current = setTimeout(() => setSearch(v), 300); }} placeholder={t("pipeline.clients.search")} className="input-base compact w-full pl-9 pr-3 text-[14px]" />
              </div>
              <div className="w-px h-5 shrink-0 hidden sm:block" style={{ background: "var(--color-border-primary)" }} />
              <Filter size={14} className="shrink-0" style={{ color: "var(--color-text-tertiary)" }} aria-hidden="true" />
              <select value={filterSt} onChange={e => setFilterSt(e.target.value)} aria-label="Filter by status" className="input-base compact px-2 text-[14px]">
                <option value="All">{t("common.all")}</option><option value="Active">{t("common.active")}</option><option value="Paused">{t("common.paused")}</option>
              </select>
              <select value={filterBilling} onChange={e => setFilterBilling(e.target.value)} aria-label="Filter by billing type" className="input-base compact px-2 text-[14px]">
                <option value="All">{t("pipeline.filter.billingAll")}</option>
                <option value="subscription">{t("pipeline.clients.billingSubscription")}</option>
                <option value="project">{t("pipeline.clients.billingProject")}</option>
              </select>
              {uniquePlanTiers.length > 0 && (
                <select value={filterPlan} onChange={e => setFilterPlan(e.target.value)} aria-label="Filter by plan" className="input-base compact px-2 text-[14px]">
                  <option value="All">{t("pipeline.filter.planAll")}</option>
                  {uniquePlanTiers.map(p => <option key={p} value={p}>{p === "Basic" ? t("pipeline.convert.planBasic") : p === "Pro" ? t("pipeline.convert.planPro") : p === "Enterprise" ? t("pipeline.convert.planEnterprise") : p}</option>)}
                </select>
              )}
              <div className="flex-1" />
              <button onClick={exportClientsCSV} className="btn-ghost compact shrink-0"><Download size={16} /></button>
              <button onClick={() => openPanel()} className="btn-primary compact shrink-0"><Plus size={16} /> <span className="hidden sm:inline">{t("pipeline.addClient")}</span></button>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2 pb-4">
            {!filtered.length && <div className="py-10 text-center text-[15px]" style={{ color: "var(--color-text-secondary)" }}>{clients.length === 0 ? t("pipeline.clients.empty") : t("pipeline.clients.noMatch")}</div>}
            {filtered.map(c => {
              const plan = c.plan_tier === "Basic" ? t("pipeline.convert.planBasic") : c.plan_tier === "Pro" ? t("pipeline.convert.planPro") : c.plan_tier === "Enterprise" ? t("pipeline.convert.planEnterprise") : (c.plan_tier || c.plan);
              return (
                <button key={c.id} onClick={() => openPanel(c)} className="w-full text-left card-interactive p-3 flex items-center gap-3 press-feedback">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-6)] text-[13px]" style={{ background: "var(--color-accent-tint)", color: "var(--color-accent)", fontWeight: "var(--font-weight-bold)" } as React.CSSProperties}>{(c.company_name || c.name || "?").charAt(0).toUpperCase()}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0"><span className="text-[15px] truncate" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{c.company_name || c.name}</span>
                      <span className="badge" style={c.status === "Active" ? { background: "var(--color-success-light)", color: "var(--color-success)" } : { background: "var(--color-warning-light)", color: "var(--color-warning)" }}>{c.status === "Active" ? t("common.active") : t("common.paused")}</span>
                    </div>
                    {c.contact_name && <div className="text-[13px] mt-0.5 truncate" style={{ color: "var(--color-text-secondary)" }}>{c.contact_name}{c.contact_phone ? ` · ${c.contact_phone}` : ""}</div>}
                    <div className="text-[13px] mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
                      {c.billing_type === "project"
                        ? <>{t("pipeline.clients.billingProject")} · {t("pipeline.clients.contract")} <strong style={{ color: "var(--color-text-primary)" }}>${Number(c.project_fee || 0).toLocaleString()}</strong></>
                        : <>{plan} · <strong style={{ color: "var(--color-text-primary)" }}>${Number(c.mrr || 0).toLocaleString()}</strong>{t("pipeline.clients.perMonth")}</>
                      }
                      {(() => { const cR = tx.finTxs.filter((r: FinanceTransaction) => r.type === "income" && (r.status || "已完成") === "已完成" && r.client_id === c.id).reduce((s: number, r: FinanceTransaction) => s + Number(r.amount || 0), 0); return cR > 0 ? <> · <span style={{ color: "var(--color-success)" }}>{t("pipeline.clients.received")} ${cR.toLocaleString()}</span></> : null; })()}
                      {c.tax_mode && c.tax_mode !== "none" && <> · <span style={{ color: "var(--color-accent)" }}>{c.tax_mode === "exclusive" ? t("money.form.taxExclBtn") : t("money.form.taxIncl")} {c.tax_rate}%</span></>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Desktop table */}
          <div ref={parentRef} className="hidden md:block card flex-1 overflow-auto min-h-[400px]">
            <table className="w-full text-left min-w-[960px]">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3">{t("pipeline.clients.table.name")}</th><th className="px-4 py-3">{t("pipeline.clients.table.contact")}</th><th className="px-4 py-3">{t("pipeline.clients.table.type")}</th><th className="px-4 py-3">{t("pipeline.clients.table.plan")}</th><th className="px-4 py-3">{t("pipeline.clients.table.status")}</th><th className="px-4 py-3">{t("pipeline.clients.table.expectedActual")}</th><th className="px-4 py-3">{t("pipeline.clients.startDate")}</th><th className="px-4 py-3">{t("pipeline.clients.taxSetting")}</th><th className="px-4 py-3 text-right">{t("pipeline.clients.table.actions")}</th>
                </tr>
              </thead>
              <tbody className="text-[15px]">
                {padTop > 0 && <tr><td style={{ height: padTop, padding: 0 }} colSpan={9} /></tr>}
                {vItems.map(vr => {
                  const c = filtered[vr.index];
                  const plan = c.plan_tier === "Basic" ? t("pipeline.convert.planBasic") : c.plan_tier === "Pro" ? t("pipeline.convert.planPro") : c.plan_tier === "Enterprise" ? t("pipeline.convert.planEnterprise") : (c.plan_tier || c.plan);
                  const displayName = c.company_name || c.name;
                  const displayInitial = displayName.charAt(0).toUpperCase();
                  return (
                    <tr key={c.id} data-index={vr.index} ref={rowV.measureElement} className="group cursor-pointer"
                      onClick={() => openPanel(c)}>
                      <td className="px-4 py-3 max-w-[200px]"><div className="flex items-center gap-3 min-w-0"><div className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-4)] text-[13px] shrink-0" style={{ background: "var(--color-accent-tint)", color: "var(--color-accent)", fontWeight: "var(--font-weight-bold)" } as React.CSSProperties}>{displayInitial}</div><span className="truncate" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{displayName}</span></div></td>
                      <td className="px-4 py-3"><div className="min-w-0">{c.contact_name && <span className="text-[15px] block truncate" style={{ color: "var(--color-text-primary)" }}>{c.contact_name}</span>}{c.contact_email && <span className="text-[13px] block truncate" style={{ color: "var(--color-text-secondary)" }}>{c.contact_email}</span>}</div></td>
                      <td className="px-4 py-3"><span className={`badge ${c.billing_type === "project" ? "badge-orange" : "badge-blue"}`}>{c.billing_type === "project" ? t("pipeline.clients.billingProject") : t("pipeline.clients.billingSubscription")}</span></td>
                      <td className="px-4 py-3"><span className="badge">{c.billing_type === "project" ? "—" : plan}</span></td>
                      <td className="px-4 py-3"><span className={`badge ${c.status === "Active" ? "badge-success" : "badge-warning"}`}>{c.status === "Active" ? t("common.active") : t("common.paused")}</span></td>
                      <td className="px-4 py-3 tabular-nums" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
                        <div>${c.billing_type === "project" ? Number(c.project_fee || 0).toLocaleString() : Number(c.lifetimeRevenue || 0).toLocaleString()}</div>
                        {(() => { const cReceived = tx.finTxs.filter((r: FinanceTransaction) => r.type === "income" && (r.status || "已完成") === "已完成" && r.client_id === c.id).reduce((s: number, r: FinanceTransaction) => s + Number(r.amount || 0), 0); return cReceived > 0 ? <div className="text-[13px]" style={{ color: "var(--color-success)" }}>{t("pipeline.clients.received")} ${cReceived.toLocaleString()}</div> : null; })()}
                        {c.billing_type === "subscription" && <div className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>${Number(c.mrr || 0).toLocaleString()}{t("pipeline.clients.perMonth")}</div>}
                      </td>
                      <td className="px-4 py-3 text-[15px]" style={{ color: "var(--color-text-secondary)" }}>{c.subscription_start_date || c.joined_at?.split("T")[0] || "—"}</td>
                      <td className="px-4 py-3">{c.tax_mode && c.tax_mode !== "none" ? <span className="badge badge-accent">{c.tax_mode === "exclusive" ? t("money.form.taxExclBtn") : t("money.form.taxIncl")} {c.tax_rate}%</span> : <span style={{ color: "var(--color-text-secondary)" }}>—</span>}</td>
                      <td className="px-4 py-3 text-right"><button onClick={e => { e.stopPropagation(); openPanel(c); }} className="btn-ghost text-[13px]"><Edit2 size={16} /> {t("common.edit")}</button></td>
                    </tr>
                  );
                })}
                {padBot > 0 && <tr><td style={{ height: padBot, padding: 0 }} colSpan={9} /></tr>}
              </tbody>
            </table>
            {!filtered.length && <div className="p-8 text-center text-[15px]" style={{ color: "var(--color-text-secondary)" }}>{clients.length === 0 ? t("pipeline.clients.empty") : t("pipeline.clients.noMatch")}</div>}
          </div>
        </>
      )}

      {/* ═══ Client Side Panel ═══ */}
      {createPortal(<AnimatePresence>
        {showPanel && (
          <motion.div key="client-panel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <div className="fixed inset-0" style={{ zIndex: "var(--layer-dialog-overlay)", background: "var(--color-overlay-primary)" }} onClick={() => setShowPanel(false)} />
            <motion.div
              initial={{ x: isMobile ? 0 : "100%", y: isMobile ? "100%" : 0 }}
              animate={{ x: 0, y: 0 }}
              exit={{ x: isMobile ? 0 : "100%", y: isMobile ? "100%" : 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              role="dialog"
              aria-modal="true"
              aria-label="Client detail"
              className={isMobile ? "fixed inset-0 flex flex-col" : "fixed top-0 right-0 h-full w-full max-w-[440px] lg:max-w-[520px] flex flex-col border-l"}
              style={{ zIndex: "var(--layer-dialog)", background: "var(--color-bg-primary)", borderColor: "var(--color-border-primary)", boxShadow: "var(--shadow-high)", paddingTop: isMobile ? "var(--mobile-header-pt, max(env(safe-area-inset-top, 0px), 0px))" : undefined }}
            >
              <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "var(--color-border-primary)" }}>
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-6)]" style={{ background: "var(--color-accent-tint)", color: "var(--color-accent)" }}><UserPlus size={16} /></div>
                  <span className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{editId ? t("pipeline.panel.editClient") : t("pipeline.panel.newClient")}</span>
                </div>
                <button onClick={() => setShowPanel(false)} className="btn-icon" aria-label="Close panel">{isMobile ? <X size={18} /> : <PanelRightClose size={18} />}</button>
              </div>
              <div className="flex-1 overflow-y-auto overflow-x-hidden ios-scroll">
                {/* ═══ Tab Bar (underline style — primary navigation) ═══ */}
                <div className="sticky top-0 z-10 px-5" style={{ background: "var(--color-bg-primary)" }}>
                  <div className="flex gap-0 relative" style={{ borderBottom: "1px solid var(--color-border-primary)" }}>
                    {([
                      { key: 'info' as const, label: t("pipeline.clients.tab.info") },
                      { key: 'billing' as const, label: form.billing_type === 'subscription' ? t("pipeline.clients.tab.subscription") : t("pipeline.clients.tab.projects") },
                      ...(editId ? [{ key: 'finance' as const, label: t("pipeline.clients.tab.finance") }] : []),
                    ] as { key: string; label: string }[]).map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => setPanelTab(tab.key as 'info' | 'billing' | 'finance')}
                        className="relative px-4 py-3 text-[14px] transition-colors"
                        style={{
                          color: panelTab === tab.key ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
                          fontWeight: panelTab === tab.key ? "var(--font-weight-semibold)" : "var(--font-weight-medium)",
                        } as React.CSSProperties}
                      >
                        {tab.label}
                        {panelTab === tab.key && (
                          <motion.div
                            layoutId="client-panel-tab-indicator"
                            className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full"
                            style={{ background: "var(--color-accent)" }}
                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                          />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-5 space-y-4">

                {/* ═══ TAB 1: Overview / Info ═══ */}
                {panelTab === 'info' && (<>
                {/* Company & Contact */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <FL label={t("pipeline.clients.companyName")}>
                      <div>
                        <div className="relative">
                          <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" style={{ color: formErrors.company_name ? "var(--color-danger)" : "var(--color-text-tertiary)" }} />
                          <input required value={form.company_name} onChange={e => { setForm(p => ({ ...p, company_name: e.target.value, name: e.target.value || p.contact_name })); setFormErrors(prev => ({...prev, company_name: false})); }} className="input-base w-full pl-9 pr-3 py-2.5 text-[15px]" style={{ borderColor: formErrors.company_name ? 'var(--color-danger)' : undefined }} />
                        </div>
                        {formErrors.company_name && <span className="text-[12px] mt-1 block" style={{ color: 'var(--color-danger)' }}>必填项</span>}
                      </div>
                    </FL>
                  </div>
                  <FL label={t("pipeline.clients.contactName")}>
                    <div className="relative">
                      <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" style={{ color: "var(--color-text-tertiary)" }} />
                      <input value={form.contact_name} onChange={e => setForm(p => ({ ...p, contact_name: e.target.value, name: p.company_name || e.target.value }))} className="input-base w-full pl-9 pr-3 py-2.5 text-[15px]" />
                    </div>
                  </FL>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FL label={t("pipeline.clients.contactEmail")}>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" style={{ color: "var(--color-text-tertiary)" }} />
                      <input type="email" value={form.contact_email} onChange={e => setForm(p => ({ ...p, contact_email: e.target.value }))} className="input-base w-full pl-9 pr-3 py-2.5 text-[15px]" />
                    </div>
                  </FL>
                  <FL label={t("pipeline.clients.contactPhone")}>
                    <div className="relative">
                      <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" style={{ color: "var(--color-text-tertiary)" }} />
                      <input type="tel" value={form.contact_phone} onChange={e => setForm(p => ({ ...p, contact_phone: e.target.value }))} className="input-base w-full pl-9 pr-3 py-2.5 text-[15px]" />
                    </div>
                  </FL>
                </div>

                {/* Google Drive folder link */}
                <FL label={t("pipeline.clients.driveFolder")}>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Link size={16} className="absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" style={{ color: "var(--color-text-tertiary)" }} />
                      <input value={form.drive_folder_url} onChange={e => setForm(p => ({ ...p, drive_folder_url: e.target.value }))} placeholder={t("pipeline.clients.drivePlaceholder")} className="input-base w-full pl-9 pr-3 py-2.5 text-[15px]" />
                    </div>
                    {form.drive_folder_url && (
                      <button type="button" onClick={() => window.open(form.drive_folder_url, '_blank')} className="btn-ghost flex items-center gap-1 px-3 shrink-0 text-[13px]" style={{ color: "var(--color-accent)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
                        <ExternalLink size={14} /> {t("pipeline.clients.openDrive")}
                      </button>
                    )}
                  </div>
                </FL>

                <div className="border-t" style={{ borderColor: "var(--color-border-primary)" }} />

                {/* Billing type — card selector with icons */}
                <FL label={t("pipeline.clients.billingType")}>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { value: "subscription" as const, label: t("pipeline.clients.billingSubscription"), icon: <PlayCircle size={16} />, hint: t("pipeline.clients.billingSubHint") },
                      { value: "project" as const, label: t("pipeline.clients.billingProject"), icon: <Layers size={16} />, hint: t("pipeline.clients.billingProjHint") },
                    ]).map(bt => {
                      const active = form.billing_type === bt.value;
                      return (
                        <button key={bt.value} type="button" onClick={() => {
                          if (editId && bt.value !== form.billing_type) {
                            const message = bt.value === "project"
                              ? t("pipeline.clients.switchToProjectConfirm")
                              : t("pipeline.clients.switchToSubConfirm");
                            setBillingConfirm({ type: bt.value, message });
                          } else {
                            setForm(p => ({ ...p, billing_type: bt.value }));
                          }
                        }}
                          className="flex flex-col items-start gap-1 p-3 rounded-[var(--radius-12)] text-left transition-all"
                          style={{
                            background: active ? "var(--color-accent-tint)" : "var(--color-bg-tertiary)",
                            border: `1px solid ${active ? "var(--color-accent)" : "var(--color-border-primary)"}`,
                          }}>
                          <div className="flex items-center gap-2">
                            <span style={{ color: active ? "var(--color-accent)" : "var(--color-text-tertiary)" }}>{bt.icon}</span>
                            <span className="text-[14px]" style={{ color: active ? "var(--color-accent)" : "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{bt.label}</span>
                          </div>
                          <span className="text-[12px] leading-tight pl-6" style={{ color: "var(--color-text-tertiary)" }}>{bt.hint}</span>
                        </button>
                      );
                    })}
                  </div>
                </FL>

                {/* Status — card selector matching billing type style */}
                <FL label={t("common.status")}>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { value: "Active", label: t("common.active"), hint: t("pipeline.clients.statusActiveHint"), color: "var(--color-success)" },
                      { value: "Paused", label: t("common.paused"), hint: t("pipeline.clients.statusPausedHint"), color: "var(--color-warning)" },
                    ] as const).map(st => {
                      const active = form.status === st.value;
                      return (
                        <button key={st.value} type="button" onClick={() => setForm(p => ({ ...p, status: st.value }))}
                          className="flex flex-col items-start gap-1 p-3 rounded-[var(--radius-12)] text-left transition-all"
                          style={{
                            background: active ? `color-mix(in srgb, ${st.color} 8%, transparent)` : "var(--color-bg-tertiary)",
                            border: `1px solid ${active ? st.color : "var(--color-border-primary)"}`,
                          }}>
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: active ? st.color : "var(--color-text-quaternary)" }} />
                            <span className="text-[14px]" style={{ color: active ? st.color : "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{st.label}</span>
                          </div>
                          <span className="text-[12px] leading-tight pl-4" style={{ color: "var(--color-text-tertiary)" }}>{st.hint}</span>
                        </button>
                      );
                    })}
                  </div>
                </FL>
                </>)}

                {/* ═══ TAB 2: Billing Details ═══ */}
                {panelTab === 'billing' && (<>
                {form.billing_type === "subscription" ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <FL label={t("pipeline.convert.plan")}><select value={form.plan} onChange={e => { const v = e.target.value; const p = plans.find((x: PlanRow) => x.name === v); setForm(prev => ({ ...prev, plan: v, mrr: p ? String(p.price) : prev.mrr })); }} className="input-base w-full px-3 py-2 text-[15px]"><option value="">{t("pipeline.convert.planSelect")}</option>{plans.map((p: PlanRow) => <option key={p.id} value={p.name}>{p.name}</option>)}</select></FL>
                    </div>
                    <FL label={t("pipeline.convert.mrr")}><input type="number" required min="0" value={form.mrr} onChange={e => setForm(p => ({ ...p, mrr: e.target.value }))} className="input-base w-full px-3 py-2 text-[15px]" /></FL>
                    {/* Payment method — unified card selector */}
                    <FL label={t("pipeline.clients.paymentMethod")}>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          { value: "auto", label: t("pipeline.clients.payAuto"), hint: t("pipeline.clients.payAutoHint"), icon: <PlayCircle size={16} /> },
                          { value: "manual", label: t("pipeline.clients.payManual"), hint: t("pipeline.clients.payManualHint"), icon: <DollarSign size={16} /> },
                        ]).map(pm => {
                          const active = form.payment_method === pm.value;
                          return (
                            <button key={pm.value} type="button" onClick={() => setForm(p => ({ ...p, payment_method: pm.value }))}
                              className="flex flex-col items-start gap-1 p-3 rounded-[var(--radius-12)] text-left transition-all"
                              style={{
                                background: active ? "var(--color-accent-tint)" : "var(--color-bg-tertiary)",
                                border: `1px solid ${active ? "var(--color-accent)" : "var(--color-border-primary)"}`,
                              }}>
                              <div className="flex items-center gap-2">
                                <span style={{ color: active ? "var(--color-accent)" : "var(--color-text-tertiary)" }}>{pm.icon}</span>
                                <span className="text-[14px]" style={{ color: active ? "var(--color-accent)" : "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{pm.label}</span>
                              </div>
                              <span className="text-[12px] leading-tight pl-6" style={{ color: "var(--color-text-tertiary)" }}>{pm.hint}</span>
                            </button>
                          );
                        })}
                      </div>
                    </FL>
                    {/* Tax settings — after amount */}
                    <FL label={t("pipeline.clients.taxSetting")}>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {([["none", t("money.form.taxNone")], ["exclusive", t("money.form.taxExclBtn")], ["inclusive", t("money.form.taxIncl")]] as [string, string][]).map(([mode, label]) => (
                          <button key={mode} type="button" onClick={() => setForm(p => ({ ...p, tax_mode: mode }))}
                            className="flex-1 py-2 rounded-full text-[15px] transition-all"
                            style={form.tax_mode === mode ? { background: "var(--color-accent)", color: "var(--color-brand-text)", fontWeight: "var(--font-weight-medium)" } : { background: "var(--color-bg-tertiary)", color: "var(--color-text-secondary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
                            {label}
                          </button>
                        ))}
                      </div>
                      {form.tax_mode !== "none" && (
                        <div className="flex flex-wrap gap-2">
                          {[13, 6, 3].map(r => (
                            <button key={r} type="button" onClick={() => setForm(p => ({ ...p, tax_rate: String(r) }))}
                              className="px-3 py-2 rounded-[var(--radius-4)] text-[13px] transition-all"
                              style={Number(form.tax_rate) === r ? { background: "var(--color-accent-tint)", color: "var(--color-accent)", border: "1px solid var(--color-accent)", fontWeight: "var(--font-weight-medium)" } : { background: "var(--color-bg-tertiary)", color: "var(--color-text-secondary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
                              {r}%
                            </button>
                          ))}
                          <input type="number" min="0" max="100" step="0.01" value={form.tax_rate} onChange={e => setForm(p => ({ ...p, tax_rate: e.target.value }))} placeholder={t("money.form.customTaxPlaceholder")} className="input-base flex-1 px-3 py-2 text-[15px] min-w-0" />
                        </div>
                      )}
                    </FL>
                    <div className="border-t" style={{ borderColor: "var(--color-border-primary)" }} />
                    <span className="section-label">{t("pipeline.clients.timeline")}</span>
                    <div className="space-y-2">
                      {form.timeline.map((evt, i) => {
                        const labels: Record<string, string> = { start: t("pipeline.clients.start"), pause: t("pipeline.clients.pause"), resume: t("pipeline.clients.resume"), cancel: t("pipeline.clients.cancel") };
                        const colors: Record<string, string> = { start: "var(--color-success)", pause: "var(--color-warning)", resume: "var(--color-blue)", cancel: "var(--color-danger)" };
                        return (
                          <div key={i} className="flex items-center gap-2">
                            <span className="badge text-[13px] shrink-0" style={{ background: `${colors[evt.type]}20`, color: colors[evt.type], minWidth: 40, textAlign: "center" }}>{labels[evt.type] || evt.type}</span>
                            <input type="date" value={evt.date} onChange={e => { const tl = [...form.timeline]; tl[i] = { ...tl[i], date: e.target.value }; setForm(p => ({ ...p, timeline: tl })); }} className="input-base flex-1 px-3 py-2 text-[15px]" />
                            {i > 0 && <button type="button" onClick={() => { const tl = form.timeline.filter((_, j) => j !== i); setForm(p => ({ ...p, timeline: tl })); }} className="btn-icon-sm" style={{ color: "var(--color-danger)" }}><X size={16} /></button>}
                          </div>
                        );
                      })}
                      <div className="flex gap-2 flex-wrap">
                        {(() => {
                          const last = form.timeline[form.timeline.length - 1];
                          const hasCancelled = form.timeline.some(e => e.type === "cancel");
                          if (hasCancelled) return null;
                          const today = todayDateKey();
                          if (!last || last.type === "start" || last.type === "resume") {
                            return (<>
                              <button type="button" onClick={() => setForm(p => ({ ...p, timeline: [...p.timeline, { type: "pause", date: today }] }))} className="btn-ghost text-[13px] flex items-center gap-1" style={{ color: "var(--color-warning)" }}><Plus size={12} /> {t("pipeline.clients.pause")}</button>
                              <button type="button" onClick={() => setForm(p => ({ ...p, timeline: [...p.timeline, { type: "cancel", date: today }] }))} className="btn-ghost text-[13px] flex items-center gap-1" style={{ color: "var(--color-danger)" }}><Plus size={12} /> {t("pipeline.clients.cancel")}</button>
                            </>);
                          }
                          if (last.type === "pause") {
                            return (<>
                              <button type="button" onClick={() => setForm(p => ({ ...p, timeline: [...p.timeline, { type: "resume", date: today }] }))} className="btn-ghost text-[13px] flex items-center gap-1" style={{ color: "var(--color-blue)" }}><Plus size={12} /> {t("pipeline.clients.resume")}</button>
                              <button type="button" onClick={() => setForm(p => ({ ...p, timeline: [...p.timeline, { type: "cancel", date: today }] }))} className="btn-ghost text-[13px] flex items-center gap-1" style={{ color: "var(--color-danger)" }}><Plus size={12} /> {t("pipeline.clients.cancel")}</button>
                            </>);
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* ═══ Projects Section ═══ */}
                    {editId ? (
                      <>
                        <div className="flex items-center justify-between pt-1">
                          <span className="section-label">{t("pipeline.projects.title")}</span>
                          <button onClick={() => proj.openAddForm()} className="btn-ghost text-[13px] flex items-center gap-1" style={{ color: "var(--color-accent)" }}><Plus size={16} /> {t("pipeline.projects.add")}</button>
                        </div>

                        {proj.loading ? (
                          <div className="space-y-2"><Skeleton className="h-16 rounded-[var(--radius-12)]" /><Skeleton className="h-16 rounded-[var(--radius-12)]" /></div>
                        ) : proj.projects.length === 0 && !proj.showAddForm ? (
                          <div className="text-center py-4 text-[15px]" style={{ color: "var(--color-text-secondary)" }}>{t("pipeline.projects.empty")}</div>
                        ) : (
                          <div className="space-y-2">
                            {/* Active projects */}
                            {proj.projects.filter(p => p.status === "active").map(p => (
                              <div key={p.id} role="button" tabIndex={0} onClick={() => proj.setActiveProjectId(p.id)}
                                className="w-full text-left rounded-[var(--radius-6)] p-3 transition-colors cursor-pointer"
                                style={{ background: p.id === proj.activeProjectId ? "var(--color-accent-tint)" : "var(--color-bg-tertiary)", border: `1px solid ${p.id === proj.activeProjectId ? "var(--color-accent)" : "var(--color-border-primary)"}` }}>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{p.name}</span>
                                    <span className="badge text-[13px]" style={{ background: "var(--color-success-light)", color: "var(--color-success)" }}>{t("pipeline.projects.status.active")}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[15px] tabular-nums" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>${Number(p.project_fee || 0).toLocaleString()}</span>
                                    <button type="button" onClick={e => { e.stopPropagation(); proj.openEditForm(p); }} className="btn-icon-sm"><Edit2 size={14} /></button>
                                    <button type="button" onClick={e => { e.stopPropagation(); setDeleteProjectId(p.id); }} className="btn-icon-sm" style={{ color: "var(--color-danger)" }}><Trash2 size={14} /></button>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 mt-1 text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
                                  {p.project_start_date && <span>{p.project_start_date}</span>}
                                  {p.project_end_date && <span>→ {p.project_end_date}</span>}
                                  {p.tax_mode && p.tax_mode !== "none" && <span style={{ color: "var(--color-accent)" }}>{p.tax_mode === "exclusive" ? t("money.form.taxExclBtn") : t("money.form.taxIncl")} {p.tax_rate}%</span>}
                                </div>
                              </div>
                            ))}

                            {/* Completed / cancelled projects (collapsed) */}
                            {(() => {
                              const done = proj.projects.filter(p => p.status === "completed" || p.status === "cancelled");
                              if (!done.length) return null;
                              return (
                                <div>
                                  <button type="button" onClick={() => setCompletedExpanded(v => !v)} className="w-full text-left text-[13px] py-2 flex items-center gap-1" style={{ color: "var(--color-text-tertiary)" }}>
                                    <span style={{ transform: completedExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s", display: "inline-block" }}>▸</span>
                                    {t("pipeline.projects.completedSection")} ({done.length})
                                  </button>
                                  {completedExpanded && done.map(p => (
                                    <div key={p.id} role="button" tabIndex={0} onClick={() => proj.setActiveProjectId(p.id)}
                                      className="w-full text-left rounded-[var(--radius-6)] p-3 mb-2 transition-colors opacity-70 cursor-pointer"
                                      style={{ background: p.id === proj.activeProjectId ? "var(--color-accent-tint)" : "var(--color-bg-tertiary)", border: `1px solid ${p.id === proj.activeProjectId ? "var(--color-accent)" : "var(--color-border-primary)"}` }}>
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <span className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{p.name}</span>
                                          <span className="badge text-[13px]" style={p.status === "completed" ? { background: "color-mix(in srgb, var(--color-blue) 12%, transparent)", color: "var(--color-blue)" } : { background: "color-mix(in srgb, var(--color-text-secondary) 12%, transparent)", color: "var(--color-text-secondary)" }}>{t(`pipeline.projects.status.${p.status}`)}</span>
                                        </div>
                                        <span className="text-[15px] tabular-nums" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>${Number(p.project_fee || 0).toLocaleString()}</span>
                                      </div>
                                      <div className="flex items-center gap-2 mt-1 text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
                                        {p.project_start_date && <span>{p.project_start_date}</span>}
                                        {p.project_end_date && <span>→ {p.project_end_date}</span>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {/* Project add / edit form */}
                        <AnimatePresence>
                          {proj.showAddForm && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                              <div className="rounded-[var(--radius-6)] p-3 space-y-3" style={{ background: "var(--color-bg-tertiary)", border: "1px solid var(--color-accent)", borderStyle: "dashed" }}>
                                <div className="flex items-center justify-between">
                                  <span className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{proj.editProjectId ? t("common.edit") : t("pipeline.projects.add")}</span>
                                  <button onClick={() => proj.closeForm()} className="btn-icon" aria-label="Close"><X size={18} /></button>
                                </div>
                                <FL label={t("pipeline.projects.name")}><input value={proj.projectForm.name} onChange={e => proj.setProjectForm(p => ({ ...p, name: e.target.value }))} placeholder={t("pipeline.projects.defaultName")} className="input-base w-full px-3 py-2 text-[15px]" /></FL>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <FL label={t("pipeline.projects.fee")}><input type="number" min="0" value={proj.projectForm.project_fee} onChange={e => proj.setProjectForm(p => ({ ...p, project_fee: e.target.value }))} className="input-base w-full px-3 py-2 text-[15px]" /></FL>
                                  <FL label={t("pipeline.projects.status")}>
                                    <select value={proj.projectForm.status} onChange={e => proj.setProjectForm(p => ({ ...p, status: e.target.value }))} className="input-base w-full px-3 py-2 text-[15px]">
                                      <option value="active">{t("pipeline.projects.status.active")}</option>
                                      <option value="completed">{t("pipeline.projects.status.completed")}</option>
                                      <option value="cancelled">{t("pipeline.projects.status.cancelled")}</option>
                                    </select>
                                  </FL>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <FL label={t("pipeline.clients.projectStart")}><input type="date" value={proj.projectForm.project_start_date} onChange={e => proj.setProjectForm(p => ({ ...p, project_start_date: e.target.value }))} className="input-base w-full px-3 py-2 text-[15px]" /></FL>
                                  <FL label={t("pipeline.clients.projectEnd")}><input type="date" value={proj.projectForm.project_end_date} onChange={e => proj.setProjectForm(p => ({ ...p, project_end_date: e.target.value }))} className="input-base w-full px-3 py-2 text-[15px]" /></FL>
                                </div>
                                {/* Per-project tax settings */}
                                <FL label={t("pipeline.clients.taxSetting")}>
                                  <div className="flex flex-wrap gap-2 mb-2">
                                    {([["none", t("money.form.taxNone")], ["exclusive", t("money.form.taxExclBtn")], ["inclusive", t("money.form.taxIncl")]] as [string, string][]).map(([mode, label]) => (
                                      <button key={mode} type="button" onClick={() => proj.setProjectForm(p => ({ ...p, tax_mode: mode as "none" | "exclusive" | "inclusive" }))}
                                        className="flex-1 py-2 rounded-full text-[15px] transition-all"
                                        style={proj.projectForm.tax_mode === mode ? { background: "var(--color-accent)", color: "var(--color-brand-text)", fontWeight: "var(--font-weight-medium)" } : { background: "var(--color-bg-tertiary)", color: "var(--color-text-secondary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
                                        {label}
                                      </button>
                                    ))}
                                  </div>
                                  {proj.projectForm.tax_mode !== "none" && (
                                    <div className="flex flex-wrap gap-2">
                                      {[13, 6, 3].map(r => (
                                        <button key={r} type="button" onClick={() => proj.setProjectForm(p => ({ ...p, tax_rate: String(r) }))}
                                          className="px-3 py-2 rounded-[var(--radius-4)] text-[13px] transition-all"
                                          style={Number(proj.projectForm.tax_rate) === r ? { background: "var(--color-accent-tint)", color: "var(--color-accent)", border: "1px solid var(--color-accent)", fontWeight: "var(--font-weight-medium)" } : { background: "var(--color-bg-tertiary)", color: "var(--color-text-secondary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
                                          {r}%
                                        </button>
                                      ))}
                                      <input type="number" min="0" max="100" step="0.01" value={proj.projectForm.tax_rate} onChange={e => proj.setProjectForm(p => ({ ...p, tax_rate: e.target.value }))} placeholder={t("money.form.customTaxPlaceholder")} className="input-base flex-1 px-3 py-2 text-[15px] min-w-0" />
                                    </div>
                                  )}
                                </FL>
                                <div className="flex justify-end gap-2">
                                  <button onClick={() => proj.closeForm()} className="btn-secondary text-[15px]">{t("common.cancel")}</button>
                                  <button onClick={() => proj.saveProject(editId!)} disabled={proj.saving} className="btn-primary text-[15px]">{proj.saving ? t("common.loading") : t("common.save")}</button>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Delete project confirmation */}
                        {deleteProjectId !== null && (
                          <div className="rounded-[var(--radius-6)] p-3 space-y-3" style={{ background: "color-mix(in srgb, var(--color-danger) 6%, var(--color-bg-primary))", border: "1px solid var(--color-danger)" }}>
                            <div className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{t("pipeline.projects.deleteConfirm")}</div>
                            <div className="flex justify-end gap-2">
                              <button onClick={() => setDeleteProjectId(null)} className="btn-secondary text-[15px]">{t("common.cancel")}</button>
                              <button onClick={() => { proj.deleteProject(deleteProjectId, editId!); setDeleteProjectId(null); }} className="text-[15px] px-3 py-2 rounded-[var(--radius-6)]" style={{ background: "var(--color-danger)", color: "var(--color-text-on-color)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{t("common.confirm")}</button>
                            </div>
                          </div>
                        )}

                        {/* ═══ Payment Milestones (per active project) ═══ */}
                        {proj.activeProject && (() => {
                          const pTaxMode = proj.activeProject?.tax_mode || form.tax_mode || "none";
                          const pTaxRate = Number(proj.activeProject?.tax_rate || form.tax_rate || 0);
                          return <>
                            <div className="border-t mt-1" style={{ borderColor: "var(--color-border-primary)" }} />
                            <div className="flex items-center justify-between">
                              <span className="section-label flex items-center gap-1.5"><DollarSign size={16} /> {t("pipeline.milestones.title")}</span>
                              <button onClick={() => ms.openAddForm()} className="btn-ghost text-[13px] flex items-center gap-1" style={{ color: "var(--color-accent)" }}><Plus size={16} /> {t("pipeline.milestones.add")}</button>
                            </div>
                            <div className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>{t("pipeline.milestones.hint")}</div>

                            {/* Progress bar */}
                            {ms.filteredMilestones.length > 0 && (() => {
                              const totalAmt = ms.filteredMilestones.reduce((s: number, m: MilestoneRow) => s + Number(m.amount || 0), 0);
                              const paidAmt = ms.filteredMilestones.filter((m: MilestoneRow) => m.status === "paid").reduce((s: number, m: MilestoneRow) => s + Number(m.amount || 0), 0);
                              const pct = totalAmt > 0 ? Math.round(paidAmt / totalAmt * 100) : 0;
                              return (
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
                                      {ms.filteredMilestones.filter((m: MilestoneRow) => m.status === "paid").length}/{ms.filteredMilestones.length} {t("pipeline.milestones.status.paid").toLowerCase()} · ${paidAmt.toLocaleString()} / ${totalAmt.toLocaleString()}
                                    </span>
                                    <span className="text-[13px] tabular-nums" style={{ color: pct === 100 ? "var(--color-success)" : "var(--color-accent)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{pct}%</span>
                                  </div>
                                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--color-bg-tertiary)" }}>
                                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: pct === 100 ? "var(--color-success)" : "var(--color-accent)" }} />
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Milestone list */}
                            {ms.msLoading ? (
                              <div className="space-y-2"><Skeleton className="h-16 rounded-[var(--radius-12)]" /><Skeleton className="h-16 rounded-[var(--radius-12)]" /></div>
                            ) : ms.filteredMilestones.length === 0 && !ms.showAddMs ? (
                              <div className="text-center py-4 text-[15px]" style={{ color: "var(--color-text-secondary)" }}>{t("pipeline.milestones.noPlan")}</div>
                            ) : (
                              <div className="space-y-2">
                                {ms.filteredMilestones.map((msItem: MilestoneRow) => (
                                  <div key={msItem.id} className="rounded-[var(--radius-6)] p-3 space-y-2 cursor-pointer transition-colors" style={{ background: "var(--color-bg-tertiary)", border: `1px solid ${msItem.status === "paid" ? "var(--color-success)" : "var(--color-border-primary)"}` }} onClick={() => { msItem.status === "paid" ? ms.openEditPaid(msItem) : ms.openEditForm(msItem); }}>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        {msItem.status === "paid" ? <CircleCheck size={16} style={{ color: "var(--color-success)" }} /> : msItem.status === "overdue" ? <AlertCircle size={16} style={{ color: "var(--color-danger)" }} /> : <Clock size={16} style={{ color: "var(--color-text-secondary)" }} />}
                                        <span className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{msItem.label}</span>
                                        <span className="badge text-[13px]" style={
                                          msItem.status === "paid" ? { background: "var(--color-success-light)", color: "var(--color-success)" }
                                          : msItem.status === "overdue" ? { background: "color-mix(in srgb, var(--color-danger) 12%, transparent)", color: "var(--color-danger)" }
                                          : { background: "color-mix(in srgb, var(--color-warning) 12%, transparent)", color: "var(--color-warning)" }
                                        }>{t(`pipeline.milestones.status.${msItem.status}`)}</span>
                                      </div>
                                      <div className="text-right">
                                        {(() => {
                                          const mAmt = Number(msItem.amount || 0);
                                          if (pTaxMode === "none" || !pTaxRate) return <span className="text-[15px] tabular-nums" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>${mAmt.toLocaleString()}</span>;
                                          const mTax = pTaxMode === "exclusive" ? Math.round(mAmt * pTaxRate / 100 * 100) / 100 : Math.round(mAmt * pTaxRate / (100 + pTaxRate) * 100) / 100;
                                          const total = pTaxMode === "exclusive" ? mAmt + mTax : mAmt;
                                          const base = pTaxMode === "inclusive" ? mAmt - mTax : mAmt;
                                          return <>
                                            <span className="text-[15px] tabular-nums" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>${total.toLocaleString()}</span>
                                            <div className="text-[12px] tabular-nums" style={{ color: "var(--color-text-tertiary)" }}>{pTaxMode === "exclusive" ? `${t("pipeline.milestones.amountPreTax")} $${base.toLocaleString()} + ${t("finance.tax")} $${mTax.toLocaleString()}` : `${t("pipeline.milestones.amountPreTax")} $${base.toLocaleString()} · ${t("finance.tax")} $${mTax.toLocaleString()}`}</div>
                                          </>;
                                        })()}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3 text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
                                      {msItem.percentage > 0 && <span>{msItem.percentage}%</span>}
                                      {msItem.due_date && <span>{t("pipeline.milestones.dueDate")}: {msItem.due_date}</span>}
                                      {msItem.paid_date && <span>{t("pipeline.milestones.paidDate")}: {msItem.paid_date}</span>}
                                      {msItem.payment_method && <span>{t(`pipeline.milestones.method.${msItem.payment_method}`)}</span>}
                                    </div>
                                    {msItem.note && <div className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>{msItem.note}</div>}
                                    {msItem.status === "paid" ? (
                                      <div className="text-[13px]" style={{ color: "var(--color-success)" }}>{t("pipeline.milestones.autoRecorded")}</div>
                                    ) : (
                                      <div className="flex items-center gap-2 pt-1" onClick={e => e.stopPropagation()}>
                                        <button onClick={() => { ms.setMarkPaidId(msItem.id); ms.setMarkPaidMethod("bank_transfer"); }} className="text-[14px] px-3 py-1.5 rounded-full flex items-center gap-1" style={{ background: "var(--color-success-light)", color: "var(--color-success)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
                                          <CircleCheck size={16} /> {t("pipeline.milestones.markPaid")}
                                        </button>
                                        <button onClick={() => ms.openEditForm(msItem)} className="btn-icon-sm"><Edit2 size={16} /></button>
                                        <button onClick={() => ms.setDeleteMsId(msItem.id)} className="btn-icon-sm" style={{ color: "var(--color-danger)" }}><Trash2 size={16} /></button>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Add / Edit milestone form */}
                            <AnimatePresence>
                              {ms.showAddMs && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                                  <div className="rounded-[var(--radius-6)] p-3 space-y-3" style={{ background: "var(--color-bg-tertiary)", border: "1px solid var(--color-accent)", borderStyle: "dashed" }}>
                                    <div className="flex items-center justify-between">
                                      <span className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{ms.editMsId ? t("common.edit") : t("pipeline.milestones.add")}</span>
                                      <button onClick={() => ms.closeForm()} className="btn-icon" aria-label="Close"><X size={18} /></button>
                                    </div>
                                    {/* Preset buttons */}
                                    {!ms.editMsId && (
                                      <div className="flex flex-wrap gap-1.5">
                                        {(["deposit", "midway", "final"] as const).map(p => (
                                          <button key={p} onClick={() => ms.applyPreset(p)} className="text-[14px] px-3 py-1.5 rounded-full transition-colors" style={{ background: "color-mix(in srgb, var(--color-accent) 10%, transparent)", color: "var(--color-accent)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
                                            {t(`pipeline.milestones.presets.${p}`)}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                    <FL label={t("pipeline.milestones.label")}><input value={ms.msForm.label} onChange={e => ms.setMsForm(p => ({ ...p, label: e.target.value }))} className="input-base w-full px-3 py-2 text-[15px]" placeholder={t("pipeline.milestones.presets.deposit")} /></FL>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      <FL label={`${t("pipeline.milestones.amount")}${pTaxMode === "exclusive" ? ` · ${t("pipeline.milestones.amountPreTax")}` : pTaxMode === "inclusive" ? ` · ${t("pipeline.milestones.amountInclTax")}` : ""}`}><input type="number" min="0" value={ms.msForm.amount} onChange={e => { const amt = e.target.value; const fee = activeProjFee || 1; ms.setMsForm(p => ({ ...p, amount: amt, percentage: fee > 0 ? String(Math.round(Number(amt) / fee * 100)) : p.percentage })); }} className="input-base w-full px-3 py-2 text-[15px]" /></FL>
                                      <FL label={t("pipeline.milestones.percentage")}><input type="number" min="0" max="100" value={ms.msForm.percentage} onChange={e => { const pct = e.target.value; const fee = activeProjFee || 0; ms.setMsForm(p => ({ ...p, percentage: pct, amount: fee > 0 ? String(Math.round(fee * Number(pct) / 100)) : p.amount })); }} className="input-base w-full px-3 py-2 text-[15px]" /></FL>
                                    </div>
                                    {/* Tax preview (read-only, inherits from project) */}
                                    {(() => {
                                      const msAmt = parseFloat(ms.msForm.amount);
                                      if (pTaxMode === "none" || !pTaxRate || isNaN(msAmt) || msAmt <= 0) return null;
                                      const msTax = pTaxMode === "exclusive" ? Math.round(msAmt * pTaxRate / 100 * 100) / 100 : Math.round(msAmt * pTaxRate / (100 + pTaxRate) * 100) / 100;
                                      const total = pTaxMode === "exclusive" ? msAmt + msTax : msAmt;
                                      const base = pTaxMode === "inclusive" ? msAmt - msTax : msAmt;
                                      return (
                                        <div className="rounded-[var(--radius-4)] px-3 py-2 flex items-center justify-between text-[13px]" style={{ background: "var(--color-bg-tertiary)", color: "var(--color-text-secondary)" }}>
                                          <span>{t("finance.tax")} ({pTaxRate}% {pTaxMode === "exclusive" ? t("pipeline.milestones.taxExclusive") : t("pipeline.milestones.taxInclusive")})</span>
                                          <span className="tabular-nums">{t("pipeline.milestones.amountPreTax")} ${base.toLocaleString()} + ${t("finance.tax")} ${msTax.toLocaleString()} = ${total.toLocaleString()}</span>
                                        </div>
                                      );
                                    })()}
                                    <FL label={t("pipeline.milestones.dueDate")}><input type="date" value={ms.msForm.due_date} onChange={e => ms.setMsForm(p => ({ ...p, due_date: e.target.value }))} className="input-base w-full px-3 py-2 text-[15px]" /></FL>
                                    <FL label={t("pipeline.milestones.note")}><input value={ms.msForm.note} onChange={e => ms.setMsForm(p => ({ ...p, note: e.target.value }))} className="input-base w-full px-3 py-2 text-[15px]" /></FL>
                                    {!ms.editMsId && (
                                      <label className="flex items-center gap-2 cursor-pointer py-1">
                                        <input type="checkbox" checked={ms.msForm.alreadyPaid} onChange={e => ms.setMsForm(p => ({ ...p, alreadyPaid: e.target.checked }))} className="w-4 h-4 rounded accent-[var(--color-success)]" />
                                        <span className="text-[15px]" style={{ color: ms.msForm.alreadyPaid ? "var(--color-success)" : "var(--color-text-secondary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{t("pipeline.milestones.alreadyPaid")}</span>
                                      </label>
                                    )}
                                    {ms.msForm.alreadyPaid && !ms.editMsId && (
                                      <FL label={t("pipeline.milestones.paymentMethod")}>
                                        <select value={ms.msForm.payMethod} onChange={e => ms.setMsForm(p => ({ ...p, payMethod: e.target.value }))} className="input-base w-full px-3 py-2 text-[15px]">
                                          {PAYMENT_METHODS.map(m => <option key={m} value={m}>{t(`pipeline.milestones.method.${m}`)}</option>)}
                                        </select>
                                      </FL>
                                    )}
                                    <div className="flex justify-end gap-2">
                                      <button onClick={() => ms.closeForm()} className="btn-secondary text-[15px]">{t("common.cancel")}</button>
                                      <button onClick={() => ms.saveMilestone(() => tx.fetchFinance())} disabled={!ms.msForm.label || !ms.msForm.amount || ms.savingMs} className="btn-primary text-[15px]">{ms.savingMs ? t("common.loading") : ms.msForm.alreadyPaid && !ms.editMsId ? t("pipeline.milestones.saveAndRecord") : t("common.save")}</button>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>

                            {/* Delete milestone confirmation */}
                            {ms.deleteMsId !== null && (
                              <div className="rounded-[var(--radius-6)] p-3 space-y-3" style={{ background: "color-mix(in srgb, var(--color-danger) 6%, var(--color-bg-primary))", border: "1px solid var(--color-danger)" }}>
                                <div className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{t("pipeline.milestones.deleteConfirm")}</div>
                                <div className="flex justify-end gap-2">
                                  <button onClick={() => ms.setDeleteMsId(null)} className="btn-secondary text-[15px]">{t("common.cancel")}</button>
                                  <button onClick={() => { ms.deleteMilestone(ms.deleteMsId!); ms.setDeleteMsId(null); }} className="text-[15px] px-3 py-2 rounded-[var(--radius-6)]" style={{ background: "var(--color-danger)", color: "var(--color-text-on-color)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{t("common.confirm")}</button>
                                </div>
                              </div>
                            )}

                            {/* Mark Paid confirmation modal */}
                            {ms.markPaidId && (() => {
                              const markMs = ms.milestones.find((m: MilestoneRow) => m.id === ms.markPaidId);
                              const markAmt = Number(markMs?.amount || 0);
                              const taxAmt = pTaxMode === "exclusive" ? Math.round(markAmt * pTaxRate / 100 * 100) / 100
                                : pTaxMode === "inclusive" ? Math.round(markAmt * pTaxRate / (100 + pTaxRate) * 100) / 100 : 0;
                              const markTotal = pTaxMode === "exclusive" ? markAmt + taxAmt : markAmt;
                              const markBase = pTaxMode === "inclusive" ? markAmt - taxAmt : markAmt;
                              return (
                                <div className="rounded-[var(--radius-6)] p-3 space-y-3" style={{ background: "color-mix(in srgb, var(--color-success) 6%, var(--color-bg-primary))", border: "1px solid var(--color-success)" }}>
                                  <div className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{t("pipeline.milestones.markPaidConfirm")}</div>
                                  {/* Finance record preview */}
                                  <div className="rounded-[var(--radius-4)] p-2.5 space-y-1" style={{ background: "var(--color-bg-tertiary)" }}>
                                    <div className="flex items-center justify-between text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
                                      <span>{t("pipeline.milestones.amountPreTax")}</span>
                                      <span className="tabular-nums" style={{ color: "var(--color-text-primary)" } as React.CSSProperties}>${markBase.toLocaleString()}</span>
                                    </div>
                                    {taxAmt > 0 && (
                                      <>
                                        <div className="flex items-center justify-between text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
                                          <span>{t("finance.tax")} ({pTaxRate}% {pTaxMode === "exclusive" ? t("pipeline.milestones.taxExclusive") : t("pipeline.milestones.taxInclusive")})</span>
                                          <span className="tabular-nums">${taxAmt.toLocaleString()}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-[13px] pt-1 border-t" style={{ color: "var(--color-text-primary)", borderColor: "var(--color-border-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>
                                          <span>{t("pipeline.tx.total")}</span>
                                          <span className="tabular-nums">${markTotal.toLocaleString()}</span>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                  <FL label={t("pipeline.milestones.paidDate")}>
                                    <input type="date" value={ms.markPaidDate} onChange={e => ms.setMarkPaidDate(e.target.value)} className="input-base w-full px-3 py-2 text-[15px]" />
                                  </FL>
                                  <FL label={t("pipeline.milestones.paymentMethod")}>
                                    <select value={ms.markPaidMethod} onChange={e => ms.setMarkPaidMethod(e.target.value)} className="input-base w-full px-3 py-2 text-[15px]">
                                      {PAYMENT_METHODS.map(m => <option key={m} value={m}>{t(`pipeline.milestones.method.${m}`)}</option>)}
                                    </select>
                                  </FL>
                                  <div className="flex justify-end gap-2">
                                    <button onClick={() => ms.setMarkPaidId(null)} className="btn-secondary text-[15px]">{t("common.cancel")}</button>
                                    <button onClick={ms.confirmMarkPaid} className="text-[15px] px-3 py-2 rounded-[var(--radius-6)]" style={{ background: "var(--color-success)", color: "var(--color-text-on-color)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>
                                      <Check size={16} className="inline mr-1" />{t("pipeline.milestones.markPaid")}
                                    </button>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Edit paid milestone panel */}
                            {ms.editPaidId && (
                              <div className="rounded-[var(--radius-6)] p-3 space-y-3" style={{ background: "color-mix(in srgb, var(--color-success) 6%, var(--color-bg-primary))", border: "1px solid var(--color-success)" }}>
                                <div className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{t("pipeline.milestones.editPaid")}</div>
                                <FL label={t("pipeline.milestones.paidDate")}>
                                  <input type="date" value={ms.editPaidDate} onChange={e => ms.setEditPaidDate(e.target.value)} className="input-base w-full px-3 py-2 text-[15px]" />
                                </FL>
                                <FL label={`${t("pipeline.milestones.amount")}${pTaxMode === "exclusive" ? ` · ${t("pipeline.milestones.amountPreTax")}` : pTaxMode === "inclusive" ? ` · ${t("pipeline.milestones.amountInclTax")}` : ""}`}>
                                  <input type="number" inputMode="decimal" step="0.01" value={ms.editPaidAmount} onChange={e => ms.setEditPaidAmount(e.target.value)} className="input-base w-full px-3 py-2 text-[15px]" />
                                </FL>
                                {(() => {
                                  const epAmt = parseFloat(ms.editPaidAmount);
                                  if (pTaxMode === "none" || !pTaxRate || isNaN(epAmt) || epAmt <= 0) return null;
                                  const epTax = pTaxMode === "exclusive" ? Math.round(epAmt * pTaxRate / 100 * 100) / 100 : Math.round(epAmt * pTaxRate / (100 + pTaxRate) * 100) / 100;
                                  const total = pTaxMode === "exclusive" ? epAmt + epTax : epAmt;
                                  const base = pTaxMode === "inclusive" ? epAmt - epTax : epAmt;
                                  return (
                                    <div className="rounded-[var(--radius-4)] px-3 py-2 flex items-center justify-between text-[13px]" style={{ background: "var(--color-bg-tertiary)", color: "var(--color-text-secondary)" }}>
                                      <span>{t("finance.tax")} ({pTaxRate}% {pTaxMode === "exclusive" ? t("pipeline.milestones.taxExclusive") : t("pipeline.milestones.taxInclusive")})</span>
                                      <span className="tabular-nums">{t("pipeline.milestones.amountPreTax")} ${base.toLocaleString()} + ${t("finance.tax")} ${epTax.toLocaleString()} = ${total.toLocaleString()}</span>
                                    </div>
                                  );
                                })()}
                                <FL label={t("pipeline.milestones.paymentMethod")}>
                                  <select value={ms.editPaidMethod} onChange={e => ms.setEditPaidMethod(e.target.value)} className="input-base w-full px-3 py-2 text-[15px]">
                                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{t(`pipeline.milestones.method.${m}`)}</option>)}
                                  </select>
                                </FL>
                                <div className="flex items-center justify-between">
                                  <button onClick={() => { ms.setEditPaidId(null); ms.undoMarkPaid(ms.editPaidId!, () => tx.fetchFinance()); }} className="btn-ghost text-[13px] flex items-center gap-1" style={{ color: "var(--color-warning)" }}>
                                    <Undo2 size={12} /> {t("pipeline.milestones.undoPaid")}
                                  </button>
                                  <div className="flex gap-2">
                                    <button onClick={() => ms.setEditPaidId(null)} className="btn-secondary text-[15px]">{t("common.cancel")}</button>
                                    <button onClick={() => ms.saveEditPaid().then(() => tx.fetchFinance())} className="btn-primary text-[15px]">{t("common.save")}</button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </>;
                        })()}
                      </>
                    ) : (
                      /* New client — simple project fields (project created after first save) */
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <FL label={t("pipeline.projects.name")}>
                            <div className="relative">
                              <Layers size={16} className="absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" style={{ color: "var(--color-text-tertiary)" }} />
                              <input value={form.project_name} onChange={e => setForm(p => ({ ...p, project_name: e.target.value }))} placeholder={t("pipeline.projects.defaultName")} className="input-base w-full pl-9 pr-3 py-2.5 text-[15px]" />
                            </div>
                          </FL>
                          <FL label={t("pipeline.clients.projectFee")}>
                            <div className="relative">
                              <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" style={{ color: "var(--color-text-tertiary)" }} />
                              <input type="number" required min="0" value={form.project_fee} onChange={e => setForm(p => ({ ...p, project_fee: e.target.value }))} className="input-base w-full pl-9 pr-3 py-2.5 text-[15px]" />
                            </div>
                          </FL>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <FL label={t("pipeline.clients.projectStart")}><input type="date" value={form.subscription_start_date} onChange={e => { const v = e.target.value; setForm(p => ({ ...p, subscription_start_date: v, timeline: p.timeline.map(ev => ev.type === "start" ? { ...ev, date: v } : ev) })); }} className="input-base w-full px-3 py-2.5 text-[15px]" /></FL>
                          <FL label={t("pipeline.clients.projectEnd")}><input type="date" value={form.project_end_date} onChange={e => setForm(p => ({ ...p, project_end_date: e.target.value }))} className="input-base w-full px-3 py-2.5 text-[15px]" /></FL>
                        </div>
                      </>
                    )}
                  </>
                )}
                </>)}

                {/* ═══ TAB 3: Finance ═══ */}
                {panelTab === 'finance' && editId && (<>
                    <div className="flex items-center justify-between pt-1">
                      <span className="section-label flex items-center gap-1.5"><DollarSign size={16} /> {t("pipeline.tx.title")}</span>
                      <button onClick={() => { const ap = proj.activeProject; tx.openNewTx({ taxMode: ap?.tax_mode || form.tax_mode, taxRate: ap ? String(ap.tax_rate || "") : form.tax_rate }); }} className="btn-ghost text-[13px] flex items-center gap-1" style={{ color: "var(--color-accent)" }}><Plus size={16} /> {t("pipeline.tx.add")}</button>
                    </div>
                    <div className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>{t("pipeline.tx.hint")}</div>

                    {/* Summary bar */}
                    {tx.clientTxs.length > 0 && (() => {
                      const received = tx.clientTxs.filter((r: FinanceTransaction) => r.type === "income" && (r.status || "已完成") === "已完成").reduce((s: number, r: FinanceTransaction) => s + Number(r.amount || 0), 0);
                      const receivedTax = tx.clientTxs.filter((r: FinanceTransaction) => r.type === "income" && (r.status || "已完成") === "已完成").reduce((s: number, r: FinanceTransaction) => s + Number(r.tax_amount || 0), 0);
                      const pending = tx.clientTxs.filter((r: FinanceTransaction) => (r.status || "").includes("应收")).reduce((s: number, r: FinanceTransaction) => { const a = Number(r.amount || 0); const t2 = Number(r.tax_amount || 0); return s + ((r.tax_mode || 'none') === 'exclusive' ? a + t2 : a); }, 0);
                      const expense = tx.clientTxs.filter((r: FinanceTransaction) => r.type === "expense" && (r.status || "已完成") === "已完成").reduce((s: number, r: FinanceTransaction) => { const a = Number(r.amount || 0); const t2 = Number(r.tax_amount || 0); return s + ((r.tax_mode || 'none') === 'exclusive' ? a + t2 : a); }, 0);
                      return (
                        <div className="flex items-center gap-3 text-[13px]" style={{ fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
                          <span style={{ color: "var(--color-success)" }}>{t("pipeline.tx.received")} ${received.toLocaleString()}{receivedTax > 0 ? ` (+${t("finance.tax")} $${receivedTax.toLocaleString()})` : ""}</span>
                          {pending > 0 && <span style={{ color: "var(--color-warning)" }}>{t("pipeline.tx.pending")} ${pending.toLocaleString()}</span>}
                          {expense > 0 && <span style={{ color: "var(--color-text-secondary)" }}>{t("pipeline.tx.expense")} ${expense.toLocaleString()}</span>}
                        </div>
                      );
                    })()}

                    {/* Transaction list */}
                    {tx.clientTxs.length > 0 ? (
                      <div className="space-y-2">
                        {tx.clientTxs.map((txItem: FinanceTransaction) => (
                          <div key={txItem.id} className="rounded-[var(--radius-6)] p-3 space-y-1" style={{ background: "var(--color-bg-tertiary)", border: "1px solid var(--color-border-primary)" }}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                {(() => {
                                  const txAmt = Math.abs(Number(txItem.amount || 0));
                                  const txTax = Math.abs(Number(txItem.tax_amount || 0));
                                  const isInc = txItem.type === "income";
                                  const txMode = txItem.tax_mode || 'none';
                                  // Exclusive expense: add tax; Inclusive expense: amount already has tax
                                  const displayAmt = isInc ? txAmt : (txMode === 'exclusive' ? txAmt + txTax : txAmt);
                                  return (<>
                                    <span className="text-[15px] tabular-nums shrink-0" style={{ color: isInc ? "var(--color-success)" : "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>
                                      {isInc ? "+" : "-"}${displayAmt.toLocaleString()}
                                    </span>
                                    {txTax > 0 && <span className="text-[13px] tabular-nums shrink-0" style={{ color: "var(--color-text-secondary)" }}>{txMode === "exclusive" ? `+${t("finance.tax")} $${txTax.toLocaleString()}` : txMode === "inclusive" ? `${t("finance.taxIncluded")} $${txTax.toLocaleString()}` : ""}</span>}
                                  </>);
                                })()}
                                <span className="text-[15px] truncate" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{txItem.description || txItem.desc}</span>
                              </div>
                              {/* Subscription confirm/undo receipt */}
                              {txItem.source === "subscription" && (txItem.status || "").includes("应收") && (
                                <button onClick={() => tx.confirmReceipt(txItem.id)} className="btn-primary compact text-[13px]">{t("pipeline.tx.confirmReceipt")}</button>
                              )}
                              {txItem.source === "subscription" && (txItem.status || "") === "已完成" && (
                                <button onClick={() => tx.undoReceipt(txItem.id)} className="btn-ghost compact text-[13px]" style={{ color: "var(--color-text-tertiary)" }}>
                                  <Undo2 size={13} className="mr-1" />{t("pipeline.tx.undoReceipt")}
                                </button>
                              )}
                              {/* Manual tx edit/delete */}
                              {(!txItem.source || txItem.source === "manual") && (
                                <div className="flex items-center gap-1 shrink-0">
                                  <button onClick={() => tx.openEditTx(txItem)} className="btn-icon-sm"><Edit2 size={16} /></button>
                                  <button onClick={() => tx.setDeleteTxId(txItem.id)} className="btn-icon-sm" style={{ color: "var(--color-danger)" }}><Trash2 size={16} /></button>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>{txItem.date}</span>
                              <span className="badge text-[13px]">{catLabel(txItem.category, t)}</span>
                              <span className="badge text-[13px]" style={{
                                background: (txItem.status || "已完成") === "已完成" ? "var(--color-success-light)" : (txItem.status || "").includes("应收") ? "var(--color-warning-light)" : "var(--color-danger-light)",
                                color: (txItem.status || "已完成") === "已完成" ? "var(--color-success)" : (txItem.status || "").includes("应收") ? "var(--color-warning)" : "var(--color-danger)",
                              }}>{stLabel(txItem.status || "已完成", t)}</span>
                              {txItem.source === "subscription" && <span className="badge text-[13px]" style={{ background: "color-mix(in srgb, var(--color-blue) 12%, transparent)", color: "var(--color-blue)" }}>{t("money.badge.subscription")}</span>}
                              {txItem.source === "milestone" && <span className="badge text-[13px]" style={{ background: "color-mix(in srgb, var(--color-orange) 12%, transparent)", color: "var(--color-orange)" }}>{t("money.badge.project")}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : !tx.showTxForm && (
                      <div className="text-center py-3 text-[15px]" style={{ color: "var(--color-text-secondary)" }}>{t("pipeline.tx.empty")}</div>
                    )}

                    {/* Add/Edit transaction form */}
                    <AnimatePresence>
                      {tx.showTxForm && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                          <div className="rounded-[var(--radius-6)] p-3 space-y-3" style={{ background: "var(--color-bg-tertiary)", border: "1px solid var(--color-accent)", borderStyle: "dashed" }}>
                            <div className="flex items-center justify-between">
                              <span className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{tx.editTxId ? t("common.edit") : t("pipeline.tx.add")}</span>
                              <button onClick={() => tx.closeTxForm()} className="btn-icon" aria-label="Close"><X size={18} /></button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <FL label={t("pipeline.tx.date")}><input type="date" value={tx.txForm.date} onChange={e => tx.setTxForm(p => ({ ...p, date: e.target.value }))} className="input-base w-full px-3 py-2 text-[15px]" /></FL>
                              <FL label={t("pipeline.tx.category")}><select value={tx.txForm.category} onChange={e => tx.setTxForm(p => ({ ...p, category: e.target.value }))} className="input-base w-full px-3 py-2 text-[15px]">{TX_CATEGORIES.map(c => <option key={c} value={c}>{catLabel(c, t)}</option>)}</select></FL>
                            </div>
                            <FL label={t("pipeline.tx.description")}><input value={tx.txForm.desc} onChange={e => tx.setTxForm(p => ({ ...p, desc: e.target.value }))} className="input-base w-full px-3 py-2 text-[15px]" /></FL>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <FL label={t("pipeline.tx.amount")}>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[15px]" style={{ color: "var(--color-text-secondary)" }}>$</span>
                                  <input type="number" min="0" step="0.01" value={tx.txForm.amount} onChange={e => tx.setTxForm(p => ({ ...p, amount: e.target.value }))} className="input-base w-full pl-7 pr-3 py-2 text-[15px]" />
                                </div>
                              </FL>
                              <FL label={t("pipeline.tx.status")}><select value={tx.txForm.status} onChange={e => tx.setTxForm(p => ({ ...p, status: e.target.value }))} className="input-base w-full px-3 py-2 text-[15px]">{TX_STATUSES.map(s => <option key={s} value={s}>{stLabel(s, t)}</option>)}</select></FL>
                            </div>
                            {/* Tax */}
                            <FL label={t("pipeline.clients.taxSetting")}>
                              <div className="flex gap-2 mb-2">
                                {([["none", t("money.form.taxNone")], ["exclusive", t("money.form.taxExclBtn")], ["inclusive", t("money.form.taxIncl")]] as [string, string][]).map(([mode, label]) => (
                                  <button key={mode} type="button" onClick={() => tx.setTxForm(p => ({ ...p, taxMode: mode }))}
                                    className="flex-1 py-2 rounded-full text-[15px] transition-all"
                                    style={tx.txForm.taxMode === mode ? { background: "var(--color-accent)", color: "var(--color-brand-text)", fontWeight: "var(--font-weight-medium)" } : { background: "var(--color-bg-tertiary)", color: "var(--color-text-secondary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
                                    {label}
                                  </button>
                                ))}
                              </div>
                              {tx.txForm.taxMode !== "none" && (
                                <div className="flex gap-2">
                                  {[13, 6, 3].map(r => (
                                    <button key={r} type="button" onClick={() => tx.setTxForm(p => ({ ...p, taxRate: String(r) }))}
                                      className="px-3 py-2 rounded-[var(--radius-4)] text-[13px] transition-all"
                                      style={Number(tx.txForm.taxRate) === r ? { background: "var(--color-accent-tint)", color: "var(--color-accent)", border: "1px solid var(--color-accent)", fontWeight: "var(--font-weight-medium)" } : { background: "var(--color-bg-tertiary)", color: "var(--color-text-secondary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
                                      {r}%
                                    </button>
                                  ))}
                                  <input type="number" min="0" max="100" step="0.01" value={tx.txForm.taxRate} onChange={e => tx.setTxForm(p => ({ ...p, taxRate: e.target.value }))} placeholder={t("money.form.customTaxPlaceholder")} className="input-base flex-1 px-3 py-2 text-[15px] min-w-0" />
                                </div>
                              )}
                            </FL>
                            {tx.txForm.taxMode !== "none" && Number(tx.txForm.amount) > 0 && Number(tx.txForm.taxRate) > 0 && (() => {
                              const amt = Number(tx.txForm.amount);
                              const rate = Number(tx.txForm.taxRate);
                              const tax = tx.txForm.taxMode === "exclusive" ? Math.round(amt * rate / 100 * 100) / 100 : Math.round(amt * rate / (100 + rate) * 100) / 100;
                              const total = tx.txForm.taxMode === "exclusive" ? amt + tax : amt;
                              const base = tx.txForm.taxMode === "inclusive" ? amt - tax : amt;
                              return (
                                <div className="rounded-[var(--radius-6)] p-3 text-[13px] tabular-nums" style={{ background: "var(--color-bg-tertiary)", border: "1px solid var(--color-border-primary)" }}>
                                  <div className="flex justify-between"><span style={{ color: "var(--color-text-secondary)" }}>{tx.txForm.taxMode === "inclusive" ? t("pipeline.tx.baseAmount") : t("pipeline.tx.amount")}</span><span style={{ color: "var(--color-text-primary)" }}>${base.toLocaleString()}</span></div>
                                  <div className="flex justify-between"><span style={{ color: "var(--color-text-secondary)" }}>{t("finance.tax")} ({rate}%)</span><span style={{ color: "var(--color-text-primary)" }}>${tax.toLocaleString()}</span></div>
                                  <div className="flex justify-between border-t pt-1 mt-1" style={{ borderColor: "var(--color-border-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}><span style={{ color: "var(--color-text-primary)" }}>{t("pipeline.tx.total")}</span><span style={{ color: "var(--color-success)" }}>${total.toLocaleString()}</span></div>
                                </div>
                              );
                            })()}
                            <div className="flex justify-end gap-2">
                              <button onClick={() => tx.closeTxForm()} className="btn-secondary text-[15px]">{t("common.cancel")}</button>
                              <button onClick={() => tx.saveTx(form.company_name || form.name)} disabled={!tx.txForm.amount} className="btn-primary text-[15px]">{t("common.save")}</button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                </>)}

                </div>
              </div>
              <div className="flex items-center justify-between px-5 py-3 border-t pb-safe" style={{ borderColor: "var(--color-border-primary)" }}>
                {editId ? <button type="button" onClick={() => setDeleteClientId(editId)} className="btn-ghost text-[15px]" style={{ color: "var(--color-danger)" }}><Trash2 size={16} /> {t("common.delete")}</button> : <div />}
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowPanel(false)} className="btn-secondary text-[15px]">{t("common.cancel")}</button>
                  <button type="button" onClick={saveClient} disabled={savingClient} className="btn-primary text-[15px]">{savingClient ? t("common.loading") : editId ? t("common.save") : t("common.create")}</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>, document.body)}

      {/* Billing type confirmation modal */}
      {billingConfirm !== null && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: "var(--layer-confirm)", background: "var(--color-overlay-primary)", paddingBottom: "16px" }}>
          <div className="card-elevated w-full max-w-sm p-5" role="dialog" aria-modal="true" aria-label="Confirm billing type change">
            <h3 className="text-[15px] mb-2" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{t("common.confirm")}</h3>
            <p className="text-[15px] mb-4" style={{ color: "var(--color-text-secondary)" }}>{billingConfirm.message}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setBillingConfirm(null)} className="btn-secondary text-[15px]">{t("common.cancel")}</button>
              <button onClick={() => {
                const bt = billingConfirm.type;
                // Auto-cleanup when switching
                if (bt === "project") {
                  // Subscription → Project: add cancel event to timeline, zero MRR
                  const today = todayDateKey();
                  const hasCancelled = form.timeline.some(e => e.type === "cancel");
                  setForm(p => ({
                    ...p, billing_type: bt, mrr: "0", status: "Active",
                    timeline: hasCancelled ? p.timeline : [...p.timeline, { type: "cancel", date: today }],
                  }));
                } else {
                  // Project → Subscription: keep milestones as-is, setup subscription fields
                  const today = todayDateKey();
                  setForm(p => ({
                    ...p, billing_type: bt, project_fee: "0",
                    timeline: [{ type: "start", date: today }],
                  }));
                }
                setBillingConfirm(null);
              }} className="text-[15px] px-4 py-2 rounded-[var(--radius-6)]" style={{ background: "var(--color-warning)", color: "var(--color-text-on-color)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{t("common.confirm")}</button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Delete client confirmation */}
      {deleteClientId !== null && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: "var(--layer-confirm)", background: "var(--color-overlay-primary)", paddingBottom: "16px" }}>
          <div className="card-elevated w-full max-w-sm p-5" role="dialog" aria-modal="true" aria-label="Confirm delete">
            <h3 className="text-[15px] mb-2" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{t("pipeline.delete.clientTitle")}</h3>
            <p className="text-[15px] mb-4" style={{ color: "var(--color-text-secondary)" }}>{t("pipeline.delete.clientWarning")}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteClientId(null)} className="btn-secondary text-[15px]">{t("common.cancel")}</button>
              <button onClick={() => { deleteClient(deleteClientId); setDeleteClientId(null); }} className="text-[15px] px-4 py-2 rounded-[var(--radius-6)]" style={{ background: "var(--color-danger)", color: "var(--color-text-on-color)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{t("pipeline.delete.confirm")}</button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Delete transaction confirmation */}
      {tx.deleteTxId !== null && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: "var(--layer-confirm)", background: "var(--color-overlay-primary)", paddingBottom: "16px" }}>
          <div className="card-elevated w-full max-w-sm p-5" role="dialog" aria-modal="true" aria-label="Confirm delete">
            <h3 className="text-[15px] mb-2" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{t("pipeline.tx.deleteTitle")}</h3>
            <p className="text-[15px] mb-4" style={{ color: "var(--color-text-secondary)" }}>{t("pipeline.tx.deleteWarning")}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => tx.setDeleteTxId(null)} className="btn-secondary text-[15px]">{t("common.cancel")}</button>
              <button onClick={() => { tx.deleteTx(tx.deleteTxId!); tx.setDeleteTxId(null); }} className="text-[15px] px-4 py-2 rounded-[var(--radius-6)]" style={{ background: "var(--color-danger)", color: "var(--color-text-on-color)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{t("common.confirm")}</button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
}

export default ClientsView;
