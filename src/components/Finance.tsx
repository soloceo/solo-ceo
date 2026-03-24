import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useT } from "../i18n/context";
import { useRealtimeRefresh } from "../hooks/useRealtimeRefresh";
import SwipeAction from "./SwipeAction";
import { useIsMobile } from "../hooks/useIsMobile";
import { useToast } from "../hooks/useToast";
import { Toast } from "./Money";
import { motion, AnimatePresence } from "motion/react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  Plus,
  Edit2,
  X,
  Check,
  Trash2,
  Loader2,
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertCircle,
  PanelRightClose,
  Filter,
  Download,
  Search,
  Receipt,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  Lock,
  ChevronRight,
} from "lucide-react";

/* ── Helpers ────────────────────────────────────────────────────── */
const calcTaxAmount = (amount: number, mode: string, rate: number): number => {
  if (mode === "none" || !rate) return 0;
  if (mode === "exclusive") return Math.round((amount * rate) / 100 * 100) / 100;
  if (mode === "inclusive") return Math.round((amount * rate) / (100 + rate) * 100) / 100;
  return 0;
};

const CATEGORY_I18N: Record<string, string> = {
  "收入": "money.cat.income",
  "软件支出": "money.cat.software",
  "外包支出": "money.cat.outsource",
  "应收": "money.cat.receivable",
  "应付": "money.cat.payable",
  "其他支出": "money.cat.other",
  "项目收入": "money.category.projectIncome",
};

const STATUS_I18N: Record<string, string> = {
  "已完成": "money.st.completed",
  "待收款 (应收)": "money.st.receivable",
  "待支付 (应付)": "money.st.payable",
};

const catLabel = (cat: string, t: (k: any) => string) => {
  const key = CATEGORY_I18N[cat];
  return key ? t(key as any) : cat;
};

const stLabel = (st: string, t: (k: any) => string) => {
  const key = STATUS_I18N[st];
  return key ? t(key as any) : st;
};

function FL({ children }: { children: React.ReactNode }) {
  return <label className="section-label block mb-1">{children}</label>;
}

/* ── Virtual scrolled transaction list ── */
function VirtualTxList({ items, t, fmtAmt, fmtAmtColor, onEdit, onDelete }: {
  items: any[]; t: any; fmtAmt: any; fmtAmtColor: any;
  onEdit: (tx: any) => void; onDelete: (tx: any) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 10,
  });

  return (
    <div ref={parentRef} className="flex-1 overflow-y-auto ios-scroll">
      <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}>
        {rowVirtualizer.getVirtualItems().map(vRow => {
          const tx = items[vRow.index];
          const isSystem = tx.source && tx.source !== 'manual';
          return (
            <div key={tx.id} style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${vRow.start}px)` }}>
              <TxRow
                tx={tx} t={t} fmtAmt={fmtAmt} fmtAmtColor={fmtAmtColor}
                onEdit={() => onEdit(tx)} onDelete={() => onDelete(tx)}
                isSystem={isSystem} expanded
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Finance — 收支统计
   ═══════════════════════════════════════════════════════════════════ */
export default function Finance() {
  const { t } = useT();
  const [toast, showToast] = useToast();
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

  /* ── Filter state (consolidated to reduce re-renders) ── */
  const [filters, setFilters] = useState({
    type: "all", category: "all", status: "all", client: "all",
    dateFrom: "", dateTo: "", search: "",
  });
  const setFilter = useCallback(<K extends keyof typeof filters>(key: K, val: typeof filters[K]) => {
    setFilters(p => ({ ...p, [key]: val }));
  }, []);
  // Aliases for compatibility
  const filterType = filters.type, filterCategory = filters.category;
  const filterStatus = filters.status, filterClient = filters.client;
  const filterDateFrom = filters.dateFrom, filterDateTo = filters.dateTo;
  const filterSearch = filters.search;

  /* ── Form state ── */
  const emptyForm = {
    date: new Date().toISOString().slice(0, 10),
    desc: "",
    category: "收入",
    amount: "",
    status: "已完成",
    taxMode: "none" as "none" | "exclusive" | "inclusive",
    taxRate: "",
    client_id: "" as string | number,
    client_name: "",
  };
  const [formData, setFormData] = useState(emptyForm);

  const categories = ["收入", "软件支出", "外包支出", "应收", "应付", "其他支出"];
  const statuses = ["已完成", "待收款 (应收)", "待支付 (应付)"];

  /* ── Fetch ── */
  const fetchFinance = useCallback(async () => {
    try {
      const res = await fetch("/api/finance");
      setTransactions(await res.json());
    } catch { showToast(t("money.loadFail" as any)); }
    finally { setIsLoading(false); }
  }, [showToast, t]);

  const fetchClients = useCallback(async () => {
    try { setClientList(await (await fetch("/api/clients")).json()); } catch {}
  }, []);

  useEffect(() => { Promise.all([fetchFinance(), fetchClients()]); }, [fetchFinance, fetchClients]);
  useRealtimeRefresh(['finance_transactions', 'clients', 'payment_milestones'], fetchFinance);

  useEffect(() => {
    const anyOpen = isMobile && (showPanel || showAll);
    window.dispatchEvent(new CustomEvent("mobile-nav-visibility", { detail: { hidden: anyOpen } }));
    return () => window.dispatchEvent(new CustomEvent("mobile-nav-visibility", { detail: { hidden: false } }));
  }, [showPanel, showAll, isMobile]);

  /* ── Stats computation ── */
  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const thisYear = String(now.getFullYear());

    let totalIncome = 0, totalExpense = 0, receivable = 0, payable = 0;
    let monthIncome = 0, monthExpense = 0, totalTax = 0;

    for (const tx of transactions) {
      const amt = Math.abs(Number(tx.amount || 0));
      const tax = Math.abs(Number(tx.tax_amount || 0));
      const isIncome = tx.type === "income" || Number(tx.amount || 0) > 0;
      const txMode = tx.tax_mode || 'none';

      // Expense actual cost: exclusive adds tax, inclusive already contains tax
      const expenseTotal = txMode === 'exclusive' ? amt + tax : amt;

      // 应收/应付：exclusive 加税，inclusive 已含税
      if (tx.status === "待收款 (应收)") { receivable += (txMode === 'exclusive' ? amt + tax : amt); continue; }
      if (tx.status === "待支付 (应付)") { payable += expenseTotal; continue; }

      // 收入用税前额（税是代收）；支出用实际花费
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

    // Init last 12 months
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
      label: m.month.slice(5), // "01", "02"
    }));
  }, [transactions]);

  /* ── Filtered transactions for "View All" ── */
  const filteredTxs = useMemo(() => {
    return transactions
      .filter(tx => {
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
      setFormData({ ...emptyForm, date: new Date().toISOString().slice(0, 10) });
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
    try {
      await fetch(`/api/finance/${id}`, { method: "DELETE" });
      setDeleteId(null);
      showToast(t("money.toast.deleted" as any));
      fetchFinance();
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
    amt >= 0 ? "var(--success, #22c55e)" : "var(--danger, #ef4444)";

  /* ── Loading ── */
  if (isLoading) {
    return (
      <div className="mobile-page max-w-[960px] mx-auto min-h-full flex items-center justify-center">
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  return (
    <div className="mobile-page max-w-[960px] mx-auto min-h-full flex flex-col px-4 py-3 md:px-6 md:py-4 lg:px-8 lg:py-5 relative">
      <Toast message={toast} />

      {/* Header */}
      <header className="flex items-center justify-between mb-4">
        <h1 className="page-title">{t("finance.pageTitle" as any)}</h1>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="btn-ghost text-[13px] gap-1.5">
            <Download size={16} /> {t("money.export.csv" as any)}
          </button>
          <button onClick={() => openPanel()} className="btn-primary text-[13px]">
            <Plus size={16} /> {t("finance.addRecord" as any)}
          </button>
        </div>
      </header>

      {/* ── KPI Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard
          label={t("money.stat.completedRevenue" as any)}
          value={`$${stats.totalIncome.toLocaleString()}`}
          sub={`${t("finance.thisMonth" as any)} $${stats.monthIncome.toLocaleString()}`}
          icon={<TrendingUp size={16} />}
          color="var(--success, #22c55e)"
        />
        <StatCard
          label={t("money.stat.completedExpense" as any)}
          value={`$${stats.totalExpense.toLocaleString()}`}
          sub={`${t("finance.thisMonth" as any)} $${stats.monthExpense.toLocaleString()}`}
          icon={<TrendingDown size={16} />}
          color="var(--danger, #ef4444)"
        />
        <StatCard
          label={t("money.stat.netProfit" as any)}
          value={`$${stats.netProfit.toLocaleString()}`}
          sub={`${t("money.stat.margin" as any)} ${stats.margin}%`}
          icon={<Wallet size={16} />}
          color={stats.netProfit >= 0 ? "var(--success, #22c55e)" : "var(--danger, #ef4444)"}
        />
        <StatCard
          label={t("money.stat.receivable" as any)}
          value={`$${stats.receivable.toLocaleString()}`}
          sub={stats.payable > 0 ? `${t("money.st.payable" as any)} $${stats.payable.toLocaleString()}` : ""}
          icon={<AlertCircle size={16} />}
          color="var(--warning, #f59e0b)"
        />
        {stats.totalTax > 0 && (
          <StatCard
            label={t("finance.totalTax" as any)}
            value={`$${stats.totalTax.toLocaleString()}`}
            sub=""
            icon={<Receipt size={16} />}
            color="var(--text-secondary)"
          />
        )}
      </div>

      {/* ── Chart ── */}
      <div className="card p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>{t("money.chart.title" as any)}</h3>
            <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{t("money.chart.subtitle" as any)}</p>
          </div>
          <div className="flex items-center gap-3 text-[11px]" style={{ color: "var(--text-secondary)" }}>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: "var(--success, #22c55e)" }} />{t("money.chart.revenue" as any)}</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: "var(--danger, #ef4444)" }} />{t("money.chart.expense" as any)}</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--accent)" }} />{t("money.chart.net" as any)}</span>
          </div>
        </div>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: isMobile ? 0 : -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-secondary)" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--text-secondary)" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                formatter={(value: number, name: string) => [`$${value.toLocaleString()}`, name === "income" ? t("money.chart.revenue" as any) : name === "expense" ? t("money.chart.expense" as any) : t("money.chart.net" as any)]}
                labelFormatter={(label: string) => `${label}${t("money.monthSuffix" as any)}`}
              />
              <Bar dataKey="income" fill="var(--success, #22c55e)" radius={[3, 3, 0, 0]} opacity={0.8} />
              <Bar dataKey="expense" fill="var(--danger, #ef4444)" radius={[3, 3, 0, 0]} opacity={0.8} />
              <Line type="monotone" dataKey="net" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3, fill: "var(--accent)" }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Recent Transactions ── */}
      <div className="card p-4 flex-1 min-h-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>{t("money.recent.title" as any)}</h3>
          <button onClick={() => setShowAll(true)} className="btn-ghost text-[13px]">
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
              <Receipt size={32} style={{ color: "var(--text-secondary)" }} />
              <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>{t("money.noData" as any)}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Delete Confirmation ── */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
          <div className="card-elevated p-5 max-w-sm w-full">
            <h3 className="text-[15px] font-semibold mb-2" style={{ color: "var(--text)" }}>{t("money.delete.title" as any)}</h3>
            <p className="text-[13px] mb-4" style={{ color: "var(--text-secondary)" }}>{t("money.delete.message" as any)}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteId(null)} className="btn-ghost text-[13px]">{t("money.cancel" as any)}</button>
              <button onClick={() => deleteTx(deleteId)} className="text-[13px] font-medium px-4 py-2 rounded-lg text-white transition-colors" style={{ background: "var(--danger)" }}>{t("money.delete.confirm" as any)}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── View All Modal ── */}
      {showAll && createPortal(
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--bg)" }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b shrink-0" style={{ borderColor: "var(--border)", paddingTop: "var(--mobile-header-pt, max(env(safe-area-inset-top), 18px))" }}>
              <div>
                <h3 className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>{t("money.allTx.title" as any)}</h3>
                <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{t("money.filter.results" as any).replace("{count}", String(filteredTxs.length))}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={exportCSV} className="btn-ghost text-[13px] gap-1"><Download size={16} /></button>
                <button onClick={() => setShowAll(false)} className="p-1.5 rounded-lg" style={{ color: "var(--text-secondary)" }}><X size={20} /></button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
              <div className="relative flex-1 min-w-[140px] max-w-[240px]">
                <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-secondary)" }} />
                <input
                  type="text" value={filterSearch} onChange={e => setFilter("search", e.target.value)}
                  placeholder={t("finance.searchPlaceholder" as any)}
                  className="input-base w-full pl-8 pr-3 py-2 text-[13px]"
                />
              </div>
              <select value={filterType} onChange={e => setFilter("type", e.target.value)} className="input-base px-2 py-2 text-[13px]">
                <option value="all">{t("money.filter.typeAll" as any)}</option>
                <option value="income">{t("money.filter.income" as any)}</option>
                <option value="expense">{t("money.filter.expense" as any)}</option>
              </select>
              <select value={filterCategory} onChange={e => setFilter("category", e.target.value)} className="input-base px-2 py-2 text-[13px]">
                <option value="all">{t("money.filter.categoryAll" as any)}</option>
                {categories.map(c => <option key={c} value={c}>{catLabel(c, t)}</option>)}
              </select>
              <select value={filterStatus} onChange={e => setFilter("status", e.target.value)} className="input-base px-2 py-2 text-[13px]">
                <option value="all">{t("money.filter.statusAll" as any)}</option>
                {statuses.map(s => <option key={s} value={s}>{stLabel(s, t)}</option>)}
              </select>
              <select value={filterClient} onChange={e => setFilter("client", e.target.value)} className="input-base px-2 py-2 text-[13px]">
                <option value="all">{t("money.filter.clientAll" as any)}</option>
                {clientList.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
              </select>
              <input type="date" value={filterDateFrom} onChange={e => setFilter("dateFrom", e.target.value)} className="input-base px-2 py-2 text-[13px]" />
              <input type="date" value={filterDateTo} onChange={e => setFilter("dateTo", e.target.value)} className="input-base px-2 py-2 text-[13px]" />
              {(filterType !== "all" || filterCategory !== "all" || filterStatus !== "all" || filterClient !== "all" || filterDateFrom || filterDateTo || filterSearch) && (
                <button
                  onClick={() => setFilters({ type: "all", category: "all", status: "all", client: "all", dateFrom: "", dateTo: "", search: "" })}
                  className="btn-ghost text-[11px]"
                >{t("money.filter.clear" as any)}</button>
              )}
            </div>

            {/* Table — virtualized for 500+ rows */}
            <div className="hidden md:grid grid-cols-[100px_1fr_120px_120px_120px_80px] gap-2 px-5 py-2 text-[11px] font-medium shrink-0" style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>
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
              fmtAmt={fmtAmt}
              fmtAmtColor={fmtAmtColor}
              onEdit={(tx: any) => { if (!tx.source || tx.source === 'manual') openPanel(tx); }}
              onDelete={(tx: any) => { if (!tx.source || tx.source === 'manual') setDeleteId(tx.id); }}
            />
            {filteredTxs.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 gap-2">
                <Receipt size={32} style={{ color: "var(--text-secondary)" }} />
                <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>{t("money.noData" as any)}</p>
              </div>
            )}
          </div>,
          document.body
        )}

      {/* ── Add/Edit Panel ── */}
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
              {/* Panel header */}
              <div className="flex items-center justify-between px-5 py-3 border-b shrink-0" style={{ borderColor: "var(--border)", paddingTop: "var(--mobile-header-pt, max(env(safe-area-inset-top), 18px))" }}>
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
                    <Receipt size={16} />
                  </div>
                  <div>
                    <h3 className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>
                      {editingTx ? t("money.panel.edit" as any) : t("money.panel.new" as any)}
                    </h3>
                    <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                      {editingTx ? t("money.panel.editDesc" as any) : t("money.panel.newDesc" as any)}
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowPanel(false)} className="p-1.5 rounded-lg" style={{ color: "var(--text-secondary)" }}>
                  {isMobile ? <X size={20} /> : <PanelRightClose size={20} />}
                </button>
              </div>

              {/* Form */}
              <form id="finance-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto overflow-x-hidden p-5 space-y-4 ios-scroll">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <FL>{t("money.form.date" as any)}</FL>
                    <input type="date" required value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="input-base w-full px-3 py-2 text-[13px]" />
                  </div>
                  <div>
                    <FL>{t("money.form.category" as any)}</FL>
                    <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className="input-base w-full px-3 py-2 text-[13px]">
                      {categories.map(c => <option key={c} value={c}>{catLabel(c, t)}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <FL>{t("money.form.description" as any)}</FL>
                  <input type="text" value={formData.desc} onChange={e => setFormData({ ...formData, desc: e.target.value })} placeholder={t("money.form.descPlaceholder" as any)} className="input-base w-full px-3 py-2 text-[13px]" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FL>{t("money.form.amount" as any)}</FL>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px]" style={{ color: "var(--text-secondary)" }}>$</span>
                      <input type="number" required min="0" step="0.01" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} placeholder="0.00" className="input-base w-full pl-7 pr-3 py-2 text-[13px]" />
                    </div>
                  </div>
                  <div>
                    <FL>{t("money.form.status" as any)}</FL>
                    <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} className="input-base w-full px-3 py-2 text-[13px]">
                      {statuses.map(s => <option key={s} value={s}>{stLabel(s, t)}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <FL>{t("money.form.client" as any)}</FL>
                  <select value={formData.client_id} onChange={e => { const c = clientList.find(cl => String(cl.id) === e.target.value); setFormData({ ...formData, client_id: e.target.value, client_name: c?.name || "" }); }} className="input-base w-full px-3 py-2 text-[13px]">
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
                        className="flex-1 text-[13px] py-2 rounded-lg font-medium transition-all"
                        style={formData.taxMode === mode ? { background: "var(--accent)", color: "#fff" } : { background: "var(--surface-alt)", color: "var(--text-secondary)" }}
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
                          className="text-[13px] px-3 py-1 rounded-md transition-colors"
                          style={{
                            background: String(formData.taxRate) === String(r) ? "var(--accent-light)" : "var(--surface-alt)",
                            color: String(formData.taxRate) === String(r) ? "var(--accent)" : "var(--text-secondary)",
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
                        className="input-base flex-1 px-2 py-1 text-[13px]"
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
                    <div className="rounded-lg p-3 text-[11px] tabular-nums" style={{ background: "var(--surface-alt)", border: "1px solid var(--border)" }}>
                      <div className="flex justify-between"><span style={{ color: "var(--text-secondary)" }}>{formData.taxMode === "inclusive" ? t("pipeline.tx.baseAmount" as any) : t("pipeline.tx.amount" as any)}</span><span style={{ color: "var(--text)" }}>${base.toLocaleString()}</span></div>
                      <div className="flex justify-between"><span style={{ color: "var(--text-secondary)" }}>{t("finance.tax" as any)} ({rate}%)</span><span style={{ color: "var(--text)" }}>${tax.toLocaleString()}</span></div>
                      <div className="flex justify-between font-semibold border-t pt-1 mt-1" style={{ borderColor: "var(--border)" }}><span style={{ color: "var(--text)" }}>{t("pipeline.tx.total" as any)}</span><span style={{ color: "var(--success)" }}>${total.toLocaleString()}</span></div>
                    </div>
                  );
                })()}
              </form>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 px-5 py-3 border-t pb-safe shrink-0" style={{ borderColor: "var(--border)" }}>
                <button type="button" onClick={() => setShowPanel(false)} className="btn-ghost text-[13px]">{t("money.cancel" as any)}</button>
                <button type="submit" form="finance-form" className="btn-primary text-[13px]">{t("money.saveRecord" as any)}</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Stat Card ──────────────────────────────────────────────────── */
function StatCard({ label, value, sub, icon, color }: {
  label: string; value: string; sub: string; icon: React.ReactNode; color: string;
}) {
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>{label}</span>
        <span style={{ color }}>{icon}</span>
      </div>
      <div className="text-lg font-semibold tracking-tight" style={{ color: "var(--text)" }}>{value}</div>
      {sub && <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{sub}</div>}
    </div>
  );
}

/* ── Transaction Row ────────────────────────────────────────────── */
const TxRow = React.memo(function TxRow({ tx, t, fmtAmt, fmtAmtColor, onEdit, onDelete, isSystem, expanded }: {
  tx: any; t: (k: any) => string; fmtAmt: (n: number) => string; fmtAmtColor: (n: number) => string;
  onEdit: () => void; onDelete: () => void; isSystem: boolean; expanded?: boolean;
}) {
  const rawAmt = Number(tx.amount || 0);
  const tax = Math.abs(Number(tx.tax_amount || 0));
  const isIncome = tx.type === "income" || rawAmt > 0;
  const taxMode = tx.tax_mode || 'none';
  // Display logic:
  // - Income: always show pre-tax (amount), tax is collected for gov
  // - Expense exclusive: show amount + tax (total cash out)
  // - Expense inclusive: show amount as-is (tax already included)
  // - Expense none: show amount as-is
  const amt = isIncome ? rawAmt
    : taxMode === 'exclusive' ? (rawAmt < 0 ? rawAmt - tax : rawAmt + tax)
    : rawAmt;
  const src = tx.source || 'manual';
  const sourceBadge = src === "subscription"
    ? t("finance.source.subscription" as any)
    : src === "milestone"
    ? t("finance.source.milestone" as any)
    : src === "project_fee"
    ? t("finance.source.project" as any)
    : null;

  const actionBtns = isSystem ? (
    <span className="p-1 rounded" style={{ color: "var(--text-secondary)" }} title={t("finance.locked.hint" as any)}><Lock size={16} /></span>
  ) : (
    <>
      <button onClick={onEdit} className="p-1.5 rounded" style={{ color: "var(--text-secondary)" }} aria-label={t("common.edit" as any)}><Edit2 size={16} /></button>
      <button onClick={onDelete} className="p-1.5 rounded" style={{ color: "var(--text-secondary)" }} aria-label={t("common.delete" as any)}><Trash2 size={16} /></button>
    </>
  );

  if (expanded) {
    return (
      <>
        {/* Desktop */}
        <div className="hidden md:grid grid-cols-[100px_1fr_120px_120px_120px_80px] gap-2 px-5 py-3 items-center border-b group hover:bg-[var(--surface-alt)] transition-colors" style={{ borderColor: "var(--border)" }}>
          <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>{tx.date || "—"}</span>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[13px] truncate" style={{ color: "var(--text)" }}>{tx.description || tx.desc || tx.client_name || "—"}</span>
            {sourceBadge && <span className="badge text-[11px] shrink-0">{sourceBadge}</span>}
          </div>
          <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>{catLabel(tx.category || "", t)}</span>
          <div className="text-right">
            <span className="text-[13px] font-semibold tabular-nums" style={{ color: fmtAmtColor(amt) }}>{fmtAmt(amt)}</span>
            {tax > 0 && <div className="text-[11px] tabular-nums" style={{ color: "var(--text-secondary)" }}>{taxMode === "exclusive" ? `+${t("finance.tax" as any)} $${tax.toLocaleString()}` : taxMode === "inclusive" ? `${t("finance.taxIncluded" as any)} $${tax.toLocaleString()}` : ""}</div>}
          </div>
          <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{stLabel(tx.status || "", t)}</span>
          <div className="flex gap-1">{actionBtns}</div>
        </div>
        {/* Mobile — swipe left to delete */}
        <SwipeAction onDelete={onDelete} disabled={isSystem}>
          <div className="flex md:hidden items-center gap-3 px-4 py-3 border-b" style={{ borderColor: "var(--border)" }} onClick={isSystem ? undefined : onEdit}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: isIncome ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)" }}>
              {isIncome ? <ArrowUpRight size={16} style={{ color: "var(--success, #22c55e)" }} /> : <ArrowDownRight size={16} style={{ color: "var(--danger, #ef4444)" }} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-medium truncate" style={{ color: "var(--text)" }}>{tx.description || tx.desc || tx.client_name || catLabel(tx.category || "", t)}</span>
                {sourceBadge && <span className="badge text-[11px] shrink-0">{sourceBadge}</span>}
              </div>
              <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{tx.date || "—"} · {catLabel(tx.category || "", t)}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[13px] font-semibold tabular-nums" style={{ color: fmtAmtColor(amt) }}>{fmtAmt(amt)}</div>
              {tax > 0 && <div className="text-[11px] tabular-nums" style={{ color: "var(--text-secondary)" }}>{taxMode === "exclusive" ? `+${t("finance.tax" as any)} $${tax.toLocaleString()}` : taxMode === "inclusive" ? `${t("finance.taxIncluded" as any)} $${tax.toLocaleString()}` : ""}</div>}
              <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{stLabel(tx.status || "", t)}</div>
            </div>
            {isSystem ? <span className="p-1" style={{ color: "var(--text-secondary)" }}><Lock size={16} /></span> : <span className="p-1" style={{ color: "var(--text-secondary)", opacity: 0.4 }}><ChevronRight size={16} /></span>}
          </div>
        </SwipeAction>
      </>
    );
  }

  return (
    <div className="flex items-center gap-3 px-1 py-3 border-b group" style={{ borderColor: "var(--border)" }}>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: isIncome ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)" }}>
        {isIncome ? <ArrowUpRight size={16} style={{ color: "var(--success, #22c55e)" }} /> : <ArrowDownRight size={16} style={{ color: "var(--danger, #ef4444)" }} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-medium truncate" style={{ color: "var(--text)" }}>{tx.description || tx.desc || tx.client_name || catLabel(tx.category || "", t)}</span>
          {sourceBadge && <span className="badge text-[11px] shrink-0">{sourceBadge}</span>}
        </div>
        <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
          {tx.date || "—"} · {catLabel(tx.category || "", t)}
          {tx.client_name ? ` · ${tx.client_name}` : ""}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-[13px] font-semibold tabular-nums" style={{ color: fmtAmtColor(amt) }}>{fmtAmt(amt)}</div>
        <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{stLabel(tx.status || "", t)}</div>
      </div>
      <div className="flex gap-1 shrink-0">{actionBtns}</div>
    </div>
  );
});
