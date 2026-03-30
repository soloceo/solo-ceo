import React from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Plus } from "lucide-react";
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
  /** Inline priority change */
  onPriorityChange?: (id: number, priority: Task["priority"]) => void;
  /** Inline due date change */
  onDueChange?: (id: number, due: string) => void;
  /** Move task to a specific column */
  onColumnChange?: (id: number, col: string) => void;
}

export function KanbanBoard({ columns, tasks, onDragEnd, onAdd, onEdit, onDelete, onClientClick, emptyText, onPriorityChange, onDueChange, onColumnChange }: KanbanBoardProps) {
  return (
    <div className="flex-1 overflow-x-auto overflow-y-hidden ios-scroll pb-4 -mx-4 px-4 md:-mx-6 md:px-6 lg:mx-0 lg:px-0 snap-x snap-mandatory lg:snap-none lg:overflow-x-visible">
      <div className="flex h-full gap-3 min-w-max lg:min-w-0">
        <DragDropContext onDragEnd={onDragEnd}>
          {columns.map((col, colIdx) => (
            <Column
              key={col.id}
              col={col}
              items={tasks[col.id] || []}
              onAdd={() => onAdd(col.id)}
              onEdit={onEdit}
              onDelete={onDelete}
              onClientClick={onClientClick}
              emptyText={emptyText}
              onPriorityChange={onPriorityChange}
              onDueChange={onDueChange}
              columns={columns}
              onColumnChange={onColumnChange}
            />
          ))}
        </DragDropContext>
      </div>
    </div>
  );
}

function Column({ col, items, onAdd, onEdit, onDelete, onClientClick, emptyText, onPriorityChange, onDueChange, columns, onColumnChange }: {
  key?: React.Key;
  col: ColDef;
  items: Task[];
  onAdd: () => void;
  onEdit: (task: Task) => void;
  onDelete: (id: number) => void;
  onClientClick?: () => void;
  emptyText: string;
  onPriorityChange?: (id: number, priority: Task["priority"]) => void;
  onDueChange?: (id: number, due: string) => void;
  columns?: ColDef[];
  onColumnChange?: (id: number, col: string) => void;
}) {
  return (
    <div className="flex flex-col flex-1 min-w-[240px] lg:min-w-0 h-full snap-start lg:snap-align-none" role="region" aria-label={col.title}>
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
            className="flex flex-col flex-1 min-h-0 rounded-[var(--radius-8)] overflow-hidden"
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
                  className="py-6 w-full text-center text-[13px] transition-colors hover:bg-[var(--color-bg-quaternary)] rounded-[var(--radius-6)] mx-auto my-1.5"
                  style={{ color: "var(--color-text-quaternary)", border: "1px dashed var(--color-border-primary)", background: "transparent" }}
                >
                  <Plus size={15} className="mx-auto mb-0.5" style={{ opacity: 0.4 }} />
                  {emptyText}
                </button>
              )}
              {items.map((task, i) => (
                // @ts-expect-error React 19 type issue with Draggable
                <Draggable key={task.id.toString()} draggableId={task.id.toString()} index={i}>
                  {(prov: any, snap: any) => (
                    <TaskCard
                      task={task} provided={prov} snapshot={snap}
                      onEdit={onEdit} onDelete={onDelete} onClientClick={onClientClick}
                      onPriorityChange={onPriorityChange}
                      onDueChange={onDueChange}
                      columns={columns}
                      onColumnChange={onColumnChange}
                    />
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

/* ── Swimlane View — reuses TaskCard with drag-and-drop ── */
interface SwimlaneProps {
  columns: ColDef[];
  tasks: Record<string, Task[]>;
  onDragEnd: (result: any) => void;
  onAdd: (col: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: number) => void;
  onMove: (id: number, col: string) => void;
  emptyText: string;
  onPriorityChange?: (id: number, priority: Task["priority"]) => void;
  onDueChange?: (id: number, due: string) => void;
  onColumnChange?: (id: number, col: string) => void;
}

export function SwimlaneView({ columns, tasks, onDragEnd, onAdd, onEdit, onDelete, onMove, emptyText, onPriorityChange, onDueChange, onColumnChange }: SwimlaneProps) {
  return (
    <DragDropContext onDragEnd={onDragEnd}>
    <div className="space-y-3 pb-4">
      {columns.map((col, colIdx) => {
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

            {/* Droppable list */}
            <Droppable droppableId={col.id}>
              {(droppableProvided, droppableSnapshot) => (
                <div
                  {...droppableProvided.droppableProps}
                  ref={droppableProvided.innerRef}
                  className="rounded-[var(--radius-8)] overflow-hidden"
                  style={{
                    background: droppableSnapshot.isDraggingOver ? "var(--color-accent-tint)" : "var(--color-bg-tertiary)",
                    borderTop: `2px solid ${col.color}`,
                    transition: "background var(--speed-quick) var(--ease-out-quad)",
                  }}
                >
                  {!items.length ? (
                    <button
                      onClick={() => onAdd(col.id)}
                      className="py-6 w-full text-center text-[13px] transition-colors hover:bg-[var(--color-bg-quaternary)] rounded-[var(--radius-6)] mx-auto my-1.5"
                      style={{ color: "var(--color-text-quaternary)", border: "1px dashed var(--color-border-primary)", background: "transparent" }}
                    >
                      <Plus size={15} className="mx-auto mb-0.5" style={{ opacity: 0.4 }} />
                      {emptyText}
                    </button>
                  ) : (
                    <div className="p-1.5 space-y-1">
                      {items.map((task, i) => (
                        // @ts-expect-error React 19 type issue with Draggable
                        <Draggable key={task.id.toString()} draggableId={task.id.toString()} index={i}>
                          {(provided: any, snapshot: any) => (
                            <TaskCard
                              task={task} provided={provided} snapshot={snapshot}
                              onEdit={onEdit} onDelete={onDelete}
                              onPriorityChange={onPriorityChange}
                              onDueChange={onDueChange}
                              columns={columns}
                              onColumnChange={onColumnChange}
                            />
                          )}
                        </Draggable>
                      ))}
                    </div>
                  )}
                  {droppableProvided.placeholder}
                </div>
              )}
            </Droppable>
          </section>
        );
      })}
    </div>
    </DragDropContext>
  );
}
