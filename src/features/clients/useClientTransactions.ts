import { useState, useMemo, useCallback } from "react";
import { useUIStore } from "../../store/useUIStore";
import { useT } from "../../i18n/context";
import { calcTaxAmount } from "../../lib/tax";
import { todayDateKey } from "../../lib/date-utils";

interface FinanceTransaction {
  id: number;
  type: "income" | "expense";
  source?: string;
  source_id?: number;
  amount: number;
  category: string;
  description: string;
  desc?: string;
  date: string;
  status: string;
  client_id?: number;
  client_name?: string;
  tax_mode: "none" | "exclusive" | "inclusive";
  tax_rate: number;
  tax_amount: number;
  [key: string]: unknown;
}

export type { FinanceTransaction };

const TX_CATEGORIES = ["收入", "软件支出", "外包支出", "其他支出"];
const TX_STATUSES = ["已完成", "待收款 (应收)", "待支付 (应付)"];
export { TX_CATEGORIES, TX_STATUSES };

const createEmptyTx = () => ({
  date: todayDateKey(),
  desc: "",
  category: "收入",
  amount: "",
  status: "已完成",
  taxMode: "none" as "none" | "exclusive" | "inclusive",
  taxRate: "",
});

export type TxForm = ReturnType<typeof createEmptyTx>;

/**
 * Encapsulates all financial transaction state + CRUD logic for a client.
 */
export function useClientTransactions(clientId: number | null) {
  const { t } = useT();
  const showToast = useUIStore((s) => s.showToast);

  const [finTxs, setFinTxs] = useState<FinanceTransaction[]>([]);
  const [showTxForm, setShowTxForm] = useState(false);
  const [editTxId, setEditTxId] = useState<number | null>(null);
  const [deleteTxId, setDeleteTxId] = useState<number | null>(null);
  const [txForm, setTxForm] = useState(createEmptyTx);

  const clientTxs = useMemo(() =>
    clientId
      ? finTxs.filter(tx => tx.client_id === clientId).sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      : [],
    [finTxs, clientId],
  );

  const fetchFinance = useCallback(async () => {
    try {
      const res = await fetch("/api/finance");
      const d = await res.json();
      setFinTxs(Array.isArray(d) ? d : []);
    } catch {
      showToast(t("common.loadFailed" as any) || "Load failed");
    }
  }, [showToast, t]);

  const saveTx = useCallback(async (clientName: string) => {
    if (!clientId) return;
    const isIncome = txForm.category === "收入" || txForm.category === "应收";
    const amt = Math.abs(parseFloat(txForm.amount));
    if (isNaN(amt) || amt === 0) return;
    const rate = parseFloat(txForm.taxRate) || 0;
    const taxAmount = calcTaxAmount(amt, txForm.taxMode, rate);
    const txData = {
      date: txForm.date,
      description: txForm.desc,
      category: txForm.category,
      amount: amt,
      type: isIncome ? "income" : "expense",
      status: txForm.status,
      tax_mode: txForm.taxMode,
      tax_rate: rate,
      tax_amount: taxAmount,
      client_id: clientId,
      client_name: clientName,
    };
    try {
      if (editTxId) {
        await fetch(`/api/finance/${editTxId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(txData) });
      } else {
        await fetch("/api/finance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(txData) });
      }
      showToast(t("pipeline.tx.saved" as any));
      setShowTxForm(false);
      setEditTxId(null);
      setTxForm(createEmptyTx());
      fetchFinance();
    } catch {
      showToast(t("common.saveFailed" as any));
    }
  }, [clientId, txForm, editTxId, fetchFinance, showToast, t]);

  const deleteTx = useCallback(async (txId: number) => {
    try {
      await fetch(`/api/finance/${txId}`, { method: "DELETE" });
      showToast(t("pipeline.tx.deleted" as any));
      fetchFinance();
    } catch {
      showToast(t("common.deleteFailed" as any));
    }
  }, [fetchFinance, showToast, t]);

  const openNewTx = useCallback((defaults?: { taxMode?: string; taxRate?: string }) => {
    setShowTxForm(true);
    setEditTxId(null);
    setTxForm({
      ...createEmptyTx(),
      taxMode: (defaults?.taxMode || "none") as "none" | "exclusive" | "inclusive",
      taxRate: defaults?.taxRate || "",
    });
  }, []);

  const openEditTx = useCallback((tx: FinanceTransaction) => {
    setEditTxId(tx.id);
    setTxForm({
      date: tx.date,
      desc: tx.description || tx.desc || "",
      category: tx.category,
      amount: String(Math.abs(tx.amount)),
      status: tx.status || "已完成",
      taxMode: tx.tax_mode || "none",
      taxRate: tx.tax_rate ? String(tx.tax_rate) : "",
    });
    setShowTxForm(true);
  }, []);

  const closeTxForm = useCallback(() => {
    setShowTxForm(false);
    setEditTxId(null);
    setTxForm(createEmptyTx());
  }, []);

  const resetState = useCallback(() => {
    setShowTxForm(false);
    setEditTxId(null);
    setTxForm(createEmptyTx());
  }, []);

  return {
    // State
    finTxs, clientTxs, showTxForm, editTxId, deleteTxId, txForm,
    // Setters
    setDeleteTxId, setTxForm,
    // Actions
    fetchFinance, saveTx, deleteTx,
    openNewTx, openEditTx, closeTxForm, resetState,
  };
}
