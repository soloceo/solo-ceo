import React, { useState, useEffect } from "react";
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
    await onSave(form, editId);
    onClose();
  };

  const handleDelete = async () => {
    if (editId) {
      await onDelete(editId);
      onClose();
    }
  };

  return (
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
            style={{ zIndex: 40, background: "var(--color-overlay-primary)" }}
            onClick={onClose}
          />
          {/* Panel */}
          <motion.div
            initial={{ x: isMobile ? 0 : "100%", y: isMobile ? "100%" : 0 }}
            animate={{ x: 0, y: 0 }}
            exit={{ x: isMobile ? 0 : "100%", y: isMobile ? "100%" : 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className={isMobile
              ? "fixed inset-0 z-50 flex flex-col"
              : "fixed top-0 right-0 z-50 h-full w-full max-w-[440px] lg:max-w-[520px] flex flex-col"
            }
            style={{
              background: "var(--color-bg-primary)",
              borderLeft: isMobile ? undefined : "1px solid var(--color-border-primary)",
              boxShadow: "var(--shadow-high)",
              paddingTop: isMobile ? "env(safe-area-inset-top, 0px)" : undefined,
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-3 shrink-0"
              style={{ borderBottom: "1px solid var(--color-line-secondary)" }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-6)]"
                  style={{ background: "var(--color-accent-tint)", color: "var(--color-accent)" }}
                >
                  {editId ? <Edit2 size={14} /> : <Plus size={14} />}
                </div>
                <span className="text-[13px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>
                  {editId ? t("work.panel.edit" as any) : t("work.panel.new" as any)}
                </span>
              </div>
              <button onClick={onClose} className="btn-ghost p-1">
                {isMobile ? <X size={16} /> : <PanelRightClose size={16} />}
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
                    onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                    placeholder={t("work.form.titlePlaceholder" as any)}
                    className="input-base w-full px-3 py-2 text-[13px]"
                    autoFocus
                  />
                </FieldLabel>

                {/* Client + Due */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FieldLabel label={t("work.form.client" as any)}>
                    <select
                      value={form.client}
                      onChange={(e) => setForm((p) => ({ ...p, client: e.target.value }))}
                      className="input-base w-full px-3 py-2 text-[13px]"
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
                      className="input-base w-full px-3 py-2 text-[13px]"
                    />
                  </FieldLabel>
                </div>

                {/* Priority + Status */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FieldLabel label={t("work.form.priority" as any)}>
                    <select
                      value={form.priority}
                      onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
                      className="input-base w-full px-3 py-2 text-[13px]"
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
                      className="input-base w-full px-3 py-2 text-[13px]"
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
                    className="input-base w-full h-20 px-3 py-2 text-[13px] resize-none"
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
                <Button variant="ghost" size="sm" onClick={handleDelete} className="text-[var(--color-danger)]">
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
    </AnimatePresence>
  );
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="section-label">{label}</span>
      {children}
    </label>
  );
}
