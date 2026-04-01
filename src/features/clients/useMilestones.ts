import { useState, useCallback } from "react";
import { api } from "../../lib/api";
import { useUIStore } from "../../store/useUIStore";
import { useT } from "../../i18n/context";

interface MilestoneRow {
  id: number;
  client_id: number;
  project_id?: number | null;
  label: string;
  amount: number;
  percentage?: number;
  due_date?: string | null;
  note?: string;
  status: string;
  payment_method?: string;
  paid_date?: string;
  finance_tx_id?: number | null;
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
export function useMilestones(clientId: number | null, projectFee: number, projectId?: number | null) {
  const { t } = useT();
  const showToast = useUIStore((s) => s.showToast);

  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [msLoading, setMsLoading] = useState(false);
  const [showAddMs, setShowAddMs] = useState(false);
  const [editMsId, setEditMsId] = useState<number | null>(null);
  const [markPaidId, setMarkPaidId] = useState<number | null>(null);
  const [deleteMsId, setDeleteMsId] = useState<number | null>(null);
  const [markPaidMethod, setMarkPaidMethod] = useState("bank_transfer");
  const [markPaidDate, setMarkPaidDate] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });
  const [editPaidId, setEditPaidId] = useState<number | null>(null);
  const [editPaidDate, setEditPaidDate] = useState("");
  const [editPaidMethod, setEditPaidMethod] = useState("");
  const [editPaidAmount, setEditPaidAmount] = useState("");
  const [msForm, setMsForm] = useState(EMPTY_MS);
  const [savingMs, setSavingMs] = useState(false);

  const fetchMilestones = useCallback(async (cid: number) => {
    setMsLoading(true);
    try {
      const data = await api.get<MilestoneRow[]>(`/api/clients/${cid}/milestones`);
      setMilestones(Array.isArray(data) ? data : []);
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
    const body: Record<string, unknown> = {
      label: msForm.label,
      amount: isNaN(msAmt) ? 0 : msAmt,
      percentage: isNaN(msPct) ? 0 : msPct,
      due_date: msForm.due_date || null,
      note: msForm.note,
    };
    if (projectId) body.project_id = projectId;
    try {
      let newMsId = editMsId;
      if (editMsId) {
        await api.put(`/api/milestones/${editMsId}`, body);
      } else {
        const data = await api.post<{ id: number }>(`/api/clients/${clientId}/milestones`, body);
        newMsId = data?.id || null;
      }
      if (msForm.alreadyPaid && newMsId) {
        await api.post(`/api/milestones/${newMsId}/mark-paid`, { payment_method: msForm.payMethod });
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
  }, [clientId, projectId, savingMs, msForm, editMsId, fetchMilestones, showToast, t]);

  const deleteMilestone = useCallback(async (msId: number) => {
    try {
      await api.del(`/api/milestones/${msId}`);
      showToast(t("pipeline.milestones.deleted"));
      if (clientId) fetchMilestones(clientId);
    } catch (e) {
      console.warn('[useMilestones] deleteMilestone', e);
      showToast(t("common.deleteFailed"));
    }
  }, [clientId, fetchMilestones, showToast, t]);

  const undoMarkPaid = useCallback(async (msId: number, onDone?: () => void) => {
    try {
      await api.post(`/api/milestones/${msId}/undo-paid`);
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
      await api.post(`/api/milestones/${markPaidId}/mark-paid`, { payment_method: markPaidMethod, paid_date: markPaidDate });
      showToast(t("pipeline.milestones.autoFinance"));
      setMarkPaidId(null);
      setMarkPaidMethod("bank_transfer");
      if (clientId) fetchMilestones(clientId);
    } catch (e) {
      console.warn('[useMilestones] confirmMarkPaid', e);
      showToast(t("common.saveFailed"));
    }
  }, [clientId, markPaidId, markPaidMethod, markPaidDate, fetchMilestones, showToast, t]);

  /** Open edit panel for a paid milestone */
  const openEditPaid = useCallback((ms: MilestoneRow) => {
    setEditPaidId(ms.id);
    setEditPaidDate(ms.paid_date || "");
    setEditPaidMethod(ms.payment_method || "bank_transfer");
    setEditPaidAmount(String(ms.amount || ""));
  }, []);

  /** Save paid_date + payment_method + amount changes (cascades to linked finance tx via API) */
  const saveEditPaid = useCallback(async () => {
    if (!editPaidId) return;
    try {
      const amt = parseFloat(editPaidAmount);
      await api.put(`/api/milestones/${editPaidId}`, {
        paid_date: editPaidDate,
        payment_method: editPaidMethod,
        amount: isNaN(amt) ? undefined : amt,
      });
      showToast(t("pipeline.milestones.saved"));
      setEditPaidId(null);
      if (clientId) fetchMilestones(clientId);
    } catch (e) {
      console.warn('[useMilestones] saveEditPaid', e);
      showToast(t("common.saveFailed"));
    }
  }, [clientId, editPaidId, editPaidDate, editPaidMethod, editPaidAmount, fetchMilestones, showToast, t]);

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
    const d = new Date();
    setMarkPaidDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
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

  // When a projectId is specified, only show milestones for that project
  const filteredMilestones = projectId
    ? milestones.filter(m => m.project_id === projectId)
    : milestones;

  return {
    // State
    milestones, filteredMilestones, msLoading, showAddMs, editMsId, markPaidId, deleteMsId,
    markPaidMethod, markPaidDate, msForm, savingMs,
    editPaidId, editPaidDate, editPaidMethod, editPaidAmount,
    // Setters (for UI binding)
    setMarkPaidId, setDeleteMsId, setMarkPaidMethod, setMarkPaidDate, setMsForm,
    setEditPaidId, setEditPaidDate, setEditPaidMethod, setEditPaidAmount,
    // Actions
    fetchMilestones, saveMilestone, deleteMilestone, undoMarkPaid,
    confirmMarkPaid, openEditPaid, saveEditPaid, applyPreset, resetState,
    openAddForm, openEditForm, closeForm,
  };
}
