import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Plus, Edit2, Trash2, X, Check, Search, Filter,
  PlayCircle, PauseCircle, Layers, PanelRightClose,
  DollarSign, CircleCheck, Clock, AlertCircle, Download,
  FolderOpen, ExternalLink, UserPlus, Undo2,
} from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { motion, AnimatePresence } from "motion/react";
import { useT } from "../../i18n/context";
import { useRealtimeRefresh } from "../../hooks/useRealtimeRefresh";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useUIStore } from "../../store/useUIStore";
import { Skeleton } from "../../components/ui";
import { FL } from "./LeadsBoard";
import { calcTaxAmount, CATEGORY_I18N, STATUS_I18N, catLabel } from "../../lib/tax";

/* ── Finance helpers ── */
const stLabel = (st: string, t: (k: any) => string) => { const key = STATUS_I18N[st]; return key ? t(key as any) : st; };
const TX_CATEGORIES = ["收入", "软件支出", "外包支出", "应收", "应付", "其他支出"];
const TX_STATUSES = ["已完成", "待收款 (应收)", "待支付 (应付)"];

/* ══════════════════════════════════════════════════════════════════
   CLIENTS VIEW
   ══════════════════════════════════════════════════════════════════ */
export function ClientsView() {
  const { t } = useT();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPanel, setShowPanel] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const showToast = useUIStore((s) => s.showToast);
  const [search, setSearch] = useState("");
  const [filterSt, setFilterSt] = useState("All");
  const [filterBilling, setFilterBilling] = useState("All");
  const [filterPlan, setFilterPlan] = useState("All");
  const isMobile = useIsMobile();
  const [plans, setPlans] = useState<any[]>([]);
  const emptyClient = { name: "", company_name: "", contact_name: "", contact_email: "", contact_phone: "", billing_type: "subscription" as "subscription" | "project", plan: "", status: "Active", mrr: "", project_fee: "", subscription_start_date: new Date().toISOString().split("T")[0], project_end_date: "", paused_at: "", resumed_at: "", cancelled_at: "", mrr_effective_from: new Date().toISOString().split("T")[0], tax_mode: "none" as "none" | "exclusive" | "inclusive", tax_rate: "", drive_folder_url: "", payment_method: "auto" as "auto" | "manual", timeline: [{ type: "start", date: new Date().toISOString().split("T")[0] }] as { type: string; date: string }[] };
  const [form, setForm] = useState(emptyClient);
  const parentRef = useRef<HTMLDivElement>(null);

  /* ── Milestones state ── */
  const [milestones, setMilestones] = useState<any[]>([]);
  const [msLoading, setMsLoading] = useState(false);
  const [showAddMs, setShowAddMs] = useState(false);
  const [editMsId, setEditMsId] = useState<number | null>(null);
  const [markPaidId, setMarkPaidId] = useState<number | null>(null);
  const [markPaidMethod, setMarkPaidMethod] = useState("bank_transfer");
  const emptyMs = { label: "", amount: "", percentage: "", due_date: "", note: "", alreadyPaid: false, payMethod: "bank_transfer" };
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
      let newMsId = editMsId;
      if (editMsId) { await fetch(`/api/milestones/${editMsId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
      else {
        const res = await fetch(`/api/clients/${editId}/milestones`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const data = await res.json();
        newMsId = data?.id || null;
      }
      // Auto mark-paid if checkbox was checked
      if (msForm.alreadyPaid && newMsId) {
        await fetch(`/api/milestones/${newMsId}/mark-paid`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payment_method: msForm.payMethod }) });
        showToast(t("pipeline.milestones.autoFinance" as any));
      } else {
        showToast(t("pipeline.milestones.saved" as any));
      }
      setShowAddMs(false); setEditMsId(null); setMsForm(emptyMs);
      fetchMilestones(editId); fetchFinance();
    } catch { showToast(t("common.saveFailed" as any)); }
  };

  const deleteMilestone = async (msId: number) => {
    try { await fetch(`/api/milestones/${msId}`, { method: "DELETE" }); showToast(t("pipeline.milestones.deleted" as any)); if (editId) fetchMilestones(editId); }
    catch { showToast(t("common.deleteFailed" as any)); }
  };

  const undoMarkPaid = async (msId: number) => {
    try {
      await fetch(`/api/milestones/${msId}/undo-paid`, { method: "POST" });
      showToast(t("pipeline.milestones.undone" as any));
      if (editId) { fetchMilestones(editId); fetchFinance(); }
    } catch { showToast(t("common.saveFailed" as any)); }
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
      setForm({ name: c.name, company_name: c.company_name || "", contact_name: c.contact_name || "", contact_email: c.contact_email || "", contact_phone: c.contact_phone || "", billing_type: c.billing_type || "subscription", plan: c.plan_tier || c.plan, status: c.status, mrr: String(c.mrr).replace(/[^0-9.-]+/g, ""), project_fee: String(c.project_fee || "").replace(/[^0-9.-]+/g, ""), subscription_start_date: tl[0]?.date || "", project_end_date: c.project_end_date || "", paused_at: c.paused_at || "", resumed_at: c.resumed_at || "", cancelled_at: c.cancelled_at || "", mrr_effective_from: tl[0]?.date || c.mrr_effective_from || "", tax_mode: (c.tax_mode || "none") as any, tax_rate: String(c.tax_rate || ""), drive_folder_url: c.drive_folder_url || "", payment_method: (c.payment_method || "auto") as any, timeline: tl });
      if ((c.billing_type || "subscription") === "project") fetchMilestones(c.id);
    }
    else { setEditId(null); setForm(emptyClient); }
    setShowPanel(true);
  };

  const saveClient = async () => {
    const startEvt = form.timeline.find(e => e.type === "start");
    const d = { name: form.name, company_name: form.company_name, contact_name: form.contact_name, contact_email: form.contact_email, contact_phone: form.contact_phone, billing_type: form.billing_type, plan_tier: form.billing_type === "subscription" ? form.plan : "", status: form.status, mrr: form.billing_type === "subscription" ? (Number(form.mrr) || 0) : 0, project_fee: form.billing_type === "project" ? (Number(form.project_fee) || 0) : 0, subscription_start_date: startEvt?.date || form.subscription_start_date, project_end_date: form.project_end_date, paused_at: form.timeline.filter(e => e.type === "pause").pop()?.date || "", resumed_at: form.timeline.filter(e => e.type === "resume").pop()?.date || "", cancelled_at: form.timeline.find(e => e.type === "cancel")?.date || "", mrr_effective_from: startEvt?.date || form.subscription_start_date, subscription_timeline: JSON.stringify(form.timeline), tax_mode: form.tax_mode, tax_rate: Number(form.tax_rate) || 0, drive_folder_url: form.drive_folder_url, payment_method: form.payment_method };
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
    <div>
      {loading ? (
        <div className="space-y-3 animate-skeleton-in">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-[72px] rounded-[var(--radius-8)]" />)}
          </div>
          <Skeleton className="h-10 rounded-[var(--radius-6)]" />
          <div className="card space-y-0">
            {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-[72px]" />)}
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="stat-card"><div className="flex items-center gap-2 mb-1"><div className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-4)]" style={{ background: "color-mix(in srgb, var(--color-success) 12%, transparent)" }}><PlayCircle size={16} style={{ color: "var(--color-success)" }} /></div><span className="text-[11px]" style={{ color: "var(--color-text-secondary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{t("common.active" as any)}</span></div><span className="text-xl tabular-nums" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{activeN}</span></div>
            <div className="stat-card"><div className="flex items-center gap-2 mb-1"><div className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-4)]" style={{ background: "color-mix(in srgb, var(--color-warning) 12%, transparent)" }}><PauseCircle size={16} style={{ color: "var(--color-warning)" }} /></div><span className="text-[11px]" style={{ color: "var(--color-text-secondary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{t("common.paused" as any)}</span></div><span className="text-xl tabular-nums" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{pausedN}</span></div>
            <div className="stat-card"><div className="flex items-center gap-2 mb-1"><div className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-4)]" style={{ background: "color-mix(in srgb, var(--color-accent) 12%, transparent)" }}><Layers size={16} style={{ color: "var(--color-accent)" }} /></div><span className="text-[11px]" style={{ color: "var(--color-text-secondary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{t("pipeline.clients.contractTotal" as any)}</span></div><span className="text-xl tabular-nums" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>${contractTotal.toLocaleString()}</span></div>
            <div className="stat-card"><div className="flex items-center gap-2 mb-1"><div className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-4)]" style={{ background: "color-mix(in srgb, var(--color-success) 12%, transparent)" }}><CircleCheck size={16} style={{ color: "var(--color-success)" }} /></div><span className="text-[11px]" style={{ color: "var(--color-text-secondary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{t("pipeline.clients.totalReceived" as any)}</span></div><span className="text-xl tabular-nums" style={{ color: "var(--color-success)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>${totalReceived.toLocaleString()}</span></div>
          </div>

          <div className="space-y-3 mb-4">
            {/* Search + Actions row */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={16} style={{ color: "var(--color-text-secondary)" }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("pipeline.clients.search" as any)} className="input-base w-full pl-9 pr-3 py-2 text-[13px]" />
              </div>
              <button onClick={exportClientsCSV} className="btn-ghost text-[13px] shrink-0" style={{ border: "1px solid var(--color-border-primary)" }}><Download size={16} /> CSV</button>
              <button onClick={() => openPanel()} className="btn-primary text-[13px] shrink-0"><Plus size={16} /> {t("pipeline.addClient" as any)}</button>
            </div>
            {/* Filters row */}
            <div className="flex items-center gap-2 flex-wrap">
              <Filter size={16} className="shrink-0" style={{ color: "var(--color-text-secondary)" }} />
              <select value={filterSt} onChange={e => setFilterSt(e.target.value)} className="input-base px-2 py-2 text-[13px]">
                <option value="All">{t("common.all" as any)}</option><option value="Active">{t("common.active" as any)}</option><option value="Paused">{t("common.paused" as any)}</option>
              </select>
              <select value={filterBilling} onChange={e => setFilterBilling(e.target.value)} className="input-base px-2 py-2 text-[13px]">
                <option value="All">{t("pipeline.filter.billingAll" as any)}</option>
                <option value="subscription">{t("pipeline.clients.billingSubscription" as any)}</option>
                <option value="project">{t("pipeline.clients.billingProject" as any)}</option>
              </select>
              {uniquePlanTiers.length > 0 && (
                <select value={filterPlan} onChange={e => setFilterPlan(e.target.value)} className="input-base px-2 py-2 text-[13px]">
                  <option value="All">{t("pipeline.filter.planAll" as any)}</option>
                  {uniquePlanTiers.map(p => <option key={p} value={p}>{p === "Basic" ? t("pipeline.convert.planBasic" as any) : p === "Pro" ? t("pipeline.convert.planPro" as any) : p === "Enterprise" ? t("pipeline.convert.planEnterprise" as any) : p}</option>)}
                </select>
              )}
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2 flex-1 overflow-y-auto ios-scroll pb-4">
            {!filtered.length && <div className="py-10 text-center text-[13px]" style={{ color: "var(--color-text-secondary)" }}>{t("pipeline.clients.noMatch" as any)}</div>}
            {filtered.map(c => {
              const plan = c.plan_tier === "Basic" ? t("pipeline.convert.planBasic" as any) : c.plan_tier === "Pro" ? t("pipeline.convert.planPro" as any) : c.plan_tier === "Enterprise" ? t("pipeline.convert.planEnterprise" as any) : (c.plan_tier || c.plan);
              return (
                <button key={c.id} onClick={() => openPanel(c)} className="w-full text-left card-interactive p-3 flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-6)] text-[11px]" style={{ background: "var(--color-accent-tint)", color: "var(--color-accent)", fontWeight: "var(--font-weight-bold)" } as React.CSSProperties}>{(c.company_name || c.name).charAt(0).toUpperCase()}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2"><span className="text-[13px] truncate" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{c.company_name || c.name}</span>
                      <span className="badge" style={c.status === "Active" ? { background: "var(--color-success-light)", color: "var(--color-success)" } : { background: "var(--color-warning-light)", color: "var(--color-warning)" }}>{c.status === "Active" ? t("common.active" as any) : t("common.paused" as any)}</span>
                    </div>
                    {c.contact_name && <div className="text-[11px] mt-0.5 truncate" style={{ color: "var(--color-text-secondary)" }}>{c.contact_name}{c.contact_phone ? ` · ${c.contact_phone}` : ""}</div>}
                    <div className="text-[11px] mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
                      {c.billing_type === "project"
                        ? <>{t("pipeline.clients.billingProject" as any)} · {t("pipeline.clients.contract" as any)} <strong style={{ color: "var(--color-text-primary)" }}>${Number(c.project_fee || 0).toLocaleString()}</strong></>
                        : <>{plan} · <strong style={{ color: "var(--color-text-primary)" }}>${Number(c.mrr || 0).toLocaleString()}</strong>{t("pipeline.clients.perMonth" as any)}</>
                      }
                      {(() => { const cR = finTxs.filter((tx: any) => tx.type === "income" && (tx.status || "已完成") === "已完成" && tx.client_id === c.id).reduce((s: number, tx: any) => s + Number(tx.amount || 0), 0); return cR > 0 ? <> · <span style={{ color: "var(--color-success)" }}>{t("pipeline.clients.received" as any)} ${cR.toLocaleString()}</span></> : null; })()}
                      {c.tax_mode && c.tax_mode !== "none" && <> · <span style={{ color: "var(--color-accent)" }}>{c.tax_mode === "exclusive" ? t("money.form.taxExclBtn" as any) : t("money.form.taxIncl" as any)} {c.tax_rate}%</span></>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Desktop table */}
          <div ref={parentRef} className="hidden md:block card flex-1 overflow-auto min-h-[400px]">
            <table className="w-full text-left min-w-[960px]">
              <thead className="sticky top-0 z-10" style={{ background: "var(--color-bg-primary)", borderBottom: "1px solid var(--color-border-primary)" }}>
                <tr className="section-label">
                  <th className="px-4 py-3" style={{ fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{t("pipeline.clients.table.name" as any)}</th><th className="px-4 py-3" style={{ fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{t("pipeline.clients.table.contact" as any)}</th><th className="px-4 py-3" style={{ fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{t("pipeline.clients.table.type" as any)}</th><th className="px-4 py-3" style={{ fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{t("pipeline.clients.table.plan" as any)}</th><th className="px-4 py-3" style={{ fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{t("pipeline.clients.table.status" as any)}</th><th className="px-4 py-3" style={{ fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{t("pipeline.clients.table.expectedActual" as any)}</th><th className="px-4 py-3" style={{ fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{t("pipeline.clients.startDate" as any)}</th><th className="px-4 py-3" style={{ fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{t("pipeline.clients.taxSetting" as any)}</th><th className="px-4 py-3 text-right" style={{ fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{t("pipeline.clients.table.actions" as any)}</th>
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
                    <tr key={c.id} data-index={vr.index} ref={rowV.measureElement} className="group border-b transition-colors cursor-pointer" style={{ borderColor: "var(--color-border-primary)" }}
                      onClick={() => openPanel(c)}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--color-bg-tertiary)")} onMouseLeave={e => (e.currentTarget.style.background = "")}>
                      <td className="px-4 py-3"><div className="flex items-center gap-2.5"><div className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-4)] text-[11px]" style={{ background: "var(--color-accent-tint)", color: "var(--color-accent)", fontWeight: "var(--font-weight-bold)" } as React.CSSProperties}>{displayInitial}</div><span style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{displayName}</span></div></td>
                      <td className="px-4 py-3"><div className="min-w-0">{c.contact_name && <span className="text-[13px] block truncate" style={{ color: "var(--color-text-primary)" }}>{c.contact_name}</span>}{c.contact_email && <span className="text-[11px] block truncate" style={{ color: "var(--color-text-secondary)" }}>{c.contact_email}</span>}</div></td>
                      <td className="px-4 py-3"><span className="badge" style={c.billing_type === "project" ? { background: "color-mix(in srgb, var(--color-orange) 12%, transparent)", color: "var(--color-orange)" } : { background: "color-mix(in srgb, var(--color-blue) 12%, transparent)", color: "var(--color-blue)" }}>{c.billing_type === "project" ? t("pipeline.clients.billingProject" as any) : t("pipeline.clients.billingSubscription" as any)}</span></td>
                      <td className="px-4 py-3"><span className="badge">{c.billing_type === "project" ? "—" : plan}</span></td>
                      <td className="px-4 py-3"><span className="badge" style={c.status === "Active" ? { background: "var(--color-success-light)", color: "var(--color-success)" } : { background: "var(--color-warning-light)", color: "var(--color-warning)" }}>{c.status === "Active" ? t("common.active" as any) : t("common.paused" as any)}</span></td>
                      <td className="px-4 py-3 tabular-nums" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
                        <div>${c.billing_type === "project" ? Number(c.project_fee || 0).toLocaleString() : Number(c.lifetimeRevenue || 0).toLocaleString()}</div>
                        {(() => { const cReceived = finTxs.filter((tx: any) => tx.type === "income" && (tx.status || "已完成") === "已完成" && tx.client_id === c.id).reduce((s: number, tx: any) => s + Number(tx.amount || 0), 0); return cReceived > 0 ? <div className="text-[11px]" style={{ color: "var(--color-success)" }}>{t("pipeline.clients.received" as any)} ${cReceived.toLocaleString()}</div> : null; })()}
                        {c.billing_type === "subscription" && <div className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>${Number(c.mrr || 0).toLocaleString()}{t("pipeline.clients.perMonth" as any)}</div>}
                      </td>
                      <td className="px-4 py-3 text-[13px]" style={{ color: "var(--color-text-secondary)" }}>{c.subscription_start_date || c.joined_at?.split("T")[0] || "—"}</td>
                      <td className="px-4 py-3">{c.tax_mode && c.tax_mode !== "none" ? <span className="badge" style={{ background: "color-mix(in srgb, var(--color-accent) 12%, transparent)", color: "var(--color-accent)" }}>{c.tax_mode === "exclusive" ? t("money.form.taxExclBtn" as any) : t("money.form.taxIncl" as any)} {c.tax_rate}%</span> : <span style={{ color: "var(--color-text-secondary)" }}>—</span>}</td>
                      <td className="px-4 py-3 text-right"><button onClick={e => { e.stopPropagation(); openPanel(c); }} className="btn-ghost text-[11px] opacity-0 group-hover:opacity-100"><Edit2 size={16} /> {t("common.edit" as any)}</button></td>
                    </tr>
                  );
                })}
                {padBot > 0 && <tr><td style={{ height: padBot, padding: 0 }} colSpan={9} /></tr>}
              </tbody>
            </table>
            {!filtered.length && <div className="p-8 text-center text-[13px]" style={{ color: "var(--color-text-secondary)" }}>{t("pipeline.clients.noMatch" as any)}</div>}
          </div>
        </>
      )}

      {/* ═══ Client Side Panel ═══ */}
      <AnimatePresence>
        {showPanel && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="modal-backdrop" onClick={() => setShowPanel(false)} />
            <motion.div
              initial={{ x: isMobile ? 0 : "100%", y: isMobile ? "100%" : 0 }}
              animate={{ x: 0, y: 0 }}
              exit={{ x: isMobile ? 0 : "100%", y: isMobile ? "100%" : 0 }}
              transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
              className={isMobile ? "fixed inset-0 z-50 flex flex-col" : "fixed top-0 right-0 z-50 h-full w-full max-w-[480px] flex flex-col border-l"}
              style={{ background: "var(--color-bg-primary)", borderColor: "var(--color-border-primary)", boxShadow: "var(--shadow-high)", paddingTop: isMobile ? "env(safe-area-inset-top, 0px)" : undefined }}
            >
              <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "var(--color-border-primary)" }}>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-4)]" style={{ background: "var(--color-accent-tint)", color: "var(--color-accent)" }}><UserPlus size={16} /></div>
                  <span className="text-[13px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{editId ? t("pipeline.panel.editClient" as any) : t("pipeline.panel.newClient" as any)}</span>
                </div>
                <button onClick={() => setShowPanel(false)} className="btn-ghost p-1">{isMobile ? <X size={16} /> : <PanelRightClose size={16} />}</button>
              </div>
              <div className="flex-1 overflow-y-auto overflow-x-hidden ios-scroll p-5 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FL label={t("pipeline.clients.companyName" as any)}><input required value={form.company_name} onChange={e => setForm(p => ({ ...p, company_name: e.target.value, name: e.target.value || p.contact_name }))} className="input-base w-full px-3 py-2 text-[13px]" /></FL>
                  <FL label={t("pipeline.clients.contactName" as any)}><input value={form.contact_name} onChange={e => setForm(p => ({ ...p, contact_name: e.target.value, name: p.company_name || e.target.value }))} className="input-base w-full px-3 py-2 text-[13px]" /></FL>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FL label={t("pipeline.clients.contactEmail" as any)}><input type="email" value={form.contact_email} onChange={e => setForm(p => ({ ...p, contact_email: e.target.value }))} className="input-base w-full px-3 py-2 text-[13px]" /></FL>
                  <FL label={t("pipeline.clients.contactPhone" as any)}><input type="tel" value={form.contact_phone} onChange={e => setForm(p => ({ ...p, contact_phone: e.target.value }))} className="input-base w-full px-3 py-2 text-[13px]" /></FL>
                </div>
                {/* Google Drive folder link */}
                <FL label={t("pipeline.clients.driveFolder" as any)}>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <FolderOpen size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-text-secondary)" }} />
                      <input value={form.drive_folder_url} onChange={e => setForm(p => ({ ...p, drive_folder_url: e.target.value }))} placeholder={t("pipeline.clients.drivePlaceholder" as any)} className="input-base w-full pl-9 pr-3 py-2 text-[13px]" />
                    </div>
                    {form.drive_folder_url && (
                      <button type="button" onClick={() => window.open(form.drive_folder_url, '_blank')} className="btn-ghost flex items-center gap-1 px-3 shrink-0 text-[11px]" style={{ color: "var(--color-accent)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
                        <ExternalLink size={16} /> {t("pipeline.clients.openDrive" as any)}
                      </button>
                    )}
                  </div>
                </FL>
                <div className="border-t" style={{ borderColor: "var(--color-border-primary)" }} />
                {/* Billing type switcher */}
                <FL label={t("pipeline.clients.billingType" as any)}>
                  <div className="segment-switcher">
                    {(["subscription", "project"] as const).map(bt => (
                      <button key={bt} onClick={() => {
                        if (editId && bt !== form.billing_type) {
                          // Switching billing type on existing client — confirm first
                          if (!window.confirm(bt === "project"
                            ? t("pipeline.clients.switchToProjectConfirm" as any)
                            : t("pipeline.clients.switchToSubConfirm" as any))) return;
                          // Auto-cleanup when switching
                          if (bt === "project") {
                            // Subscription → Project: add cancel event to timeline, zero MRR
                            const today = new Date().toISOString().split("T")[0];
                            const hasCancelled = form.timeline.some(e => e.type === "cancel");
                            setForm(p => ({
                              ...p, billing_type: bt, mrr: "0", status: "Active",
                              timeline: hasCancelled ? p.timeline : [...p.timeline, { type: "cancel", date: today }],
                            }));
                          } else {
                            // Project → Subscription: keep milestones as-is, setup subscription fields
                            const today = new Date().toISOString().split("T")[0];
                            setForm(p => ({
                              ...p, billing_type: bt, project_fee: "0",
                              timeline: [{ type: "start", date: today }],
                            }));
                          }
                        } else {
                          setForm(p => ({ ...p, billing_type: bt }));
                        }
                      }} data-active={form.billing_type === bt}>
                        {bt === "subscription" ? t("pipeline.clients.billingSubscription" as any) : t("pipeline.clients.billingProject" as any)}
                      </button>
                    ))}
                  </div>
                </FL>
                {form.billing_type === "subscription" ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <FL label={t("pipeline.convert.plan" as any)}><select value={form.plan} onChange={e => { const v = e.target.value; const p = plans.find((x: any) => x.name === v); setForm(prev => ({ ...prev, plan: v, mrr: p ? String(p.price) : prev.mrr })); }} className="input-base w-full px-3 py-2 text-[13px]"><option value="">{t("pipeline.convert.planSelect" as any)}</option>{plans.map((p: any) => <option key={p.id} value={p.name}>{p.name}</option>)}</select></FL>
                      <FL label={t("common.status" as any)}><select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className="input-base w-full px-3 py-2 text-[13px]"><option value="Active">{t("common.active" as any)}</option><option value="Paused">{t("common.paused" as any)}</option></select></FL>
                    </div>
                    <FL label={t("pipeline.convert.mrr" as any)}><input type="number" required min="0" value={form.mrr} onChange={e => setForm(p => ({ ...p, mrr: e.target.value }))} className="input-base w-full px-3 py-2 text-[13px]" /></FL>
                    {/* Payment method */}
                    <FL label={t("pipeline.clients.paymentMethod" as any)}>
                      <div className="flex gap-2">
                        {([
                          ["auto", t("pipeline.clients.payAuto" as any), t("pipeline.clients.payAutoHint" as any)],
                          ["manual", t("pipeline.clients.payManual" as any), t("pipeline.clients.payManualHint" as any)],
                        ] as [string, string, string][]).map(([val, label, hint]) => (
                          <button key={val} type="button" onClick={() => setForm(p => ({ ...p, payment_method: val as any }))}
                            className="flex-1 card p-3 text-left transition-colors"
                            style={form.payment_method === val ? { borderColor: "var(--color-accent)", background: "var(--color-accent-tint)" } : {}}>
                            <div className="text-[13px]" style={{ color: form.payment_method === val ? "var(--color-accent)" : "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{label}</div>
                            <div className="text-[11px] mt-0.5" style={{ color: "var(--color-text-secondary)" }}>{hint}</div>
                          </button>
                        ))}
                      </div>
                    </FL>
                    {/* Tax settings — after amount */}
                    <FL label={t("pipeline.clients.taxSetting" as any)}>
                      <div className="flex gap-2 mb-2">
                        {([["none", t("money.form.taxNone" as any)], ["exclusive", t("money.form.taxExclBtn" as any)], ["inclusive", t("money.form.taxIncl" as any)]] as [string, string][]).map(([mode, label]) => (
                          <button key={mode} type="button" onClick={() => setForm(p => ({ ...p, tax_mode: mode as any }))}
                            className="flex-1 py-2 rounded-[var(--radius-6)] text-[13px] transition-all"
                            style={form.tax_mode === mode ? { background: "var(--color-accent)", color: "#fff", fontWeight: "var(--font-weight-medium)" } : { background: "var(--color-bg-tertiary)", color: "var(--color-text-secondary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
                            {label}
                          </button>
                        ))}
                      </div>
                      {form.tax_mode !== "none" && (
                        <div className="flex gap-2">
                          {[13, 6, 3].map(r => (
                            <button key={r} type="button" onClick={() => setForm(p => ({ ...p, tax_rate: String(r) }))}
                              className="px-3 py-2 rounded-[var(--radius-4)] text-[11px] transition-all"
                              style={Number(form.tax_rate) === r ? { background: "var(--color-accent-tint)", color: "var(--color-accent)", border: "1px solid var(--color-accent)", fontWeight: "var(--font-weight-medium)" } : { background: "var(--color-bg-tertiary)", color: "var(--color-text-secondary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
                              {r}%
                            </button>
                          ))}
                          <input type="number" min="0" max="100" step="0.01" value={form.tax_rate} onChange={e => setForm(p => ({ ...p, tax_rate: e.target.value }))} placeholder={t("money.form.customTaxPlaceholder" as any)} className="input-base flex-1 px-3 py-2 text-[11px] min-w-0" />
                        </div>
                      )}
                    </FL>
                    <div className="border-t" style={{ borderColor: "var(--color-border-primary)" }} />
                    <span className="section-label">{t("pipeline.clients.timeline" as any)}</span>
                    <div className="space-y-2">
                      {form.timeline.map((evt, i) => {
                        const labels: Record<string, string> = { start: t("pipeline.clients.start" as any), pause: t("pipeline.clients.pause" as any), resume: t("pipeline.clients.resume" as any), cancel: t("pipeline.clients.cancel" as any) };
                        const colors: Record<string, string> = { start: "var(--color-success)", pause: "var(--color-warning)", resume: "var(--color-blue)", cancel: "var(--color-danger)" };
                        return (
                          <div key={i} className="flex items-center gap-2">
                            <span className="badge text-[11px] shrink-0" style={{ background: `${colors[evt.type]}20`, color: colors[evt.type], minWidth: 40, textAlign: "center" }}>{labels[evt.type] || evt.type}</span>
                            <input type="date" value={evt.date} onChange={e => { const tl = [...form.timeline]; tl[i] = { ...tl[i], date: e.target.value }; setForm(p => ({ ...p, timeline: tl })); }} className="input-base flex-1 px-3 py-2 text-[13px]" />
                            {i > 0 && <button type="button" onClick={() => { const tl = form.timeline.filter((_, j) => j !== i); setForm(p => ({ ...p, timeline: tl })); }} className="btn-ghost p-1" style={{ color: "var(--color-danger)" }}><X size={16} /></button>}
                          </div>
                        );
                      })}
                      <div className="flex gap-2 flex-wrap">
                        {(() => {
                          const last = form.timeline[form.timeline.length - 1];
                          const hasCancelled = form.timeline.some(e => e.type === "cancel");
                          if (hasCancelled) return null;
                          const today = new Date().toISOString().split("T")[0];
                          if (!last || last.type === "start" || last.type === "resume") {
                            return (<>
                              <button type="button" onClick={() => setForm(p => ({ ...p, timeline: [...p.timeline, { type: "pause", date: today }] }))} className="btn-ghost text-[11px] flex items-center gap-1" style={{ color: "var(--color-warning)" }}><Plus size={12} /> {t("pipeline.clients.pause" as any)}</button>
                              <button type="button" onClick={() => setForm(p => ({ ...p, timeline: [...p.timeline, { type: "cancel", date: today }] }))} className="btn-ghost text-[11px] flex items-center gap-1" style={{ color: "var(--color-danger)" }}><Plus size={12} /> {t("pipeline.clients.cancel" as any)}</button>
                            </>);
                          }
                          if (last.type === "pause") {
                            return (<>
                              <button type="button" onClick={() => setForm(p => ({ ...p, timeline: [...p.timeline, { type: "resume", date: today }] }))} className="btn-ghost text-[11px] flex items-center gap-1" style={{ color: "var(--color-blue)" }}><Plus size={12} /> {t("pipeline.clients.resume" as any)}</button>
                              <button type="button" onClick={() => setForm(p => ({ ...p, timeline: [...p.timeline, { type: "cancel", date: today }] }))} className="btn-ghost text-[11px] flex items-center gap-1" style={{ color: "var(--color-danger)" }}><Plus size={12} /> {t("pipeline.clients.cancel" as any)}</button>
                            </>);
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <FL label={t("pipeline.clients.projectFee" as any)}><input type="number" required min="0" value={form.project_fee} onChange={e => setForm(p => ({ ...p, project_fee: e.target.value }))} className="input-base w-full px-3 py-2 text-[13px]" /></FL>
                      <FL label={t("common.status" as any)}><select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className="input-base w-full px-3 py-2 text-[13px]"><option value="Active">{t("common.active" as any)}</option><option value="Paused">{t("common.paused" as any)}</option></select></FL>
                    </div>
                    {/* Tax settings — after amount */}
                    <FL label={t("pipeline.clients.taxSetting" as any)}>
                      <div className="flex gap-2 mb-2">
                        {([["none", t("money.form.taxNone" as any)], ["exclusive", t("money.form.taxExclBtn" as any)], ["inclusive", t("money.form.taxIncl" as any)]] as [string, string][]).map(([mode, label]) => (
                          <button key={mode} type="button" onClick={() => setForm(p => ({ ...p, tax_mode: mode as any }))}
                            className="flex-1 py-2 rounded-[var(--radius-6)] text-[13px] transition-all"
                            style={form.tax_mode === mode ? { background: "var(--color-accent)", color: "#fff", fontWeight: "var(--font-weight-medium)" } : { background: "var(--color-bg-tertiary)", color: "var(--color-text-secondary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
                            {label}
                          </button>
                        ))}
                      </div>
                      {form.tax_mode !== "none" && (
                        <div className="flex gap-2">
                          {[13, 6, 3].map(r => (
                            <button key={r} type="button" onClick={() => setForm(p => ({ ...p, tax_rate: String(r) }))}
                              className="px-3 py-2 rounded-[var(--radius-4)] text-[11px] transition-all"
                              style={Number(form.tax_rate) === r ? { background: "var(--color-accent-tint)", color: "var(--color-accent)", border: "1px solid var(--color-accent)", fontWeight: "var(--font-weight-medium)" } : { background: "var(--color-bg-tertiary)", color: "var(--color-text-secondary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
                              {r}%
                            </button>
                          ))}
                          <input type="number" min="0" max="100" step="0.01" value={form.tax_rate} onChange={e => setForm(p => ({ ...p, tax_rate: e.target.value }))} placeholder={t("money.form.customTaxPlaceholder" as any)} className="input-base flex-1 px-3 py-2 text-[11px] min-w-0" />
                        </div>
                      )}
                    </FL>
                    <div className="border-t" style={{ borderColor: "var(--color-border-primary)" }} />
                    <span className="section-label">{t("pipeline.clients.projectTimeline" as any)}</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <FL label={t("pipeline.clients.projectStart" as any)}><input type="date" value={form.subscription_start_date} onChange={e => setForm(p => ({ ...p, subscription_start_date: e.target.value }))} className="input-base w-full px-3 py-2 text-[13px]" /></FL>
                      <FL label={t("pipeline.clients.projectEnd" as any)}><input type="date" value={form.project_end_date} onChange={e => setForm(p => ({ ...p, project_end_date: e.target.value }))} className="input-base w-full px-3 py-2 text-[13px]" /></FL>
                    </div>

                    {/* ═══ Payment Milestones ═══ */}
                    {editId && (
                      <>
                        <div className="border-t" style={{ borderColor: "var(--color-border-primary)" }} />
                        <div className="flex items-center justify-between">
                          <span className="section-label flex items-center gap-1.5"><DollarSign size={16} /> {t("pipeline.milestones.title" as any)}</span>
                          <button onClick={() => { setShowAddMs(true); setEditMsId(null); setMsForm(emptyMs); }} className="btn-ghost text-[11px] flex items-center gap-1" style={{ color: "var(--color-accent)" }}><Plus size={16} /> {t("pipeline.milestones.add" as any)}</button>
                        </div>
                        <div className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>{t("pipeline.milestones.hint" as any)}</div>

                        {/* Progress bar */}
                        {milestones.length > 0 && (() => {
                          const totalAmt = milestones.reduce((s: number, m: any) => s + Number(m.amount || 0), 0);
                          const paidAmt = milestones.filter((m: any) => m.status === "paid").reduce((s: number, m: any) => s + Number(m.amount || 0), 0);
                          const pct = totalAmt > 0 ? Math.round(paidAmt / totalAmt * 100) : 0;
                          return (
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>
                                  {milestones.filter((m: any) => m.status === "paid").length}/{milestones.length} {t("pipeline.milestones.status.paid" as any).toLowerCase()} · ${paidAmt.toLocaleString()} / ${totalAmt.toLocaleString()}
                                </span>
                                <span className="text-[11px] tabular-nums" style={{ color: pct === 100 ? "var(--color-success)" : "var(--color-accent)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{pct}%</span>
                              </div>
                              <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--color-bg-tertiary)" }}>
                                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: pct === 100 ? "var(--color-success)" : "var(--color-accent)" }} />
                              </div>
                            </div>
                          );
                        })()}

                        {/* Milestone list */}
                        {msLoading ? (
                          <div className="space-y-2">
                            <Skeleton className="h-16 rounded-[var(--radius-6)]" />
                            <Skeleton className="h-16 rounded-[var(--radius-6)]" />
                          </div>
                        ) : milestones.length === 0 && !showAddMs ? (
                          <div className="text-center py-4 text-[13px]" style={{ color: "var(--color-text-secondary)" }}>{t("pipeline.milestones.noPlan" as any)}</div>
                        ) : (
                          <div className="space-y-2">
                            {milestones.map((ms: any) => (
                              <div key={ms.id} className="rounded-[var(--radius-6)] p-3 space-y-2 cursor-pointer transition-colors" style={{ background: "var(--color-bg-tertiary)", border: `1px solid ${ms.status === "paid" ? "var(--color-success)" : "var(--color-border-primary)"}` }} onClick={() => { if (ms.status !== "paid") { setEditMsId(ms.id); setMsForm({ label: ms.label, amount: String(ms.amount), percentage: String(ms.percentage || ""), due_date: ms.due_date || "", note: ms.note || "" }); setShowAddMs(true); } }}>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    {ms.status === "paid" ? <CircleCheck size={16} style={{ color: "var(--color-success)" }} /> : ms.status === "overdue" ? <AlertCircle size={16} style={{ color: "var(--color-danger)" }} /> : <Clock size={16} style={{ color: "var(--color-text-secondary)" }} />}
                                    <span className="text-[13px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{ms.label}</span>
                                    <span className="badge text-[11px]" style={
                                      ms.status === "paid" ? { background: "var(--color-success-light)", color: "var(--color-success)" }
                                      : ms.status === "overdue" ? { background: "color-mix(in srgb, var(--color-danger) 12%, transparent)", color: "var(--color-danger)" }
                                      : { background: "color-mix(in srgb, var(--color-warning) 12%, transparent)", color: "var(--color-warning)" }
                                    }>{t(`pipeline.milestones.status.${ms.status}` as any)}</span>
                                  </div>
                                  <span className="text-[13px] tabular-nums" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>${Number(ms.amount || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex items-center gap-3 text-[11px]" style={{ color: "var(--color-text-secondary)" }}>
                                  {ms.percentage > 0 && <span>{ms.percentage}%</span>}
                                  {ms.due_date && <span>{t("pipeline.milestones.dueDate" as any)}: {ms.due_date}</span>}
                                  {ms.paid_date && <span>{t("pipeline.milestones.paidDate" as any)}: {ms.paid_date}</span>}
                                  {ms.payment_method && <span>{t(`pipeline.milestones.method.${ms.payment_method}` as any)}</span>}
                                </div>
                                {ms.note && <div className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>{ms.note}</div>}
                                {ms.status === "paid" ? (
                                  <div className="flex items-center justify-between" onClick={e => e.stopPropagation()}>
                                    <span className="text-[11px]" style={{ color: "var(--color-success)" }}>{t("pipeline.milestones.autoRecorded" as any)}</span>
                                    <button onClick={() => undoMarkPaid(ms.id)} className="btn-ghost text-[11px] flex items-center gap-1" style={{ color: "var(--color-warning)" }}>
                                      <Undo2 size={12} /> {t("pipeline.milestones.undoPaid" as any)}
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 pt-1" onClick={e => e.stopPropagation()}>
                                    <button onClick={() => { setMarkPaidId(ms.id); setMarkPaidMethod("bank_transfer"); }} className="text-[11px] px-3 py-1 rounded-[var(--radius-4)] flex items-center gap-1" style={{ background: "var(--color-success-light)", color: "var(--color-success)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
                                      <CircleCheck size={16} /> {t("pipeline.milestones.markPaid" as any)}
                                    </button>
                                    <button onClick={() => { setEditMsId(ms.id); setMsForm({ label: ms.label, amount: String(ms.amount), percentage: String(ms.percentage || ""), due_date: ms.due_date || "", note: ms.note || "" }); setShowAddMs(true); }} className="btn-ghost text-[11px] p-1"><Edit2 size={16} /></button>
                                    <button onClick={() => deleteMilestone(ms.id)} className="btn-ghost text-[11px] p-1" style={{ color: "var(--color-danger)" }}><Trash2 size={16} /></button>
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
                              <div className="rounded-[var(--radius-6)] p-3 space-y-3" style={{ background: "var(--color-bg-tertiary)", border: "1px solid var(--color-accent)", borderStyle: "dashed" }}>
                                <div className="flex items-center justify-between">
                                  <span className="text-[13px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{editMsId ? t("common.edit" as any) : t("pipeline.milestones.add" as any)}</span>
                                  <button onClick={() => { setShowAddMs(false); setEditMsId(null); setMsForm(emptyMs); }} className="btn-ghost p-0.5"><X size={16} /></button>
                                </div>
                                {/* Preset buttons */}
                                {!editMsId && (
                                  <div className="flex gap-1.5">
                                    {(["deposit", "midway", "final"] as const).map(p => (
                                      <button key={p} onClick={() => applyPreset(p)} className="text-[11px] px-2 py-1 rounded-[var(--radius-4)] transition-colors" style={{ background: "color-mix(in srgb, var(--color-accent) 10%, transparent)", color: "var(--color-accent)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
                                        {t(`pipeline.milestones.presets.${p}` as any)}
                                      </button>
                                    ))}
                                  </div>
                                )}
                                <FL label={t("pipeline.milestones.label" as any)}><input value={msForm.label} onChange={e => setMsForm(p => ({ ...p, label: e.target.value }))} className="input-base w-full px-3 py-2 text-[13px]" placeholder={t("pipeline.milestones.presets.deposit" as any)} /></FL>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <FL label={t("pipeline.milestones.amount" as any)}><input type="number" min="0" value={msForm.amount} onChange={e => { const amt = e.target.value; const fee = Number(form.project_fee) || 1; setMsForm(p => ({ ...p, amount: amt, percentage: fee > 0 ? String(Math.round(Number(amt) / fee * 100)) : p.percentage })); }} className="input-base w-full px-3 py-2 text-[13px]" /></FL>
                                  <FL label={t("pipeline.milestones.percentage" as any)}><input type="number" min="0" max="100" value={msForm.percentage} onChange={e => { const pct = e.target.value; const fee = Number(form.project_fee) || 0; setMsForm(p => ({ ...p, percentage: pct, amount: fee > 0 ? String(Math.round(fee * Number(pct) / 100)) : p.amount })); }} className="input-base w-full px-3 py-2 text-[13px]" /></FL>
                                </div>
                                <FL label={t("pipeline.milestones.dueDate" as any)}><input type="date" value={msForm.due_date} onChange={e => setMsForm(p => ({ ...p, due_date: e.target.value }))} className="input-base w-full px-3 py-2 text-[13px]" /></FL>
                                <FL label={t("pipeline.milestones.note" as any)}><input value={msForm.note} onChange={e => setMsForm(p => ({ ...p, note: e.target.value }))} className="input-base w-full px-3 py-2 text-[13px]" /></FL>
                                {!editMsId && (
                                  <label className="flex items-center gap-2 cursor-pointer py-1">
                                    <input type="checkbox" checked={msForm.alreadyPaid} onChange={e => setMsForm(p => ({ ...p, alreadyPaid: e.target.checked }))} className="w-4 h-4 rounded accent-[var(--color-success)]" />
                                    <span className="text-[13px]" style={{ color: msForm.alreadyPaid ? "var(--color-success)" : "var(--color-text-secondary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{t("pipeline.milestones.alreadyPaid" as any)}</span>
                                  </label>
                                )}
                                {msForm.alreadyPaid && !editMsId && (
                                  <FL label={t("pipeline.milestones.paymentMethod" as any)}>
                                    <select value={msForm.payMethod} onChange={e => setMsForm(p => ({ ...p, payMethod: e.target.value }))} className="input-base w-full px-3 py-2 text-[13px]">
                                      {PAYMENT_METHODS.map(m => <option key={m} value={m}>{t(`pipeline.milestones.method.${m}` as any)}</option>)}
                                    </select>
                                  </FL>
                                )}
                                <div className="flex justify-end gap-2">
                                  <button onClick={() => { setShowAddMs(false); setEditMsId(null); setMsForm(emptyMs); }} className="btn-secondary text-[13px]">{t("common.cancel" as any)}</button>
                                  <button onClick={saveMilestone} disabled={!msForm.label || !msForm.amount} className="btn-primary text-[13px]">{msForm.alreadyPaid && !editMsId ? t("pipeline.milestones.saveAndRecord" as any) : t("common.save" as any)}</button>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Mark Paid confirmation modal */}
                        {markPaidId && (
                          <div className="rounded-[var(--radius-6)] p-3 space-y-3" style={{ background: "color-mix(in srgb, var(--color-success) 6%, var(--color-bg-primary))", border: "1px solid var(--color-success)" }}>
                            <div className="text-[13px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{t("pipeline.milestones.markPaidConfirm" as any)}</div>
                            <FL label={t("pipeline.milestones.paymentMethod" as any)}>
                              <select value={markPaidMethod} onChange={e => setMarkPaidMethod(e.target.value)} className="input-base w-full px-3 py-2 text-[13px]">
                                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{t(`pipeline.milestones.method.${m}` as any)}</option>)}
                              </select>
                            </FL>
                            <div className="flex justify-end gap-2">
                              <button onClick={() => setMarkPaidId(null)} className="btn-secondary text-[13px]">{t("common.cancel" as any)}</button>
                              <button onClick={confirmMarkPaid} className="text-[13px] px-3 py-2 rounded-[var(--radius-6)] text-white" style={{ background: "var(--color-success)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>
                                <Check size={16} className="inline mr-1" />{t("pipeline.milestones.markPaid" as any)}
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
                    <div className="border-t" style={{ borderColor: "var(--color-border-primary)" }} />
                    <div className="flex items-center justify-between">
                      <span className="section-label flex items-center gap-1.5"><DollarSign size={16} /> {t("pipeline.tx.title" as any)}</span>
                      <button onClick={() => { setShowTxForm(true); setEditTxId(null); setTxForm({ ...emptyTx, taxMode: (form.tax_mode || "none") as any, taxRate: form.tax_rate || "" }); }} className="btn-ghost text-[11px] flex items-center gap-1" style={{ color: "var(--color-accent)" }}><Plus size={16} /> {t("pipeline.tx.add" as any)}</button>
                    </div>
                    <div className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>{t("pipeline.tx.hint" as any)}</div>

                    {/* Summary bar */}
                    {clientTxs.length > 0 && (() => {
                      const received = clientTxs.filter((tx: any) => tx.type === "income" && (tx.status || "已完成") === "已完成").reduce((s: number, tx: any) => s + Number(tx.amount || 0), 0);
                      const receivedTax = clientTxs.filter((tx: any) => tx.type === "income" && (tx.status || "已完成") === "已完成").reduce((s: number, tx: any) => s + Number(tx.tax_amount || 0), 0);
                      const pending = clientTxs.filter((tx: any) => (tx.status || "").includes("应收")).reduce((s: number, tx: any) => { const a = Number(tx.amount || 0); const t2 = Number(tx.tax_amount || 0); return s + ((tx.tax_mode || 'none') === 'exclusive' ? a + t2 : a); }, 0);
                      const expense = clientTxs.filter((tx: any) => tx.type === "expense" && (tx.status || "已完成") === "已完成").reduce((s: number, tx: any) => { const a = Number(tx.amount || 0); const t2 = Number(tx.tax_amount || 0); return s + ((tx.tax_mode || 'none') === 'exclusive' ? a + t2 : a); }, 0);
                      return (
                        <div className="flex items-center gap-3 text-[11px]" style={{ fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
                          <span style={{ color: "var(--color-success)" }}>{t("pipeline.tx.received" as any)} ${received.toLocaleString()}{receivedTax > 0 ? ` (+${t("finance.tax" as any)} $${receivedTax.toLocaleString()})` : ""}</span>
                          {pending > 0 && <span style={{ color: "var(--color-warning)" }}>{t("pipeline.tx.pending" as any)} ${pending.toLocaleString()}</span>}
                          {expense > 0 && <span style={{ color: "var(--color-text-secondary)" }}>{t("pipeline.tx.expense" as any)} ${expense.toLocaleString()}</span>}
                        </div>
                      );
                    })()}

                    {/* Transaction list */}
                    {clientTxs.length > 0 ? (
                      <div className="space-y-2">
                        {clientTxs.map((tx: any) => (
                          <div key={tx.id} className="rounded-[var(--radius-6)] p-3 space-y-1" style={{ background: "var(--color-bg-tertiary)", border: "1px solid var(--color-border-primary)" }}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                {(() => {
                                  const txAmt = Math.abs(Number(tx.amount || 0));
                                  const txTax = Math.abs(Number(tx.tax_amount || 0));
                                  const isInc = tx.type === "income";
                                  const txMode = tx.tax_mode || 'none';
                                  // Exclusive expense: add tax; Inclusive expense: amount already has tax
                                  const displayAmt = isInc ? txAmt : (txMode === 'exclusive' ? txAmt + txTax : txAmt);
                                  return (<>
                                    <span className="text-[13px] shrink-0" style={{ color: isInc ? "var(--color-success)" : "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>
                                      {isInc ? "+" : "-"}${displayAmt.toLocaleString()}
                                    </span>
                                    {txTax > 0 && <span className="text-[11px] shrink-0" style={{ color: "var(--color-text-secondary)" }}>{txMode === "exclusive" ? `+${t("finance.tax" as any)} $${txTax.toLocaleString()}` : txMode === "inclusive" ? `${t("finance.taxIncluded" as any)} $${txTax.toLocaleString()}` : ""}</span>}
                                  </>);
                                })()}
                                <span className="text-[13px] truncate" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{tx.description || tx.desc}</span>
                              </div>
                              {(!tx.source || tx.source === "manual") && (
                                <div className="flex items-center gap-1 shrink-0">
                                  <button onClick={() => { setEditTxId(tx.id); setTxForm({ date: tx.date, desc: tx.description || tx.desc, category: tx.category, amount: String(Math.abs(tx.amount)), status: tx.status || "已完成", taxMode: tx.tax_mode || "none", taxRate: tx.tax_rate ? String(tx.tax_rate) : "" }); setShowTxForm(true); }} className="btn-ghost p-1"><Edit2 size={16} /></button>
                                  <button onClick={() => deleteTx(tx.id)} className="btn-ghost p-1" style={{ color: "var(--color-danger)" }}><Trash2 size={16} /></button>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>{tx.date}</span>
                              <span className="badge text-[11px]">{catLabel(tx.category, t)}</span>
                              <span className="badge text-[11px]" style={{
                                background: (tx.status || "已完成") === "已完成" ? "var(--color-success-light)" : (tx.status || "").includes("应收") ? "var(--color-warning-light)" : "var(--color-danger-light)",
                                color: (tx.status || "已完成") === "已完成" ? "var(--color-success)" : (tx.status || "").includes("应收") ? "var(--color-warning)" : "var(--color-danger)",
                              }}>{stLabel(tx.status || "已完成", t)}</span>
                              {tx.source === "client_subscription" && <span className="badge text-[11px]" style={{ background: "color-mix(in srgb, var(--color-blue) 12%, transparent)", color: "var(--color-blue)" }}>{t("money.badge.subscription" as any)}</span>}
                              {tx.source === "client_project" && <span className="badge text-[11px]" style={{ background: "color-mix(in srgb, var(--color-orange) 12%, transparent)", color: "var(--color-orange)" }}>{t("money.badge.project" as any)}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : !showTxForm && (
                      <div className="text-center py-3 text-[13px]" style={{ color: "var(--color-text-secondary)" }}>{t("pipeline.tx.empty" as any)}</div>
                    )}

                    {/* Add/Edit transaction form */}
                    <AnimatePresence>
                      {showTxForm && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                          <div className="rounded-[var(--radius-6)] p-3 space-y-3" style={{ background: "var(--color-bg-tertiary)", border: "1px solid var(--color-accent)", borderStyle: "dashed" }}>
                            <div className="flex items-center justify-between">
                              <span className="text-[13px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{editTxId ? t("common.edit" as any) : t("pipeline.tx.add" as any)}</span>
                              <button onClick={() => { setShowTxForm(false); setEditTxId(null); setTxForm(emptyTx); }} className="btn-ghost p-0.5"><X size={16} /></button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <FL label={t("pipeline.tx.date" as any)}><input type="date" value={txForm.date} onChange={e => setTxForm(p => ({ ...p, date: e.target.value }))} className="input-base w-full px-3 py-2 text-[13px]" /></FL>
                              <FL label={t("pipeline.tx.category" as any)}><select value={txForm.category} onChange={e => setTxForm(p => ({ ...p, category: e.target.value }))} className="input-base w-full px-3 py-2 text-[13px]">{TX_CATEGORIES.map(c => <option key={c} value={c}>{catLabel(c, t)}</option>)}</select></FL>
                            </div>
                            <FL label={t("pipeline.tx.description" as any)}><input value={txForm.desc} onChange={e => setTxForm(p => ({ ...p, desc: e.target.value }))} className="input-base w-full px-3 py-2 text-[13px]" /></FL>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <FL label={t("pipeline.tx.amount" as any)}>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px]" style={{ color: "var(--color-text-secondary)" }}>$</span>
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
                                    className="flex-1 py-2 rounded-[var(--radius-6)] text-[13px] transition-all"
                                    style={txForm.taxMode === mode ? { background: "var(--color-accent)", color: "#fff", fontWeight: "var(--font-weight-medium)" } : { background: "var(--color-bg-tertiary)", color: "var(--color-text-secondary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
                                    {label}
                                  </button>
                                ))}
                              </div>
                              {txForm.taxMode !== "none" && (
                                <div className="flex gap-2">
                                  {[13, 6, 3].map(r => (
                                    <button key={r} type="button" onClick={() => setTxForm(p => ({ ...p, taxRate: String(r) }))}
                                      className="px-3 py-2 rounded-[var(--radius-4)] text-[11px] transition-all"
                                      style={Number(txForm.taxRate) === r ? { background: "var(--color-accent-tint)", color: "var(--color-accent)", border: "1px solid var(--color-accent)", fontWeight: "var(--font-weight-medium)" } : { background: "var(--color-bg-tertiary)", color: "var(--color-text-secondary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
                                      {r}%
                                    </button>
                                  ))}
                                  <input type="number" min="0" max="100" step="0.01" value={txForm.taxRate} onChange={e => setTxForm(p => ({ ...p, taxRate: e.target.value }))} placeholder={t("money.form.customTaxPlaceholder" as any)} className="input-base flex-1 px-3 py-2 text-[11px] min-w-0" />
                                </div>
                              )}
                            </FL>
                            {txForm.taxMode !== "none" && Number(txForm.amount) > 0 && Number(txForm.taxRate) > 0 && (() => {
                              const amt = Number(txForm.amount);
                              const rate = Number(txForm.taxRate);
                              const tax = txForm.taxMode === "exclusive" ? Math.round(amt * rate / 100 * 100) / 100 : Math.round(amt * rate / (100 + rate) * 100) / 100;
                              const total = txForm.taxMode === "exclusive" ? amt + tax : amt;
                              const base = txForm.taxMode === "inclusive" ? amt - tax : amt;
                              return (
                                <div className="rounded-[var(--radius-6)] p-3 text-[11px] tabular-nums" style={{ background: "var(--color-bg-tertiary)", border: "1px solid var(--color-border-primary)" }}>
                                  <div className="flex justify-between"><span style={{ color: "var(--color-text-secondary)" }}>{txForm.taxMode === "inclusive" ? t("pipeline.tx.baseAmount" as any) : t("pipeline.tx.amount" as any)}</span><span style={{ color: "var(--color-text-primary)" }}>${base.toLocaleString()}</span></div>
                                  <div className="flex justify-between"><span style={{ color: "var(--color-text-secondary)" }}>{t("finance.tax" as any)} ({rate}%)</span><span style={{ color: "var(--color-text-primary)" }}>${tax.toLocaleString()}</span></div>
                                  <div className="flex justify-between border-t pt-1 mt-1" style={{ borderColor: "var(--color-border-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}><span style={{ color: "var(--color-text-primary)" }}>{t("pipeline.tx.total" as any)}</span><span style={{ color: "var(--color-success)" }}>${total.toLocaleString()}</span></div>
                                </div>
                              );
                            })()}
                            <div className="flex justify-end gap-2">
                              <button onClick={() => { setShowTxForm(false); setEditTxId(null); setTxForm(emptyTx); }} className="btn-secondary text-[13px]">{t("common.cancel" as any)}</button>
                              <button onClick={saveTx} disabled={!txForm.amount} className="btn-primary text-[13px]">{t("common.save" as any)}</button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}
              </div>
              <div className="flex items-center justify-between px-5 py-3 border-t pb-safe" style={{ borderColor: "var(--color-border-primary)" }}>
                {editId ? <button type="button" onClick={() => deleteClient(editId)} className="btn-ghost text-[13px]" style={{ color: "var(--color-danger)" }}><Trash2 size={16} /> {t("common.delete" as any)}</button> : <div />}
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowPanel(false)} className="btn-secondary text-[13px]">{t("common.cancel" as any)}</button>
                  <button type="button" onClick={saveClient} className="btn-primary text-[13px]">{editId ? t("common.save" as any) : t("common.create" as any)}</button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ClientsView;
