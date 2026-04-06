import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { createPortal } from "react-dom";
import { useT } from "../../i18n/context";
import { usePullToRefresh } from "../../hooks/usePullToRefresh";
import { useRealtimeRefresh } from "../../hooks/useRealtimeRefresh";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useUIStore } from "../../store/useUIStore";
import { Skeleton } from "../../components/ui";
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
  Bot,
  Loader2,
  Building2,
  User as UserIcon,
  Send,
} from "lucide-react";

import { api } from "../../lib/api";
import { calcTaxAmount, catLabel, STATUS_I18N } from "../../lib/tax";
import { todayDateKey } from "../../lib/date-utils";
import { parseExpense, getAIConfig, type AIProvider } from "../../lib/ai-client";
import { useAppSettings } from "../../hooks/useAppSettings";
const FinanceChart = React.lazy(() => import("./FinanceChart"));
import { StatCard, TxRow, VirtualTxList } from "./TransactionList";

/* ── Type definitions ── */
interface FinanceTransaction {
  id: number;
  type: "income" | "expense";
  source?: string;
  source_id?: number;
  amount: number;
  category: string;
  description: string;
  date: string;
  status: string;
  client_id?: number | null;
  client_name?: string;
  tax_mode: "none" | "exclusive" | "inclusive";
  tax_rate: number;
  tax_amount: number;
  [key: string]: unknown;
}

interface ClientItem {
  id: number;
  name: string;
  company_name?: string;
  [key: string]: unknown;
}

/* ── Helpers ── */
const stLabel = (st: string, t: (k: string) => string) => {
  const key = STATUS_I18N[st];
  return key ? t(key) : st;
};

function FL({ children }: { children: React.ReactNode }) {
  return <label className="section-label block mb-1">{children}</label>;
}

const FINANCE_TABLES = ["finance_transactions", "clients", "payment_milestones"] as const;
const BIZ_CATEGORIES = [
  // Chinese
  "收入", "软件支出", "硬件支出", "外包支出", "营销推广", "办公费用", "差旅费", "其他支出", "订阅收入", "项目收入", "咨询收入",
  // English
  "Income", "Software", "Hardware", "Outsourcing", "Marketing", "Office", "Travel", "Other Expense",
];
const PERSONAL_CATEGORIES_LIST = [
  // Chinese
  "餐饮", "交通", "房租", "购物", "娱乐", "医疗", "学习", "个人其他",
  // English
  "Food", "Transport", "Rent", "Shopping", "Entertainment", "Health", "Education", "Other",
];
const TX_CATEGORIES = [...BIZ_CATEGORIES, ...PERSONAL_CATEGORIES_LIST];
const PERSONAL_CATEGORIES = new Set(PERSONAL_CATEGORIES_LIST);
const TX_STATUSES = ["已完成", "待收款 (应收)", "待支付 (应付)"];
// Categories that are treated as income (for amount sign and type determination)
const INCOME_CATEGORIES = ["收入", "应收", "项目收入", "订阅收入", "咨询收入", "Income"];

const createEmptyForm = () => ({
  date: todayDateKey(),
  desc: "",
  category: BIZ_CATEGORIES[0], // "收入"
  amount: "",
  status: TX_STATUSES[0], // "已完成"
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

  const { settings: appSettings } = useAppSettings();

  /* ── Data state ── */
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [clientList, setClientList] = useState<ClientItem[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiParsing, setAiParsing] = useState(false);
  const [savingTx, setSavingTx] = useState(false);

  /* ── UI state ── */
  const [financeTab, setFinanceTab] = useState<"business" | "personal">("business");
  const [showPanel, setShowPanel] = useState(false);
  const [editingTx, setEditingTx] = useState<FinanceTransaction | null>(null);
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
    type: "all", category: "all", status: "all",
    dateFrom: "", dateTo: "", search: "",
  });
  const setFilter = useCallback(<K extends keyof typeof filters>(key: K, val: typeof filters[K]) => {
    setFilters(p => ({ ...p, [key]: val }));
  }, []);
  const filterType = filters.type, filterCategory = filters.category;
  const filterStatus = filters.status;
  const filterDateFrom = filters.dateFrom, filterDateTo = filters.dateTo;
  const filterSearch = filters.search;

  /* ── Form state ── */
  const [formData, setFormData] = useState(createEmptyForm);

  const categories = TX_CATEGORIES;
  const statuses = TX_STATUSES;

  /* ── Fetch ── */
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;
  const tRef = useRef(t);
  tRef.current = t;

  const fetchFinance = useCallback(async () => {
    try {
      const data = await api.get<FinanceTransaction[]>("/api/finance");
      setTransactions(Array.isArray(data) ? data : []);
    } catch { showToastRef.current(tRef.current("money.loadFail")); }
    finally { setIsLoading(false); }
  }, []);

  const fetchClients = useCallback(async () => {
    try { const d = await api.get<{ id: number; name: string }[]>("/api/clients"); setClientList(Array.isArray(d) ? d : []); } catch { /* client list unavailable */ }
  }, []);

  useEffect(() => { void Promise.all([fetchFinance(), fetchClients()]); }, [fetchFinance, fetchClients]);
  useRealtimeRefresh(FINANCE_TABLES, fetchFinance);

  const pullRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  usePullToRefresh(pullRef, fetchFinance);

  useEffect(() => {
    const anyOpen = isMobile && (showPanel || showAll);
    window.dispatchEvent(new CustomEvent("mobile-nav-visibility", { detail: { hidden: anyOpen } }));
    return () => window.dispatchEvent(new CustomEvent("mobile-nav-visibility", { detail: { hidden: false } }));
  }, [showPanel, showAll, isMobile]);

  /* ── Quick Create listener ── */
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.type === "transaction" || detail?.type === "biz-transaction") { openPanel(); }
    };
    window.addEventListener("quick-create", handler);
    return () => window.removeEventListener("quick-create", handler);
  }, []);

  /* ── Tab-filtered transactions ── */
  const tabTxs = useMemo(() => {
    return transactions.filter(tx => {
      const isPersonal = PERSONAL_CATEGORIES.has(tx.category || "");
      return financeTab === "personal" ? isPersonal : !isPersonal;
    });
  }, [transactions, financeTab]);

  /* ── Stats computation ── */
  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    let totalIncome = 0, totalExpense = 0, receivable = 0, payable = 0;
    let monthIncome = 0, monthExpense = 0, totalTax = 0;

    for (const tx of tabTxs) {
      const amt = Math.abs(Number(tx.amount || 0));
      const tax = Math.abs(Number(tx.tax_amount || 0));
      const isIncome = tx.type === "income";
      const txMode = tx.tax_mode || 'none';

      const expenseTotal = txMode === 'exclusive' ? amt + tax : amt;

      if (tx.status === "待收款 (应收)") { receivable += (txMode === 'exclusive' ? amt + tax : amt); continue; }
      if (tx.status === "待支付 (应付)") { payable += expenseTotal; continue; }

      // Income: exclusive tax means client pays base + tax, so total received = amt + tax
      const incomeTotal = txMode === 'exclusive' ? amt + tax : amt;
      if (isIncome) { totalIncome += incomeTotal; totalTax += tax; }
      else { totalExpense += expenseTotal; }

      if ((tx.date || "").startsWith(thisMonth)) {
        if (isIncome) monthIncome += incomeTotal;
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
  }, [tabTxs]);

  /* ── Personal stats ── */
  const personalStats = useMemo(() => {
    if (financeTab !== "personal") return { monthTotal: 0, dailyAvg: 0 };
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    let monthTotal = 0;
    for (const tx of tabTxs) {
      if ((tx.date || "").startsWith(thisMonth)) monthTotal += Math.abs(Number(tx.amount || 0));
    }
    const dayOfMonth = now.getDate();
    return { monthTotal, dailyAvg: dayOfMonth > 0 ? monthTotal / dayOfMonth : 0 };
  }, [tabTxs, financeTab]);

  /* ── Chart data ── */
  const chartData = useMemo(() => {
    const months: Record<string, { month: string; income: number; expense: number; net: number }> = {};
    const now = new Date();
    const nowYear = now.getFullYear();
    const nowMonth = now.getMonth();

    for (let i = 11; i >= 0; i--) {
      const d = new Date(nowYear, nowMonth - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months[key] = { month: key, income: 0, expense: 0, net: 0 };
    }

    for (const tx of tabTxs) {
      if (!tx.date) continue;
      const m = tx.date.slice(0, 7);
      if (!months[m]) continue;
      if (tx.status === "待收款 (应收)" || tx.status === "待支付 (应付)") continue;
      const amt = Math.abs(Number(tx.amount || 0));
      const tax = Math.abs(Number(tx.tax_amount || 0));
      const isIncome = tx.type === "income";
      const txMode = tx.tax_mode || 'none';
      const total = txMode === 'exclusive' ? amt + tax : amt;
      if (isIncome) months[m].income += total;
      else months[m].expense += total;
    }

    return Object.values(months).map(m => ({
      ...m,
      net: m.income - m.expense,
      label: m.month.slice(5),
    }));
  }, [tabTxs]);

  /* ── Filtered transactions for "View All" ── */
  const filteredTxs = useMemo(() => {
    return tabTxs
      .filter(tx => {
        if (filterType !== "all") {
          const isIncome = tx.type === "income";
          if (filterType === "income" && !isIncome) return false;
          if (filterType === "expense" && isIncome) return false;
        }
        if (filterCategory !== "all" && tx.category !== filterCategory) return false;
        if (filterStatus !== "all" && tx.status !== filterStatus) return false;
        if (filterDateFrom && (tx.date || "") < filterDateFrom) return false;
        if (filterDateTo && (tx.date || "") > filterDateTo) return false;
        if (filterSearch) {
          const s = filterSearch.toLowerCase();
          const desc = (tx.description || tx.desc || "").toLowerCase();
          const cat = (tx.category || "").toLowerCase();
          if (!desc.includes(s) && !cat.includes(s)) return false;
        }
        return true;
      })
      .sort((a: FinanceTransaction, b: FinanceTransaction) => (b.date || "").localeCompare(a.date || ""));
  }, [tabTxs, filters]);

  /* ── Recent transactions (top 8) ── */
  const recentTxs = useMemo(() =>
    [...tabTxs].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 8),
  [tabTxs]);

  /* ── Panel open/close ── */
  const openPanel = async (tx: FinanceTransaction | null = null) => {
    if (tx) {
      setEditingTx(tx);
      setFormData({
        date: tx.date || "",
        desc: tx.description || tx.desc || "",
        category: tx.category || BIZ_CATEGORIES[0], // fallback to "收入"
        amount: String(Math.abs(Number(tx.amount || 0))),
        status: tx.status || TX_STATUSES[0], // fallback to "已完成"
        taxMode: tx.tax_mode || "none",
        taxRate: tx.tax_rate ? String(tx.tax_rate) : "",
        client_id: tx.client_id || "",
        client_name: tx.client_name || "",
      });
    } else {
      setEditingTx(null);
      const form = createEmptyForm();
      if (financeTab === "personal") {
        form.category = PERSONAL_CATEGORIES_LIST[0]; // "餐饮"
        form.status = TX_STATUSES[0]; // "已完成"
        form.taxMode = "none";
      }
      setFormData(form);
    }
    setShowPanel(true);
  };

  /* ── Save ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingTx) return;
    const amt = parseFloat(formData.amount);
    if (isNaN(amt) || amt === 0) return;
    setSavingTx(true);

    const isIncome = INCOME_CATEGORIES.includes(formData.category);
    const rate = parseFloat(formData.taxRate) || 0;
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
        await api.put(`/api/finance/${editingTx.id}`, txData);
        showToast(t("money.toast.updated"));
      } else {
        await api.post("/api/finance", txData);
        showToast(t("money.toast.added"));
      }
      setShowPanel(false);
      fetchFinance();
    } catch (e) {
      console.warn('[FinancePage] saveTx', e);
      showToast(t("money.saveFail"));
    } finally {
      setSavingTx(false);
    }
  };

  /* ── AI record ── */
  const handleAiRecord = async () => {
    const text = aiInput.trim();
    if (!text) return;
    const aiConfig = getAIConfig(appSettings);
    if (!aiConfig) {
      showToast(t("money.ai.noKey"), 5000, {
        label: t("common.goSettings"),
        fn: () => setActiveTab("settings"),
      });
      return;
    }
    const { provider, apiKey } = aiConfig;

    setAiParsing(true);
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('AI parsing timeout')), 15000)
      );
      const parsed = await Promise.race([parseExpense(text, financeTab, lang, provider, apiKey), timeoutPromise]);
      const isIncome = financeTab === "business" && (parsed.category === "收入" || parsed.category === "Income");
      await api.post("/api/finance", {
        date: parsed.date,
        description: parsed.description,
        category: parsed.category,
        amount: isIncome ? parsed.amount : -parsed.amount,
        type: isIncome ? "income" : "expense",
        status: "已完成",
        tax_mode: "none",
        tax_rate: 0,
        tax_amount: 0,
      });
      showToast(`✓ ${t("money.ai.recorded").replace("{desc}", parsed.description).replace("{amount}", `$${parsed.amount}`)}`);
      setAiInput("");
      fetchFinance();
    } catch (e) {
      console.warn('[FinancePage] handleAiRecord', e);
      showToast(t("money.ai.error"));
    } finally {
      setAiParsing(false);
    }
  };

  /* ── Delete ── */
  const deleteTx = async (id: number) => {
    // Cache for undo
    const cached = transactions.find(tx => tx.id === id);
    try {
      await api.del(`/api/finance/${id}`);
      setDeleteId(null);
      fetchFinance();
      showToast(t("money.toast.deleted"), 5000, cached ? {
        label: t("common.undo"),
        fn: async () => {
          try {
            const isIncome = cached.type === "income";
            await api.post("/api/finance", {
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
            });
            fetchFinance();
          } catch (e) { console.warn('[FinancePage] undoDelete', e); }
        },
      } : undefined);
    } catch (e) { console.warn('[FinancePage] deleteTx', e); showToast(t("money.deleteFail")); }
  };

  /* ── Export CSV ── */
  const exportCSV = () => {
    const data = filteredTxs.length > 0 ? filteredTxs : transactions;
    const header = [t("money.table.date"), t("money.table.description"), t("money.table.category"), t("money.table.amount"), t("finance.tax"), t("money.table.status"), t("money.filter.client")].join(",");
    const safeCsv = (val: string) => {
      let v = val.replace(/"/g, '""');
      if (/^[=+\-@\t\r]/.test(v)) v = "\t" + v;
      return `"${v}"`;
    };
    const rows = data.map(tx =>
      [tx.date, safeCsv(tx.description || tx.desc || ""), tx.category, tx.amount, tx.tax_amount || 0, tx.status, safeCsv(tx.client_name || "")].join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finance-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(t("money.export.csvDone"));
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
      <div className="mobile-page max-w-[1680px] mx-auto min-h-full p-4 md:p-6 lg:p-8">
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
    <div ref={pullRef} className="mobile-page max-w-[1680px] mx-auto min-h-full flex flex-col p-4 md:p-6 lg:p-8 relative">
      <h1 className="sr-only">{t("nav.finance")}</h1>

      {/* ── Tabs + Actions row ── */}
      <div className="flex items-center gap-2 mb-2">
        <div className="page-tabs">
          {(["business", "personal"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => { setFinanceTab(tab); setFilters({ type: "all", category: "all", status: "all", dateFrom: "", dateTo: "", search: "" }); }}
              data-active={financeTab === tab}
            >
              {tab === "business" ? <Building2 size={13} /> : <UserIcon size={13} />}
              {tab === "business" ? t("money.tab.business") : t("money.tab.personal")}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button onClick={exportCSV} className="btn-ghost compact">
          <Download size={16} /> <span className="hidden sm:inline">{t("money.export.csv")}</span>
        </button>
        <button onClick={() => openPanel()} className="btn-primary compact">
          <Plus size={16} /> <span className="hidden sm:inline">{t("finance.addRecord")}</span><span className="sm:hidden">{t("money.addShort")}</span>
        </button>
      </div>

      {/* ── Tab Content ── */}
      {financeTab === "business" && (
        <div className="flex flex-col">
          {/* AI Chat Input */}
          <div className="flex items-center gap-2 mb-3">
            <div className="relative flex-1">
              <Bot size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-text-quaternary)" }} />
              <input
                type="text"
                value={financeTab === "business" ? aiInput : ""}
                onChange={e => setAiInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) handleAiRecord(); }}
                placeholder={t("money.tab.bizPlaceholder")}
                disabled={aiParsing || financeTab !== "business"}
                className="input-base w-full pl-9 pr-3 py-2.5 text-[15px]"
              />
            </div>
            <button onClick={handleAiRecord} disabled={!aiInput.trim() || aiParsing || financeTab !== "business"} className="btn-primary compact text-[14px] shrink-0 disabled:opacity-40">
              {aiParsing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>

          {/* KPI Stat Cards — Business */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <StatCard
              label={t("money.stat.completedRevenue")}
              value={`$${stats.totalIncome.toLocaleString()}`}
              sub={`${t("finance.thisMonth")} $${stats.monthIncome.toLocaleString()}${stats.totalTax > 0 ? ` · ${t("finance.inclTax")}` : ""}`}
              icon={<TrendingUp size={16} />}
              color="var(--color-success)"
            />
            <StatCard
              label={t("money.stat.completedExpense")}
              value={`$${stats.totalExpense.toLocaleString()}`}
              sub={`${t("finance.thisMonth")} $${stats.monthExpense.toLocaleString()}`}
              icon={<TrendingDown size={16} />}
              color="var(--color-danger)"
            />
            <StatCard
              label={t("money.stat.netProfit")}
              value={stats.netProfit < 0 ? `-$${Math.abs(stats.netProfit).toLocaleString()}` : `$${stats.netProfit.toLocaleString()}`}
              sub={`${t("money.stat.margin")} ${stats.margin}%`}
              icon={<Wallet size={16} />}
              color={stats.netProfit >= 0 ? "var(--color-success)" : "var(--color-danger)"}
            />
            <StatCard
              label={t("money.stat.receivable")}
              value={`$${stats.receivable.toLocaleString()}`}
              sub={stats.payable > 0 ? `${t("money.st.payable")} $${stats.payable.toLocaleString()}` : ""}
              icon={<AlertCircle size={16} />}
              color="var(--color-warning)"
            />
            {stats.totalTax > 0 && (
              <StatCard
                label={t("finance.totalTax")}
                value={`$${stats.totalTax.toLocaleString()}`}
                sub=""
                icon={<Receipt size={16} />}
                color="var(--color-text-secondary)"
              />
            )}
          </div>

          <React.Suspense fallback={<div className="card p-4 mb-4 h-[200px] skeleton-bone rounded-[var(--radius-12)]" />}>
            <FinanceChart chartData={chartData} isMobile={isMobile} t={t} />
          </React.Suspense>

          <div className="card p-4 flex-1 min-h-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{t("money.recent.title")}</h3>
              <button onClick={() => setShowAll(true)} className="btn-ghost compact">
                {t("money.recent.viewAll")} ({tabTxs.length})
              </button>
            </div>
            <div className="space-y-0">
              {recentTxs.map(tx => {
                const isSystem = tx.source && tx.source !== 'manual';
                return (
                  <TxRow key={tx.id} tx={tx} t={t} fmtAmt={fmtAmt} fmtAmtColor={fmtAmtColor}
                    onEdit={() => { if (!isSystem) openPanel(tx); }}
                    onDelete={() => { if (!isSystem) setDeleteId(tx.id); }}
                    isSystem={isSystem}
                  />
                );
              })}
              {recentTxs.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <Receipt size={32} style={{ color: "var(--color-text-secondary)" }} />
                  <p className="text-[15px]" style={{ color: "var(--color-text-secondary)" }}>{t("money.noData")}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {financeTab === "personal" && (
        <div className="flex flex-col">
          {/* AI Chat Input */}
          <div className="flex items-center gap-2 mb-3">
            <div className="relative flex-1">
              <Bot size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-info)" }} />
              <input
                type="text"
                value={financeTab === "personal" ? aiInput : ""}
                onChange={e => setAiInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) handleAiRecord(); }}
                placeholder={t("money.tab.personalPlaceholder")}
                disabled={aiParsing || financeTab !== "personal"}
                className="input-base w-full pl-9 pr-3 py-2.5 text-[15px]"
              />
            </div>
            <button onClick={handleAiRecord} disabled={!aiInput.trim() || aiParsing || financeTab !== "personal"} className="btn-primary compact text-[14px] shrink-0 disabled:opacity-40">
              {aiParsing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>

          {/* KPI Stat Cards — Personal */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <StatCard
              label={t("money.stat.monthExpense")}
              value={`$${personalStats.monthTotal.toLocaleString()}`}
              sub=""
              icon={<TrendingDown size={16} />}
              color="var(--color-danger)"
            />
            <StatCard
              label={t("money.stat.dailyAvg")}
              value={`$${Math.round(personalStats.dailyAvg).toLocaleString()}`}
              sub=""
              icon={<Wallet size={16} />}
              color="var(--color-text-secondary)"
            />
          </div>

          <React.Suspense fallback={<div className="card p-4 mb-4 h-[200px] skeleton-bone rounded-[var(--radius-12)]" />}>
            <FinanceChart chartData={chartData} isMobile={isMobile} t={t} />
          </React.Suspense>

          <div className="card p-4 flex-1 min-h-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{t("money.recent.title")}</h3>
              <button onClick={() => setShowAll(true)} className="btn-ghost compact">
                {t("money.recent.viewAll")} ({tabTxs.length})
              </button>
            </div>
            <div className="space-y-0">
              {recentTxs.map(tx => {
                const isSystem = tx.source && tx.source !== 'manual';
                return (
                  <TxRow key={tx.id} tx={tx} t={t} fmtAmt={fmtAmt} fmtAmtColor={fmtAmtColor}
                    onEdit={() => { if (!isSystem) openPanel(tx); }}
                    onDelete={() => { if (!isSystem) setDeleteId(tx.id); }}
                    isSystem={isSystem}
                  />
                );
              })}
              {recentTxs.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <Receipt size={32} style={{ color: "var(--color-text-secondary)" }} />
                  <p className="text-[15px]" style={{ color: "var(--color-text-secondary)" }}>{t("money.noData")}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation ── */}
      {deleteId !== null && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4 animate-fade-in" style={{ zIndex: "var(--layer-confirm)", background: "var(--color-overlay-primary)", paddingBottom: "16px" }}>
          <div className="card-elevated p-5 max-w-sm w-full" role="dialog" aria-modal="true" aria-label="Confirm delete">
            <h3 className="text-[15px] mb-2" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{t("money.delete.title")}</h3>
            <p className="text-[15px] mb-4" style={{ color: "var(--color-text-secondary)" }}>{t("money.delete.message")}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteId(null)} className="btn-ghost text-[15px]">{t("money.cancel")}</button>
              <button onClick={() => deleteTx(deleteId)} className="text-[15px] px-4 py-2 rounded-[var(--radius-6)] transition-colors" style={{ background: "var(--color-danger)", color: "var(--color-text-on-color)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{t("money.delete.confirm")}</button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ── View All Modal ── */}
      {showAll && createPortal(
        <div className="fixed inset-0 flex flex-col page-enter" role="dialog" aria-modal="true" aria-label="All transactions" style={{ zIndex: "var(--layer-dialog)", background: "var(--color-bg-primary)", paddingBottom: "8px" }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b shrink-0" style={{ borderColor: "var(--color-border-primary)", paddingTop: "max(12px, var(--mobile-header-pt, env(safe-area-inset-top, 0px)))" }}>
              <div>
                <h3 className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{t("money.allTx.title")}</h3>
                <p className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>{t("money.filter.results").replace("{count}", String(filteredTxs.length))}</p>
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
                  type="text" defaultValue={filterSearch} onChange={e => { const v = e.target.value; if (searchTimerRef.current) clearTimeout(searchTimerRef.current); searchTimerRef.current = setTimeout(() => setFilter("search", v), 300); }}
                  placeholder={t("finance.searchPlaceholder")}
                  className="input-base compact w-full pl-8 pr-3 text-[15px]"
                />
              </div>
              {financeTab === "business" && (
                <select value={filterType} onChange={e => setFilter("type", e.target.value)} className="input-base compact px-2 text-[15px] shrink-0">
                  <option value="all">{t("money.filter.typeAll")}</option>
                  <option value="income">{t("money.filter.income")}</option>
                  <option value="expense">{t("money.filter.expense")}</option>
                </select>
              )}
              <select value={filterCategory} onChange={e => setFilter("category", e.target.value)} className="input-base compact px-2 text-[15px] shrink-0">
                <option value="all">{t("money.filter.categoryAll")}</option>
                {(financeTab === "business" ? BIZ_CATEGORIES : PERSONAL_CATEGORIES_LIST).map(c => <option key={c} value={c}>{catLabel(c, t)}</option>)}
              </select>
              {financeTab === "business" && (
                <select value={filterStatus} onChange={e => setFilter("status", e.target.value)} className="input-base compact px-2 text-[15px] shrink-0">
                  <option value="all">{t("money.filter.statusAll")}</option>
                  {statuses.map(s => <option key={s} value={s}>{stLabel(s, t)}</option>)}
                </select>
              )}
              <input type="date" value={filterDateFrom} onChange={e => setFilter("dateFrom", e.target.value)} className="input-base compact px-2 text-[15px] shrink-0" />
              <input type="date" value={filterDateTo} onChange={e => setFilter("dateTo", e.target.value)} className="input-base compact px-2 text-[15px] shrink-0" />
              {(filterType !== "all" || filterCategory !== "all" || filterStatus !== "all" || filterDateFrom || filterDateTo || filterSearch) && (
                <button
                  onClick={() => setFilters({ type: "all", category: "all", status: "all", dateFrom: "", dateTo: "", search: "" })}
                  className="btn-ghost compact text-[13px]"
                >{t("money.filter.clear")}</button>
              )}
            </div>

            {/* Table — virtualized for 500+ rows */}
            <div className="hidden md:grid grid-cols-[100px_1fr_120px_120px_120px_80px] gap-2 px-5 py-2 text-[13px] shrink-0" style={{ color: "var(--color-text-secondary)", borderBottom: "1px solid var(--color-border-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
              <span>{t("money.table.date")}</span>
              <span>{t("money.table.description")}</span>
              <span>{t("money.table.category")}</span>
              <span className="text-right">{t("money.table.amount")}</span>
              <span>{t("money.table.status")}</span>
              <span></span>
            </div>
            <VirtualTxList
              items={filteredTxs}
              t={t}
              lang={lang}
              fmtAmt={fmtAmt}
              fmtAmtColor={fmtAmtColor}
              onEdit={(tx: FinanceTransaction) => { if (!tx.source || tx.source === 'manual') openPanel(tx); }}
              onDelete={(tx: FinanceTransaction) => { if (!tx.source || tx.source === 'manual') setDeleteId(tx.id); }}
              onClientClick={() => setActiveTab("clients")}
            />
            {filteredTxs.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 gap-2">
                <Receipt size={32} style={{ color: "var(--color-text-secondary)" }} />
                <p className="text-[15px]" style={{ color: "var(--color-text-secondary)" }}>{t("money.noData")}</p>
              </div>
            )}
          </div>,
          document.body
        )}

      {/* ── Add/Edit Panel ── */}
      {createPortal(<AnimatePresence>
        {showPanel && (
          <motion.div key="finance-panel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div
              className="fixed inset-0"
              style={{ zIndex: "var(--layer-dialog-overlay)", background: isMobile ? "var(--color-bg-primary)" : "var(--color-overlay-primary)", ...(!isMobile ? { backdropFilter: "blur(2px) saturate(180%)", WebkitBackdropFilter: "blur(2px) saturate(180%)" } : {}) }}
              onClick={() => !isMobile && setShowPanel(false)}
            />
            <motion.div
              initial={{ x: isMobile ? 0 : "100%", y: isMobile ? "100%" : 0 }}
              animate={{ x: 0, y: 0 }}
              exit={{ x: isMobile ? 0 : "100%", y: isMobile ? "100%" : 0 }}
              transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
              role="dialog"
              aria-modal="true"
              aria-label="Transaction form"
              className={isMobile
                ? "fixed inset-0 flex flex-col"
                : "fixed top-0 right-0 h-full w-full max-w-[440px] lg:max-w-[520px] border-l flex flex-col"
              }
              style={{ zIndex: "var(--layer-dialog)", background: "var(--color-bg-primary)", borderColor: "var(--color-border-primary)" }}
            >
              {/* Panel header */}
              <div className="flex items-center justify-between px-5 py-3 border-b shrink-0" style={{ borderColor: "var(--color-border-primary)", paddingTop: "max(12px, var(--mobile-header-pt, env(safe-area-inset-top, 0px)))" }}>
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-6)]" style={{ background: "var(--color-accent-tint)", color: "var(--color-accent)" }}>
                    <Receipt size={16} />
                  </div>
                  <div>
                    <h3 className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>
                      {editingTx ? t("money.panel.edit") : t("money.panel.new")}
                    </h3>
                    <p className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
                      {editingTx ? t("money.panel.editDesc") : t("money.panel.newDesc")}
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowPanel(false)} className="btn-icon" aria-label="Close panel">
                  {isMobile ? <X size={18} /> : <PanelRightClose size={18} />}
                </button>
              </div>

              {/* Form */}
              <form id="finance-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto overflow-x-hidden p-5 space-y-3 ios-scroll">
                {/* Scope toggle — only for new records */}
                {!editingTx && (
                  <div className="page-tabs" style={{ marginBottom: 4 }}>
                    {(["business", "personal"] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => {
                          setFinanceTab(tab);
                          setFormData(prev => ({
                            ...prev,
                            category: tab === "personal" ? PERSONAL_CATEGORIES_LIST[0] : BIZ_CATEGORIES[0],
                            taxMode: tab === "personal" ? "none" : prev.taxMode,
                            taxRate: tab === "personal" ? "" : prev.taxRate,
                            client_id: tab === "personal" ? "" : prev.client_id,
                            client_name: tab === "personal" ? "" : prev.client_name,
                          }));
                        }}
                        data-active={financeTab === tab}
                      >
                        {tab === "business" ? <Building2 size={13} /> : <UserIcon size={13} />}
                        {tab === "business" ? t("money.tab.business") : t("money.tab.personal")}
                      </button>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <FL>{t("money.form.date")}</FL>
                    <input type="date" required value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="input-base w-full px-3 py-2 text-[15px]" />
                  </div>
                  <div>
                    <FL>{t("money.form.category")}</FL>
                    <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className="input-base w-full px-3 py-2 text-[15px]">
                      {(financeTab === "business" ? BIZ_CATEGORIES : PERSONAL_CATEGORIES_LIST).map(c => <option key={c} value={c}>{catLabel(c, t)}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <FL>{t("money.form.description")}</FL>
                  <input type="text" value={formData.desc} onChange={e => setFormData({ ...formData, desc: e.target.value })} placeholder={t("money.form.descPlaceholder")} className="input-base w-full px-3 py-2 text-[15px]" />
                </div>

                <div className={financeTab === "business" ? "grid grid-cols-1 sm:grid-cols-2 gap-3" : ""}>
                  <div>
                    <FL>{t("money.form.amount")}</FL>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[15px]" style={{ color: "var(--color-text-secondary)" }}>$</span>
                      <input type="number" required min="0" step="0.01" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} placeholder="0.00" className="input-base w-full pl-7 pr-3 py-2 text-[15px]" />
                    </div>
                  </div>
                  {financeTab === "business" && (
                    <div>
                      <FL>{t("money.form.status")}</FL>
                      <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} className="input-base w-full px-3 py-2 text-[15px]">
                        {statuses.map(s => <option key={s} value={s}>{stLabel(s, t)}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                {/* Tax — business only */}
                {financeTab === "business" && <><div>
                  <FL>{t("money.form.tax")}</FL>
                  <div className="flex gap-2 mb-2">
                    {(["none", "exclusive", "inclusive"] as const).map(mode => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setFormData({ ...formData, taxMode: mode })}
                        className="flex-1 text-[15px] py-2 rounded-full transition-all"
                        style={formData.taxMode === mode ? { background: "var(--color-accent)", color: "var(--color-brand-text)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties : { background: "var(--color-bg-tertiary)", color: "var(--color-text-secondary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}
                      >
                        {mode === "none" ? t("money.form.taxNone") : mode === "exclusive" ? t("money.form.taxExcl") : t("money.form.taxIncl")}
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
                        placeholder={t("money.form.customTaxPlaceholder")}
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
                      <div className="flex justify-between"><span style={{ color: "var(--color-text-secondary)" }}>{formData.taxMode === "inclusive" ? t("pipeline.tx.baseAmount") : t("pipeline.tx.amount")}</span><span style={{ color: "var(--color-text-primary)" }}>${base.toLocaleString()}</span></div>
                      <div className="flex justify-between"><span style={{ color: "var(--color-text-secondary)" }}>{t("finance.tax")} ({rate}%)</span><span style={{ color: "var(--color-text-primary)" }}>${tax.toLocaleString()}</span></div>
                      <div className="flex justify-between border-t pt-1 mt-1" style={{ borderColor: "var(--color-border-primary)", color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}><span>{t("pipeline.tx.total")}</span><span style={{ color: "var(--color-success)" }}>${total.toLocaleString()}</span></div>
                    </div>
                  );
                })()}</>}
              </form>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 px-5 py-3 border-t pb-safe shrink-0" style={{ borderColor: "var(--color-border-primary)" }}>
                <button type="button" onClick={() => setShowPanel(false)} className="btn-ghost text-[15px]">{t("money.cancel")}</button>
                <button type="submit" form="finance-form" disabled={savingTx} className="btn-primary text-[15px]">{savingTx ? t("common.loading") : t("money.saveRecord")}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>, document.body)}
    </div>
  );
}
