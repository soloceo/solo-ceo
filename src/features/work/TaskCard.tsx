import React from "react";
import { createPortal } from "react-dom";
import { Clock, GripVertical, Trash2 } from "lucide-react";

export interface Task {
  id: number;
  title: string;
  client?: string;
  priority: "High" | "Medium" | "Low";
  due?: string;
  column: string;
  originalRequest?: string;
}

const prioColorMap: Record<string, string> = {
  High: "var(--color-danger)",
  Medium: "var(--color-warning)",
  Low: "var(--color-success)",
};

interface TaskCardProps {
  task: Task;
  provided: any;
  snapshot: any;
  onEdit: (task: Task) => void;
  onDelete: (id: number) => void;
}

export const TaskCard = React.memo(function TaskCard({ task, provided, snapshot, onEdit, onDelete }: TaskCardProps) {
  const prioColor = prioColorMap[task.priority] || "var(--color-text-quaternary)";

  const card = (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      style={provided.draggableProps.style as React.CSSProperties}
      onClick={() => onEdit(task)}
      className={`group card-interactive cursor-pointer p-3 ${snapshot.isDragging ? "rotate-[2deg] scale-[1.02] !shadow-lg z-[9999]" : ""}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span {...provided.dragHandleProps} style={{ touchAction: "none" }} className="shrink-0 cursor-grab active:cursor-grabbing">
          <GripVertical size={14} style={{ color: "var(--color-text-quaternary)", opacity: 0.5 }} />
        </span>
        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: prioColor }} />
        <h4 className="text-[13px] truncate" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
          {task.title}
        </h4>
      </div>
      {task.client && (
        <p className="text-[11px] mb-1 pl-3.5" style={{ color: "var(--color-text-tertiary)" }}>{task.client}</p>
      )}
      <div className="flex items-center justify-between pl-3.5 mt-1.5">
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
              <span className="badge text-[11px]" style={dueSt}>
                <Clock size={12} /> {task.due}
              </span>
            );
          })()}
        </div>
        <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
            className="p-0.5 rounded-[var(--radius-4)]"
            style={{ color: "var(--color-text-quaternary)" }}
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
