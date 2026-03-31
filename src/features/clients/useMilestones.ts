import { useState, useCallback } from "react";
import { useUIStore } from "../../store/useUIStore";
import { useT } from "../../i18n/context";

interface MilestoneRow {
  id: number;
  client_id: number;
  label: string;
  amount: number;
  percentage?: number;
  due_date?: string | null;
  note?: string;
  status: string;
  payment_method?: string;
  paid_date?: string;
  [key: string]: unknown;
}

const EMPTY_MS = { label: "", amount: "", percentage: "", due_date: "", note: "", alreadyPaid: false, payMethod: "bank_transfer" };

export type MsForm = typeof EMPTY_MS;

export type { MilestoneRow };

const PAYMENT_METHODS = ["bank_transfer", "wechat", "alipay", "cash", "paypal", "stripe", "other"] as const;
export { PAYMENT_METHODS };

/**
 * Encapsulates all milestone state + CRUD logic for a client.
 * The component only needs to render — no API logic in JSX.
 */
export function useMilestones(clientId: number | null, projectFee: number) {
  const { t } = useT();
  const showToast = useUIStore((s) => s.showToast);

  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [msLoading, setMsLoading] = useState(false);
  const [showAddMs, setShowAddMs] = useState(false);
  const [editMsId, setEditMsId] = useState<number | null>(null);
  const [markPaidId, setMarkPaidId] = useState<number | null>(null);
  const [deleteMsId, setDeleteMsId] = useState<number | null>(null);
  const [markPaidMethod, setMarkPaidMethod] = useState("bank_transfer");
  const [msForm, setMsForm] = useState(EMPTY_MS);
  const [savingMs, setSavingMs] = useState(false);

  const fetchMilestones = useCallback(async (cid: number) => {
    setMsLoading(true);
    try {
      const res = await fetch(`/api/clients/${cid}/milestones`);
      setMilestones(await res.json());
    } catch (e) {
      console.warn('[useMilestones] fetchMilestones', e);
      setMilestones([]);
    } finally {
      setMsLoading(false);
    }
  }, []);

  const saveMilestone = useCallback(async (onDone?: () => void) => {
    if (!clientId || savingMs) return;
    setSavingMs(true);
    const msAmt = parseFloat(msForm.amount);
    const msPct = parseFloat(msForm.percentage);
    const body = {
      label: msForm.label,
      amount: isNaN(msAmt) ? 0 : msAmt,
      percentage: isNaN(msPct) ? 0 : msPct,
      due_date: msForm.due_date || null,
      note: msForm.note,
    };
    try {
      let newMsId = editMsId;
      if (editMsId) {
        await fetch(`/api/milestones/${editMsId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      } else {
        const res = await fetch(`/api/clients/${clientId}/milestones`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const data = await res.json();
        newMsId = data?.id || null;
      }
      if (msForm.alreadyPaid && newMsId) {
        await fetch(`/api/milestones/${newMsId}/mark-paid`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payment_method: msForm.payMethod }) });
        showToast(t("pipeline.milestones.autoFinance"));
      } else {
        showToast(t("pipeline.milestones.saved"));
      }
      setShowAddMs(false);
      setEditMsId(null);
      setMsForm(EMPTY_MS);
      fetchMilestones(clientId);
      onDone?.();
    } catch (e) {
      console.warn('[useMilestones] saveMilestone', e);
      showToast(t("common.saveFailed"));
    } finally {
      setSavingMs(false);
    }
  }, [clientId, savingMs, msForm, editMsId, fetchMilestones, showToast, t]);

  const deleteMilestone = useCallback(async (msId: number) => {
    try {
      await fetch(`/api/milestones/${msId}`, { method: "DELETE" });
      showToast(t("pipeline.milestones.deleted"));
      if (clientId) fetchMilestones(clientId);
    } catch (e) {
      console.warn('[useMilestones] deleteMilestone', e);
      showToast(t("common.deleteFailed"));
    }
  }, [clientId, fetchMilestones, showToast, t]);

  const undoMarkPaid = useCallback(async (msId: number, onDone?: () => void) => {
    try {
      await fetch(`/api/milestones/${msId}/undo-paid`, { method: "POST" });
      showToast(t("pipeline.milestones.undone"));
      if (clientId) {
        fetchMilestones(clientId);
        onDone?.();
      }
    } catch (e) {
      console.warn('[useMilestones] undoMarkPaid', e);
      showToast(t("common.saveFailed"));
    }
  }, [clientId, fetchMilestones, showToast, t]);

  const confirmMarkPaid = useCallback(async () => {
    if (!markPaidId) return;
    try {
      await fetch(`/api/milestones/${markPaidId}/mark-paid`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payment_method: markPaidMethod }) });
      showToast(t("pipeline.milestones.autoFinance"));
      setMarkPaidId(null);
      setMarkPaidMethod("bank_transfer");
      if (clientId) fetchMilestones(clientId);
    } catch (e) {
      console.warn('[useMilestones] confirmMarkPaid', e);
      showToast(t("common.saveFailed"));
    }
  }, [clientId, markPaidId, markPaidMethod, fetchMilestones, showToast, t]);

  const applyPreset = useCallback((preset: "deposit" | "midway" | "final") => {
    const fee = projectFee || 0;
    const pctMap = { deposit: 30, midway: 40, final: 30 };
    const pct = pctMap[preset];
    setMsForm(p => ({
      ...p,
      label: t(`pipeline.milestones.presets.${preset}`),
      percentage: String(pct),
      amount: String(Math.round(fee * pct / 100)),
    }));
  }, [projectFee, t]);

  const resetState = useCallback(() => {
    setMilestones([]);
    setShowAddMs(false);
    setEditMsId(null);
    setMarkPaidId(null);
    setMsForm(EMPTY_MS);
  }, []);

  const openAddForm = useCallback(() => {
    setShowAddMs(true);
    setEditMsId(null);
    setMsForm(EMPTY_MS);
  }, []);

  const openEditForm = useCallback((ms: MilestoneRow) => {
    setEditMsId(ms.id);
    setMsForm({
      label: ms.label,
      amount: String(ms.amount),
      percentage: String(ms.percentage || ""),
      due_date: ms.due_date || "",
      note: ms.note || "",
      alreadyPaid: false,
      payMethod: "bank_transfer",
    });
    setShowAddMs(true);
  }, []);

  const closeForm = useCallback(() => {
    setShowAddMs(false);
    setEditMsId(null);
    setMsForm(EMPTY_MS);
  }, []);

  return {
    // State
    milestones, msLoading, showAddMs, editMsId, markPaidId, deleteMsId,
    markPaidMethod, msForm, savingMs,
    // Setters (for UI binding)
    setMarkPaidId, setDeleteMsId, setMarkPaidMethod, setMsForm,
    // Actions
    fetchMilestones, saveMilestone, deleteMilestone, undoMarkPaid,
    confirmMarkPaid, applyPreset, resetState,
    openAddForm, openEditForm, closeForm,
  };
}
