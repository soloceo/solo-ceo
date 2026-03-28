import React, { useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { Plus, Check, Circle, ChevronDown, ChevronRight, Bot, Send, Loader2, Trash2, X } from "lucide-react";
import { useT } from "../../i18n/context";
import { useAppSettings } from "../../hooks/useAppSettings";
import { useUIStore } from "../../store/useUIStore";
import { parseTaskBreakdown, type AIProvider, type TaskBreakdown } from "../../lib/ai-client";
import type { Task } from "./TaskCard";

interface PersonalTaskListProps {
  tasks: Task[];
  onRefresh: () => void;
}

export default function PersonalTaskList({ tasks, onRefresh }: PersonalTaskListProps) {
  const { t, lang } = useT();
  const showToast = useUIStore((s) => s.showToast);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const { settings } = useAppSettings();

  const [aiInput, setAiInput] = useState("");
  const [aiParsing, setAiParsing] = useState(false);
  const [preview, setPreview] = useState<TaskBreakdown | null>(null);
  const [addingSimple, setAddingSimple] = useState(false);
  const [simpleTitle, setSimpleTitle] = useState("");
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  // Filter personal tasks
  const personalTasks = useMemo(() => tasks.filter(t => t.scope === "personal"), [tasks]);
  const parentTasks = useMemo(() => personalTasks.filter(t => !t.parent_id), [personalTasks]);
  const childrenOf = useCallback((parentId: number) =>
    personalTasks.filter(t => t.parent_id === parentId).sort((a, b) => a.id - b.id),
  [personalTasks]);

  // Toggle task completion
  const toggleTask = async (task: Task) => {
    const newColumn = task.column === "done" ? "todo" : "done";
    await fetch(`/api/tasks/${task.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...task, column: newColumn }),
    });
    // Auto-complete parent if all children done
    if (task.parent_id) {
      const siblings = childrenOf(task.parent_id);
      const allDone = siblings.every(s => s.id === task.id ? newColumn === "done" : s.column === "done");
      if (allDone) {
        const parent = parentTasks.find(p => p.id === task.parent_id);
        if (parent && parent.column !== "done") {
          await fetch(`/api/tasks/${parent.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...parent, column: "done" }),
          });
        }
      }
    }
    onRefresh();
  };

  const deleteTask = async (id: number) => {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    onRefresh();
  };

  // Create simple task
  const addSimpleTask = async () => {
    const title = simpleTitle.trim();
    if (!title) return;
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, scope: "personal", column: "todo", priority: "Medium" }),
    });
    setSimpleTitle("");
    setAddingSimple(false);
    onRefresh();
  };

  // AI breakdown
  const handleAiBreakdown = async () => {
    const text = aiInput.trim();
    if (!text) return;
    const provider = settings?.ai_provider as AIProvider | undefined;
    const keyMap: Record<string, string> = { gemini: "gemini_api_key", claude: "claude_api_key", openai: "openai_api_key" };
    const apiKey = provider ? settings?.[keyMap[provider]] : undefined;
    if (!provider || !apiKey) {
      showToast(t("money.ai.noKey" as any), 5000, {
        label: t("common.goSettings" as any),
        fn: () => setActiveTab("settings" as any),
      });
      return;
    }
    setAiParsing(true);
    try {
      const result = await parseTaskBreakdown(text, lang, provider, apiKey);
      setPreview(result);
      setAiInput("");
    } catch {
      showToast(t("work.personal.aiFailed" as any));
    } finally {
      setAiParsing(false);
    }
  };

  // Confirm AI breakdown → create tasks
  const confirmBreakdown = async () => {
    if (!preview) return;
    // Create parent task
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: preview.title, scope: "personal", column: "todo", priority: "Medium" }),
    });
    const { id: parentId } = await res.json();
    // Create child tasks
    for (const step of preview.steps) {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: step, scope: "personal", column: "todo", priority: "Medium", parent_id: parentId }),
      });
    }
    setPreview(null);
    onRefresh();
  };

  const toggleExpand = (id: number) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  return (
    <div className="flex-1 space-y-3 pb-4">
      {/* AI input */}
      <div className="flex items-center gap-2 rounded-[var(--radius-8)] p-1.5" style={{
        background: "color-mix(in srgb, var(--color-info) 6%, transparent)",
      }}>
        <div className="relative flex-1">
          <Bot size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-info)" }} />
          <input
            type="text"
            value={aiInput}
            onChange={e => setAiInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) handleAiBreakdown(); }}
            placeholder={t("work.personal.aiPlaceholder" as any)}
            disabled={aiParsing}
            className="input-base w-full pl-9 pr-3 py-2.5 text-[15px]"
          />
        </div>
        <button onClick={handleAiBreakdown} disabled={!aiInput.trim() || aiParsing} className="btn-primary compact text-[14px] shrink-0 disabled:opacity-40">
          {aiParsing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
      </div>

      {/* Task list */}
      <div className="card overflow-hidden divide-y divide-[var(--color-line-secondary)]">
        {parentTasks.map(task => {
          const children = childrenOf(task.id);
          const hasChildren = children.length > 0;
          const isExpanded = expanded[task.id] !== false; // default expanded
          const doneCount = children.filter(c => c.column === "done").length;
          const isDone = task.column === "done";

          return (
            <div key={task.id}>
              {/* Parent row */}
              <div
                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors hover:bg-[var(--color-bg-tertiary)] press-feedback"
                onClick={() => hasChildren ? toggleExpand(task.id) : toggleTask(task)}
              >
                {hasChildren ? (
                  <div className="shrink-0" style={{ color: "var(--color-text-quaternary)" }}>
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </div>
                ) : (
                  <div className="shrink-0 cursor-pointer" onClick={e => { e.stopPropagation(); toggleTask(task); }}>
                    {isDone
                      ? <Check size={16} style={{ color: "var(--color-success)" }} />
                      : <Circle size={16} strokeWidth={1.5} style={{ color: "var(--color-border-secondary)" }} />
                    }
                  </div>
                )}
                <span className="flex-1 text-[15px] min-w-0 truncate" style={{
                  color: isDone ? "var(--color-text-quaternary)" : "var(--color-text-primary)",
                  fontWeight: hasChildren ? "var(--font-weight-semibold)" : "var(--font-weight-medium)",
                  textDecoration: isDone ? "line-through" : "none",
                } as React.CSSProperties}>
                  {task.title}
                </span>
                {hasChildren && (
                  <span className="text-[12px] tabular-nums shrink-0" style={{ color: doneCount === children.length ? "var(--color-success)" : "var(--color-text-quaternary)" }}>
                    {doneCount}/{children.length}
                  </span>
                )}
                <button onClick={e => { e.stopPropagation(); deleteTask(task.id); }} className="btn-icon-sm shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Children */}
              {hasChildren && isExpanded && children.map(child => {
                const childDone = child.column === "done";
                return (
                  <div
                    key={child.id}
                    className="flex items-center gap-3 pl-10 pr-3 py-2 cursor-pointer transition-colors hover:bg-[var(--color-bg-tertiary)] press-feedback"
                    onClick={() => toggleTask(child)}
                  >
                    {childDone
                      ? <Check size={14} style={{ color: "var(--color-success)" }} />
                      : <Circle size={14} strokeWidth={1.5} style={{ color: "var(--color-border-secondary)" }} />
                    }
                    <span className="flex-1 text-[14px] min-w-0" style={{
                      color: childDone ? "var(--color-text-quaternary)" : "var(--color-text-secondary)",
                      textDecoration: childDone ? "line-through" : "none",
                    }}>
                      {child.title}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Add simple task inline */}
        {addingSimple ? (
          <div className="flex items-center gap-2 px-3 py-2">
            <input
              type="text"
              value={simpleTitle}
              onChange={e => setSimpleTitle(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addSimpleTask(); if (e.key === "Escape") setAddingSimple(false); }}
              placeholder={t("work.personal.taskName" as any)}
              className="input-base flex-1 px-2 py-1.5 text-[15px]"
              autoFocus
            />
            <button onClick={addSimpleTask} disabled={!simpleTitle.trim()} className="btn-primary compact text-[13px] disabled:opacity-40">
              {t("common.add" as any)}
            </button>
            <button onClick={() => { setAddingSimple(false); setSimpleTitle(""); }} className="btn-icon-sm">
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAddingSimple(true)}
            className="flex items-center gap-2 px-3 py-3 w-full text-left text-[14px] transition-colors hover:bg-[var(--color-bg-tertiary)]"
            style={{ color: "var(--color-text-quaternary)" }}
          >
            <Plus size={14} />
            {t("work.personal.addTask" as any)}
          </button>
        )}
      </div>

      {/* Empty state */}
      {parentTasks.length === 0 && !addingSimple && (
        <div className="text-center py-8 text-[14px]" style={{ color: "var(--color-text-quaternary)" }}>
          {t("work.personal.empty" as any)}
        </div>
      )}

      {/* AI Preview Modal */}
      {preview && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4 animate-fade-in" style={{ zIndex: 710, background: "var(--color-overlay-primary)" }}>
          <div className="card-elevated p-5 max-w-md w-full" role="dialog" aria-modal="true">
            <h3 className="text-[16px] mb-3" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-bold)" } as React.CSSProperties}>
              {preview.title}
            </h3>
            <div className="space-y-1.5 mb-4">
              {preview.steps.map((step, i) => (
                <div key={i} className="flex items-start gap-2 text-[14px]" style={{ color: "var(--color-text-secondary)" }}>
                  <span className="shrink-0 tabular-nums text-[12px] mt-0.5" style={{ color: "var(--color-text-quaternary)" }}>{i + 1}.</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setPreview(null)} className="btn-ghost text-[15px]">
                {t("common.cancel" as any)}
              </button>
              <button onClick={confirmBreakdown} className="btn-primary text-[15px]">
                {t("common.confirm" as any)}
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
}
