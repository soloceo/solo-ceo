import { useState, useMemo, useCallback, useRef } from "react";
import { api } from "../../lib/api";
import { useUIStore } from "../../store/useUIStore";
import { useT } from "../../i18n/context";
import { calcTaxAmount, TX_STATUS } from "../../lib/tax";
import { todayDateKey } from "../../lib/date-utils";

export type { FinanceTransaction } from "../../lib/types/finance";
import type { FinanceTransaction } from "../../lib/types/finance";

const TX_CATEGORIES = ["收入", "软件支出", "外包支出", "其他支出"];
const TX_STATUSES = [TX_STATUS.COMPLETED, TX_STATUS.RECEIVABLE, TX_STATUS.PAYABLE];
export { TX_CATEGORIES, TX_STATUSES };

const createEmptyTx = () => ({
  date: todayDateKey(),
  desc: "",
  category: "收入",
  amount: "",
  status: TX_STATUS.COMPLETED as string,
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
  const editTxRef = useRef<FinanceTransaction | null>(null);
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
        // Rule 13: only send changed fields to avoid stale-data overwrites
        const orig = editTxRef.current;
        if (orig) {
          const patch: Record<string, unknown> = {};
          if (txData.date !== (orig.date || '')) patch.date = txData.date;
          if (txData.description !== (orig.description || orig.desc || '')) patch.description = txData.description;
          if (txData.category !== (orig.category || '')) patch.category = txData.category;
          if (txData.amount !== Math.abs(Number(orig.amount))) patch.amount = txData.amount;
          if (txData.type !== orig.type) patch.type = txData.type;
          if (txData.status !== (orig.status || '')) patch.status = txData.status;
          if (txData.tax_mode !== (orig.tax_mode || 'none')) patch.tax_mode = txData.tax_mode;
          if (txData.tax_rate !== (orig.tax_rate || 0)) patch.tax_rate = txData.tax_rate;
          if (txData.tax_amount !== (orig.tax_amount || 0)) patch.tax_amount = txData.tax_amount;
          if (String(txData.client_id || '') !== String(orig.client_id || '')) patch.client_id = txData.client_id;
          if ((txData.client_name || '') !== (orig.client_name || '')) patch.client_name = txData.client_name;
          if (Object.keys(patch).length > 0) await api.put(`/api/finance/${editTxId}`, patch);
        } else {
          await api.put(`/api/finance/${editTxId}`, txData);
        }
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
    editTxRef.current = tx;
    setTxForm({
      date: tx.date,
      desc: tx.description || tx.desc || "",
      category: tx.category,
      amount: String(Math.abs(tx.amount)),
      status: tx.status || TX_STATUS.COMPLETED,
      taxMode: tx.tax_mode || "none",
      taxRate: tx.tax_rate ? String(tx.tax_rate) : "",
    });
    setShowTxForm(true);
  }, []);

  const closeTxForm = useCallback(() => {
    setShowTxForm(false);
    setEditTxId(null);
    editTxRef.current = null;
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
    editTxRef.current = null;
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
