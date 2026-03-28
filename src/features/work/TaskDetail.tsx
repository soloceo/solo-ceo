import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Edit2, Trash2, X, PanelRightClose } from "lucide-react";
import { useT } from "../../i18n/context";
import { useIsMobile } from "../../hooks/useIsMobile";
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
  priority: string;
  due: string;
  column: string;
  originalRequest: string;
}

function quickDates(t: (k: any) => string) {
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const dayOfWeek = today.getDay(); // 0=Sun
  const daysUntilMon = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 7 : 8 - dayOfWeek;
  const nextMon = new Date(today);
  nextMon.setDate(today.getDate() + daysUntilMon);
  return [
    { label: t("common.today" as any), value: fmt(today) },
    { label: t("common.tomorrow" as any), value: fmt(tomorrow) },
    { label: t("common.nextMonday" as any), value: fmt(nextMon) },
  ];
}

const emptyForm: TaskForm = {
  title: "",
  client: "",
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
    await onSave(form, editId);
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
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0"
            style={{ zIndex: 699, background: "var(--color-overlay-primary)" }}
            onClick={onClose}
          />
          {/* Panel */}
          <motion.div
            initial={{ x: isMobile ? 0 : "100%", y: isMobile ? "100%" : 0 }}
            animate={{ x: 0, y: 0 }}
            exit={{ x: isMobile ? 0 : "100%", y: isMobile ? "100%" : 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            role="dialog"
            aria-modal="true"
            aria-label="Task detail"
            className={isMobile
              ? "fixed inset-0 flex flex-col"
              : "fixed top-0 right-0 h-full w-full max-w-[440px] lg:max-w-[520px] flex flex-col"
            }
            style={{
              zIndex: 700,
              background: "var(--color-bg-primary)",
              borderLeft: isMobile ? undefined : "1px solid var(--color-border-primary)",
              boxShadow: "var(--shadow-high)",
              paddingTop: isMobile ? "var(--mobile-header-pt, env(safe-area-inset-top, 0px))" : undefined,
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
                  {editId ? t("work.panel.edit" as any) : t("work.panel.new" as any)}
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
                <FieldLabel label={t("work.form.title" as any)}>
                  <input
                    required
                    value={form.title}
                    onChange={(e) => { setForm((p) => ({ ...p, title: e.target.value })); setTitleError(false); }}
                    placeholder={t("work.form.titlePlaceholder" as any)}
                    className="input-base w-full px-3 py-2 text-[15px]"
                    style={titleError ? { borderColor: "var(--color-danger)", boxShadow: "0 0 0 2px color-mix(in srgb, var(--color-danger) 15%, transparent)" } : undefined}
                  />
                </FieldLabel>

                {/* Client + Due */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FieldLabel label={t("work.form.client" as any)}>
                    <select
                      value={form.client}
                      onChange={(e) => setForm((p) => ({ ...p, client: e.target.value }))}
                      className="input-base w-full px-3 py-2 text-[15px]"
                    >
                      <option value="">{t("work.form.clientNone" as any)}</option>
                      {clientList.map((c) => (
                        <option key={c.id} value={c.company_name || c.name}>
                          {c.company_name || c.name}
                        </option>
                      ))}
                    </select>
                  </FieldLabel>
                  <FieldLabel label={t("work.form.due" as any)}>
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
                  <FieldLabel label={t("work.form.priority" as any)}>
                    <select
                      value={form.priority}
                      onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
                      className="input-base w-full px-3 py-2 text-[15px]"
                    >
                      <option value="High">{t("work.filter.high" as any)}</option>
                      <option value="Medium">{t("work.filter.medium" as any)}</option>
                      <option value="Low">{t("work.filter.low" as any)}</option>
                    </select>
                  </FieldLabel>
                  <FieldLabel label={t("work.form.status" as any)}>
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
                <FieldLabel label={t("work.form.request" as any)}>
                  <textarea
                    value={form.originalRequest}
                    onChange={(e) => setForm((p) => ({ ...p, originalRequest: e.target.value }))}
                    placeholder={t("work.form.requestPlaceholder" as any)}
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
                  <Trash2 size={14} /> {t("common.delete" as any)}
                </Button>
              ) : <div />}
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={onClose}>
                  {t("common.cancel" as any)}
                </Button>
                <Button size="sm" onClick={handleSave}>
                  {editId ? t("common.save" as any) : t("common.create" as any)}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )}
  {showDeleteConfirm && createPortal(
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 710, background: "var(--color-overlay-primary)", paddingBottom: "max(env(safe-area-inset-bottom, 0px), 16px)" }}>
      <div className="card-elevated w-full max-w-sm p-5" role="dialog" aria-modal="true" aria-label="Confirm delete">
        <h3 className="text-[15px] mb-2" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{t("work.delete.title" as any)}</h3>
        <p className="text-[15px] mb-4" style={{ color: "var(--color-text-secondary)" }}>{t("work.delete.warning" as any)}</p>
        <div className="flex justify-end gap-2">
          <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary text-[15px]">{t("common.cancel" as any)}</button>
          <button onClick={handleDelete} className="text-[15px] px-4 py-2 rounded-[var(--radius-6)]" style={{ background: "var(--color-danger)", color: "var(--color-text-on-color)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{t("common.confirm" as any)}</button>
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
