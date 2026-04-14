import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Plus, Filter, LayoutGrid, AlignJustify, Bot, Send, Loader2, Download } from "lucide-react";
import { usePullToRefresh } from "../../hooks/usePullToRefresh";
import { useIsMobile } from "../../hooks/useIsMobile";
import { exportCSV } from "../../lib/csv-export";
import { useAppSettings } from "../../hooks/useAppSettings";
import { parseWorkTask, getAIConfig, type AIProvider } from "../../lib/ai-client";
import { api } from "../../lib/api";
import { Skeleton } from "../../components/ui";
import { useT } from "../../i18n/context";
import { useRealtimeRefresh } from "../../hooks/useRealtimeRefresh";
import { useUIStore } from "../../store/useUIStore";
import { KanbanBoard, SwimlaneView, type ColDef } from "./KanbanBoard";
import { TaskDetail, type TaskForm } from "./TaskDetail";
import type { Task } from "./TaskCard";

type TaskMap = Record<string, Task[]>;

interface ClientItem {
  id: number;
  name: string;
  company_name?: string;
  [key: string]: unknown;
}

const WORK_TABLES = ["tasks"] as const;

export default function WorkPage() {
  const { t, lang } = useT();

  const COLS = useMemo<ColDef[]>(() => [
    { id: "todo", title: t("work.col.todo"), color: "var(--color-text-tertiary)" },
    { id: "inProgress", title: t("work.col.inProgress"), color: "var(--color-info)" },
    { id: "review", title: t("work.col.review"), color: "var(--color-warning)" },
    { id: "done", title: t("work.col.done"), color: "var(--color-success)" },
  ], [t]);

  const { settings: appSettings } = useAppSettings();
  const [aiInput, setAiInput] = useState("");
  const [aiParsing, setAiParsing] = useState(false);
  const [tasks, setTasks] = useState<TaskMap>({ todo: [], inProgress: [], review: [], done: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [filterPriority, setFilterPriority] = useState("All");
  const showToast = useUIStore((s) => s.showToast);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const isMobile = useIsMobile();
  const storeViewMode = useUIStore((s) => s.tasksViewMode);
  const setStoreViewMode = useUIStore((s) => s.setTasksViewMode);
  // Mobile defaults to list (horizontal); desktop uses persisted store value
  const [mobileViewMode, setMobileViewMode] = useState<"vertical" | "horizontal">("horizontal");
  const viewMode = isMobile ? mobileViewMode : storeViewMode;
  const setViewMode = isMobile ? setMobileViewMode : setStoreViewMode;
  const [clientList, setClientList] = useState<ClientItem[]>([]);

  // Task detail panel state
  const [showPanel, setShowPanel] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [defaultColumn, setDefaultColumn] = useState("todo");

  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;
  const tRef = useRef(t);
  tRef.current = t;

  const fetchTasks = useCallback(async () => {
    try {
      const raw = await api.get<Task[]>("/api/tasks");
      const data = Array.isArray(raw) ? raw as Task[] : [];
      // Group work tasks only (exclude personal + work-memo) for kanban
      const workData = data.filter((t: Task) => t.scope !== "personal" && t.scope !== "work-memo");
      const grouped = workData.reduce((acc: TaskMap, t: Task) => {
        const col = t.column || "todo";
        if (!acc[col]) acc[col] = [];
        acc[col].push(t);
        return acc;
      }, {} as TaskMap);
      setTasks({
        todo: grouped.todo || [],
        inProgress: grouped.inProgress || [],
        review: grouped.review || [],
        done: grouped.done || [],
      });
      // Notify other components (e.g. MiniCalendarWidget) that tasks changed
      window.dispatchEvent(new CustomEvent("tasks-changed"));
    } catch (e) {
      console.warn('[WorkPage] fetchTasks', e);
      showToastRef.current(tRef.current("work.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Parallel load: tasks + clients
    Promise.all([
      fetchTasks(),
      api.get<ClientItem[]>("/api/clients")
        .then((d) => setClientList(Array.isArray(d) ? d.filter((c: ClientItem) => !c.soft_deleted) : []))
        .catch(() => { /* client list unavailable */ }),
    ]);
  }, [fetchTasks]);
  useRealtimeRefresh(WORK_TABLES, fetchTasks);

  const scrollRef = useRef<HTMLDivElement>(null);
  usePullToRefresh(scrollRef, fetchTasks);

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
  const onDragEnd = async (result: { source: { droppableId: string; index: number }; destination?: { droppableId: string; index: number } | null }) => {
    if (!result.destination) return;
    const { source: s, destination: d } = result;
    if (s.droppableId !== d.droppableId) {
      const src = [...tasks[s.droppableId]];
      const dst = [...tasks[d.droppableId]];
      const [moved] = src.splice(s.index, 1);
      moved.column = d.droppableId;
      dst.splice(d.index, 0, moved);
      const prev = { ...tasks };
      setTasks({ ...tasks, [s.droppableId]: src, [d.droppableId]: dst });
      try {
        await api.put(`/api/tasks/${moved.id}`, { column: d.droppableId });
      } catch (e) {
        console.warn('[WorkPage] onDragEnd', e);
        showToast(t("common.updateFailed"));
        setTasks(prev);
      }
    } else {
      const col = [...tasks[s.droppableId]];
      const [moved] = col.splice(s.index, 1);
      col.splice(d.index, 0, moved);
      setTasks({ ...tasks, [s.droppableId]: col });

      // TODO: Same-column reorder persistence requires sort_order field in schema.
      // Currently the database sorts tasks by created_at DESC, so reordering within
      // a column will not persist on page refresh. To fix this:
      // 1. Add sort_order INTEGER field to tasks table
      // 2. After reordering, PATCH all affected tasks with updated sort_order values
      // 3. Fetch tasks ordered by sort_order, then created_at DESC as fallback
    }
  };

  /* ── Panel helpers ── */
  const handleAiTask = async () => {
    const text = aiInput.trim();
    if (!text) return;
    const aiConfig = getAIConfig(appSettings);
    if (!aiConfig) {
      showToast(t("work.ai.noKey"), 5000, {
        label: t("common.goSettings"),
        fn: () => setActiveTab("settings"),
      });
      return;
    }
    const { provider, apiKey } = aiConfig;
    setAiParsing(true);
    try {
      const clientNames = clientList.map((c: ClientItem) => c.company_name || c.name).filter(Boolean);
      const parsed = await parseWorkTask(text, clientNames, lang, provider, apiKey) as { title: string; client?: string; priority: string; due?: string; column: string; originalRequest: string };
      // Resolve client_id from parsed client name
      const matchedClient = parsed.client ? clientList.find((c: ClientItem) => (c.company_name || c.name) === parsed.client) : null;
      await api.post("/api/tasks", { ...parsed, client_id: matchedClient?.id || null, scope: "work" });
      showToast(`✓ ${t("work.ai.created")}: ${parsed.title}`);
      setAiInput("");
      fetchTasks();
    } catch (e) {
      console.warn('[WorkPage] handleAiTask', e);
      showToast(t("work.ai.genFailed"));
    } finally {
      setAiParsing(false);
    }
  };

  const openPanel = useCallback((task: Task | null = null, col = "todo") => {
    setEditTask(task);
    setDefaultColumn(task?.column || col);
    setShowPanel(true);
  }, []);

  /* ── Navigate-to-entity listener (from TodayFocus) ── */
  useEffect(() => {
    const handler = (e: Event) => {
      const { type, id } = (e as CustomEvent).detail || {};
      if (type === "task" && id) {
        const all = (Object.values(tasks) as Task[][]).flat();
        const target = all.find((t) => t.id === id);
        if (target) openPanel(target, target.column);
      }
    };
    window.addEventListener("navigate-to-entity", handler);
    return () => window.removeEventListener("navigate-to-entity", handler);
  }, [tasks, openPanel]);

  const handleSave = async (form: TaskForm, editId: number | null) => {
    try {
      if (editId && editTask) {
        // Rule 13: only send changed fields to avoid stale-data overwrites
        const diff: Record<string, unknown> = {};
        if (form.title !== (editTask.title || '')) diff.title = form.title;
        if (form.client !== (editTask.client || '')) diff.client = form.client;
        if ((form.client_id ?? null) !== (editTask.client_id ?? null)) diff.client_id = form.client_id;
        if (form.priority !== (editTask.priority || '')) diff.priority = form.priority;
        if ((form.due || '') !== (editTask.due || '')) diff.due = form.due;
        if (form.column !== (editTask.column || '')) diff.column = form.column;
        if (form.originalRequest !== (editTask.originalRequest || '')) diff.originalRequest = form.originalRequest;
        if (Object.keys(diff).length > 0) {
          await api.put(`/api/tasks/${editId}`, diff);
        }
        showToast(t("work.taskUpdated"));
      } else if (editId) {
        await api.put(`/api/tasks/${editId}`, form);
        showToast(t("work.taskUpdated"));
      } else {
        await api.post("/api/tasks", form);
        showToast(t("work.taskAdded"));
      }
      fetchTasks();
    } catch (e) {
      console.warn('[WorkPage] handleSave', e);
      showToast(t("common.saveFailed"));
    }
  };

  const handleDelete = async (id: number) => {
    // Cache task data before deleting for undo
    const allTasks: Task[] = (Object.values(tasks) as Task[][]).flat();
    const cached = allTasks.find(t => t.id === id);
    try {
      await api.del(`/api/tasks/${id}`);
      fetchTasks();
      showToast(t("work.taskDeleted"), 5000, cached ? {
        label: t("common.undo"),
        fn: async () => {
          try {
            await api.post("/api/tasks", {
              title: cached.title,
              client: cached.client || "",
              client_id: cached.client_id || null,
              priority: cached.priority,
              due: cached.due || "",
              column: cached.column,
              scope: cached.scope || "work",
              originalRequest: cached.originalRequest || "",
            });
            fetchTasks();
          } catch (e) { console.warn('[WorkPage] undoDelete', e); }
        },
      } : undefined);
    } catch (e) {
      console.warn('[WorkPage] handleDelete', e);
      showToast(t("common.deleteFailed"));
    }
  };

  const handleMove = async (id: number, col: string) => {
    try {
      await api.put(`/api/tasks/${id}`, { column: col });
      fetchTasks();
    } catch (e) {
      console.warn('[WorkPage] handleMove', e);
      showToast(t("work.moveFailed"));
    }
  };

  /** Inline priority change (immutable update — no in-place mutation) */
  const handlePriorityChange = async (id: number, priority: string) => {
    const newTasks: TaskMap = {};
    for (const [col, list] of Object.entries(tasks)) {
      newTasks[col] = list.map(t => t.id === id ? { ...t, priority: priority as Task["priority"] } : t);
    }
    setTasks(newTasks);
    try {
      await api.put(`/api/tasks/${id}`, { priority });
    } catch (e) { console.warn('[WorkPage] handlePriorityChange', e); showToast(t("common.updateFailed")); fetchTasks(); }
  };

  /** Inline due date change (immutable update — no in-place mutation) */
  const handleDueChange = async (id: number, due: string) => {
    const newTasks: TaskMap = {};
    for (const [col, list] of Object.entries(tasks)) {
      newTasks[col] = list.map(t => t.id === id ? { ...t, due: due || undefined } : t);
    }
    setTasks(newTasks);
    try {
      await api.put(`/api/tasks/${id}`, { due: due || null });
    } catch (e) { console.warn('[WorkPage] handleDueChange', e); showToast(t("common.updateFailed")); fetchTasks(); }
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

  /* ── Progress stats (memoized) ── */
  const totalTasks = useMemo(() => (Object.values(tasks) as Task[][]).flat().length, [tasks]);
  const counts = useMemo(() => COLS.map((c) => ({ ...c, count: (tasks[c.id] || []).length })), [tasks]);

  /* ── Task toolbar + AI input + progress (task-related controls, above kanban) ── */
  const renderTaskControls = () => (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <div className="flex items-center gap-1.5 shrink-0">
          <Filter size={14} style={{ color: "var(--color-text-tertiary)" }} />
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            aria-label={t("work.filter.all")}
            className="input-base compact px-2 text-[14px]"
          >
            <option value="All">{t("work.filter.all")}</option>
            <option value="High">{t("work.filter.high")}</option>
            <option value="Medium">{t("work.filter.medium")}</option>
            <option value="Low">{t("work.filter.low")}</option>
          </select>
        </div>
        <div className="page-tabs" role="tablist">
          {([
            ["vertical", <LayoutGrid size={14} />, "Board view"],
            ["horizontal", <AlignJustify size={14} />, "List view"],
          ] as [string, React.ReactNode, string][]).map(([mode, icon, label]) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode as "vertical" | "horizontal")}
              data-active={viewMode === mode}
              role="tab"
              aria-selected={viewMode === mode}
              aria-label={label}
            >
              {icon}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button onClick={() => {
          const all: Task[] = (Object.values(tasks) as Task[][]).flat();
          exportCSV(all.map(t => ({ title: t.title, client: t.client, priority: t.priority, due: t.due, column: t.column })), "tasks", [
            { key: "title", label: "Title" }, { key: "client", label: "Client" }, { key: "priority", label: "Priority" }, { key: "due", label: "Due" }, { key: "column", label: "Status" },
          ]);
        }} className="btn-ghost compact" aria-label={t("common.export")}><Download size={16} /></button>
        <button onClick={() => openPanel(null, "todo")} className="btn-primary compact">
          <Plus size={16} /> <span className="hidden sm:inline">{t("work.new")}</span>
        </button>
      </div>

      {/* AI task input */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Bot size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-text-quaternary)" }} />
          <input
            type="text"
            value={aiInput}
            onChange={e => setAiInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) handleAiTask(); }}
            placeholder={t("work.ai.placeholder")}
            disabled={aiParsing}
            aria-label={t("work.ai.placeholder")}
            className="input-base w-full pl-9 pr-3 py-2.5 text-[15px]"
          />
        </div>
        <button onClick={handleAiTask} disabled={!aiInput.trim() || aiParsing} className="btn-primary compact text-[14px] shrink-0 disabled:opacity-40">
          {aiParsing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
      </div>

      {/* Progress bar — directly above kanban, visually grouped */}
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
    </>
  );

  return (
    <div ref={scrollRef} className="mobile-page max-w-[1680px] mx-auto min-h-full flex flex-col p-4 md:px-6 md:pb-6 md:pt-0 lg:px-8 lg:pb-8 lg:pt-0 relative">
      <h1 className="sr-only">{t("nav.work")}</h1>

      <div className="flex-1 flex flex-col">
        {renderTaskControls()}
        <h2 className="sr-only">{t("nav.work")}</h2>

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
          <div key="kanban" className="anim-fade flex-1 flex flex-col"><KanbanBoard
            columns={COLS}
            tasks={filteredTasks}
            onDragEnd={onDragEnd}
            onAdd={(col) => openPanel(null, col)}
            onEdit={(task) => openPanel(task, task.column)}
            onDelete={handleDelete}
            onClientClick={() => setActiveTab("clients")}
            emptyText={t("work.empty")}
            onPriorityChange={handlePriorityChange}
            onDueChange={handleDueChange}
            onColumnChange={handleMove}
          /></div>
        ) : (
          <div key="swimlane" className="anim-fade flex-1 flex flex-col"><SwimlaneView
            columns={COLS}
            tasks={filteredTasks}
            onDragEnd={onDragEnd}
            onAdd={(col) => openPanel(null, col)}
            onEdit={(task) => openPanel(task, task.column)}
            onDelete={handleDelete}
            onMove={handleMove}
            emptyText={t("work.empty")}
            onPriorityChange={handlePriorityChange}
            onDueChange={handleDueChange}
            onColumnChange={handleMove}
          /></div>
        )}
      </div>

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
