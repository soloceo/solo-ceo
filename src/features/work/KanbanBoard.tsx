import React from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Plus, Trash2, ChevronRight } from "lucide-react";
import { useT } from "../../i18n/context";
import { TaskCard, type Task } from "./TaskCard";

export interface ColDef {
  id: string;
  title: string;
  color: string;
}

interface KanbanBoardProps {
  columns: ColDef[];
  tasks: Record<string, Task[]>;
  onDragEnd: (result: any) => void;
  onAdd: (col: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: number) => void;
  emptyText: string;
}

export function KanbanBoard({ columns, tasks, onDragEnd, onAdd, onEdit, onDelete, emptyText }: KanbanBoardProps) {
  return (
    <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4 -mx-4 px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
      <div className="flex h-full gap-3" style={{ minWidth: "max-content" }}>
        <DragDropContext onDragEnd={onDragEnd}>
          {columns.map((col) => (
            <Column
              key={col.id}
              col={col}
              items={tasks[col.id] || []}
              onAdd={() => onAdd(col.id)}
              onEdit={onEdit}
              onDelete={onDelete}
              emptyText={emptyText}
            />
          ))}
        </DragDropContext>
      </div>
    </div>
  );
}

function Column({ col, items, onAdd, onEdit, onDelete, emptyText }: {
  col: ColDef;
  items: Task[];
  onAdd: () => void;
  onEdit: (task: Task) => void;
  onDelete: (id: number) => void;
  emptyText: string;
}) {
  return (
    <div className="flex flex-col min-w-[240px] flex-1 max-w-[360px] h-full">
      {/* Column header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-[var(--radius-2)]" style={{ background: col.color }} />
          <h3 className="text-[13px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>
            {col.title}
          </h3>
          <span className="text-[11px] tabular-nums" style={{ color: "var(--color-text-tertiary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
            {items.length}
          </span>
        </div>
        <button onClick={onAdd} className="btn-ghost p-0.5">
          <Plus size={16} />
        </button>
      </div>

      <Droppable droppableId={col.id}>
        {(provided, snapshot) => (
          <div
            {...provided.droppableProps}
            ref={provided.innerRef}
            className="flex flex-col flex-1 min-h-0 rounded-[var(--radius-8)] overflow-hidden"
            style={{
              background: snapshot.isDraggingOver ? "var(--color-accent-tint)" : "var(--color-bg-tertiary)",
              borderTop: `2px solid ${col.color}`,
              transition: "background var(--speed-quick) var(--ease-out-quad)",
            }}
          >
            <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
              {!items.length && (
                <button
                  onClick={onAdd}
                  className="py-8 w-full text-center text-[11px] transition-colors hover:bg-[var(--color-bg-quaternary)] rounded-[var(--radius-6)]"
                  style={{ color: "var(--color-text-quaternary)" }}
                >
                  <Plus size={16} className="mx-auto mb-1" style={{ opacity: 0.5 }} />
                  {emptyText}
                </button>
              )}
              {items.map((task, i) => (
                // @ts-expect-error React 19 type issue with Draggable
                <Draggable key={task.id.toString()} draggableId={task.id.toString()} index={i}>
                  {(prov: any, snap: any) => (
                    <TaskCard task={task} provided={prov} snapshot={snap} onEdit={onEdit} onDelete={onDelete} />
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          </div>
        )}
      </Droppable>
    </div>
  );
}

/* ── Swimlane View — Linear list-row style ───────────────────── */
interface SwimlaneProps {
  columns: ColDef[];
  tasks: Record<string, Task[]>;
  onAdd: (col: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: number) => void;
  onMove: (id: number, col: string) => void;
  emptyText: string;
}

const prioColor: Record<string, string> = {
  High: "var(--color-danger)",
  Medium: "var(--color-warning)",
  Low: "var(--color-success)",
};

export function SwimlaneView({ columns, tasks, onAdd, onEdit, onDelete, onMove, emptyText }: SwimlaneProps) {
  const { t } = useT();

  return (
    <div className="flex-1 overflow-y-auto space-y-3 pb-4">
      {columns.map((col) => {
        const items = tasks[col.id] || [];
        return (
          <section key={col.id}>
            {/* Section header */}
            <div className="flex items-center justify-between mb-1 px-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                <h3 className="text-[13px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>
                  {col.title}
                </h3>
                <span className="text-[11px] tabular-nums" style={{ color: "var(--color-text-tertiary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
                  {items.length}
                </span>
              </div>
              <button onClick={() => onAdd(col.id)} className="btn-ghost p-0.5">
                <Plus size={14} />
              </button>
            </div>

            {/* List rows */}
            <div className="card overflow-hidden divide-y divide-[var(--color-line-secondary)]">
              {!items.length ? (
                <div className="px-4 py-4 text-[12px] text-center" style={{ color: "var(--color-text-quaternary)" }}>
                  {emptyText}
                </div>
              ) : items.map((task) => (
                <div
                  key={task.id}
                  onClick={() => onEdit(task)}
                  className="flex items-center gap-2.5 px-3 py-2.5 group cursor-pointer transition-colors hover:bg-[var(--color-bg-tertiary)]"
                >
                  {/* Priority dot */}
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: prioColor[task.priority] || "var(--color-text-quaternary)" }} />

                  {/* Title + client */}
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] truncate block" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
                      {task.title}
                    </span>
                    {task.client && (
                      <span className="text-[11px] truncate block" style={{ color: "var(--color-text-tertiary)" }}>{task.client}</span>
                    )}
                  </div>

                  {/* Due date badge */}
                  {task.due && (() => {
                    const today = new Date().toISOString().split("T")[0];
                    const isOverdue = task.due < today;
                    const isToday = task.due === today;
                    return (
                      <span
                        className="badge text-[11px] shrink-0"
                        style={isOverdue ? { background: "var(--color-danger-light)", color: "var(--color-danger)" } : isToday ? { background: "var(--color-warning-light)", color: "var(--color-warning)" } : undefined}
                      >
                        {task.due}
                      </span>
                    );
                  })()}

                  {/* Move selector + delete — hover only */}
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    <select
                      value={col.id}
                      onChange={(e) => onMove(task.id, e.target.value)}
                      className="appearance-none text-[11px] pl-1.5 pr-3 py-0.5 rounded-[var(--radius-4)] cursor-pointer input-base"
                      style={{ fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}
                    >
                      {columns.map((c) => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => onDelete(task.id)}
                      className="p-0.5 rounded-[var(--radius-4)] transition-colors hover:bg-[var(--color-bg-quaternary)]"
                      style={{ color: "var(--color-text-quaternary)" }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* Chevron */}
                  <ChevronRight size={14} className="shrink-0" style={{ color: "var(--color-text-quaternary)", opacity: 0.5 }} />
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
