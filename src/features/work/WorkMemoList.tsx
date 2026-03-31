import React, { useState, useMemo } from "react";
import { Plus, Check, Circle, ChevronDown, ChevronRight, Trash2, Pin, X, Calendar, Pencil, Bot, Send, Loader2 } from "lucide-react";
import { useT } from "../../i18n/context";
import { useAppSettings } from "../../hooks/useAppSettings";
import { useUIStore } from "../../store/useUIStore";
import type { Task } from "./TaskCard";

interface WorkMemoListProps {
  tasks: Task[];
  onRefresh: () => void;
  scope?: "work-memo" | "personal";
  accentColor?: string;
}

/* ── Helpers ── */
function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function getWeekDays(base: Date) {
  const sun = new Date(base);
  const day = sun.getDay();
  sun.setDate(sun.getDate() - day); // go to Sunday
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sun);
    d.setDate(sun.getDate() + i);
    days.push(d);
  }
  return days;
}

const SHORT_DAY_ZH = ["日", "一", "二", "三", "四", "五", "六"];
const SHORT_DAY_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

function TimePicker24({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const h = value ? value.slice(0, 2) : "";
  const m = value ? value.slice(3, 5) : "";
  return (
    <div className="flex items-center gap-0.5">
      <select
        value={h}
        onChange={e => {
          const newH = e.target.value;
          if (!newH) { onChange(""); return; }
          onChange(`${newH}:${m || "00"}`);
        }}
        className="input-base px-1.5 py-1 text-[13px] tabular-nums"
        style={{ color: h ? "var(--color-text-primary)" : "var(--color-text-quaternary)", minWidth: 48 }}
      >
        <option value="">--</option>
        {HOURS.map(hh => <option key={hh} value={hh}>{hh}</option>)}
      </select>
      <span className="text-[13px]" style={{ color: "var(--color-text-quaternary)" }}>:</span>
      <select
        value={m}
        onChange={e => {
          const newM = e.target.value;
          if (!newM) { onChange(""); return; }
          onChange(`${h || "00"}:${newM}`);
        }}
        className="input-base px-1.5 py-1 text-[13px] tabular-nums"
        style={{ color: m ? "var(--color-text-primary)" : "var(--color-text-quaternary)", minWidth: 48 }}
      >
        <option value="">--</option>
        {MINUTES.map(mm => <option key={mm} value={mm}>{mm}</option>)}
      </select>
    </div>
  );
}

export default function WorkMemoList({ tasks, onRefresh, scope = "work-memo", accentColor }: WorkMemoListProps) {
  const { t, lang } = useT();
  const prefix = scope === "personal" ? "personal.memo" : "work.memo";
  const accent = accentColor || "var(--color-accent)";
  const [collapsed, setCollapsed] = useState(false);
  const [addingSimple, setAddingSimple] = useState(false);
  const [simpleTitle, setSimpleTitle] = useState("");
  const [simpleDate, setSimpleDate] = useState("");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [simpleTime, setSimpleTime] = useState("");
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const { settings: appSettings } = useAppSettings();
  const showToast = useUIStore((s) => s.showToast);
  const setActiveTab = useUIStore((s) => s.setActiveTab);

  const todayStr = useMemo(() => toDateStr(new Date()), []);
  const weekDays = useMemo(() => getWeekDays(new Date()), []);
  const dayLabels = lang === "zh" ? SHORT_DAY_ZH : SHORT_DAY_EN;

  const memoTasks = useMemo(() =>
    tasks.filter(t => t.scope === scope).sort((a, b) => {
      // undone first
      if (a.column === "done" && b.column !== "done") return 1;
      if (a.column !== "done" && b.column === "done") return -1;
      // then by due date+time ascending (items with due first)
      if (a.due && b.due) return a.due.localeCompare(b.due);
      if (a.due && !b.due) return -1;
      if (!a.due && b.due) return 1;
      return b.id - a.id;
    }),
  [tasks]);

  // Build date → memo count map for dots
  const dateMemoMap = useMemo(() => {
    const map: Record<string, { total: number; done: number }> = {};
    for (const m of memoTasks) {
      if (!m.due) continue;
      const key = m.due.slice(0, 10);
      if (!map[key]) map[key] = { total: 0, done: 0 };
      map[key].total++;
      if (m.column === "done") map[key].done++;
    }
    return map;
  }, [memoTasks]);

  // Filter displayed memos
  const displayedMemos = useMemo(() => {
    if (!selectedDay) return memoTasks;
    return memoTasks.filter(m => m.due && m.due.slice(0, 10) === selectedDay);
  }, [memoTasks, selectedDay]);

  const undoneCount = memoTasks.filter(t => t.column !== "done").length;

  const toggleTask = (task: Task) => {
    const newColumn = task.column === "done" ? "todo" : "done";
    // Optimistic: refresh immediately, API in background
    onRefresh();
    fetch(`/api/tasks/${task.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...task, column: newColumn }),
    }).then(() => onRefresh());
  };

  const deleteTask = (id: number) => {
    onRefresh();
    fetch(`/api/tasks/${id}`, { method: "DELETE" }).then(() => onRefresh());
  };

  const startEdit = (task: Task) => {
    setEditingId(task.id);
    setEditTitle(task.title);
    setEditDate(task.due?.slice(0, 10) || "");
    setEditTime(task.due && task.due.length > 10 ? task.due.slice(11, 16) : "");
  };

  const buildDue = (date: string, time: string) => {
    if (!date) return null;
    return time ? `${date}T${time}` : date;
  };

  const saveEdit = () => {
    if (!editingId || !editTitle.trim()) return;
    const task = memoTasks.find(t => t.id === editingId);
    if (!task) return;
    setEditingId(null);
    fetch(`/api/tasks/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...task, title: editTitle.trim(), due: buildDue(editDate, editTime) }),
    }).then(() => onRefresh());
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
    setEditDate("");
    setEditTime("");
  };

  const addMemo = () => {
    const title = simpleTitle.trim();
    if (!title) return;
    const due = buildDue(simpleDate, simpleTime);
    setSimpleTitle("");
    setSimpleDate("");
    setSimpleTime("");
    setAddingSimple(false);
    fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        scope,
        column: "todo",
        priority: "Medium",
        ...(due ? { due } : {}),
      }),
    }).then(() => onRefresh());
  };

  const addMemoByAi = async () => {
    const text = aiInput.trim();
    if (!text) return;

    const provider = appSettings?.ai_provider as string | undefined;
    const keyMap: Record<string, string> = { openai: "openai_api_key", claude: "claude_api_key", deepseek: "deepseek_api_key", gemini: "gemini_api_key" };
    const apiKey = provider ? appSettings?.[keyMap[provider]] : undefined;

    if (!provider || !apiKey) {
      // No AI key — just create directly with text as title
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: text, scope: "work-memo", column: "todo", priority: "Medium" }),
      });
      showToast(`✓ ${text}`);
      setAiInput("");
      onRefresh();
      return;
    }

    setAiLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const dayOfWeek = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][new Date().getDay()];
      const sysPrompt = `You extract a memo/event from user input. Today is ${today} (${dayOfWeek}). Return JSON: {"title":"short title","due":"YYYY-MM-DD" or "YYYY-MM-DDThh:mm" or null}. Only JSON, no markdown.`;

      let result: { title: string; due?: string | null } | null = null;

      if (provider === "openai") {
        const r = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "system", content: sysPrompt }, { role: "user", content: text }], temperature: 0 }),
        });
        const d = await r.json();
        result = JSON.parse(d.choices[0].message.content);
      } else if (provider === "claude") {
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST", headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
          body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 200, system: sysPrompt, messages: [{ role: "user", content: text }] }),
        });
        const d = await r.json();
        result = JSON.parse(d.content[0].text);
      } else if (provider === "deepseek") {
        const r = await fetch("https://api.deepseek.com/chat/completions", {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ model: "deepseek-chat", messages: [{ role: "system", content: sysPrompt }, { role: "user", content: text }], temperature: 0 }),
        });
        const d = await r.json();
        result = JSON.parse(d.choices[0].message.content);
      } else if (provider === "gemini") {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: `${sysPrompt}\n\nUser: ${text}` }] }] }),
        });
        const d = await r.json();
        const raw = d.candidates[0].content.parts[0].text.replace(/```json\n?|\n?```/g, "").trim();
        result = JSON.parse(raw);
      }

      if (result) {
        await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: result.title || text,
            scope,
            column: "todo",
            priority: "Medium",
            ...(result.due ? { due: result.due } : {}),
          }),
        });
        showToast(`✓ ${result.title || text}`);
      }
      setAiInput("");
      onRefresh();
    } catch {
      // Fallback: create directly
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: text, scope: "work-memo", column: "todo", priority: "Medium" }),
      });
      showToast(`✓ ${text}`);
      setAiInput("");
      onRefresh();
    } finally {
      setAiLoading(false);
    }
  };

  // Don't render if no memos and not adding
  if (memoTasks.length === 0 && !addingSimple) {
    return (
      <button
        onClick={() => setAddingSimple(true)}
        className="flex items-center gap-1.5 mb-3 text-[13px] transition-colors hover:opacity-80"
        style={{ color: "var(--color-text-quaternary)" }}
      >
        <Pin size={12} />
        {t(`${prefix}.add` as any)}
      </button>
    );
  }

  return (
    <div className="mb-3">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-1.5 w-full text-left mb-1.5 transition-colors hover:opacity-80"
      >
        <Pin size={13} style={{ color: accent }} />
        <span className="text-[13px]" style={{ color: "var(--color-text-secondary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>
          {t(`${prefix}.title` as any)}
        </span>
        {undoneCount > 0 && (
          <span className="text-[12px] tabular-nums px-1.5 py-0.5 rounded-full" style={{ background: `color-mix(in srgb, ${accent} 12%, transparent)`, color: accent }}>
            {undoneCount}
          </span>
        )}
        <div className="flex-1" />
        <div style={{ color: "var(--color-text-quaternary)" }}>
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {/* Content */}
      <div className="anim-collapse-wrapper" data-open={!collapsed && memoTasks.length > 0 ? "true" : "false"}>
        <div className="anim-collapse-inner">
        <div className="card overflow-hidden">
          {/* Week strip */}
          <div className="flex items-stretch border-b" style={{ borderColor: "var(--color-line-secondary)" }}>
            {weekDays.map((d, i) => {
              const ds = toDateStr(d);
              const isToday = ds === todayStr;
              const isSelected = selectedDay === ds;
              const info = dateMemoMap[ds];
              const allDone = info && info.done === info.total;
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDay(isSelected ? null : ds)}
                  className="flex-1 flex flex-col items-center py-1.5 transition-colors"
                  style={{
                    background: isSelected ? `color-mix(in srgb, ${accent} 12%, transparent)` : "transparent",
                  }}
                >
                  <span className="text-[10px]" style={{
                    color: isToday ? accent : "var(--color-text-quaternary)",
                    fontWeight: isToday ? 700 : 500,
                  } as React.CSSProperties}>
                    {dayLabels[i]}
                  </span>
                  <span
                    className="flex items-center justify-center tabular-nums mt-0.5"
                    style={{
                      width: 24, height: 24, borderRadius: "50%",
                      fontSize: 13,
                      fontWeight: isToday ? 700 : 400,
                      background: isToday ? accent : "transparent",
                      color: isToday ? "var(--color-text-on-color)" : "var(--color-text-primary)",
                    } as React.CSSProperties}
                  >
                    {d.getDate()}
                  </span>
                  {/* Dot indicator */}
                  <div className="mt-0.5" style={{ width: 4, height: 4, borderRadius: 2, background: info ? (allDone ? "var(--color-success)" : accent) : "transparent" }} />
                </button>
              );
            })}
          </div>

          {/* Selected day label */}
          {selectedDay && (
            <div className="flex items-center justify-between px-3 py-1.5" style={{ background: "var(--color-bg-tertiary)" }}>
              <span className="text-[12px]" style={{ color: "var(--color-text-tertiary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
                {selectedDay === todayStr
                  ? t("work.memo.today" as any)
                  : new Date(selectedDay + "T00:00:00").toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", { month: "short", day: "numeric", weekday: "short" })
                }
                {displayedMemos.length === 0 && ` — ${t("work.memo.noItems" as any)}`}
              </span>
              <button onClick={() => setSelectedDay(null)} className="btn-icon-sm">
                <X size={12} />
              </button>
            </div>
          )}

          {/* AI quick input */}
          <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: "var(--color-line-secondary)" }}>
            <Bot size={14} className="shrink-0" style={{ color: accent, opacity: 0.6 }} />
            <input
              type="text"
              value={aiInput}
              onChange={e => setAiInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) addMemoByAi(); }}
              placeholder={scope === "personal"
                ? (lang === "zh" ? "AI 快捷添加：周六 10am 看牙医..." : "AI: dentist Sat 10am...")
                : (lang === "zh" ? "AI 快捷添加：下周三 2 点见客户..." : "AI: meet client Wed 2pm...")}
              disabled={aiLoading}
              className="input-base flex-1 px-2 py-1.5 text-[13px]"
              style={{ background: "transparent", border: "none", boxShadow: "none" }}
            />
            {aiInput.trim() && (
              <button onClick={addMemoByAi} disabled={aiLoading} className="btn-icon-sm shrink-0" style={{ color: accent }}>
                {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            )}
          </div>

          {/* Memo list */}
          <div className="divide-y divide-[var(--color-line-secondary)]">
            {displayedMemos.map(task => {
              const isDone = task.column === "done";
              const isEditing = editingId === task.id;
              const timeStr = task.due && task.due.length > 10 ? task.due.slice(11, 16) : null;
              const dateLabel = task.due
                ? (() => {
                    const ds = task.due.slice(0, 10);
                    const datePart = selectedDay
                      ? null
                      : ds === todayStr
                        ? t("work.memo.today" as any)
                        : new Date(ds + "T00:00:00").toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", { month: "numeric", day: "numeric" });
                    if (datePart && timeStr) return `${datePart} ${timeStr}`;
                    if (datePart) return datePart;
                    if (timeStr) return timeStr;
                    return null;
                  })()
                : null;

              if (isEditing) {
                return (
                  <div key={task.id} className="px-3 py-2 space-y-2" style={{ background: "var(--color-bg-tertiary)" }}>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) saveEdit(); if (e.key === "Escape") cancelEdit(); }}
                        className="input-base flex-1 px-2 py-1.5 text-[14px]"
                        autoFocus
                      />
                      <button onClick={saveEdit} disabled={!editTitle.trim()} className="btn-primary compact text-[13px] disabled:opacity-40">
                        {t("common.save" as any)}
                      </button>
                      <button onClick={cancelEdit} className="btn-icon-sm">
                        <X size={14} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Calendar size={13} className="shrink-0" style={{ color: "var(--color-text-quaternary)" }} />
                      <input
                        type="date"
                        value={editDate}
                        onChange={e => setEditDate(e.target.value)}
                        className="input-base px-2 py-1 text-[13px]"
                        style={{ color: editDate ? "var(--color-text-primary)" : "var(--color-text-quaternary)" }}
                      />
                      <TimePicker24 value={editTime} onChange={setEditTime} />
                      {(editDate || editTime) && (
                        <button onClick={() => { setEditDate(""); setEditTime(""); }} className="btn-icon-sm">
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={task.id}
                  className="flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors hover:bg-[var(--color-bg-tertiary)] press-feedback anim-appear"
                  onClick={() => toggleTask(task)}
                >
                  <div className="shrink-0">
                    {isDone
                      ? <Check size={15} style={{ color: "var(--color-success)" }} />
                      : <Circle size={15} strokeWidth={1.5} style={{ color: "var(--color-border-secondary)" }} />
                    }
                  </div>
                  <span className="flex-1 text-[14px] min-w-0 truncate" style={{
                    color: isDone ? "var(--color-text-quaternary)" : "var(--color-text-primary)",
                    textDecoration: isDone ? "line-through" : "none",
                  }}>
                    {task.title}
                  </span>
                  {dateLabel && (
                    <span className="text-[11px] shrink-0 tabular-nums" style={{ color: "var(--color-text-quaternary)" }}>
                      {dateLabel}
                    </span>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); e.preventDefault(); startEdit(task); }}
                    onPointerDown={e => e.stopPropagation()}
                    className="shrink-0 flex items-center justify-center"
                    style={{ opacity: 0.5, width: 32, height: 32, borderRadius: 8 }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                    onMouseLeave={e => (e.currentTarget.style.opacity = "0.5")}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); e.preventDefault(); deleteTask(task.id); }}
                    onPointerDown={e => e.stopPropagation()}
                    className="shrink-0 flex items-center justify-center"
                    style={{ opacity: 0.5, width: 32, height: 32, borderRadius: 8 }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                    onMouseLeave={e => (e.currentTarget.style.opacity = "0.5")}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Manual add inline */}
          {addingSimple ? (
            <div className="border-t px-3 py-2 space-y-2" style={{ borderColor: "var(--color-line-secondary)" }}>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={simpleTitle}
                  onChange={e => setSimpleTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) addMemo(); if (e.key === "Escape") { setAddingSimple(false); setSimpleTitle(""); setSimpleDate(""); setSimpleTime(""); } }}
                  placeholder={t(`${prefix}.placeholder` as any)}
                  className="input-base flex-1 px-2 py-1.5 text-[14px]"
                  autoFocus
                />
                <button onClick={addMemo} disabled={!simpleTitle.trim()} className="btn-primary compact text-[13px] disabled:opacity-40">
                  {t("common.add" as any)}
                </button>
                <button onClick={() => { setAddingSimple(false); setSimpleTitle(""); setSimpleDate(""); setSimpleTime(""); }} className="btn-icon-sm">
                  <X size={14} />
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Calendar size={13} className="shrink-0" style={{ color: "var(--color-text-quaternary)" }} />
                <input
                  type="date"
                  value={simpleDate}
                  onChange={e => setSimpleDate(e.target.value)}
                  className="input-base px-2 py-1 text-[13px]"
                  style={{ color: simpleDate ? "var(--color-text-primary)" : "var(--color-text-quaternary)" }}
                />
                <TimePicker24 value={simpleTime} onChange={setSimpleTime} />
                {(simpleDate || simpleTime) && (
                  <button onClick={() => { setSimpleDate(""); setSimpleTime(""); }} className="btn-icon-sm">
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingSimple(true)}
              className="flex items-center gap-2 px-3 py-2.5 w-full text-left text-[13px] transition-colors hover:bg-[var(--color-bg-tertiary)] border-t"
              style={{ color: "var(--color-text-quaternary)", borderColor: "var(--color-line-secondary)" }}
            >
              <Plus size={13} />
              {t(`${prefix}.add` as any)}
            </button>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
