import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Clock, Trash2, Calendar, ArrowRightLeft } from "lucide-react";
import { fmtDate } from "../../lib/format";
import { todayDateKey } from "../../lib/date-utils";
import { useT } from "../../i18n/context";
import { InlinePopover, PopoverOption } from "../../components/ui/InlinePopover";

export interface Task {
  id: number;
  title: string;
  client?: string;
  client_id?: number | null;
  priority: "High" | "Medium" | "Low";
  due?: string;
  column: string;
  originalRequest?: string;
  scope?: string;
  parent_id?: number | null;
}

const PRIO_OPTIONS: { value: Task["priority"]; zh: string; en: string; color: string }[] = [
  { value: "High", zh: "高", en: "High", color: "var(--color-danger)" },
  { value: "Medium", zh: "中", en: "Medium", color: "var(--color-warning)" },
  { value: "Low", zh: "低", en: "Low", color: "var(--color-success)" },
];

const prioLabel: Record<string, { zh: string; en: string; color: string }> = {
  High: { zh: "高", en: "H", color: "var(--color-danger)" },
  Medium: { zh: "中", en: "M", color: "var(--color-warning)" },
  Low: { zh: "低", en: "L", color: "var(--color-success)" },
};

interface ColDef {
  id: string;
  title: string;
  color: string;
}

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (id: number) => void;
  onClientClick?: () => void;
  onPriorityChange?: (id: number, priority: Task["priority"]) => void;
  onDueChange?: (id: number, due: string) => void;
  columns?: ColDef[];
  onColumnChange?: (id: number, col: string) => void;
  /** If true, renders as overlay (no sortable hooks) */
  isOverlay?: boolean;
}

export const TaskCard = React.memo(function TaskCard({
  task, onEdit, onDelete, onClientClick,
  onPriorityChange, onDueChange, columns, onColumnChange, isOverlay,
}: TaskCardProps) {
  const { lang, t } = useT();
  const prio = prioLabel[task.priority];
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id.toString(),
    disabled: isOverlay,
  });

  const style: React.CSSProperties = isOverlay
    ? { boxShadow: "var(--shadow-high)", transform: "rotate(2deg) scale(1.02)", opacity: 0.95 }
    : {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        touchAction: "manipulation",
      };

  const cardContent = (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      {...(isOverlay ? {} : attributes)}
      {...(isOverlay ? {} : listeners)}
      role="listitem"
      style={style}
      onClick={() => onEdit(task)}
      className={`group card-interactive cursor-grab active:cursor-grabbing p-3 press-feedback ${isDragging && !isOverlay ? "z-[var(--layer-tooltip)]" : ""}`}
    >
      <div className="flex items-center gap-2 mb-1 min-w-0">
        {onPriorityChange ? (
          <InlinePopover
            align="start"
            trigger={
              <span
                className="text-[11px] shrink-0 px-1.5 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-[var(--radius-4)] transition-colors hover:bg-[var(--color-bg-quaternary)] -my-2"
                style={{ color: prio?.color || "var(--color-text-quaternary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}
              >
                {prio?.[lang] || ""}
              </span>
            }
          >
            {PRIO_OPTIONS.map(opt => (
              <PopoverOption
                key={opt.value}
                selected={task.priority === opt.value}
                color={opt.color}
                onClick={(e) => { e.stopPropagation(); onPriorityChange(task.id, opt.value); }}
              >
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: opt.color }} />
                  {opt[lang as "zh" | "en"]}
                </span>
              </PopoverOption>
            ))}
          </InlinePopover>
        ) : (
          <span className="text-[11px] shrink-0" style={{ color: prio?.color || "var(--color-text-quaternary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
            {prio?.[lang] || ""}
          </span>
        )}

        <h3 className="text-[15px] truncate min-w-0 flex-1" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
          {task.title}
        </h3>
      </div>

      {task.client && (
        <p className="text-[13px] mb-0.5">
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
        <p className="text-[12px] truncate" style={{ color: "var(--color-text-quaternary)" }}>
          {task.originalRequest}
        </p>
      )}

      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-1">
          {onDueChange ? (
            <span
              className="inline-flex items-center gap-1 cursor-pointer rounded-[var(--radius-4)] transition-colors hover:bg-[var(--color-bg-quaternary)]"
              onClick={(e) => e.stopPropagation()}
            >
              {task.due ? (() => {
                const today = todayDateKey();
                const isOverdue = task.due < today;
                const isToday = task.due === today;
                const dueCls = isOverdue ? "badge-danger" : isToday ? "badge-warning" : "";
                return (
                  <label className={`badge text-[13px] cursor-pointer relative ${dueCls}`}>
                    <Clock size={12} /> {fmtDate(task.due!, lang)}
                    <input
                      type="date"
                      value={task.due?.slice(0, 10)}
                      onChange={(e) => { e.stopPropagation(); onDueChange(task.id, e.target.value); }}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      style={{ width: "100%", height: "100%" }}
                    />
                  </label>
                );
              })() : (
                <label className="badge text-[13px] cursor-pointer relative" style={{ color: "var(--color-text-quaternary)" }}>
                  <Calendar size={12} />
                  <input
                    type="date"
                    value=""
                    onChange={(e) => { e.stopPropagation(); onDueChange(task.id, e.target.value); }}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    style={{ width: "100%", height: "100%" }}
                  />
                </label>
              )}
            </span>
          ) : (
            task.due && (() => {
              const today = todayDateKey();
              const isOverdue = task.due < today;
              const isToday = task.due === today;
              const dueCls = isOverdue ? "badge-danger" : isToday ? "badge-warning" : "";
              return (
                <span className={`badge text-[13px] ${dueCls}`}>
                  <Clock size={12} /> {fmtDate(task.due!, lang)}
                </span>
              );
            })()
          )}
        </div>

        <div className="flex items-center gap-1">
          {columns && onColumnChange && (
            <InlinePopover
              align="end"
              trigger={
                <span
                  className="inline-flex items-center gap-1 text-[12px] px-1.5 min-h-[44px] rounded-[var(--radius-4)] transition-colors hover:bg-[var(--color-bg-quaternary)] cursor-pointer -my-2"
                  style={{ color: columns.find(c => c.id === task.column)?.color || "var(--color-text-tertiary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}
                >
                  <ArrowRightLeft size={11} />
                  {columns.find(c => c.id === task.column)?.title || task.column}
                </span>
              }
            >
              {columns.map(col => (
                <PopoverOption
                  key={col.id}
                  selected={task.column === col.id}
                  color={col.color}
                  onClick={(e) => { e.stopPropagation(); if (col.id !== task.column) onColumnChange(task.id, col.id); }}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                    {col.title}
                  </span>
                </PopoverOption>
              ))}
            </InlinePopover>
          )}
          {confirmDeleteId === task.id ? (
            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => { onDelete(task.id); setConfirmDeleteId(null); }}
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
                <span style={{ color: "var(--color-text-quaternary)", fontSize: "var(--font-size-xs)" }}>×</span>
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

  if (confirmDeleteId === task.id) {
    return (
      <>
        {cardContent}
        {createPortal(
          <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: "var(--layer-confirm)", background: "var(--color-overlay-primary)", backdropFilter: "blur(2px) saturate(180%)", WebkitBackdropFilter: "blur(2px) saturate(180%)", paddingBottom: "16px" }}>
            <div className="card-elevated w-full max-w-sm p-5 rounded-[var(--radius-6)]" role="dialog" aria-modal="true" aria-label="Confirm delete">
              <h3 className="text-[15px] mb-2" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{t("common.confirmDelete")}</h3>
              <p className="text-[14px] mb-4" style={{ color: "var(--color-text-secondary)" }}>{t("common.cannotUndo")}</p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setConfirmDeleteId(null)} className="btn-secondary text-[14px]">{t("common.cancel")}</button>
                <button onClick={() => {
                  onDelete(task.id);
                  setConfirmDeleteId(null);
                }} className="text-[14px] px-4 py-2 rounded-[var(--radius-6)]" style={{ background: "var(--color-danger)", color: "var(--color-text-on-color)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{t("common.confirm")}</button>
              </div>
            </div>
          </div>,
          document.body,
        )}
      </>
    );
  }

  return cardContent;
});
