import { useState, useMemo, useCallback } from "react";
import { api } from "../../lib/api";
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
      const d = await api.get<FinanceTransaction[]>("/api/finance");
      setFinTxs(Array.isArray(d) ? d : []);
    } catch (e) {
      console.warn('[useClientTransactions] fetchFinance', e);
      showToast(t("common.loadFailed") || "Load failed");
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
        await api.put(`/api/finance/${editTxId}`, txData);
      } else {
        await api.post("/api/finance", txData);
      }
      showToast(t("pipeline.tx.saved"));
      setShowTxForm(false);
      setEditTxId(null);
      setTxForm(createEmptyTx());
      fetchFinance();
    } catch (e) {
      console.warn('[useClientTransactions] saveTx', e);
      showToast(t("common.saveFailed"));
    }
  }, [clientId, txForm, editTxId, fetchFinance, showToast, t]);

  const deleteTx = useCallback(async (txId: number) => {
    try {
      await api.del(`/api/finance/${txId}`);
      showToast(t("pipeline.tx.deleted"));
      fetchFinance();
    } catch (e) {
      console.warn('[useClientTransactions] deleteTx', e);
      showToast(t("common.deleteFailed"));
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

  /** Mark a pending subscription transaction as received (已完成) */
  const confirmReceipt = useCallback(async (txId: number) => {
    try {
      await api.post(`/api/finance/${txId}/confirm-receipt`);
      showToast(t("pipeline.tx.confirmSuccess"));
      fetchFinance();
    } catch (e) {
      console.warn('[useClientTransactions] confirmReceipt', e);
      showToast(t("common.saveFailed"));
    }
  }, [fetchFinance, showToast, t]);

  /** Undo a confirmed subscription receipt back to pending */
  const undoReceipt = useCallback(async (txId: number) => {
    try {
      await api.post(`/api/finance/${txId}/undo-receipt`);
      showToast(t("pipeline.tx.undoReceiptSuccess"));
      fetchFinance();
    } catch (e) {
      console.warn('[useClientTransactions] undoReceipt', e);
      showToast(t("common.saveFailed"));
    }
  }, [fetchFinance, showToast, t]);

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
    fetchFinance, saveTx, deleteTx, confirmReceipt, undoReceipt,
    openNewTx, openEditTx, closeTxForm, resetState,
  };
}
