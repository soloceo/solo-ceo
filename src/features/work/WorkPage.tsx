import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Filter, LayoutGrid, AlignJustify, Building2, User as UserIcon, Bot, Send, Loader2, Download } from "lucide-react";
import { exportCSV } from "../../lib/csv-export";
import { useAppSettings } from "../../hooks/useAppSettings";
import { parseWorkTask, AI_KEY_MAP, type AIProvider } from "../../lib/ai-client";
import { Skeleton } from "../../components/ui";
import { useT } from "../../i18n/context";
import { useRealtimeRefresh } from "../../hooks/useRealtimeRefresh";
import { useUIStore } from "../../store/useUIStore";
import { KanbanBoard, SwimlaneView, type ColDef } from "./KanbanBoard";
import { TaskDetail, type TaskForm } from "./TaskDetail";
import PersonalTaskList from "./PersonalTaskList";
import type { Task } from "./TaskCard";

type TaskMap = Record<string, Task[]>;

const WORK_TABLES = ["tasks"] as const;

export default function WorkPage() {
  const { t, lang } = useT();

  const COLS = useMemo<ColDef[]>(() => [
    { id: "todo", title: t("work.col.todo" as any), color: "var(--color-text-tertiary)" },
    { id: "inProgress", title: t("work.col.inProgress" as any), color: "var(--color-info)" },
    { id: "review", title: t("work.col.review" as any), color: "var(--color-warning)" },
    { id: "done", title: t("work.col.done" as any), color: "var(--color-success)" },
  ], [t]);

  const { settings: appSettings } = useAppSettings();
  const [workTab, setWorkTab] = useState<"work" | "personal">("work");
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiParsing, setAiParsing] = useState(false);
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
    fetch("/api/clients").then((r) => r.json()).then((d) => setClientList(Array.isArray(d) ? d.filter((c: any) => !c.soft_deleted) : [])).catch(() => {});
  }, []);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks");
      const raw = await res.json();
      const data = Array.isArray(raw) ? raw : [];
      setAllTasks(data);
      // Group work tasks only (exclude personal) for kanban
      const workData = data.filter((t: any) => t.scope !== "personal");
      const grouped = workData.reduce((acc: any, t: any) => {
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
        setWorkTab("work");
        openPanel(null, "todo");
      } else if (detail?.type === "personal-task") {
        setWorkTab("personal");
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
  const handleAiTask = async () => {
    const text = aiInput.trim();
    if (!text) return;
    const provider = appSettings?.ai_provider as AIProvider | undefined;
    const keyMap = AI_KEY_MAP;
    const apiKey = provider ? appSettings?.[keyMap[provider]] : undefined;
    if (!provider || !apiKey) {
      const lang = lang;
      showToast(t("work.ai.noKey" as any), 5000, {
        label: t("common.goSettings" as any),
        fn: () => setActiveTab("settings" as any),
      });
      return;
    }
    setAiParsing(true);
    try {
      const clientNames = clientList.map((c: any) => c.company_name || c.name).filter(Boolean);
      const parsed = await parseWorkTask(text, clientNames, lang, provider, apiKey);
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...parsed, scope: "work" }),
      });
      showToast(`✓ ${t("work.ai.created" as any)}: ${parsed.title}`);
      setAiInput("");
      fetchTasks();
    } catch {
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
      {/* Row 1: Tab switcher (full width) */}
      <div className="flex gap-1 p-1 mb-2 rounded-[var(--radius-8)]" style={{ background: "var(--color-bg-tertiary)" }}>
        {(["work", "personal"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setWorkTab(tab)}
            className="flex-1 py-1.5 text-[14px] rounded-[var(--radius-6)] transition-colors press-feedback flex items-center justify-center gap-1.5"
            style={workTab === tab ? {
              background: tab === "work"
                ? "color-mix(in srgb, var(--color-accent) 12%, var(--color-bg-primary))"
                : "color-mix(in srgb, var(--color-info) 12%, var(--color-bg-primary))",
              color: tab === "work" ? "var(--color-accent)" : "var(--color-info)",
              fontWeight: "var(--font-weight-semibold)",
              boxShadow: "var(--shadow-low)",
            } as React.CSSProperties : {
              color: "var(--color-text-tertiary)",
              fontWeight: "var(--font-weight-medium)",
            } as React.CSSProperties}
          >
            {tab === "work" ? <Building2 size={14} /> : <UserIcon size={14} />}
            {tab === "work" ? (t("work.tab.work" as any)) : (t("work.tab.personal" as any))}
          </button>
        ))}
      </div>

      {/* Row 2: Toolbar (work tab only) */}
      {workTab === "work" && (
        <div className="flex items-center gap-2 mb-2">
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
            const all = Object.values(tasks).flat();
            exportCSV(all.map(t => ({ title: t.title, client: t.client, priority: t.priority, due: t.due, column: t.column })), "tasks", [
              { key: "title", label: "Title" }, { key: "client", label: "Client" }, { key: "priority", label: "Priority" }, { key: "due", label: "Due" }, { key: "column", label: "Status" },
            ]);
          }} className="btn-ghost compact"><Download size={16} /></button>
          <button onClick={() => openPanel(null, "todo")} className="btn-primary compact">
            <Plus size={16} /> {t("work.new" as any)}
          </button>
        </div>
      )}

      {workTab === "work" ? (
        <>
          {/* AI task input */}
          <div className="flex items-center gap-2 mb-3 rounded-[var(--radius-8)] p-1.5" style={{
            background: "color-mix(in srgb, var(--color-accent) 6%, transparent)",
          }}>
            <div className="relative flex-1">
              <Bot size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-accent)" }} />
              <input
                type="text"
                value={aiInput}
                onChange={e => setAiInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) handleAiTask(); }}
                placeholder={t("work.ai.placeholder" as any)}
                disabled={aiParsing}
                className="input-base w-full pl-9 pr-3 py-2.5 text-[15px]"
              />
            </div>
            <button onClick={handleAiTask} disabled={!aiInput.trim() || aiParsing} className="btn-primary compact text-[14px] shrink-0 disabled:opacity-40">
              {aiParsing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>

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
        </>
      ) : (
        <PersonalTaskList tasks={allTasks} onRefresh={fetchTasks} />
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
