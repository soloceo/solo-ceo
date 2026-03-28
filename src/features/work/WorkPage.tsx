import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Filter, LayoutGrid, AlignJustify } from "lucide-react";
import { Skeleton } from "../../components/ui";
import { useT } from "../../i18n/context";
import { useRealtimeRefresh } from "../../hooks/useRealtimeRefresh";
import { useUIStore } from "../../store/useUIStore";
import { KanbanBoard, SwimlaneView, type ColDef } from "./KanbanBoard";
import { TaskDetail, type TaskForm } from "./TaskDetail";
import type { Task } from "./TaskCard";

type TaskMap = Record<string, Task[]>;

const WORK_TABLES = ["tasks"] as const;

export default function WorkPage() {
  const { t } = useT();

  const COLS = useMemo<ColDef[]>(() => [
    { id: "todo", title: t("work.col.todo" as any), color: "var(--color-text-tertiary)" },
    { id: "inProgress", title: t("work.col.inProgress" as any), color: "var(--color-info, #3b82f6)" },
    { id: "review", title: t("work.col.review" as any), color: "var(--color-warning)" },
    { id: "done", title: t("work.col.done" as any), color: "var(--color-success)" },
  ], [t]);

  const [tasks, setTasks] = useState<TaskMap>({ todo: [], inProgress: [], review: [], done: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [filterPriority, setFilterPriority] = useState("All");
  const showToast = useUIStore((s) => s.showToast);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const viewMode = useUIStore((s) => s.tasksViewMode);
  const setViewMode = useUIStore((s) => s.setTasksViewMode);
  const [clientList, setClientList] = useState<any[]>([]);

  // Task detail panel state
  const [showPanel, setShowPanel] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [defaultColumn, setDefaultColumn] = useState("todo");

  useEffect(() => {
    fetch("/api/clients").then((r) => r.json()).then((d) => setClientList(d.filter((c: any) => !c.soft_deleted))).catch(() => {});
  }, []);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      const grouped = data.reduce((acc: any, t: any) => {
        const col = t.column || "todo";
        if (!acc[col]) acc[col] = [];
        acc[col].push(t);
        return acc;
      }, {} as Record<string, any[]>);
      setTasks({
        todo: grouped.todo || [],
        inProgress: grouped.inProgress || [],
        review: grouped.review || [],
        done: grouped.done || [],
      });
    } catch {
      showToast(t("work.loadFailed" as any));
    } finally {
      setIsLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);
  useRealtimeRefresh(WORK_TABLES, fetchTasks);

  /* ── Quick Create listener ── */
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.type === "task") {
        openPanel(null, "todo");
      }
    };
    window.addEventListener("quick-create", handler);
    return () => window.removeEventListener("quick-create", handler);
  }, []);

  /* ── Drag & Drop ── */
  const onDragEnd = async (result: any) => {
    if (!result.destination) return;
    const { source: s, destination: d } = result;
    if (s.droppableId !== d.droppableId) {
      const src = [...tasks[s.droppableId]];
      const dst = [...tasks[d.droppableId]];
      const [moved] = src.splice(s.index, 1);
      moved.column = d.droppableId;
      dst.splice(d.index, 0, moved);
      setTasks({ ...tasks, [s.droppableId]: src, [d.droppableId]: dst });
      try {
        await fetch(`/api/tasks/${moved.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(moved),
        });
      } catch {
        showToast(t("common.updateFailed" as any));
        fetchTasks();
      }
    } else {
      const col = [...tasks[s.droppableId]];
      const [moved] = col.splice(s.index, 1);
      col.splice(d.index, 0, moved);
      setTasks({ ...tasks, [s.droppableId]: col });
    }
  };

  /* ── Panel helpers ── */
  const openPanel = useCallback((task: Task | null = null, col = "todo") => {
    setEditTask(task);
    setDefaultColumn(task?.column || col);
    setShowPanel(true);
  }, []);

  const handleSave = async (form: TaskForm, editId: number | null) => {
    try {
      if (editId) {
        await fetch(`/api/tasks/${editId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        showToast(t("work.taskUpdated" as any));
      } else {
        await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        showToast(t("work.taskAdded" as any));
      }
      fetchTasks();
    } catch {
      showToast(t("common.saveFailed" as any));
    }
  };

  const handleDelete = async (id: number) => {
    // Cache task data before deleting for undo
    const allTasks = Object.values(tasks).flat();
    const cached = allTasks.find(t => t.id === id);
    try {
      await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      fetchTasks();
      showToast(t("work.taskDeleted" as any), 5000, cached ? {
        label: t("common.undo" as any),
        fn: async () => {
          try {
            await fetch("/api/tasks", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: cached.title,
                client: cached.client || "",
                priority: cached.priority,
                due: cached.due || "",
                column: cached.column,
                originalRequest: cached.originalRequest || "",
              }),
            });
            fetchTasks();
          } catch {}
        },
      } : undefined);
    } catch {
      showToast(t("common.deleteFailed" as any));
    }
  };

  const handleMove = async (id: number, col: string) => {
    try {
      const allTasks = Object.values(tasks).flat();
      const task = allTasks.find((t) => t.id === id);
      if (!task) return;
      await fetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...task, column: col }),
      });
      fetchTasks();
    } catch {
      showToast(t("work.moveFailed" as any));
    }
  };

  const applyFilter = (map: TaskMap): TaskMap => {
    if (filterPriority === "All") return map;
    const result: TaskMap = {};
    for (const key of Object.keys(map)) {
      result[key] = map[key].filter((t) => t.priority === filterPriority);
    }
    return result;
  };

  const filteredTasks = applyFilter(tasks);

  /* ── Progress stats ── */
  const totalTasks = Object.values(tasks).flat().length;
  const counts = COLS.map((c) => ({ ...c, count: (tasks[c.id] || []).length }));

  return (
    <div className="mobile-page max-w-[1680px] mx-auto min-h-full flex flex-col px-4 py-3 md:px-6 md:py-4 lg:px-8 lg:py-5 relative">
      {/* Header */}
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-3">
        <div className="flex items-center gap-3">
          <h1 className="page-title">{t("work.pageTitle" as any)}</h1>
          <span className="text-[14px] tabular-nums" style={{ color: "var(--color-text-quaternary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
            {totalTasks}
          </span>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {/* Priority filter */}
          <div className="flex items-center gap-1.5">
            <Filter size={16} style={{ color: "var(--color-text-tertiary)" }} />
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="input-base compact px-2 text-[15px]"
            >
              <option value="All">{t("work.filter.all" as any)}</option>
              <option value="High">{t("work.filter.high" as any)}</option>
              <option value="Medium">{t("work.filter.medium" as any)}</option>
              <option value="Low">{t("work.filter.low" as any)}</option>
            </select>
          </div>

          {/* View mode toggle */}
          <div className="segment-switcher">
            {([
              ["vertical", <LayoutGrid size={14} />],
              ["horizontal", <AlignJustify size={14} />],
            ] as [string, React.ReactNode][]).map(([mode, icon]) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode as "vertical" | "horizontal")}
                data-active={viewMode === mode}
              >
                {icon}
              </button>
            ))}
          </div>

          <button onClick={() => openPanel(null, "todo")} className="btn-primary compact">
            <Plus size={16} /> {t("work.new" as any)}
          </button>
        </div>
      </header>

      {/* Progress bar */}
      {!isLoading && totalTasks > 0 && (
        <div className="mb-3">
          <div className="flex h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-bg-quaternary)" }}>
            {counts.map((c) => (
              c.count > 0 && (
                <div
                  key={c.id}
                  style={{ width: `${(c.count / totalTasks) * 100}%`, background: c.color }}
                  className="transition-all duration-300"
                />
              )
            ))}
          </div>
          <div className="flex gap-3 mt-1.5">
            {counts.map((c) => (
              <div key={c.id} className="flex items-center gap-1.5 text-[13px]" style={{ color: "var(--color-text-tertiary)" }}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: c.color }} />
                <span>{c.title}</span>
                <span className="tabular-nums" style={{ color: "var(--color-text-quaternary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{c.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Board */}
      {isLoading ? (
        <div className="flex-1 flex gap-3 animate-skeleton-in">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-1 min-w-[220px] max-w-[360px] space-y-2">
              <Skeleton className="h-4 w-20" />
              <div className="space-y-1.5 p-1.5 rounded-[var(--radius-12)]" style={{ background: "var(--color-bg-tertiary)" }}>
                <Skeleton className="h-[72px] rounded-[var(--radius-12)]" />
                <Skeleton className="h-[72px] rounded-[var(--radius-12)]" />
              </div>
            </div>
          ))}
        </div>
      ) : viewMode === "vertical" ? (
        <KanbanBoard
          columns={COLS}
          tasks={filteredTasks}
          onDragEnd={onDragEnd}
          onAdd={(col) => openPanel(null, col)}
          onEdit={(task) => openPanel(task, task.column)}
          onDelete={handleDelete}
          onClientClick={() => setActiveTab("clients")}
          emptyText={t("work.empty" as any)}
        />
      ) : (
        <SwimlaneView
          columns={COLS}
          tasks={filteredTasks}
          onAdd={(col) => openPanel(null, col)}
          onEdit={(task) => openPanel(task, task.column)}
          onDelete={handleDelete}
          onMove={handleMove}
          emptyText={t("work.empty" as any)}
        />
      )}

      {/* Task Detail Panel */}
      <TaskDetail
        open={showPanel}
        onClose={() => setShowPanel(false)}
        editTask={editTask}
        columns={COLS}
        defaultColumn={defaultColumn}
        clientList={clientList}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
}
