import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Filter, LayoutGrid, AlignJustify, Building2, User as UserIcon, Bot, Send, Loader2, Download } from "lucide-react";
import { useSwipeTabs } from "../../hooks/useSwipeTabs";
import { useIsMobile } from "../../hooks/useIsMobile";
import { exportCSV } from "../../lib/csv-export";
import { useAppSettings } from "../../hooks/useAppSettings";
import { parseWorkTask, AI_KEY_MAP, type AIProvider } from "../../lib/ai-client";
import { Skeleton } from "../../components/ui";
import { useT } from "../../i18n/context";
import { useRealtimeRefresh } from "../../hooks/useRealtimeRefresh";
import { useUIStore } from "../../store/useUIStore";
import { KanbanBoard, SwimlaneView, type ColDef } from "./KanbanBoard";
import { TaskDetail, type TaskForm } from "./TaskDetail";
import WorkMemoList from "./WorkMemoList";
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
  const TABS = ["work", "personal"] as const;
  const { activeTab: workTab, setActiveTab: setWorkTab, switchTo: switchWorkTab, swipeRef: workSwipeRef, handleScroll: handleWorkScroll, onTouchStart: handleWorkTouchStart, onTouchMove: handleWorkTouchMove } = useSwipeTabs(TABS, "work");
  const [allTasks, setAllTasks] = useState<Task[]>([]);
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

  useEffect(() => {
    fetch("/api/clients").then((r) => r.json()).then((d) => setClientList(Array.isArray(d) ? d.filter((c: ClientItem) => !c.soft_deleted) : [])).catch(() => { /* client list unavailable */ });
  }, []);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks");
      const raw = await res.json();
      const data = Array.isArray(raw) ? raw : [];
      setAllTasks(data);
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
      showToast(t("work.loadFailed"));
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
        switchWorkTab("work");
        openPanel(null, "todo");
      } else if (detail?.type === "personal-task") {
        switchWorkTab("personal");
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
      setTasks({ ...tasks, [s.droppableId]: src, [d.droppableId]: dst });
      try {
        await fetch(`/api/tasks/${moved.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(moved),
        });
      } catch (e) {
        console.warn('[WorkPage] onDragEnd', e);
        showToast(t("common.updateFailed"));
        fetchTasks();
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
    const provider = appSettings?.ai_provider as AIProvider | undefined;
    const keyMap = AI_KEY_MAP;
    const apiKey = provider ? appSettings?.[keyMap[provider]] : undefined;
    if (!provider || !apiKey) {
      showToast(t("work.ai.noKey"), 5000, {
        label: t("common.goSettings"),
        fn: () => setActiveTab("settings"),
      });
      return;
    }
    setAiParsing(true);
    try {
      const clientNames = clientList.map((c: ClientItem) => c.company_name || c.name).filter(Boolean);
      const parsed = await parseWorkTask(text, clientNames, lang, provider, apiKey) as { title: string; client?: string; priority: string; due?: string; column: string; originalRequest: string };
      // Resolve client_id from parsed client name
      const matchedClient = parsed.client ? clientList.find((c: ClientItem) => (c.company_name || c.name) === parsed.client) : null;
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...parsed, client_id: matchedClient?.id || null, scope: "work" }),
      });
      showToast(`✓ ${t("work.ai.created")}: ${parsed.title}`);
      setAiInput("");
      fetchTasks();
    } catch (e) {
      console.warn('[WorkPage] handleAiTask', e);
      showToast("AI failed");
    } finally {
      setAiParsing(false);
    }
  };

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
        showToast(t("work.taskUpdated"));
      } else {
        await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
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
      await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      fetchTasks();
      showToast(t("work.taskDeleted"), 5000, cached ? {
        label: t("common.undo"),
        fn: async () => {
          try {
            await fetch("/api/tasks", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: cached.title,
                client: cached.client || "",
                client_id: cached.client_id || null,
                priority: cached.priority,
                due: cached.due || "",
                column: cached.column,
                originalRequest: cached.originalRequest || "",
              }),
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
      const allTasks: Task[] = (Object.values(tasks) as Task[][]).flat();
      const task = allTasks.find((t) => t.id === id);
      if (!task) return;
      await fetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...task, column: col }),
      });
      fetchTasks();
    } catch (e) {
      console.warn('[WorkPage] handleMove', e);
      showToast(t("work.moveFailed"));
    }
  };

  /** Inline priority change */
  const handlePriorityChange = async (id: number, priority: string) => {
    const allTasks = (Object.values(tasks) as Task[][]).flat();
    const task = allTasks.find(t => t.id === id);
    if (!task) return;
    task.priority = priority as Task["priority"];
    setTasks({ ...tasks });
    try {
      await fetch(`/api/tasks/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...task, priority }) });
    } catch (e) { console.warn('[WorkPage] handlePriorityChange', e); showToast(t("common.updateFailed")); fetchTasks(); }
  };

  /** Inline due date change */
  const handleDueChange = async (id: number, due: string) => {
    const allTasks = (Object.values(tasks) as Task[][]).flat();
    const task = allTasks.find(t => t.id === id);
    if (!task) return;
    task.due = due || undefined;
    setTasks({ ...tasks });
    try {
      await fetch(`/api/tasks/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...task, due: due || null }) });
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

  /* ── Progress stats ── */
  const totalTasks = (Object.values(tasks) as Task[][]).flat().length;
  const counts = COLS.map((c) => ({ ...c, count: (tasks[c.id] || []).length }));

  /* ── Shared toolbar + AI + memo + progress (used by both mobile-kanban and swipe branches) ── */
  const renderWorkHeader = () => (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <div className="flex items-center gap-1.5 shrink-0">
          <Filter size={14} style={{ color: "var(--color-text-tertiary)" }} />
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="input-base compact px-2 text-[14px]"
          >
            <option value="All">{t("work.filter.all")}</option>
            <option value="High">{t("work.filter.high")}</option>
            <option value="Medium">{t("work.filter.medium")}</option>
            <option value="Low">{t("work.filter.low")}</option>
          </select>
        </div>
        <div className="segment-switcher">
          {([
            ["vertical", <LayoutGrid size={14} />, "Board view"],
            ["horizontal", <AlignJustify size={14} />, "List view"],
          ] as [string, React.ReactNode, string][]).map(([mode, icon, label]) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode as "vertical" | "horizontal")}
              data-active={viewMode === mode}
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
        }} className="btn-ghost compact"><Download size={16} /></button>
        <button onClick={() => openPanel(null, "todo")} className="btn-primary compact">
          <Plus size={16} /> <span className="hidden sm:inline">{t("work.new")}</span>
        </button>
      </div>

      {/* AI task input */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Bot size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-accent)" }} />
          <input
            type="text"
            value={aiInput}
            onChange={e => setAiInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) handleAiTask(); }}
            placeholder={t("work.ai.placeholder")}
            disabled={aiParsing}
            className="input-base w-full pl-9 pr-3 py-2.5 text-[15px]"
          />
        </div>
        <button onClick={handleAiTask} disabled={!aiInput.trim() || aiParsing} className="btn-primary compact text-[14px] shrink-0 disabled:opacity-40">
          {aiParsing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
      </div>

      {/* Work Memo */}
      <WorkMemoList tasks={allTasks} onRefresh={fetchTasks} />

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
    </>
  );

  return (
    <div className="mobile-page max-w-[1680px] mx-auto min-h-full flex flex-col p-4 md:p-6 lg:p-8 relative">
      <h1 className="sr-only">{t("nav.work")}</h1>

      {/* ── Segmented Tab Switcher ── */}
      <div className="flex items-center gap-1 p-0.5 rounded-[var(--radius-8)] mb-2" style={{ background: "var(--color-bg-tertiary)" }}>
        {(["work", "personal"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => switchWorkTab(tab)}
            className="flex-1 text-center py-1.5 px-3 rounded-[var(--radius-6)] text-[13px] transition-all flex items-center justify-center gap-1.5"
            style={{
              background: workTab === tab ? "var(--color-bg-primary)" : "transparent",
              color: workTab === tab ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
              fontWeight: workTab === tab ? "var(--font-weight-semibold)" : "var(--font-weight-medium)",
              boxShadow: workTab === tab ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            } as React.CSSProperties}
          >
            {tab === "work" ? <Building2 size={13} /> : <UserIcon size={13} />}
            {tab === "work" ? t("work.tab.work") : t("work.tab.personal")}
          </button>
        ))}
      </div>

      {/* ── Swipeable Panel Container ── */}
      {/* Mobile kanban: render outside swipe container to avoid nested horizontal scroll conflict */}
      {isMobile && viewMode === "vertical" ? (
        <div className="flex-1 flex flex-col">
          {renderWorkHeader()}
          <KanbanBoard
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
          />
        </div>
      ) : (
      <div
        ref={workSwipeRef}
        onScroll={handleWorkScroll}
        onTouchStart={handleWorkTouchStart}
        onTouchMove={handleWorkTouchMove}
        className="home-swipe-container flex-1"
      >
        {/* Panel 1: Work */}
        <div className="home-swipe-panel flex flex-col">
          {renderWorkHeader()}

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

        {/* Panel 2: Personal */}
        <div className="home-swipe-panel">
          <WorkMemoList tasks={allTasks} onRefresh={fetchTasks} scope="personal" accentColor="var(--color-info)" />
        </div>
      </div>
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
