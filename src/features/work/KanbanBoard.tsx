import React, { useState, useCallback, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useIsTouchPointer } from "../../hooks/useIsTouchPointer";
import { TaskCard, type Task } from "./TaskCard";
import type { ColDef } from "./types";
export type { ColDef };

interface KanbanBoardProps {
  columns: ColDef[];
  tasks: Record<string, Task[]>;
  onDragEnd: (result: { source: { droppableId: string; index: number }; destination?: { droppableId: string; index: number } | null }) => void;
  onAdd: (col: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: number) => void;
  onClientClick?: () => void;
  emptyText: string;
  onPriorityChange?: (id: number, priority: Task["priority"]) => void;
  onDueChange?: (id: number, due: string) => void;
  onColumnChange?: (id: number, col: string) => void;
}

/** Find which column a task ID belongs to */
function findColumn(tasks: Record<string, Task[]>, taskId: string): string | null {
  for (const [colId, items] of Object.entries(tasks)) {
    if (items.some(t => t.id.toString() === taskId)) return colId;
  }
  return null;
}

/** Sortable card wrapper — owns useSortable so transform/layout coexist on the same motion.div (matches LeadsBoard pattern) */
interface SortableTaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (id: number) => void;
  onClientClick?: () => void;
  onPriorityChange?: (id: number, priority: Task["priority"]) => void;
  onDueChange?: (id: number, due: string) => void;
  columns?: ColDef[];
  onColumnChange?: (id: number, col: string) => void;
}

function SortableTaskCard({ task, onEdit, onDelete, onClientClick, onPriorityChange, onDueChange, columns, onColumnChange }: SortableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id.toString() });
  // Outer div owns dnd-kit drag transform. Inner motion.div owns intro/exit animations.
  // Two elements on purpose: a single motion.div with both `initial/animate` (on `scale`) and dnd-kit's
  // `style.transform` causes Framer Motion to composite its motion values on top of dnd-kit's transform,
  // which makes dragged cards offset from the cursor.
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        // With DragOverlay, the active card must NOT carry a transform — otherwise it
        // visually translates away from the cursor while the overlay floats at the cursor.
        // Neighbors still need transform to animate the shift that makes room for the drag.
        transform: isDragging ? undefined : CSS.Transform.toString(transform),
        transition: isDragging ? undefined : transition,
        opacity: isDragging ? 0.4 : 1,
        touchAction: "manipulation",
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
      >
        <TaskCard
          task={task}
          onEdit={onEdit}
          onDelete={onDelete}
          onClientClick={onClientClick}
          onPriorityChange={onPriorityChange}
          onDueChange={onDueChange}
          columns={columns}
          onColumnChange={onColumnChange}
        />
      </motion.div>
    </div>
  );
}

export function KanbanBoard({ columns, tasks, onDragEnd, onAdd, onEdit, onDelete, onClientClick, emptyText, onPriorityChange, onDueChange, onColumnChange }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const isTouch = useIsTouchPointer();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: isTouch ? 99999 : 5 } }),
  );

  const allTasks = useMemo(() => Object.values(tasks).flat(), [tasks]);
  const activeTask = activeId ? allTasks.find(t => t.id.toString() === activeId) : null;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeTaskId = active.id as string;
    const overId = over.id as string;

    // Find source column
    const sourceCol = findColumn(tasks, activeTaskId);
    if (!sourceCol) return;

    // Determine destination: over could be a task ID or a column ID
    let destCol = findColumn(tasks, overId);
    let destIndex = 0;

    if (destCol) {
      // Dropped over a task — find its index
      destIndex = tasks[destCol].findIndex(t => t.id.toString() === overId);
    } else if (columns.some(c => c.id === overId)) {
      // Dropped over an empty column droppable
      destCol = overId;
      destIndex = 0;
    } else {
      return;
    }

    const sourceIndex = tasks[sourceCol].findIndex(t => t.id.toString() === activeTaskId);

    // Translate to source/destination format for WorkPage.onDragEnd
    onDragEnd({
      source: { droppableId: sourceCol, index: sourceIndex },
      destination: { droppableId: destCol, index: destIndex },
    });
  }, [tasks, columns, onDragEnd]);

  return (
    <div className="flex-1 overflow-x-auto overflow-y-hidden ios-scroll pb-4 -mx-4 px-4 md:-mx-6 md:px-6 lg:mx-0 lg:px-0 snap-x snap-mandatory lg:snap-none lg:overflow-x-visible">
      <div className="flex h-full gap-3 min-w-max lg:min-w-0">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {columns.map((col) => (
            <KanbanColumn
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
          <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.25, 1, 0.5, 1)" }}>
            {activeTask ? (
              <TaskCard
                task={activeTask}
                onEdit={() => {}}
                onDelete={() => {}}
                isOverlay
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}

const KanbanColumn = React.memo(function KanbanColumn({ col, items, onAdd, onEdit, onDelete, onClientClick, emptyText, onPriorityChange, onDueChange, columns, onColumnChange }: {
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
  const itemIds = useMemo(() => items.map(t => t.id.toString()), [items]);
  const { setNodeRef: setDropRef } = useDroppable({ id: col.id });

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

      <SortableContext id={col.id} items={itemIds} strategy={verticalListSortingStrategy}>
        <div
          ref={setDropRef}
          className="flex flex-col flex-1 min-h-0 rounded-[var(--radius-8)] overflow-hidden kanban-column"
          role="list"
          style={{
            borderTop: `2px solid ${col.color}`,
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
            <AnimatePresence mode="popLayout">
              {items.map((task) => (
                <SortableTaskCard
                  key={task.id}
                  task={task}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onClientClick={onClientClick}
                  onPriorityChange={onPriorityChange}
                  onDueChange={onDueChange}
                  columns={columns}
                  onColumnChange={onColumnChange}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      </SortableContext>
    </div>
  );
});

/* ── Swimlane View ── */
interface SwimlaneProps {
  columns: ColDef[];
  tasks: Record<string, Task[]>;
  onDragEnd: (result: { source: { droppableId: string; index: number }; destination?: { droppableId: string; index: number } | null }) => void;
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
  const [activeId, setActiveId] = useState<string | null>(null);
  const isTouch = useIsTouchPointer();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: isTouch ? 99999 : 5 } }),
  );

  const allTasks = useMemo(() => Object.values(tasks).flat(), [tasks]);
  const activeTask = activeId ? allTasks.find(t => t.id.toString() === activeId) : null;

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeTaskId = active.id as string;
    const overId = over.id as string;

    let sourceCol: string | null = null;
    for (const [colId, items] of Object.entries(tasks)) {
      if (items.some(t => t.id.toString() === activeTaskId)) { sourceCol = colId; break; }
    }
    if (!sourceCol) return;

    let destCol: string | null = null;
    let destIndex = 0;
    for (const [colId, items] of Object.entries(tasks)) {
      const idx = items.findIndex(t => t.id.toString() === overId);
      if (idx >= 0) { destCol = colId; destIndex = idx; break; }
    }
    if (!destCol && columns.some(c => c.id === overId)) {
      destCol = overId;
      destIndex = 0;
    }
    if (!destCol) return;

    const sourceIndex = tasks[sourceCol].findIndex(t => t.id.toString() === activeTaskId);

    onDragEnd({
      source: { droppableId: sourceCol, index: sourceIndex },
      destination: { droppableId: destCol, index: destIndex },
    });
  }, [tasks, columns, onDragEnd]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={(e) => setActiveId(e.active.id as string)}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-3 pb-4">
        {columns.map((col) => {
          const items = tasks[col.id] || [];
          const itemIds = items.map(t => t.id.toString());
          return (
            <section key={col.id}>
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

              <SortableContext id={col.id} items={itemIds} strategy={verticalListSortingStrategy}>
                <DroppableColumn colId={col.id} color={col.color}>
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
                      <AnimatePresence mode="popLayout">
                        {items.map((task) => (
                          <SortableTaskCard
                            key={task.id}
                            task={task}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onPriorityChange={onPriorityChange}
                            onDueChange={onDueChange}
                            columns={columns}
                            onColumnChange={onColumnChange}
                          />
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </DroppableColumn>
              </SortableContext>
            </section>
          );
        })}
      </div>
      <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.25, 1, 0.5, 1)" }}>
        {activeTask ? (
          <TaskCard
            task={activeTask}
            onEdit={() => {}}
            onDelete={() => {}}
            isOverlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

/** Wrapper that registers a droppable zone for a column */
function DroppableColumn({ colId, color, children }: { colId: string; color: string; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id: colId });
  return (
    <div
      ref={setNodeRef}
      className="rounded-[var(--radius-8)] overflow-hidden"
      style={{
        background: "var(--color-bg-tertiary)",
        borderTop: `2px solid ${color}`,
      }}
    >
      {children}
    </div>
  );
}
