import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useT } from "../i18n/context";
import { useRealtimeRefresh } from "../hooks/useRealtimeRefresh";
import { motion, AnimatePresence } from "motion/react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  AlertCircle,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Edit2,
  X,
  Receipt,
  Check,
  Wallet,
  Landmark,
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
type Segment = "transactions" | "plans";

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

const calcTaxAmount = (amount: number, mode: string, rate: number): number => {
  if (mode === "none" || !rate) return 0;
  if (mode === "exclusive") return Math.round((amount * rate) / 100 * 100) / 100;
  if (mode === "inclusive") return Math.round((amount * rate) / (100 + rate) * 100) / 100;
  return 0;
};

/* ── Shared sub-components ─────────────────────────────────────── */
export function Toast({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 px-5 py-2.5 rounded-xl shadow-lg z-[9999] flex items-center gap-2 text-[13px] font-medium" style={{ background: "var(--text)", color: "var(--bg)" }}>
      <Check size={14} style={{ color: "var(--success)" }} /> {message}
    </div>
  );
}

function FL({ children }: { children: React.ReactNode }) {
  return <label className="section-label block mb-1">{children}</label>;
}

/* ═══════════════════════════════════════════════════════════════════
   Money — main component
   ═══════════════════════════════════════════════════════════════════ */
export default function Money() {
  const { t } = useT();
  const [segment, setSegment] = useState<Segment>("transactions");
  const [toast, setToast] = useState("");

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }, []);

  return (
    <div className="mobile-page max-w-[1680px] mx-auto min-h-full flex flex-col px-4 py-3 md:px-6 md:py-4 lg:px-8 lg:py-5 relative">
      <Toast message={toast} />

      {/* Header — title + segment toggle on same row */}
      <header className="flex items-center justify-between mb-4">
        <h1 className="page-title">{t("money.pageTitle" as any)}</h1>
        <div className="segment-switcher">
          {([["transactions", t("money.transactions" as any)], ["plans", t("money.plans" as any)]] as [string, string][]).map(([id, label]) => (
            <button key={id} onClick={() => setSegment(id as Segment)} data-active={segment === id || undefined}>
              {label}
            </button>
          ))}
        </div>
      </header>

      {segment === "transactions" ? (
        <TransactionsView showToast={showToast} />
      ) : (
        <PlansView showToast={showToast} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Transactions view
   ═══════════════════════════════════════════════════════════════════ */
export function TransactionsView({ showToast }: { showToast: (m: string) => void }) {
  const { t } = useT();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [editingTx, setEditingTx] = useState<any>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [formData, setFormData] = useState({
    date: "", desc: "", category: "收入", amount: "", status: "已完成",
    taxMode: "none" as "none" | "exclusive" | "inclusive", taxRate: "",
    client_id: "" as string | number, client_name: "",
  });
  const [clientList, setClientList] = useState<any[]>([]);

  const categories = ["收入", "软件支出", "外包支出", "应收", "应付", "其他支出"];
  const statuses = ["已完成", "待收款 (应收)", "待支付 (应付)"];

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const [pendingMilestones, setPendingMilestones] = useState<{ total: number; overdue: number; overdueAmt: number; pendingAmt: number }>({ total: 0, overdue: 0, overdueAmt: 0, pendingAmt: 0 });

  const fetchFinance = useCallback(async () => {
    try {
      const res = await fetch("/api/finance");
      setTransactions(await res.json());
    } catch { showToast(t("money.loadFail" as any)); }
    finally { setIsLoading(false); }
  }, [showToast, t]);

  const fetchMilestoneStats = useCallback(async () => {
    try {
      const clientsRes = await fetch("/api/clients");
      const clients = await clientsRes.json();
      const projectClients = clients.filter((c: any) => c.billing_type === "project");
      let total = 0, overdue = 0, overdueAmt = 0, pendingAmt = 0;
      for (const c of projectClients) {
        try {
          const msRes = await fetch(`/api/clients/${c.id}/milestones`);
          const milestones = await msRes.json();
          for (const ms of milestones) {
            if (ms.status !== "paid") {
              total++;
              pendingAmt += Number(ms.amount || 0);
              if (ms.status === "overdue") { overdue++; overdueAmt += Number(ms.amount || 0); }
            }
          }
        } catch {}
      }
      setPendingMilestones({ total, overdue, overdueAmt, pendingAmt });
    } catch {}
  }, []);

  useEffect(() => { fetchFinance(); fetchMilestoneStats(); }, [fetchFinance, fetchMilestoneStats]);
  useRealtimeRefresh(['finance_transactions', 'clients', 'payment_milestones'], () => { fetchFinance(); fetchMilestoneStats(); });

  useEffect(() => {
    const anyOpen = isMobile && (showPanel || showAll || showRules);
    window.dispatchEvent(new CustomEvent("mobile-nav-visibility", { detail: { hidden: anyOpen } }));
    return () => window.dispatchEvent(new CustomEvent("mobile-nav-visibility", { detail: { hidden: false } }));
  }, [showPanel, showAll, showRules, isMobile]);

  const openPanel = (tx: any = null) => {
    fetch("/api/clients").then(r => r.json()).then(setClientList).catch(() => {});
    if (tx) {
      setEditingTx(tx);
      setFormData({
        date: tx.date, desc: tx.description || tx.desc, category: tx.category,
        amount: String(tx.amount).replace(/[+$]/g, ""), status: tx.status || "已完成",
        taxMode: tx.tax_mode || "none", taxRate: tx.tax_rate ? String(tx.tax_rate) : "",
        client_id: tx.client_id || "", client_name: tx.client_name || "",
      });
    } else {
      setEditingTx(null);
      setFormData({ date: new Date().toISOString().split("T")[0], desc: "", category: "收入", amount: "", status: "已完成", taxMode: "none", taxRate: "", client_id: "", client_name: "" });
    }
    setShowPanel(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isIncome = formData.category === "收入" || formData.category === "应收";
    const amt = Math.abs(Number(formData.amount));
    const rate = Number(formData.taxRate) || 0;
    const taxAmount = calcTaxAmount(amt, formData.taxMode, rate);
    const txData = {
      date: formData.date, description: formData.desc, category: formData.category,
      amount: amt, type: isIncome ? "income" : "expense", status: formData.status,
      tax_mode: formData.taxMode, tax_rate: rate, tax_amount: taxAmount,
      client_id: formData.client_id || null, client_name: formData.client_name || null,
    };
    try {
      if (editingTx) {
        await fetch(`/api/finance/${editingTx.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(txData) });
        showToast(t("money.toast.updated" as any));
      } else {
        await fetch("/api/finance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(txData) });
        showToast(t("money.toast.added" as any));
      }
      setShowPanel(false);
      fetchFinance();
    } catch { showToast(t("money.saveFail" as any)); }
  };

  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const handleExportReport = async () => {
    try {
      const res = await fetch("/api/finance/report");
      const html = await res.text();
      setReportHtml(html);
    } catch { showToast(t("money.popupBlocked" as any)); }
  };

  /* ── Derived data ─── */
  const cashFlowMap = new Map<string, { month: string; income: number; expense: number }>();
  transactions.forEach((tx) => {
    if ((tx.status || "已完成") !== "已完成" || !tx.date) return;
    const d = new Date(tx.date);
    if (Number.isNaN(d.getTime())) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!cashFlowMap.has(key)) cashFlowMap.set(key, { month: `${d.getMonth() + 1}${t("money.monthSuffix" as any)}`, income: 0, expense: 0 });
    const row = cashFlowMap.get(key)!;
    const amt = Number(tx.amount || 0);
    if (tx.type === "income" || tx.category === "收入") row.income += amt; else row.expense += amt;
  });
  const cashFlowData = Array.from(cashFlowMap.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);

  const completedIncome = transactions.filter(tx => (tx.type === "income" || tx.category === "收入") && (tx.status || "已完成") === "已完成").reduce((s, tx) => s + Number(tx.amount || 0), 0);
  const completedExpense = transactions.filter(tx => (tx.type === "expense" || ["软件支出", "外包支出", "其他支出"].includes(tx.category)) && (tx.status || "已完成") === "已完成").reduce((s, tx) => s + Number(tx.amount || 0), 0);
  const receivables = transactions.filter(tx => (tx.status || "").includes("应收") || tx.category === "应收").reduce((s, tx) => s + Number(tx.amount || 0), 0);
  const payables = transactions.filter(tx => (tx.status || "").includes("应付") || tx.category === "应付").reduce((s, tx) => s + Number(tx.amount || 0), 0);
  const netProfit = completedIncome - completedExpense;
  const cy = new Date().getFullYear();
  const ytdDone = transactions.filter(tx => (tx.status || "已完成") === "已完成" && String(tx.date || "").startsWith(`${cy}-`));
  const ytdIncome = ytdDone.filter(tx => tx.type === "income" || tx.category === "收入").reduce((s, tx) => s + Number(tx.amount || 0), 0);
  const ytdExpense = ytdDone.filter(tx => tx.type === "expense" || ["软件支出", "外包支出", "其他支出"].includes(tx.category)).reduce((s, tx) => s + Number(tx.amount || 0), 0);
  const ytdProfit = ytdIncome - ytdExpense;
  const incomeCount = transactions.filter(tx => (tx.type === "income" || tx.category === "收入") && (tx.status || "已完成") === "已完成").length;
  const expenseCount = transactions.filter(tx => (tx.type === "expense" || ["软件支出", "外包支出", "其他支出"].includes(tx.category)) && (tx.status || "已完成") === "已完成").length;

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      {/* Action bar */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setShowRules(true)} className="btn-ghost text-[13px] gap-1.5"><AlertCircle size={14} /> {t("money.rules" as any)}</button>
        <button onClick={handleExportReport} className="btn-ghost text-[13px] gap-1.5"><FileText size={14} /> {t("money.export" as any)}</button>
        <div className="flex-1" />
        <button onClick={() => openPanel()} className="btn-primary text-[13px]"><Plus size={14} /> {t("money.newTransaction" as any)}</button>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard title={t("money.stat.completedRevenue" as any)} value={isLoading ? "—" : `$${completedIncome.toLocaleString()}`} sub={t("money.stat.count" as any).replace("{count}", String(incomeCount))} icon={<Wallet size={15} />} color="var(--success)" />
        <StatCard title={t("money.stat.completedExpense" as any)} value={isLoading ? "—" : `$${completedExpense.toLocaleString()}`} sub={t("money.stat.count" as any).replace("{count}", String(expenseCount))} icon={<ArrowDownRight size={15} />} color="var(--danger)" />
        <StatCard title={t("money.stat.netProfit" as any)} value={isLoading ? "—" : `$${netProfit.toLocaleString()}`} sub={netProfit >= 0 ? t("money.stat.realtime" as any) : t("money.lossWarning" as any)} icon={<Landmark size={15} />} color={netProfit >= 0 ? "var(--success)" : "var(--danger)"} />
        <StatCard title={t("money.stat.yearRevenue" as any)} value={isLoading ? "—" : `$${ytdIncome.toLocaleString()}`} sub={`${cy} ${t("money.stat.ytd" as any)}`} icon={<ArrowUpRight size={15} />} color="var(--success)" />
        <StatCard title={t("money.stat.yearProfit" as any)} value={isLoading ? "—" : `$${ytdProfit.toLocaleString()}`} sub={`${cy} ${t("money.stat.ytd" as any)}`} icon={<ArrowUpRight size={15} />} color={ytdProfit >= 0 ? "var(--success)" : "var(--danger)"} />
        {/* Receivables / payables */}
        <div className="stat-card">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0" style={{ background: "color-mix(in srgb, var(--warning) 12%, transparent)", color: "var(--warning)" }}><AlertCircle size={15} /></div>
          <div>
            <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{t("money.stat.receivable" as any)}</div>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold" style={{ color: "var(--warning)" }}>{t("money.stat.receivePrefix" as any)}{receivables.toLocaleString()}</span>
              <span className="text-[13px] font-semibold" style={{ color: "var(--danger)" }}>{t("money.stat.payPrefix" as any)}{payables.toLocaleString()}</span>
            </div>
          </div>
        </div>
        {/* Project milestones receivables */}
        {pendingMilestones.total > 0 && (
          <div className="stat-card">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0" style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)", color: "var(--accent)" }}><Clock size={15} /></div>
            <div>
              <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{t("money.stat.milestones" as any)}</div>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold tabular-nums" style={{ color: "var(--accent)" }}>${pendingMilestones.pendingAmt.toLocaleString()}</span>
                {pendingMilestones.overdue > 0 && (
                  <span className="text-[11px] font-medium" style={{ color: "var(--danger)" }}>{pendingMilestones.overdue} {t("pipeline.milestones.status.overdue" as any).toLowerCase()}</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Cash flow chart + recent transactions */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-4 flex-1 min-h-0">
        {/* Chart */}
        <div className="card p-5">
          <h3 className="text-[13px] font-semibold mb-0.5" style={{ color: "var(--text)" }}>{t("money.chart.title" as any)}</h3>
          <p className="text-[11px] mb-4" style={{ color: "var(--text-tertiary)" }}>{t("money.chart.subtitle" as any)}</p>
          <div className="h-[220px] md:h-[280px]">
            {isLoading ? (
              <div className="h-full flex items-center justify-center text-[13px]" style={{ color: "var(--text-tertiary)" }}>{t("money.loading" as any)}</div>
            ) : cashFlowData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[13px]" style={{ color: "var(--text-tertiary)" }}>{t("money.noData" as any)}</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cashFlowData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "var(--text-tertiary)", fontSize: 11 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--text-tertiary)", fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    cursor={{ fill: "var(--surface-alt)" }}
                    contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", boxShadow: "var(--shadow-md)", background: "var(--surface)", padding: 10, fontSize: 12 }}
                    labelStyle={{ color: "var(--text)", fontWeight: 600 }}
                  />
                  <Bar dataKey="income" name={t("money.chart.revenue" as any)} fill="var(--success)" radius={[3, 3, 0, 0]} maxBarSize={24} />
                  <Bar dataKey="expense" name={t("money.chart.expense" as any)} fill="var(--danger)" radius={[3, 3, 0, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Recent transactions — flat list */}
        <div className="card flex flex-col overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: "var(--border)" }}>
            <h3 className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>{t("money.recent.title" as any)}</h3>
          </div>
          <div className="flex-1 overflow-y-auto">
            {transactions.slice(0, 10).map((tx) => (
              <div
                key={tx.id}
                onClick={() => openPanel(tx)}
                className="list-item px-4 py-3 cursor-pointer"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium truncate" style={{ color: "var(--text)" }}>{tx.description || tx.desc}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>{tx.date}</span>
                      <span className="w-1 h-1 rounded-full" style={{ background: "var(--border-strong)" }} />
                      <span className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>{tx.category}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[13px] font-semibold" style={{ color: tx.type === "income" ? "var(--success)" : "var(--text)" }}>
                      {tx.type === "income" ? "+" : "-"}${Math.abs(tx.amount).toLocaleString()}
                    </div>
                    {Number(tx.tax_amount || 0) > 0 && (
                      <span className="text-[10px] font-medium" style={{ color: "var(--accent)" }}>
                        {tx.tax_mode === "inclusive" ? t("money.table.inclusiveTax" as any) : t("money.table.plusTax" as any)}¥{Number(tx.tax_amount).toLocaleString()}
                      </span>
                    )}
                    <div className="text-[10px] font-medium" style={{ color: (tx.status || "已完成") === "已完成" ? "var(--success)" : (tx.status || "").includes("应收") ? "var(--warning)" : "var(--danger)" }}>
                      {tx.status || t("money.form.status.completed" as any)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 py-2.5 text-center border-t" style={{ borderColor: "var(--border)" }}>
            <button onClick={() => setShowAll(true)} className="text-[12px] font-semibold" style={{ color: "var(--accent)" }}>
              {t("money.recent.viewAll" as any)}
            </button>
          </div>
        </div>
      </div>

      {/* ── Full transaction list modal ─── */}
      {showAll && createPortal(
        <div className="fixed inset-0 z-[70] flex flex-col" style={{ background: "var(--bg)" }}>
          <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "var(--border)", background: "var(--bg)", paddingTop: "var(--mobile-header-pt, max(env(safe-area-inset-top), 18px))" }}>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--accent-light)", color: "var(--accent)" }}><Receipt size={16} /></div>
              <div><h3 className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>{t("money.allTx.title" as any)}</h3><p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{t("money.allTx.desc" as any)}</p></div>
            </div>
            <button onClick={() => setShowAll(false)} className="p-1.5 rounded-lg" style={{ color: "var(--text-secondary)" }}><X size={18} /></button>
          </div>
          <div className="flex-1 overflow-auto ios-scroll pb-safe">
            {/* Mobile */}
            <div className="md:hidden divide-y" style={{ borderColor: "var(--border)" }}>
              {transactions.map((tx) => (
                <div key={tx.id} onClick={() => !tx.source && (setShowAll(false), openPanel(tx))} className={`p-4 flex items-center gap-3 ${tx.source ? "opacity-60" : "cursor-pointer"}`}>
                  <div className="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-bold" style={{ background: tx.type === "income" ? "var(--success-light)" : "var(--danger-light)", color: tx.type === "income" ? "var(--success)" : "var(--danger)" }}>
                    {tx.type === "income" ? "+" : "-"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium truncate" style={{ color: "var(--text)" }}>{tx.description || tx.desc}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>{tx.date}</span>
                      <span className="badge text-[10px]">{tx.category}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[13px] font-semibold" style={{ color: tx.type === "income" ? "var(--success)" : "var(--text)" }}>
                      {tx.type === "income" ? "+" : "-"}${Math.abs(tx.amount).toLocaleString()}
                    </div>
                    <span className="text-[10px] font-medium" style={{ color: (tx.status || "已完成") === "已完成" ? "var(--success)" : (tx.status || "").includes("应收") ? "var(--warning)" : "var(--danger)" }}>
                      {tx.status || t("money.form.status.completed" as any)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-[13px] border-collapse min-w-[640px]">
                <thead className="sticky top-0 z-10" style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
                  <tr>
                    {[t("money.table.date" as any), t("money.table.description" as any), t("money.table.category" as any), t("money.table.amount" as any), t("money.table.status" as any), t("money.table.action" as any)].map((h, i) => (
                      <th key={i} className={`section-label px-4 py-3 ${i === 5 ? "text-right" : ""}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="list-item transition-colors" style={{ borderBottom: "1px solid var(--border)" }}>
                      <td className="px-4 py-3 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{tx.date}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium" style={{ color: "var(--text)" }}>{tx.description || tx.desc}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {tx.source === "client_subscription" ? <span className="badge text-[10px]" style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)", color: "var(--accent)" }}>{t("money.badge.subscription" as any)}</span> : tx.source === "client_project" ? <span className="badge text-[10px]" style={{ background: "color-mix(in srgb, var(--warning) 12%, transparent)", color: "var(--warning)" }}>{t("money.badge.project" as any)}</span> : tx.client_name ? <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>{tx.client_name}</span> : <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>{t("money.table.manualRecord" as any)}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className="badge">{tx.category}</span></td>
                      <td className="px-4 py-3 font-semibold whitespace-nowrap" style={{ color: tx.type === "income" ? "var(--success)" : "var(--text)" }}>
                        {tx.type === "income" ? "+" : "-"}${Math.abs(tx.amount).toLocaleString()}
                        {Number(tx.tax_amount || 0) > 0 && <span className="ml-1 text-[10px] font-medium" style={{ color: "var(--accent)" }}>{tx.tax_mode === "inclusive" ? t("money.table.inclusiveTax" as any) : t("money.table.plusTax" as any)}¥{Number(tx.tax_amount).toLocaleString()}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="badge" style={{
                          background: (tx.status || "已完成") === "已完成" ? "var(--success-light)" : (tx.status || "").includes("应收") ? "var(--warning-light)" : "var(--danger-light)",
                          color: (tx.status || "已完成") === "已完成" ? "var(--success)" : (tx.status || "").includes("应收") ? "var(--warning)" : "var(--danger)",
                        }}>
                          {tx.status || t("money.form.status.completed" as any)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => openPanel(tx)} disabled={!!tx.source} className="p-1.5 rounded-lg transition-colors" style={{ color: tx.source ? "var(--text-tertiary)" : "var(--text-secondary)" }}>
                          <Edit2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Rules modal ─── */}
      {showRules && createPortal(
        <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: "var(--bg)" }}>
          <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "var(--border)", paddingTop: "var(--mobile-header-pt, max(env(safe-area-inset-top), 18px))" }}>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--accent-light)", color: "var(--accent)" }}><AlertCircle size={16} /></div>
              <div><h3 className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>{t("money.rules.title" as any)}</h3><p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{t("money.rules.desc" as any)}</p></div>
            </div>
            <button onClick={() => setShowRules(false)} className="p-1.5 rounded-lg" style={{ color: "var(--text-secondary)" }}><X size={18} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-5 text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            <RulesContent />
          </div>
          <div className="px-5 py-3 flex justify-end border-t" style={{ borderColor: "var(--border)" }}>
            <button onClick={() => setShowRules(false)} className="btn-primary text-[13px]">{t("money.rules.gotIt" as any)}</button>
          </div>
        </div>,
        document.body
      )}

      {/* ── Add/Edit transaction — side panel (desktop) / fullscreen (mobile) ─── */}
      <AnimatePresence>
        {showPanel && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50"
              style={{ background: isMobile ? "var(--bg)" : "rgba(0,0,0,0.2)" }}
              onClick={() => !isMobile && setShowPanel(false)}
            />
            {/* Panel */}
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
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b shrink-0" style={{ borderColor: "var(--border)", paddingTop: "var(--mobile-header-pt, max(env(safe-area-inset-top), 18px))" }}>
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--accent-light)", color: "var(--accent)" }}><Receipt size={16} /></div>
                  <div>
                    <h3 className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>{editingTx ? t("money.panel.edit" as any) : t("money.panel.new" as any)}</h3>
                    <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{t("money.panel.fullDesc" as any)}</p>
                  </div>
                </div>
                <button onClick={() => setShowPanel(false)} className="p-1.5 rounded-lg" style={{ color: "var(--text-secondary)" }}>
                  {isMobile ? <X size={18} /> : <PanelRightClose size={18} />}
                </button>
              </div>

              {/* Form */}
              <form id="tx-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 ios-scroll">
                <div className="grid grid-cols-2 gap-3">
                  <div><FL>{t("money.form.date" as any)}</FL><input type="date" required value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="input-base w-full px-3 py-2 text-[13px]" /></div>
                  <div><FL>{t("money.form.category" as any)}</FL><select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="input-base w-full px-3 py-2 text-[13px]">{categories.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
                </div>
                <div><FL>{t("money.form.description" as any)}</FL><input type="text" required value={formData.desc} onChange={(e) => setFormData({ ...formData, desc: e.target.value })} placeholder={t("money.form.descPlaceholder" as any)} className="input-base w-full px-3 py-2 text-[13px]" /></div>
                <div><FL>{t("money.form.client" as any)}</FL><select value={formData.client_id} onChange={(e) => { const cid = e.target.value; const c = clientList.find((x: any) => String(x.id) === cid); setFormData({ ...formData, client_id: cid ? Number(cid) : "", client_name: c ? (c.company_name || c.name) : "" }); }} className="input-base w-full px-3 py-2 text-[13px]"><option value="">{t("money.form.clientNone" as any)}</option>{clientList.map((c: any) => <option key={c.id} value={c.id}>{c.company_name || c.name}</option>)}</select></div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FL>{t("money.form.amount" as any)}</FL>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px]" style={{ color: "var(--text-tertiary)" }}>$</span>
                      <input type="number" required min="0" step="0.01" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} placeholder="1080" className="input-base w-full pl-7 pr-3 py-2 text-[13px]" />
                    </div>
                  </div>
                  <div><FL>{t("money.form.status" as any)}</FL><select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="input-base w-full px-3 py-2 text-[13px]">{statuses.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
                </div>
                {/* Tax */}
                <div>
                  <FL>{t("money.form.tax" as any)}</FL>
                  <div className="flex gap-2 mb-3">
                    {([["none", t("money.form.taxNone" as any)], ["exclusive", t("money.form.taxExclBtn" as any)], ["inclusive", t("money.form.taxIncl" as any)]] as [string, string][]).map(([mode, label]) => (
                      <button key={mode} type="button" onClick={() => setFormData({ ...formData, taxMode: mode as "none" | "exclusive" | "inclusive" })}
                        className="flex-1 py-2 rounded-lg text-[13px] font-medium transition-all"
                        style={formData.taxMode === mode ? { background: "var(--text)", color: "var(--bg)" } : { background: "var(--surface-alt)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                        {label}
                      </button>
                    ))}
                  </div>
                  {formData.taxMode !== "none" && (
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        {[13, 6, 3].map((r) => (
                          <button key={r} type="button" onClick={() => setFormData({ ...formData, taxRate: String(r) })}
                            className="px-3 py-1.5 rounded-md text-[11px] font-medium transition-all"
                            style={Number(formData.taxRate) === r ? { background: "var(--accent-light)", color: "var(--accent)", border: "1px solid var(--accent)" } : { background: "var(--surface-alt)", color: "var(--text-secondary)" }}>
                            {r}%
                          </button>
                        ))}
                        <input type="number" min="0" max="100" step="0.01" value={formData.taxRate} onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })} placeholder={t("money.form.customTaxPlaceholder" as any)} className="input-base flex-1 px-3 py-1.5 text-[11px] min-w-0" />
                      </div>
                      {formData.amount && Number(formData.taxRate) > 0 && (() => {
                        const amt = Math.abs(Number(formData.amount));
                        const rate = Number(formData.taxRate);
                        const tax = calcTaxAmount(amt, formData.taxMode, rate);
                        return (
                          <div className="rounded-lg px-3 py-2 text-[11px] font-medium" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
                            {formData.taxMode === "exclusive"
                              ? t("money.form.taxExclCalc" as any).replace("{amount}", amt.toLocaleString()).replace("{tax}", tax.toLocaleString()).replace("{rate}", String(rate)).replace("{total}", (amt + tax).toLocaleString())
                              : t("money.form.taxInclCalc" as any).replace("{amount}", amt.toLocaleString()).replace("{pretax}", (Math.round((amt - tax) * 100) / 100).toLocaleString()).replace("{tax}", tax.toLocaleString()).replace("{rate}", String(rate))}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </form>

              {/* Footer */}
              <div className="flex items-center justify-between px-5 py-3 border-t pb-safe shrink-0" style={{ borderColor: "var(--border)" }}>
                {editingTx ? (
                  <button type="button" onClick={async () => { try { await fetch(`/api/finance/${editingTx.id}`, { method: "DELETE" }); setShowPanel(false); showToast(t("money.toast.deleted" as any)); fetchFinance(); } catch { showToast(t("money.deleteFail" as any)); } }}
                    className="flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--danger)" }}>
                    <Trash2 size={13} /> {t("money.deleteBtn" as any)}
                  </button>
                ) : <div />}
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowPanel(false)} className="btn-ghost text-[13px]">{t("money.cancel" as any)}</button>
                  <button type="submit" form="tx-form" className="btn-primary text-[13px]">{t("money.saveRecord" as any)}</button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Report modal (in-app, no external browser) ── */}
      {reportHtml && createPortal(
        <div className="fixed inset-0 z-[9999] flex flex-col" style={{ background: "var(--bg)" }}>
          <div className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
            <span className="font-semibold text-[15px]" style={{ color: "var(--text)" }}>{t("money.export" as any)}</span>
            <button onClick={() => setReportHtml(null)} className="p-1.5 rounded-lg hover:bg-black/5"><X size={18} /></button>
          </div>
          <iframe
            srcDoc={reportHtml}
            className="flex-1 w-full border-0"
            sandbox="allow-same-origin"
            title="Finance Report"
          />
        </div>,
        document.body
      )}
    </div>
  );
}

/* ── Rules content ──────────────────────────────────────────────── */
function RulesContent() {
  const { t } = useT();
  const sections = [
    { title: t("money.rules.section1.title" as any), items: [t("money.rules.section1.item1" as any), t("money.rules.section1.item2" as any)] },
    { title: t("money.rules.section2.title" as any), items: [t("money.rules.section2.item1" as any), t("money.rules.section2.item2" as any), t("money.rules.section2.item3" as any), t("money.rules.section2.item4" as any), t("money.rules.section2.item5" as any)] },
    { title: t("money.rules.section3.title" as any), items: [t("money.rules.section3.item1" as any)] },
    { title: t("money.rules.section4.title" as any), items: [t("money.rules.section4.item1" as any), t("money.rules.section4.item2" as any), t("money.rules.section4.item3" as any), t("money.rules.section4.item4" as any)] },
    { title: t("money.rules.section5.title" as any), items: [t("money.rules.section5.item1" as any), t("money.rules.section5.item2" as any)] },
  ];
  return (
    <>
      {sections.map((s) => (
        <section key={s.title}>
          <h4 className="font-semibold mb-2" style={{ color: "var(--text)" }}>{s.title}</h4>
          <ul className="space-y-1.5 list-disc pl-4">{s.items.map((i, idx) => <li key={idx}>{i}</li>)}</ul>
        </section>
      ))}
    </>
  );
}

/* ── Stat card ──────────────────────────────────────────────────── */
function StatCard({ title, value, sub, icon, color }: { title: string; value: string; sub: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="stat-card">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0" style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}>{icon}</div>
      <div>
        <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{title}</div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg font-semibold" style={{ color: "var(--text)" }}>{value}</span>
          <span className="text-[10px] font-medium" style={{ color }}>{sub}</span>
        </div>
      </div>
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
  const [isMobile, setIsMobile] = useState(false);
  const [formData, setFormData] = useState({ name: "", price: "", deliverySpeed: "", features: "" });

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

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
        <button onClick={generateAI} className="btn-ghost text-[13px] gap-1.5"><Sparkles size={14} /> {t("money.plans.aiAnalysis" as any)}</button>
        <div className="flex-1" />
        <button onClick={() => openPanel()} className="btn-primary text-[13px]"><Plus size={14} /> {t("money.plans.new" as any)}</button>
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
              <button onClick={() => openPanel(plan)} className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors" style={{ background: "var(--surface-alt)", color: "var(--text-secondary)" }}><Edit2 size={13} /></button>
              <button onClick={() => setDeleteId(plan.id)} className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors" style={{ background: "var(--surface-alt)", color: "var(--text-secondary)" }}><Trash2 size={13} /></button>
            </div>

            <h3 className="text-[15px] font-semibold mb-1" style={{ color: "var(--text)" }}>{plan.name}</h3>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-2xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>${plan.price}</span>
              <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>{t("money.plans.perMonth" as any)}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 pb-3 mb-3 border-b" style={{ borderColor: "var(--border)" }}>
              <span className="badge gap-1"><Users size={11} style={{ color: "var(--accent)" }} />{t("money.plans.clients" as any).replace("{count}", String(Number(plan.clients || 0)))}</span>
              <span className="badge gap-1"><Clock size={11} style={{ color: "var(--warning)" }} />{plan.deliverySpeed}</span>
            </div>

            <button
              onClick={() => { navigator.clipboard.writeText(`${plan.name}｜$${plan.price}${t("money.plans.perMonth" as any)}｜${plan.deliverySpeed}｜${plan.features.join("、")}`); showToast(t("money.plans.copiedMsg" as any).replace("{name}", plan.name)); }}
              className="btn-ghost w-full mb-3 text-[12px]"
            >
              {t("money.plans.copySummary" as any)}
            </button>

            <p className="section-label mb-2">{t("money.plans.services" as any)}</p>
            <ul className="space-y-1.5 flex-1">
              {plan.features.map((f: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-[13px]" style={{ color: "var(--text-secondary)" }}>
                  <Check size={13} className="shrink-0 mt-0.5" style={{ color: "var(--accent)" }} />
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
              style={{ background: isMobile ? "var(--bg)" : "rgba(0,0,0,0.2)" }}
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
                  {isMobile ? <X size={18} /> : <PanelRightClose size={18} />}
                </button>
              </div>

              <form id="plan-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 ios-scroll">
                <div><FL>{t("money.plans.form.name" as any)}</FL><input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder={t("money.plans.form.namePlaceholder" as any)} className="input-base w-full px-3 py-2 text-[13px]" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FL>{t("money.plans.form.price" as any)}</FL>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px]" style={{ color: "var(--text-tertiary)" }}>$</span>
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
            <button onClick={() => setIsAIOpen(false)} className="p-1.5 rounded-lg" style={{ color: "var(--text-secondary)" }}><X size={18} /></button>
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
