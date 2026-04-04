import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Edit2, Trash2, X, PanelRightClose } from "lucide-react";
import { useT } from "../../i18n/context";
import { useIsMobile } from "../../hooks/useIsMobile";
import { dateToKey } from "../../lib/date-utils";
import { Button } from "../../components/ui";
import type { Task } from "./TaskCard";

interface ColDef {
  id: string;
  title: string;
  color: string;
}

interface TaskDetailProps {
  open: boolean;
  onClose: () => void;
  editTask: Task | null;
  columns: ColDef[];
  defaultColumn: string;
  clientList: { id: number; name: string; company_name?: string }[];
  onSave: (form: TaskForm, editId: number | null) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export interface TaskForm {
  title: string;
  client: string;
  client_id: number | null;
  priority: string;
  due: string;
  column: string;
  originalRequest: string;
}

function quickDates(t: (k: string) => string) {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const dayOfWeek = today.getDay(); // 0=Sun
  const daysUntilMon = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 7 : 8 - dayOfWeek;
  const nextMon = new Date(today);
  nextMon.setDate(today.getDate() + daysUntilMon);
  return [
    { label: t("common.today"), value: dateToKey(today) },
    { label: t("common.tomorrow"), value: dateToKey(tomorrow) },
    { label: t("common.nextMonday"), value: dateToKey(nextMon) },
  ];
}

const emptyForm: TaskForm = {
  title: "",
  client: "",
  client_id: null,
  priority: "Medium",
  due: "",
  column: "todo",
  originalRequest: "",
};

export function TaskDetail({ open, onClose, editTask, columns, defaultColumn, clientList, onSave, onDelete }: TaskDetailProps) {
  const { t } = useT();
  const isMobile = useIsMobile();
  const editId = editTask?.id ?? null;

  const [form, setForm] = useState<TaskForm>(emptyForm);
  const [titleError, setTitleError] = useState(false);

  useEffect(() => {
    if (editTask) {
      setForm({
        title: editTask.title,
        client: editTask.client || "",
        client_id: editTask.client_id ?? null,
        priority: editTask.priority,
        due: editTask.due || "",
        column: editTask.column || defaultColumn,
        originalRequest: editTask.originalRequest || "",
      });
    } else {
      setForm({ ...emptyForm, column: defaultColumn });
    }
  }, [editTask, defaultColumn]);

  // Hide mobile nav when panel is open
  useEffect(() => {
    if (isMobile && open) {
      window.dispatchEvent(new CustomEvent("mobile-nav-visibility", { detail: { hidden: true } }));
      return () => {
        window.dispatchEvent(new CustomEvent("mobile-nav-visibility", { detail: { hidden: false } }));
      };
    }
  }, [open, isMobile]);

  const handleSave = async () => {
    if (!form.title.trim()) {
      setTitleError(true);
      return;
    }
    setTitleError(false);
    // Rule 13: only send changed fields on edit to avoid stale-data overwrites
    if (editId && editTask) {
      const diff: Partial<TaskForm> = {};
      const orig: TaskForm = {
        title: editTask.title, client: editTask.client || "", client_id: editTask.client_id ?? null,
        priority: editTask.priority, due: editTask.due || "", column: editTask.column || defaultColumn,
        originalRequest: editTask.originalRequest || "",
      };
      for (const k of Object.keys(form) as (keyof TaskForm)[]) {
        if (form[k] !== orig[k]) (diff as Record<string, unknown>)[k] = form[k];
      }
      if (Object.keys(diff).length === 0) { onClose(); return; }
      await onSave(diff as TaskForm, editId);
    } else {
      await onSave(form, editId);
    }
    onClose();
  };

  // Cmd/Ctrl+Enter to save — use ref to always call latest handleSave
  const handleSaveRef = React.useRef(handleSave);
  handleSaveRef.current = handleSave;

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSaveRef.current();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = async () => {
    if (editId) {
      await onDelete(editId);
      setShowDeleteConfirm(false);
      onClose();
    }
  };

  return <>
  {createPortal(
    <AnimatePresence>
      {open && (
        <motion.div key="task-panel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}>
          {/* Overlay */}
          <div
            className="fixed inset-0"
            style={{ zIndex: "var(--layer-dialog-overlay)", background: "var(--color-overlay-primary)", backdropFilter: "blur(2px) saturate(180%)", WebkitBackdropFilter: "blur(2px) saturate(180%)" }}
            onClick={onClose}
          />
          {/* Panel */}
          <motion.div
            initial={{ x: isMobile ? 0 : "100%", y: isMobile ? "100%" : 0 }}
            animate={{ x: 0, y: 0 }}
            exit={{ x: isMobile ? 0 : "100%", y: isMobile ? "100%" : 0 }}
            transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label="Task detail"
            className={isMobile
              ? "fixed inset-0 flex flex-col"
              : "fixed top-0 right-0 h-full w-full max-w-[440px] lg:max-w-[520px] flex flex-col"
            }
            style={{
              zIndex: "var(--layer-dialog)",
              background: "var(--color-bg-primary)",
              borderLeft: isMobile ? undefined : "1px solid var(--color-border-primary)",
              boxShadow: "var(--shadow-high)",
              paddingTop: isMobile ? "var(--mobile-header-pt, max(env(safe-area-inset-top, 0px), 0px))" : undefined,
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-3 shrink-0"
              style={{ borderBottom: "1px solid var(--color-line-secondary)" }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-6)]"
                  style={{ background: "var(--color-accent-tint)", color: "var(--color-accent)" }}
                >
                  {editId ? <Edit2 size={14} /> : <Plus size={14} />}
                </div>
                <span className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>
                  {editId ? t("work.panel.edit") : t("work.panel.new")}
                </span>
              </div>
              <button onClick={onClose} className="btn-icon">
                {isMobile ? <X size={18} /> : <PanelRightClose size={18} />}
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
              <div className="p-5 space-y-3">
                {/* Title */}
                <FieldLabel label={t("work.form.title")}>
                  <input
                    required
                    value={form.title}
                    onChange={(e) => { setForm((p) => ({ ...p, title: e.target.value })); setTitleError(false); }}
                    placeholder={t("work.form.titlePlaceholder")}
                    className="input-base w-full px-3 py-2 text-[15px]"
                    style={titleError ? { borderColor: "var(--color-danger)", boxShadow: "0 0 0 2px color-mix(in srgb, var(--color-danger) 15%, transparent)" } : undefined}
                  />
                </FieldLabel>

                {/* Client + Due */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FieldLabel label={t("work.form.client")}>
                    <select
                      value={form.client_id ? String(form.client_id) : ""}
                      onChange={(e) => {
                        const selectedId = e.target.value ? Number(e.target.value) : null;
                        const selected = clientList.find((c) => c.id === selectedId);
                        setForm((p) => ({
                          ...p,
                          client_id: selectedId,
                          client: selected ? (selected.company_name || selected.name) : "",
                        }));
                      }}
                      className="input-base w-full px-3 py-2 text-[15px]"
                    >
                      <option value="">{t("work.form.clientNone")}</option>
                      {clientList.map((c) => (
                        <option key={c.id} value={String(c.id)}>
                          {c.company_name || c.name}
                        </option>
                      ))}
                    </select>
                  </FieldLabel>
                  <FieldLabel label={t("work.form.due")}>
                    <input
                      type="date"
                      value={form.due}
                      onChange={(e) => setForm((p) => ({ ...p, due: e.target.value }))}
                      className="input-base w-full px-3 py-2 text-[15px]"
                    />
                    <div className="flex flex-wrap gap-1 mt-1">
                      {quickDates(t).map((qd) => (
                        <button
                          key={qd.label}
                          type="button"
                          onClick={() => setForm((p) => ({ ...p, due: qd.value }))}
                          className="text-[13px] px-2 py-0.5 rounded-[var(--radius-4)] transition-colors hover:bg-[var(--color-bg-quaternary)]"
                          style={{
                            color: form.due === qd.value ? "var(--color-accent)" : "var(--color-text-quaternary)",
                            background: form.due === qd.value ? "var(--color-accent-tint)" : undefined,
                            fontWeight: "var(--font-weight-medium)",
                          } as React.CSSProperties}
                        >
                          {qd.label}
                        </button>
                      ))}
                    </div>
                  </FieldLabel>
                </div>

                {/* Priority + Status */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FieldLabel label={t("work.form.priority")}>
                    <select
                      value={form.priority}
                      onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
                      className="input-base w-full px-3 py-2 text-[15px]"
                    >
                      <option value="High">{t("work.filter.high")}</option>
                      <option value="Medium">{t("work.filter.medium")}</option>
                      <option value="Low">{t("work.filter.low")}</option>
                    </select>
                  </FieldLabel>
                  <FieldLabel label={t("work.form.status")}>
                    <select
                      value={form.column}
                      onChange={(e) => setForm((p) => ({ ...p, column: e.target.value }))}
                      className="input-base w-full px-3 py-2 text-[15px]"
                    >
                      {columns.map((c) => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>
                  </FieldLabel>
                </div>

                {/* Divider */}
                <div style={{ borderTop: "1px solid var(--color-line-secondary)" }} />

                {/* Notes / original request */}
                <FieldLabel label={t("work.form.request")}>
                  <textarea
                    value={form.originalRequest}
                    onChange={(e) => setForm((p) => ({ ...p, originalRequest: e.target.value }))}
                    placeholder={t("work.form.requestPlaceholder")}
                    className="input-base w-full h-20 px-3 py-2 text-[15px] resize-none"
                  />
                </FieldLabel>
              </div>
            </div>

            {/* Footer */}
            <div
              className="flex items-center justify-between px-5 py-3 shrink-0 pb-safe"
              style={{ borderTop: "1px solid var(--color-line-secondary)" }}
            >
              {editId ? (
                <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(true)} className="text-[var(--color-danger)]">
                  <Trash2 size={14} /> {t("common.delete")}
                </Button>
              ) : <div />}
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={onClose}>
                  {t("common.cancel")}
                </Button>
                <Button size="sm" onClick={handleSave}>
                  {editId ? t("common.save") : t("common.create")}
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )}
  {showDeleteConfirm && createPortal(
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: "var(--layer-confirm)", background: "var(--color-overlay-primary)", paddingBottom: "16px" }}>
      <div className="card-elevated w-full max-w-sm p-5" role="dialog" aria-modal="true" aria-label="Confirm delete">
        <h3 className="text-[15px] mb-2" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{t("work.delete.title")}</h3>
        <p className="text-[15px] mb-4" style={{ color: "var(--color-text-secondary)" }}>{t("work.delete.warning")}</p>
        <div className="flex justify-end gap-2">
          <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary text-[15px]">{t("common.cancel")}</button>
          <button onClick={handleDelete} className="text-[15px] px-4 py-2 rounded-[var(--radius-6)]" style={{ background: "var(--color-danger)", color: "var(--color-text-on-color)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{t("common.confirm")}</button>
        </div>
      </div>
    </div>,
    document.body,
  )}
  </>;
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="section-label">{label}</span>
      {children}
    </label>
  );
}
