import React, { useState } from "react";
import { createPortal } from "react-dom";
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
  onClientClick?: () => void;
  emptyText: string;
}

export function KanbanBoard({ columns, tasks, onDragEnd, onAdd, onEdit, onDelete, onClientClick, emptyText }: KanbanBoardProps) {
  return (
    <div className="flex-1 overflow-x-auto overflow-y-hidden ios-scroll pb-4 -mx-4 px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8 snap-x snap-mandatory lg:snap-none">
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
              onClientClick={onClientClick}
              emptyText={emptyText}
            />
          ))}
        </DragDropContext>
      </div>
    </div>
  );
}

function Column({ col, items, onAdd, onEdit, onDelete, onClientClick, emptyText }: {
  col: ColDef;
  items: Task[];
  onAdd: () => void;
  onEdit: (task: Task) => void;
  onDelete: (id: number) => void;
  onClientClick?: () => void;
  emptyText: string;
}) {
  return (
    <div className="flex flex-col min-w-[240px] flex-1 max-w-[320px] h-full snap-start" role="region" aria-label={col.title}>
      {/* Column header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-[var(--radius-2)]" style={{ background: col.color }} />
          <h3 className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>
            {col.title}
          </h3>
          <span className="text-[13px] tabular-nums" style={{ color: "var(--color-text-tertiary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
            {items.length}
          </span>
        </div>
        <button onClick={onAdd} className="btn-icon-sm" aria-label={`Add task to ${col.title}`}>
          <Plus size={14} />
        </button>
      </div>

      <Droppable droppableId={col.id}>
        {(provided, snapshot) => (
          <div
            {...provided.droppableProps}
            ref={provided.innerRef}
            className="flex flex-col flex-1 min-h-0 rounded-[var(--radius-12)] overflow-hidden"
            role="list"
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
                  className="py-8 w-full text-center text-[13px] transition-colors hover:bg-[var(--color-bg-quaternary)] rounded-[var(--radius-6)]"
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
                    <TaskCard task={task} provided={prov} snapshot={snap} onEdit={onEdit} onDelete={onDelete} onClientClick={onClientClick} />
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

const prioLabel: Record<string, { zh: string; en: string; color: string }> = {
  High: { zh: "高", en: "H", color: "var(--color-danger)" },
  Medium: { zh: "中", en: "M", color: "var(--color-warning)" },
  Low: { zh: "低", en: "L", color: "var(--color-success)" },
};

export function SwimlaneView({ columns, tasks, onAdd, onEdit, onDelete, onMove, emptyText }: SwimlaneProps) {
  const { t, lang } = useT();
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  return (
    <>
    <div className="space-y-3 pb-4">
      {columns.map((col) => {
        const items = tasks[col.id] || [];
        return (
          <section key={col.id}>
            {/* Section header */}
            <div className="flex items-center justify-between mb-1 px-1">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-[var(--radius-2)]" style={{ background: col.color }} />
                <h3 className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>
                  {col.title}
                </h3>
                <span className="text-[13px] tabular-nums" style={{ color: "var(--color-text-tertiary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
                  {items.length}
                </span>
              </div>
              <button onClick={() => onAdd(col.id)} className="btn-icon-sm" aria-label="Add task">
                <Plus size={14} />
              </button>
            </div>

            {/* List rows */}
            <div className="card overflow-hidden divide-y divide-[var(--color-line-secondary)]">
              {!items.length ? (
                <div className="px-4 py-4 text-[14px] text-center" style={{ color: "var(--color-text-quaternary)" }}>
                  {emptyText}
                </div>
              ) : items.map((task) => (
                <div
                  key={task.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onEdit(task)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onEdit(task); } }}
                  className="flex items-center gap-3 px-3 py-2.5 group cursor-pointer transition-colors hover:bg-[var(--color-bg-tertiary)] press-feedback"
                >
                  {/* Priority label */}
                  <span className="text-[11px] shrink-0" style={{ color: prioLabel[task.priority]?.color || "var(--color-text-quaternary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
                    {prioLabel[task.priority]?.[lang as "zh" | "en"] || ""}
                  </span>

                  {/* Title + client */}
                  <div className="flex-1 min-w-0">
                    <span className="text-[15px] truncate block" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
                      {task.title}
                    </span>
                    {task.client && (
                      <span className="text-[13px] truncate block" style={{ color: "var(--color-text-tertiary)" }}>{task.client}</span>
                    )}
                  </div>

                  {/* Due date badge */}
                  {task.due && (() => {
                    const today = new Date().toISOString().split("T")[0];
                    const isOverdue = task.due < today;
                    const isToday = task.due === today;
                    return (
                      <span
                        className="badge text-[13px] shrink-0"
                        style={isOverdue ? { background: "var(--color-danger-light)", color: "var(--color-danger)" } : isToday ? { background: "var(--color-warning-light)", color: "var(--color-warning)" } : undefined}
                      >
                        {task.due}
                      </span>
                    );
                  })()}

                  {/* Move selector + delete — always visible on mobile, hover on desktop */}
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <select
                      value={col.id}
                      onChange={(e) => onMove(task.id, e.target.value)}
                      className="input-base compact cursor-pointer text-[15px] px-2"
                      style={{ fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}
                    >
                      {columns.map((c) => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>
                    {confirmDeleteId === task.id ? (
                      <div className="flex gap-1">
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
                        onClick={() => setConfirmDeleteId(task.id)}
                        className="btn-icon-sm"
                        aria-label="Delete task"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
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
    {confirmDeleteId !== null && createPortal(
      <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 710, background: "var(--color-overlay-primary)", paddingBottom: "max(env(safe-area-inset-bottom, 0px), 16px)" }}>
        <div className="card-elevated w-full max-w-sm p-5 rounded-[var(--radius-6)]" role="dialog" aria-modal="true" aria-label="Confirm delete">
          <h3 className="text-[15px] mb-2" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{t("common.confirmDelete" as any)}</h3>
          <p className="text-[14px] mb-4" style={{ color: "var(--color-text-secondary)" }}>{t("common.cannotUndo" as any)}</p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setConfirmDeleteId(null)} className="btn-secondary text-[14px]">{t("common.cancel" as any)}</button>
            <button onClick={() => {
              onDelete(confirmDeleteId);
              setConfirmDeleteId(null);
            }} className="text-[14px] px-4 py-2 rounded-[var(--radius-6)]" style={{ background: "var(--color-danger)", color: "var(--color-text-on-color)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>{t("common.confirm" as any)}</button>
          </div>
        </div>
      </div>,
      document.body,
    )}
    </>
  );
}
