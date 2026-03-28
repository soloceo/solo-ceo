import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useT } from "../../i18n/context";
import { useRealtimeRefresh } from "../../hooks/useRealtimeRefresh";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useUIStore } from "../../store/useUIStore";
import { Skeleton } from "../../components/ui";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus,
  X,
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertCircle,
  PanelRightClose,
  Download,
  Search,
  Receipt,
} from "lucide-react";

import { calcTaxAmount, catLabel, STATUS_I18N } from "../../lib/tax";
const FinanceChart = React.lazy(() => import("./FinanceChart"));
import { StatCard, TxRow, VirtualTxList } from "./TransactionList";

/* ── Helpers ── */
const stLabel = (st: string, t: (k: any) => string) => {
  const key = STATUS_I18N[st];
  return key ? t(key as any) : st;
};

function FL({ children }: { children: React.ReactNode }) {
  return <label className="section-label block mb-1">{children}</label>;
}

const FINANCE_TABLES = ["finance_transactions", "clients", "payment_milestones"] as const;
const TX_CATEGORIES = ["收入", "软件支出", "外包支出", "应收", "应付", "其他支出", "餐饮", "交通", "房租", "娱乐", "个人其他"];
const PERSONAL_CATEGORIES = new Set(["餐饮", "交通", "房租", "娱乐", "个人其他"]);
const TX_STATUSES = ["已完成", "待收款 (应收)", "待支付 (应付)"];

const createEmptyForm = () => ({
  date: new Date().toISOString().slice(0, 10),
  desc: "",
  category: "收入",
  amount: "",
  status: "已完成",
  taxMode: "none" as "none" | "exclusive" | "inclusive",
  taxRate: "",
  client_id: "" as string | number,
  client_name: "",
});

/* ═══════════════════════════════════════════════════════════════════
   FinancePage — 收支统计
   ═══════════════════════════════════════════════════════════════════ */
export default function FinancePage() {
  const { t, lang } = useT();
  const showToast = useUIStore((s) => s.showToast);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const isMobile = useIsMobile();

  /* ── Data state ── */
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [clientList, setClientList] = useState<any[]>([]);

  /* ── UI state ── */
  const [showPanel, setShowPanel] = useState(false);
  const [editingTx, setEditingTx] = useState<any>(null);
  const [showAll, setShowAll] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Cmd/Ctrl+Enter to submit finance form
  useEffect(() => {
    if (!showPanel) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        const form = document.getElementById("finance-form") as HTMLFormElement;
        form?.requestSubmit();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [showPanel]);

  /* ── Filter state (consolidated to reduce re-renders) ── */
  const [filters, setFilters] = useState({
    scope: "all", type: "all", category: "all", status: "all", client: "all",
    dateFrom: "", dateTo: "", search: "",
  });
  const setFilter = useCallback(<K extends keyof typeof filters>(key: K, val: typeof filters[K]) => {
    setFilters(p => ({ ...p, [key]: val }));
  }, []);
  const filterScope = filters.scope, filterType = filters.type, filterCategory = filters.category;
  const filterStatus = filters.status, filterClient = filters.client;
  const filterDateFrom = filters.dateFrom, filterDateTo = filters.dateTo;
  const filterSearch = filters.search;

  /* ── Form state ── */
  const [formData, setFormData] = useState(createEmptyForm);

  const categories = TX_CATEGORIES;
  const statuses = TX_STATUSES;

  /* ── Fetch ── */
  const fetchFinance = useCallback(async () => {
    try {
      const res = await fetch("/api/finance");
      const data = await res.json();
      setTransactions(Array.isArray(data) ? data : []);
    } catch { showToast(t("money.loadFail" as any)); }
    finally { setIsLoading(false); }
  }, [showToast, t]);

  const fetchClients = useCallback(async () => {
    try { const d = await (await fetch("/api/clients")).json(); setClientList(Array.isArray(d) ? d : []); } catch {}
  }, []);

  useEffect(() => { Promise.all([fetchFinance(), fetchClients()]); }, [fetchFinance, fetchClients]);
  useRealtimeRefresh(FINANCE_TABLES, fetchFinance);

  useEffect(() => {
    const anyOpen = isMobile && (showPanel || showAll);
    window.dispatchEvent(new CustomEvent("mobile-nav-visibility", { detail: { hidden: anyOpen } }));
    return () => window.dispatchEvent(new CustomEvent("mobile-nav-visibility", { detail: { hidden: false } }));
  }, [showPanel, showAll, isMobile]);

  /* ── Quick Create listener ── */
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.type === "transaction") openPanel();
    };
    window.addEventListener("quick-create", handler);
    return () => window.removeEventListener("quick-create", handler);
  }, []);

  /* ── Stats computation ── */
  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    let totalIncome = 0, totalExpense = 0, receivable = 0, payable = 0;
    let monthIncome = 0, monthExpense = 0, totalTax = 0;

    for (const tx of transactions) {
      const amt = Math.abs(Number(tx.amount || 0));
      const tax = Math.abs(Number(tx.tax_amount || 0));
      const isIncome = tx.type === "income" || Number(tx.amount || 0) > 0;
      const txMode = tx.tax_mode || 'none';

      const expenseTotal = txMode === 'exclusive' ? amt + tax : amt;

      if (tx.status === "待收款 (应收)") { receivable += (txMode === 'exclusive' ? amt + tax : amt); continue; }
      if (tx.status === "待支付 (应付)") { payable += expenseTotal; continue; }

      if (isIncome) { totalIncome += amt; totalTax += tax; }
      else { totalExpense += expenseTotal; }

      if ((tx.date || "").startsWith(thisMonth)) {
        if (isIncome) monthIncome += amt;
        else monthExpense += expenseTotal;
      }
    }

    return {
      totalIncome, totalExpense,
      netProfit: totalIncome - totalExpense,
      margin: totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome * 100).toFixed(1) : "0",
      receivable, payable, totalTax,
      monthIncome, monthExpense,
      monthNet: monthIncome - monthExpense,
    };
  }, [transactions]);

  /* ── Chart data ── */
  const chartData = useMemo(() => {
    const months: Record<string, { month: string; income: number; expense: number; net: number }> = {};
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months[key] = { month: key, income: 0, expense: 0, net: 0 };
    }

    for (const tx of transactions) {
      if (!tx.date) continue;
      const m = tx.date.slice(0, 7);
      if (!months[m]) continue;
      const amt = Math.abs(Number(tx.amount || 0));
      const isIncome = tx.type === "income" || Number(tx.amount) > 0;

      if (tx.status === "待收款 (应收)" || tx.status === "待支付 (应付)") continue;

      if (isIncome) months[m].income += amt;
      else months[m].expense += amt;
    }

    return Object.values(months).map(m => ({
      ...m,
      net: m.income - m.expense,
      label: m.month.slice(5),
    }));
  }, [transactions]);

  /* ── Filtered transactions for "View All" ── */
  const filteredTxs = useMemo(() => {
    return transactions
      .filter(tx => {
        if (filterScope !== "all") {
          const isPersonal = PERSONAL_CATEGORIES.has(tx.category || "");
          if (filterScope === "personal" && !isPersonal) return false;
          if (filterScope === "business" && isPersonal) return false;
        }
        if (filterType !== "all") {
          const isIncome = tx.type === "income" || Number(tx.amount) > 0;
          if (filterType === "income" && !isIncome) return false;
          if (filterType === "expense" && isIncome) return false;
        }
        if (filterCategory !== "all" && tx.category !== filterCategory) return false;
        if (filterStatus !== "all" && tx.status !== filterStatus) return false;
        if (filterClient !== "all" && String(tx.client_id) !== filterClient) return false;
        if (filterDateFrom && (tx.date || "") < filterDateFrom) return false;
        if (filterDateTo && (tx.date || "") > filterDateTo) return false;
        if (filterSearch) {
          const s = filterSearch.toLowerCase();
          const desc = (tx.description || tx.desc || "").toLowerCase();
          const cat = (tx.category || "").toLowerCase();
          const client = (tx.client_name || "").toLowerCase();
          if (!desc.includes(s) && !cat.includes(s) && !client.includes(s)) return false;
        }
        return true;
      })
      .sort((a: any, b: any) => (b.date || "").localeCompare(a.date || ""));
  }, [transactions, filters]);

  /* ── Recent transactions (top 8) ── */
  const recentTxs = useMemo(() =>
    [...transactions].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 8),
  [transactions]);

  /* ── Panel open/close ── */
  const openPanel = async (tx: any = null) => {
    if (tx) {
      setEditingTx(tx);
      setFormData({
        date: tx.date || "",
        desc: tx.description || tx.desc || "",
        category: tx.category || "收入",
        amount: String(Math.abs(Number(tx.amount || 0))),
        status: tx.status || "已完成",
        taxMode: tx.tax_mode || "none",
        taxRate: tx.tax_rate ? String(tx.tax_rate) : "",
        client_id: tx.client_id || "",
        client_name: tx.client_name || "",
      });
    } else {
      setEditingTx(null);
      setFormData(createEmptyForm());
    }
    setShowPanel(true);
  };

  /* ── Save ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(formData.amount);
    if (!amt) return;

    const isIncome = ["收入", "应收", "项目收入"].includes(formData.category);
    const rate = Number(formData.taxRate) || 0;
    const taxAmount = calcTaxAmount(amt, formData.taxMode, rate);
    const selectedClient = clientList.find(c => String(c.id) === String(formData.client_id));

    const txData = {
      date: formData.date,
      description: formData.desc,
      category: formData.category,
      amount: isIncome ? amt : -amt,
      type: isIncome ? "income" : "expense",
      status: formData.status,
      tax_mode: formData.taxMode,
      tax_rate: rate,
      tax_amount: taxAmount,
      client_id: formData.client_id || null,
      client_name: selectedClient?.name || formData.client_name || "",
    };

    try {
      if (editingTx && !String(editingTx.id).includes("-")) {
        await fetch(`/api/finance/${editingTx.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(txData),
        });
        showToast(t("money.toast.updated" as any));
      } else {
        await fetch("/api/finance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(txData),
        });
        showToast(t("money.toast.added" as any));
      }
      setShowPanel(false);
      fetchFinance();
    } catch {
      showToast(t("money.saveFail" as any));
    }
  };

  /* ── Delete ── */
  const deleteTx = async (id: number) => {
    // Cache for undo
    const cached = transactions.find(tx => tx.id === id);
    try {
      await fetch(`/api/finance/${id}`, { method: "DELETE" });
      setDeleteId(null);
      fetchFinance();
      showToast(t("money.toast.deleted" as any), 5000, cached ? {
        label: t("common.undo" as any),
        fn: async () => {
          try {
            const isIncome = cached.type === "income";
            await fetch("/api/finance", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                date: cached.date,
                description: cached.description || cached.desc || "",
                category: cached.category,
                amount: Math.abs(Number(cached.amount || 0)) * (isIncome ? 1 : -1),
                type: cached.type,
                status: cached.status,
                tax_mode: cached.tax_mode || "none",
                tax_rate: Number(cached.tax_rate || 0),
                tax_amount: Number(cached.tax_amount || 0),
                client_id: cached.client_id || null,
                client_name: cached.client_name || "",
              }),
            });
            fetchFinance();
          } catch {}
        },
      } : undefined);
    } catch { showToast(t("money.deleteFail" as any)); }
  };

  /* ── Export CSV ── */
  const exportCSV = () => {
    const data = filteredTxs.length > 0 ? filteredTxs : transactions;
    const header = [t("money.table.date" as any), t("money.table.description" as any), t("money.table.category" as any), t("money.table.amount" as any), t("finance.tax" as any), t("money.table.status" as any), t("money.filter.client" as any)].join(",");
    const rows = data.map(tx =>
      [tx.date, `"${(tx.description || tx.desc || "").replace(/"/g, '""')}"`, tx.category, tx.amount, tx.tax_amount || 0, tx.status, `"${tx.client_name || ""}"`].join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finance-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(t("money.export.csvDone" as any));
  };

  /* ── Format helpers ── */
  const fmtAmt = (amt: number) => {
    const abs = Math.abs(amt);
    return `${amt >= 0 ? "+" : "-"}$${abs.toLocaleString()}`;
  };

  const fmtAmtColor = (amt: number) =>
    amt >= 0 ? "var(--color-success)" : "var(--color-danger)";

  /* ── Loading ── */
  if (isLoading) {
    return (
      <div className="mobile-page max-w-[960px] mx-auto min-h-full px-4 py-3 md:px-6 md:py-4 lg:px-8 lg:py-5">
        <div className="space-y-4 animate-skeleton-in">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-[80px] rounded-[var(--radius-12)]" />)}
          </div>
          <Skeleton className="h-[200px] rounded-[var(--radius-12)]" />
          <div className="space-y-0">
            {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-[64px]" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-page max-w-[960px] mx-auto min-h-full flex flex-col px-4 py-3 md:px-6 md:py-4 lg:px-8 lg:py-5 relative">

      {/* Header */}
      <header className="flex items-center justify-between mb-4">
        <h1 className="page-title">{t("finance.pageTitle" as any)}</h1>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="btn-ghost compact gap-1.5">
            <Download size={16} /> <span className="hidden sm:inline">{t("money.export.csv" as any)}</span>
          </button>
          <button onClick={() => openPanel()} className="btn-primary compact">
            <Plus size={16} /> {t("finance.addRecord" as any)}
          </button>
        </div>
      </header>

      {/* ── KPI Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard
          label={t("money.stat.completedRevenue" as any)}
          value={`$${stats.totalIncome.toLocaleString()}`}
          sub={`${t("finance.thisMonth" as any)} $${stats.monthIncome.toLocaleString()}`}
          icon={<TrendingUp size={16} />}
          color="var(--color-success)"
        />
        <StatCard
          label={t("money.stat.completedExpense" as any)}
          value={`$${stats.totalExpense.toLocaleString()}`}
          sub={`${t("finance.thisMonth" as any)} $${stats.monthExpense.toLocaleString()}`}
          icon={<TrendingDown size={16} />}
          color="var(--color-danger)"
        />
        <StatCard
          label={t("money.stat.netProfit" as any)}
          value={stats.netProfit < 0 ? `-$${Math.abs(stats.netProfit).toLocaleString()}` : `$${stats.netProfit.toLocaleString()}`}
          sub={`${t("money.stat.margin" as any)} ${stats.margin}%`}
          icon={<Wallet size={16} />}
          color={stats.netProfit >= 0 ? "var(--color-success)" : "var(--color-danger)"}
        />
        <StatCard
          label={t("money.stat.receivable" as any)}
          value={`$${stats.receivable.toLocaleString()}`}
          sub={stats.payable > 0 ? `${t("money.st.payable" as any)} $${stats.payable.toLocaleString()}` : ""}
          icon={<AlertCircle size={16} />}
          color="var(--color-warning)"
        />
        {stats.totalTax > 0 && (
          <StatCard
            label={t("finance.totalTax" as any)}
            value={`$${stats.totalTax.toLocaleString()}`}
            sub=""
            icon={<Receipt size={16} />}
            color="var(--color-text-secondary)"
          />
        )}
      </div>

      {/* ── Chart ── */}
      <React.Suspense fallback={<div className="card p-4 mb-4 h-[200px] skeleton-bone rounded-[var(--radius-12)]" />}>
        <FinanceChart chartData={chartData} isMobile={isMobile} t={t} />
      </React.Suspense>

      {/* ── Recent Transactions ── */}
      <div className="card p-4 flex-1 min-h-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{t("money.recent.title" as any)}</h3>
          <button onClick={() => setShowAll(true)} className="btn-ghost compact">
            {t("money.recent.viewAll" as any)} ({transactions.length})
          </button>
        </div>

        <div className="space-y-0">
          {recentTxs.map(tx => {
            const isSystem = tx.source && tx.source !== 'manual';
            return (
              <TxRow
                key={tx.id}
                tx={tx}
                t={t}
                fmtAmt={fmtAmt}
                fmtAmtColor={fmtAmtColor}
                onEdit={() => { if (!isSystem) openPanel(tx); }}
                onDelete={() => { if (!isSystem) setDeleteId(tx.id); }}
                isSystem={isSystem}
              />
            );
          })}
          {recentTxs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Receipt size={32} style={{ color: "var(--color-text-secondary)" }} />
              <p className="text-[15px]" style={{ color: "var(--color-text-secondary)" }}>{t("money.noData" as any)}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Delete Confirmation ── */}
      {deleteId !== null && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4 animate-fade-in" style={{ zIndex: 710, background: "var(--color-overlay-primary)", paddingBottom: "max(env(safe-area-inset-bottom, 0px), 16px)" }}>
          <div className="card-elevated p-5 max-w-sm w-full" role="dialog" aria-modal="true" aria-label="Confirm delete">
            <h3 className="text-[15px] mb-2" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{t("money.delete.title" as any)}</h3>
            <p className="text-[15px] mb-4" style={{ color: "var(--color-text-secondary)" }}>{t("money.delete.message" as any)}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteId(null)} className="btn-ghost text-[15px]">{t("money.cancel" as any)}</button>
              <button onClick={() => deleteTx(deleteId)} className="text-[15px] px-4 py-2 rounded-[var(--radius-6)] transition-colors" style={{ background: "var(--color-danger)", color: "var(--color-text-on-color)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{t("money.delete.confirm" as any)}</button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ── View All Modal ── */}
      {showAll && createPortal(
        <div className="fixed inset-0 flex flex-col page-enter" role="dialog" aria-modal="true" aria-label="All transactions" style={{ zIndex: 700, background: "var(--color-bg-primary)", paddingBottom: "max(env(safe-area-inset-bottom, 0px), 8px)" }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b shrink-0" style={{ borderColor: "var(--color-border-primary)", paddingTop: "max(12px, var(--mobile-header-pt, env(safe-area-inset-top, 0px)))" }}>
              <div>
                <h3 className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{t("money.allTx.title" as any)}</h3>
                <p className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>{t("money.filter.results" as any).replace("{count}", String(filteredTxs.length))}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={exportCSV} className="btn-ghost compact gap-1" aria-label="Export CSV"><Download size={16} /></button>
                <button onClick={() => setShowAll(false)} className="btn-icon" aria-label="Close"><X size={18} /></button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 px-5 py-3 border-b shrink-0 overflow-x-auto ios-scroll" style={{ borderColor: "var(--color-border-primary)" }}>
              <div className="relative min-w-[140px] max-w-[240px] shrink-0">
                <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--color-text-secondary)" }} />
                <input
                  type="text" value={filterSearch} onChange={e => setFilter("search", e.target.value)}
                  placeholder={t("finance.searchPlaceholder" as any)}
                  className="input-base compact w-full pl-8 pr-3 text-[15px]"
                />
              </div>
              <select value={filterScope} onChange={e => setFilter("scope", e.target.value)} className="input-base compact px-2 text-[15px] shrink-0">
                <option value="all">{t("money.filter.scopeAll" as any)}</option>
                <option value="business">{t("money.filter.scopeBusiness" as any)}</option>
                <option value="personal">{t("money.filter.scopePersonal" as any)}</option>
              </select>
              <select value={filterType} onChange={e => setFilter("type", e.target.value)} className="input-base compact px-2 text-[15px] shrink-0">
                <option value="all">{t("money.filter.typeAll" as any)}</option>
                <option value="income">{t("money.filter.income" as any)}</option>
                <option value="expense">{t("money.filter.expense" as any)}</option>
              </select>
              <select value={filterCategory} onChange={e => setFilter("category", e.target.value)} className="input-base compact px-2 text-[15px] shrink-0">
                <option value="all">{t("money.filter.categoryAll" as any)}</option>
                {categories.map(c => <option key={c} value={c}>{catLabel(c, t)}</option>)}
              </select>
              <select value={filterStatus} onChange={e => setFilter("status", e.target.value)} className="input-base compact px-2 text-[15px] shrink-0">
                <option value="all">{t("money.filter.statusAll" as any)}</option>
                {statuses.map(s => <option key={s} value={s}>{stLabel(s, t)}</option>)}
              </select>
              <select value={filterClient} onChange={e => setFilter("client", e.target.value)} className="input-base compact px-2 text-[15px] shrink-0">
                <option value="all">{t("money.filter.clientAll" as any)}</option>
                {clientList.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
              </select>
              <input type="date" value={filterDateFrom} onChange={e => setFilter("dateFrom", e.target.value)} className="input-base compact px-2 text-[15px] shrink-0" />
              <input type="date" value={filterDateTo} onChange={e => setFilter("dateTo", e.target.value)} className="input-base compact px-2 text-[15px] shrink-0" />
              {(filterScope !== "all" || filterType !== "all" || filterCategory !== "all" || filterStatus !== "all" || filterClient !== "all" || filterDateFrom || filterDateTo || filterSearch) && (
                <button
                  onClick={() => setFilters({ scope: "all", type: "all", category: "all", status: "all", client: "all", dateFrom: "", dateTo: "", search: "" })}
                  className="btn-ghost compact text-[13px]"
                >{t("money.filter.clear" as any)}</button>
              )}
            </div>

            {/* Table — virtualized for 500+ rows */}
            <div className="hidden md:grid grid-cols-[100px_1fr_120px_120px_120px_80px] gap-2 px-5 py-2 text-[13px] shrink-0" style={{ color: "var(--color-text-secondary)", borderBottom: "1px solid var(--color-border-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
              <span>{t("money.table.date" as any)}</span>
              <span>{t("money.table.description" as any)}</span>
              <span>{t("money.table.category" as any)}</span>
              <span className="text-right">{t("money.table.amount" as any)}</span>
              <span>{t("money.table.status" as any)}</span>
              <span></span>
            </div>
            <VirtualTxList
              items={filteredTxs}
              t={t}
              lang={lang}
              fmtAmt={fmtAmt}
              fmtAmtColor={fmtAmtColor}
              onEdit={(tx: any) => { if (!tx.source || tx.source === 'manual') openPanel(tx); }}
              onDelete={(tx: any) => { if (!tx.source || tx.source === 'manual') setDeleteId(tx.id); }}
              onClientClick={() => setActiveTab("clients")}
            />
            {filteredTxs.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 gap-2">
                <Receipt size={32} style={{ color: "var(--color-text-secondary)" }} />
                <p className="text-[15px]" style={{ color: "var(--color-text-secondary)" }}>{t("money.noData" as any)}</p>
              </div>
            )}
          </div>,
          document.body
        )}

      {/* ── Add/Edit Panel ── */}
      {createPortal(<AnimatePresence>
        {showPanel && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className={isMobile ? "fixed inset-0" : "fixed inset-0"}
              style={{ zIndex: 699, background: isMobile ? "var(--color-bg-primary)" : "var(--color-overlay-primary)" }}
              onClick={() => !isMobile && setShowPanel(false)}
            />
            <motion.div
              initial={{ x: isMobile ? 0 : "100%", y: isMobile ? "100%" : 0 }}
              animate={{ x: 0, y: 0 }}
              exit={{ x: isMobile ? 0 : "100%", y: isMobile ? "100%" : 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              role="dialog"
              aria-modal="true"
              aria-label="Transaction form"
              className={isMobile
                ? "fixed inset-0 flex flex-col"
                : "fixed top-0 right-0 h-full w-full max-w-[480px] border-l flex flex-col"
              }
              style={{ zIndex: 700, background: "var(--color-bg-primary)", borderColor: "var(--color-border-primary)" }}
            >
              {/* Panel header */}
              <div className="flex items-center justify-between px-5 py-3 border-b shrink-0" style={{ borderColor: "var(--color-border-primary)", paddingTop: "max(12px, var(--mobile-header-pt, env(safe-area-inset-top, 0px)))" }}>
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-6)]" style={{ background: "var(--color-accent-tint)", color: "var(--color-accent)" }}>
                    <Receipt size={16} />
                  </div>
                  <div>
                    <h3 className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>
                      {editingTx ? t("money.panel.edit" as any) : t("money.panel.new" as any)}
                    </h3>
                    <p className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
                      {editingTx ? t("money.panel.editDesc" as any) : t("money.panel.newDesc" as any)}
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowPanel(false)} className="btn-icon" aria-label="Close panel">
                  {isMobile ? <X size={18} /> : <PanelRightClose size={18} />}
                </button>
              </div>

              {/* Form */}
              <form id="finance-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto overflow-x-hidden p-5 space-y-3 ios-scroll">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <FL>{t("money.form.date" as any)}</FL>
                    <input type="date" required value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="input-base w-full px-3 py-2 text-[15px]" />
                  </div>
                  <div>
                    <FL>{t("money.form.category" as any)}</FL>
                    <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className="input-base w-full px-3 py-2 text-[15px]">
                      {categories.map(c => <option key={c} value={c}>{catLabel(c, t)}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <FL>{t("money.form.description" as any)}</FL>
                  <input type="text" value={formData.desc} onChange={e => setFormData({ ...formData, desc: e.target.value })} placeholder={t("money.form.descPlaceholder" as any)} className="input-base w-full px-3 py-2 text-[15px]" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <FL>{t("money.form.amount" as any)}</FL>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[15px]" style={{ color: "var(--color-text-secondary)" }}>$</span>
                      <input type="number" required min="0" step="0.01" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} placeholder="0.00" className="input-base w-full pl-7 pr-3 py-2 text-[15px]" />
                    </div>
                  </div>
                  <div>
                    <FL>{t("money.form.status" as any)}</FL>
                    <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} className="input-base w-full px-3 py-2 text-[15px]">
                      {statuses.map(s => <option key={s} value={s}>{stLabel(s, t)}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <FL>{t("money.form.client" as any)}</FL>
                  <select value={formData.client_id} onChange={e => { const c = clientList.find(cl => String(cl.id) === e.target.value); setFormData({ ...formData, client_id: e.target.value, client_name: c?.name || "" }); }} className="input-base w-full px-3 py-2 text-[15px]">
                    <option value="">{t("money.form.clientNone" as any)}</option>
                    {clientList.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                  </select>
                </div>

                {/* Tax */}
                <div>
                  <FL>{t("money.form.tax" as any)}</FL>
                  <div className="flex gap-2 mb-2">
                    {(["none", "exclusive", "inclusive"] as const).map(mode => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setFormData({ ...formData, taxMode: mode })}
                        className="flex-1 text-[15px] py-2 rounded-full transition-all"
                        style={formData.taxMode === mode ? { background: "var(--color-accent)", color: "var(--color-brand-text)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties : { background: "var(--color-bg-tertiary)", color: "var(--color-text-secondary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}
                      >
                        {mode === "none" ? t("money.form.taxNone" as any) : mode === "exclusive" ? t("money.form.taxExcl" as any) : t("money.form.taxIncl" as any)}
                      </button>
                    ))}
                  </div>
                  {formData.taxMode !== "none" && (
                    <div className="flex gap-2 items-center">
                      {[13, 6, 3].map(r => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setFormData({ ...formData, taxRate: String(r) })}
                          className="text-[15px] px-3 py-1 rounded-[var(--radius-4)] transition-colors"
                          style={{
                            background: String(formData.taxRate) === String(r) ? "var(--color-accent-tint)" : "var(--color-bg-tertiary)",
                            color: String(formData.taxRate) === String(r) ? "var(--color-accent)" : "var(--color-text-secondary)",
                          }}
                        >
                          {r}%
                        </button>
                      ))}
                      <input
                        type="number"
                        min="0" max="100" step="0.1"
                        value={formData.taxRate}
                        onChange={e => setFormData({ ...formData, taxRate: e.target.value })}
                        placeholder={t("money.form.customTaxPlaceholder" as any)}
                        className="input-base flex-1 px-2 py-1 text-[15px]"
                      />
                    </div>
                  )}
                </div>
                {formData.taxMode !== "none" && Number(formData.amount) > 0 && Number(formData.taxRate) > 0 && (() => {
                  const amt = Number(formData.amount);
                  const rate = Number(formData.taxRate);
                  const tax = formData.taxMode === "exclusive" ? Math.round(amt * rate / 100 * 100) / 100 : Math.round(amt * rate / (100 + rate) * 100) / 100;
                  const total = formData.taxMode === "exclusive" ? amt + tax : amt;
                  const base = formData.taxMode === "inclusive" ? amt - tax : amt;
                  return (
                    <div className="rounded-[var(--radius-6)] p-3 text-[13px] tabular-nums" style={{ background: "var(--color-bg-tertiary)", border: "1px solid var(--color-border-primary)" }}>
                      <div className="flex justify-between"><span style={{ color: "var(--color-text-secondary)" }}>{formData.taxMode === "inclusive" ? t("pipeline.tx.baseAmount" as any) : t("pipeline.tx.amount" as any)}</span><span style={{ color: "var(--color-text-primary)" }}>${base.toLocaleString()}</span></div>
                      <div className="flex justify-between"><span style={{ color: "var(--color-text-secondary)" }}>{t("finance.tax" as any)} ({rate}%)</span><span style={{ color: "var(--color-text-primary)" }}>${tax.toLocaleString()}</span></div>
                      <div className="flex justify-between border-t pt-1 mt-1" style={{ borderColor: "var(--color-border-primary)", color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}><span>{t("pipeline.tx.total" as any)}</span><span style={{ color: "var(--color-success)" }}>${total.toLocaleString()}</span></div>
                    </div>
                  );
                })()}
              </form>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 px-5 py-3 border-t pb-safe shrink-0" style={{ borderColor: "var(--color-border-primary)" }}>
                <button type="button" onClick={() => setShowPanel(false)} className="btn-ghost text-[15px]">{t("money.cancel" as any)}</button>
                <button type="submit" form="finance-form" className="btn-primary text-[15px]">{t("money.saveRecord" as any)}</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>, document.body)}
    </div>
  );
}
