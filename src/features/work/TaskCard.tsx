import React from "react";
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
  const { lang } = useT();
  const prio = prioLabel[task.priority];

  const card = (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      style={{ ...(provided.draggableProps.style as React.CSSProperties), touchAction: snapshot.isDragging ? "none" : "auto", ...(snapshot.isDragging ? { boxShadow: "var(--shadow-high)" } : {}) }}
      onClick={() => onEdit(task)}
      className={`group card-interactive cursor-pointer p-3 press-feedback ${snapshot.isDragging ? "rotate-[2deg] scale-[1.02] z-[1100]" : ""}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span {...provided.dragHandleProps} style={{ touchAction: "none" }} className="shrink-0 cursor-grab active:cursor-grabbing">
          <GripVertical size={14} style={{ color: "var(--color-text-quaternary)", opacity: 0.5 }} />
        </span>
        <span className="text-[11px] shrink-0" style={{ color: prio?.color || "var(--color-text-quaternary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
          {prio?.[lang] || ""}
        </span>
        <h4 className="text-[15px] truncate" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
          {task.title}
        </h4>
      </div>
      {task.client && (
        <p className="text-[13px] mb-1 pl-3.5">
          <button
            className="cursor-pointer hover:underline bg-transparent border-0 p-0 text-[13px]"
            style={{ color: "var(--color-accent)", font: "inherit" }}
            onClick={(e) => { e.stopPropagation(); onClientClick?.(); }}
          >
            {task.client}
          </button>
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
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
            className="btn-icon-sm"
            aria-label="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );

  return snapshot.isDragging ? createPortal(card, document.body) : card;
});
