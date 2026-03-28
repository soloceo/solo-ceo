import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Clock, GripVertical, Trash2 } from "lucide-react";
import { fmtDate } from "../../lib/format";
import { useT } from "../../i18n/context";

export interface Task {
  id: number;
  title: string;
  client?: string;
  priority: "High" | "Medium" | "Low";
  due?: string;
  column: string;
  originalRequest?: string;
  scope?: string;
  parent_id?: number | null;
}

const prioLabel: Record<string, { zh: string; en: string; color: string }> = {
  High: { zh: "高", en: "H", color: "var(--color-danger)" },
  Medium: { zh: "中", en: "M", color: "var(--color-warning)" },
  Low: { zh: "低", en: "L", color: "var(--color-success)" },
};

interface TaskCardProps {
  task: Task;
  provided: any;
  snapshot: any;
  onEdit: (task: Task) => void;
  onDelete: (id: number) => void;
  onClientClick?: () => void;
}

export const TaskCard = React.memo(function TaskCard({ task, provided, snapshot, onEdit, onDelete, onClientClick }: TaskCardProps) {
  const { lang, t } = useT();
  const prio = prioLabel[task.priority];
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const card = (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      role="listitem"
      style={{ ...(provided.draggableProps.style as React.CSSProperties), touchAction: snapshot.isDragging ? "none" : "auto", ...(snapshot.isDragging ? { boxShadow: "var(--shadow-high)" } : {}) }}
      onClick={() => onEdit(task)}
      className={`group card-interactive cursor-pointer p-3 press-feedback ${snapshot.isDragging ? "rotate-[2deg] scale-[1.02] z-[1100]" : ""}`}
    >
      <div className="flex items-center gap-2 mb-1 min-w-0">
        <span {...provided.dragHandleProps} style={{ touchAction: "none" }} className="shrink-0 cursor-grab active:cursor-grabbing">
          <GripVertical size={14} style={{ color: "var(--color-text-quaternary)", opacity: 0.5 }} />
        </span>
        <span className="text-[11px] shrink-0" style={{ color: prio?.color || "var(--color-text-quaternary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
          {prio?.[lang] || ""}
        </span>
        <h3 className="text-[15px] truncate min-w-0" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
          {task.title}
        </h3>
      </div>
      {task.client && (
        <p className="text-[13px] mb-0.5 pl-3.5">
          <button
            className="cursor-pointer hover:underline bg-transparent border-0 p-0 text-[13px]"
            style={{ color: prio?.color || "var(--color-text-tertiary)", font: "inherit" }}
            onClick={(e) => { e.stopPropagation(); onClientClick?.(); }}
          >
            {task.client}
          </button>
        </p>
      )}
      {task.originalRequest && (
        <p className="text-[12px] pl-3.5 truncate" style={{ color: "var(--color-text-quaternary)" }}>
          {task.originalRequest}
        </p>
      )}
      <div className="flex items-center justify-between pl-3.5 mt-1">
        <div className="flex items-center gap-1">
          {task.due && (() => {
            const today = new Date().toISOString().split("T")[0];
            const isOverdue = task.due < today;
            const isToday = task.due === today;
            const dueSt = isOverdue
              ? { background: "var(--color-danger-light)", color: "var(--color-danger)" }
              : isToday
              ? { background: "var(--color-warning-light)", color: "var(--color-warning)" }
              : undefined;
            return (
              <span className="badge text-[13px]" style={dueSt}>
                <Clock size={12} /> {fmtDate(task.due!, lang)}
              </span>
            );
          })()}
        </div>
        <div className="flex gap-1">
          {confirmDeleteId === task.id ? (
            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => {
                  onDelete(task.id);
                  setConfirmDeleteId(null);
                }}
                className="btn-icon-sm"
                aria-label="Confirm delete"
                style={{ color: "var(--color-danger)" }}
              >
                <Trash2 size={14} />
              </button>
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="btn-icon-sm"
                aria-label="Cancel delete"
              >
                <span style={{ color: "var(--color-text-quaternary)", fontSize: "12px" }}>×</span>
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(task.id); }}
              className="btn-icon-sm"
              aria-label="Delete"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const cardWithConfirm = confirmDeleteId === task.id ? (
    <>
      {card}
      {createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 710, background: "var(--color-overlay-primary)", paddingBottom: "max(env(safe-area-inset-bottom, 0px), 16px)" }}>
          <div className="card-elevated w-full max-w-sm p-5 rounded-[var(--radius-6)]" role="dialog" aria-modal="true" aria-label="Confirm delete">
            <h3 className="text-[15px] mb-2" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{t("common.confirmDelete" as any)}</h3>
            <p className="text-[14px] mb-4" style={{ color: "var(--color-text-secondary)" }}>{t("common.cannotUndo" as any)}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDeleteId(null)} className="btn-secondary text-[14px]">{t("common.cancel" as any)}</button>
              <button onClick={() => {
                onDelete(task.id);
                setConfirmDeleteId(null);
              }} className="text-[14px] px-4 py-2 rounded-[var(--radius-6)]" style={{ background: "var(--color-danger)", color: "var(--color-text-on-color)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{t("common.confirm" as any)}</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  ) : card;

  return snapshot.isDragging ? createPortal(cardWithConfirm, document.body) : cardWithConfirm;
});
