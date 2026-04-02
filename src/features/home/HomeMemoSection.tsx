import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Check, ChevronDown, ChevronRight, Trash2, X, Calendar, Bot, Send, Loader2, StickyNote, Briefcase, User } from "lucide-react";
import { api } from "../../lib/api";
import { useT } from "../../i18n/context";
import { useAppSettings } from "../../hooks/useAppSettings";
import { useUIStore } from "../../store/useUIStore";
import { useRealtimeRefresh } from "../../hooks/useRealtimeRefresh";
import type { Task } from "../work/TaskCard";

/* ── Helpers ── */
function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function getWeekDays(base: Date) {
  const sun = new Date(base);
  sun.setDate(sun.getDate() - sun.getDay());
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sun);
    d.setDate(sun.getDate() + i);
    days.push(d);
  }
  return days;
}

const SHORT_DAY_ZH = ["日", "一", "二", "三", "四", "五", "六"];
const SHORT_DAY_EN = ["S", "M", "T", "W", "T", "F", "S"];
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));
const MEMO_TABLES = ["tasks"] as const;

function TimePicker24({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const h = value ? value.slice(0, 2) : "";
  const m = value ? value.slice(3, 5) : "";
  return (
    <div className="flex items-center gap-0.5">
      <select value={h} onChange={e => { const v = e.target.value; if (!v) { onChange(""); return; } onChange(`${v}:${m || "00"}`); }}
        className="input-base px-1.5 py-1 text-[13px] tabular-nums" style={{ color: h ? "var(--color-text-primary)" : "var(--color-text-quaternary)", minWidth: 48 }}>
        <option value="">--</option>
        {HOURS.map(hh => <option key={hh} value={hh}>{hh}</option>)}
      </select>
      <span className="text-[13px]" style={{ color: "var(--color-text-quaternary)" }}>:</span>
      <select value={m} onChange={e => { const v = e.target.value; if (!v) { onChange(""); return; } onChange(`${h || "00"}:${v}`); }}
        className="input-base px-1.5 py-1 text-[13px] tabular-nums" style={{ color: m ? "var(--color-text-primary)" : "var(--color-text-quaternary)", minWidth: 48 }}>
        <option value="">--</option>
        {MINUTES.map(mm => <option key={mm} value={mm}>{mm}</option>)}
      </select>
    </div>
  );
}

/* ── Scope toggle (segmented control) ── */
function ScopeToggle({ value, onChange, lang, size = "sm" }: {
  value: "work-memo" | "personal";
  onChange: (v: "work-memo" | "personal") => void;
  lang: string;
  size?: "sm" | "md";
}) {
  const py = size === "sm" ? "py-0.5" : "py-1";
  const text = size === "sm" ? "text-[11px]" : "text-[12px]";
  const iconSize = size === "sm" ? 10 : 12;
  return (
    <div
      className="inline-flex items-center rounded-[var(--radius-6)] shrink-0"
      style={{ background: "var(--color-bg-secondary)", padding: 2 }}
    >
      <button
        onClick={() => onChange("work-memo")}
        className={`inline-flex items-center gap-1 px-2 ${py} ${text} rounded-[var(--radius-4)] transition-all`}
        style={{
          fontWeight: 600,
          background: value === "work-memo" ? "var(--color-bg-primary)" : "transparent",
          color: value === "work-memo" ? "var(--color-accent)" : "var(--color-text-quaternary)",
          boxShadow: value === "work-memo" ? "var(--shadow-low)" : "none",
        }}
      >
        <Briefcase size={iconSize} /> {lang === "zh" ? "工作" : "Work"}
      </button>
      <button
        onClick={() => onChange("personal")}
        className={`inline-flex items-center gap-1 px-2 ${py} ${text} rounded-[var(--radius-4)] transition-all`}
        style={{
          fontWeight: 600,
          background: value === "personal" ? "var(--color-bg-primary)" : "transparent",
          color: value === "personal" ? "var(--color-info)" : "var(--color-text-quaternary)",
          boxShadow: value === "personal" ? "var(--shadow-low)" : "none",
        }}
      >
        <User size={iconSize} /> {lang === "zh" ? "个人" : "Me"}
      </button>
    </div>
  );
}

/* ── Scope badge ── */
function ScopeBadge({ scope, lang }: { scope: string; lang: string }) {
  const isPersonal = scope === "personal";
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-[var(--radius-4)] shrink-0"
      style={{
        background: isPersonal
          ? "color-mix(in srgb, var(--color-info) 8%, transparent)"
          : "color-mix(in srgb, var(--color-accent) 8%, transparent)",
        color: isPersonal ? "var(--color-info)" : "var(--color-accent)",
        fontWeight: 600,
      } as React.CSSProperties}
    >
      {isPersonal
        ? <><User size={9} /> {lang === "zh" ? "个人" : "Me"}</>
        : <><Briefcase size={9} /> {lang === "zh" ? "工作" : "Work"}</>
      }
    </span>
  );
}

export function HomeMemoSection() {
  const { t, lang } = useT();
  const { settings: appSettings } = useAppSettings();
  const showToast = useUIStore((s) => s.showToast);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [addingSimple, setAddingSimple] = useState(false);
  const [simpleTitle, setSimpleTitle] = useState("");
  const [simpleDate, setSimpleDate] = useState("");
  const [simpleTime, setSimpleTime] = useState("");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [memoScope, setMemoScope] = useState<"work-memo" | "personal">("work-memo");

  const fetchTasks = useCallback(async () => {
    try {
      const data = await api.get<Task[]>("/api/tasks");
      setTasks(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);
  useRealtimeRefresh(MEMO_TABLES, fetchTasks);

  const todayStr = useMemo(() => toDateStr(new Date()), []);
  const weekDays = useMemo(() => getWeekDays(new Date()), []);
  const dayLabels = lang === "zh" ? SHORT_DAY_ZH : SHORT_DAY_EN;

  const memoTasks = useMemo(() =>
    tasks.filter(t => t.scope === "work-memo" || t.scope === "personal").sort((a, b) => {
      if (a.column === "done" && b.column !== "done") return 1;
      if (a.column !== "done" && b.column === "done") return -1;
      if (a.due && b.due) return a.due.localeCompare(b.due);
      if (a.due && !b.due) return -1;
      if (!a.due && b.due) return 1;
      return b.id - a.id;
    }),
  [tasks]);

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

  const displayedMemos = useMemo(() => {
    if (!selectedDay) return memoTasks;
    return memoTasks.filter(m => m.due && m.due.slice(0, 10) === selectedDay);
  }, [memoTasks, selectedDay]);

  const undoneCount = memoTasks.filter(t => t.column !== "done").length;

  const toggleTask = (task: Task) => {
    const newColumn = task.column === "done" ? "todo" : "done";
    api.put(`/api/tasks/${task.id}`, { column: newColumn }).then(() => fetchTasks());
  };

  const deleteTask = (id: number) => {
    api.del(`/api/tasks/${id}`).then(() => fetchTasks());
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
    setEditingId(null);
    api.put(`/api/tasks/${editingId}`, { title: editTitle.trim(), due: buildDue(editDate, editTime) }).then(() => fetchTasks());
  };

  const cancelEdit = () => { setEditingId(null); setEditTitle(""); setEditDate(""); setEditTime(""); };

  const addMemo = () => {
    const title = simpleTitle.trim();
    if (!title) return;
    const due = buildDue(simpleDate, simpleTime);
    setSimpleTitle(""); setSimpleDate(""); setSimpleTime(""); setAddingSimple(false);
    api.post("/api/tasks", { title, scope: memoScope, column: "todo", priority: "Medium", ...(due ? { due } : {}) }).then(() => fetchTasks());
  };

  const addMemoByAi = async () => {
    const text = aiInput.trim();
    if (!text) return;

    const provider = appSettings?.ai_provider as string | undefined;
    const keyMap: Record<string, string> = { openai: "openai_api_key", claude: "claude_api_key", deepseek: "deepseek_api_key", gemini: "gemini_api_key" };
    const apiKey = provider ? appSettings?.[keyMap[provider]] : undefined;

    if (!provider || !apiKey) {
      await api.post("/api/tasks", { title: text, scope: memoScope, column: "todo", priority: "Medium" });
      showToast(`✓ ${text}`);
      setAiInput(""); fetchTasks(); return;
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
        result = JSON.parse((await r.json()).choices[0].message.content);
      } else if (provider === "claude") {
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST", headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
          body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 200, system: sysPrompt, messages: [{ role: "user", content: text }] }),
        });
        result = JSON.parse((await r.json()).content[0].text);
      } else if (provider === "deepseek") {
        const r = await fetch("https://api.deepseek.com/chat/completions", {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ model: "deepseek-chat", messages: [{ role: "system", content: sysPrompt }, { role: "user", content: text }], temperature: 0 }),
        });
        result = JSON.parse((await r.json()).choices[0].message.content);
      } else if (provider === "gemini") {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: `${sysPrompt}\n\nUser: ${text}` }] }] }),
        });
        const raw = (await r.json()).candidates[0].content.parts[0].text.replace(/```json\n?|\n?```/g, "").trim();
        result = JSON.parse(raw);
      }

      if (result) {
        await api.post("/api/tasks", { title: result.title || text, scope: memoScope, column: "todo", priority: "Medium", ...(result.due ? { due: result.due } : {}) });
        showToast(`✓ ${result.title || text}`);
      }
      setAiInput(""); fetchTasks();
    } catch {
      await api.post("/api/tasks", { title: text, scope: memoScope, column: "todo", priority: "Medium" });
      showToast(`✓ ${text}`);
      setAiInput(""); fetchTasks();
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <section>
      {/* ── Section header ── */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2 transition-colors hover:opacity-80"
        >
          <h3 className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-bold)" } as React.CSSProperties}>
            {t("home.memo.title")}
          </h3>
          {undoneCount > 0 && (
            <span className="text-[12px] tabular-nums px-1.5 py-0.5 rounded-[var(--radius-4)]"
              style={{ background: "var(--color-bg-tertiary)", color: "var(--color-text-secondary)", fontWeight: "var(--font-weight-bold)" } as React.CSSProperties}>
              {undoneCount}
            </span>
          )}
          <div style={{ color: "var(--color-text-quaternary)" }}>
            {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </div>
        </button>
        <button
          onClick={() => { setAddingSimple(true); setCollapsed(false); }}
          className="flex items-center gap-1 text-[13px] transition-colors hover:opacity-80 press-feedback"
          style={{ color: "var(--color-accent)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}
        >
          <Plus size={14} /> {t("home.memo.add")}
        </button>
      </div>

      {/* ── Collapsible body ── */}
      {!collapsed && (
        <div className="card overflow-hidden">

          {/* ── Week strip — compact, clean ── */}
          <div className="flex items-stretch px-1">
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
                  className="flex-1 flex flex-col items-center py-2.5 transition-all rounded-[var(--radius-8)]"
                  style={{
                    background: isSelected
                      ? "var(--color-bg-tertiary)"
                      : "transparent",
                  }}
                >
                  <span className="text-[11px] leading-none" style={{
                    color: isToday ? "var(--color-accent)" : "var(--color-text-quaternary)",
                    fontWeight: isToday ? "var(--font-weight-bold)" : "var(--font-weight-medium)",
                  } as React.CSSProperties}>
                    {dayLabels[i]}
                  </span>
                  <span className="flex items-center justify-center tabular-nums mt-1" style={{
                    width: 30, height: 30, borderRadius: "50%", fontSize: 14,
                    fontWeight: isToday ? "var(--font-weight-bold)" : "var(--font-weight-regular)",
                    background: isToday ? "var(--color-accent)" : "transparent",
                    color: isToday ? "var(--color-text-on-color)" : "var(--color-text-primary)",
                  } as React.CSSProperties}>
                    {d.getDate()}
                  </span>
                  {/* Dot indicator — larger, clearer */}
                  <div className="mt-1" style={{
                    width: 5, height: 5, borderRadius: "50%",
                    background: info
                      ? (allDone ? "var(--color-success)" : "var(--color-accent)")
                      : "transparent",
                  }} />
                </button>
              );
            })}
          </div>

          {/* ── Selected day chip ── */}
          {selectedDay && (
            <div className="flex items-center gap-2 mx-3 mb-1 mt-0.5 px-2.5 py-1.5 rounded-[var(--radius-6)]" style={{ background: "var(--color-bg-tertiary)" }}>
              <Calendar size={12} style={{ color: "var(--color-text-tertiary)" }} />
              <span className="text-[12px] flex-1" style={{ color: "var(--color-text-secondary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
                {selectedDay === todayStr
                  ? t("home.memo.today")
                  : new Date(selectedDay + "T00:00:00").toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", { month: "short", day: "numeric", weekday: "short" })
                }
                {displayedMemos.length === 0 && ` · ${t("home.memo.noItems")}`}
              </span>
              <button onClick={() => setSelectedDay(null)} className="btn-icon-sm" style={{ marginRight: -4 }}><X size={12} /></button>
            </div>
          )}

          {/* ── AI quick input — accent-tinted area ── */}
          <div
            className="flex items-center gap-2.5 mx-3 my-2 px-3 py-2 rounded-[var(--radius-8)]"
            style={{ background: "var(--color-bg-tertiary)" }}
          >
            <ScopeToggle value={memoScope} onChange={setMemoScope} lang={lang} />
            <input
              type="text" value={aiInput}
              onChange={e => setAiInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) addMemoByAi(); }}
              placeholder={lang === "zh" ? "输入备忘，AI 自动识别日期…" : "Type a memo, AI picks up dates…"}
              disabled={aiLoading}
              className="input-base flex-1 px-0 py-0.5 text-[13px]"
              style={{ background: "transparent", border: "none", boxShadow: "none" }}
            />
            {aiInput.trim() && (
              <button onClick={addMemoByAi} disabled={aiLoading}
                className="flex items-center justify-center shrink-0 rounded-full transition-colors"
                style={{ width: 28, height: 28, background: "var(--color-accent)", color: "var(--color-text-on-color)" }}>
                {aiLoading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              </button>
            )}
          </div>

          {/* ── Memo list — whitespace separated, no dividers ── */}
          <div className="px-3 pb-2">
            {displayedMemos.length > 0 ? (
              <div className="flex flex-col gap-0.5">
                {displayedMemos.map((task) => {
                  const isDone = task.column === "done";
                  const isEditing = editingId === task.id;
                  const timeStr = task.due && task.due.length > 10 ? task.due.slice(11, 16) : null;
                  const dateLabel = task.due
                    ? (() => {
                        const ds = task.due!.slice(0, 10);
                        const datePart = selectedDay ? null : ds === todayStr ? t("home.memo.today") : new Date(ds + "T00:00:00").toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", { month: "numeric", day: "numeric" });
                        if (datePart && timeStr) return `${datePart} ${timeStr}`;
                        return datePart || timeStr || null;
                      })()
                    : null;

                  if (isEditing) {
                    return (
                      <div key={task.id} className="px-2 py-3 space-y-2.5 rounded-[var(--radius-8)] anim-appear" style={{ background: "var(--color-bg-tertiary)" }}>
                        <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) saveEdit(); if (e.key === "Escape") cancelEdit(); }}
                          className="input-base w-full px-2.5 py-2 text-[14px]" autoFocus />
                        <div className="flex items-center gap-2 flex-wrap">
                          <Calendar size={13} className="shrink-0" style={{ color: "var(--color-text-quaternary)" }} />
                          <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                            className="input-base px-2 py-1.5 text-[13px]" style={{ color: editDate ? "var(--color-text-primary)" : "var(--color-text-quaternary)" }} />
                          <TimePicker24 value={editTime} onChange={setEditTime} />
                          {(editDate || editTime) && <button onClick={() => { setEditDate(""); setEditTime(""); }} className="btn-icon-sm"><X size={12} /></button>}
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={saveEdit} disabled={!editTitle.trim()} className="btn-primary compact text-[13px] disabled:opacity-40">{t("common.save")}</button>
                          <button onClick={cancelEdit} className="btn-ghost compact text-[13px]">{t("common.cancel")}</button>
                          <div className="flex-1" />
                          <button onClick={() => { cancelEdit(); deleteTask(task.id); }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-[var(--radius-6)] text-[13px] transition-colors"
                            style={{ background: "color-mix(in srgb, var(--color-error) 8%, transparent)", color: "var(--color-error)", border: "none" }}>
                            <Trash2 size={12} /> {t("common.delete")}
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-2.5 px-1 py-2 rounded-[var(--radius-8)] cursor-pointer transition-colors hover:bg-[var(--color-bg-tertiary)] press-feedback anim-appear"
                      onClick={() => startEdit(task)}
                    >
                      {/* Toggle circle — 44px touch target */}
                      <button className="shrink-0 flex items-center justify-center"
                        style={{ width: 44, height: 44, marginLeft: -8, marginTop: -8, marginBottom: -8, borderRadius: "50%", background: "transparent", border: "none" }}
                        onClick={e => { e.stopPropagation(); toggleTask(task); }}>
                        {isDone
                          ? <div className="flex items-center justify-center rounded-full" style={{ width: 20, height: 20, background: "var(--color-success)" }}>
                              <Check size={12} strokeWidth={2.5} style={{ color: "var(--color-text-on-color)" }} />
                            </div>
                          : <div className="rounded-full" style={{ width: 20, height: 20, border: "2px solid var(--color-border-secondary)" }} />
                        }
                      </button>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <span className="text-[14px] block truncate" style={{
                          color: isDone ? "var(--color-text-quaternary)" : "var(--color-text-primary)",
                          textDecoration: isDone ? "line-through" : "none",
                        }}>{task.title}</span>
                        {/* Meta row: scope badge + date */}
                        {(dateLabel || task.scope) && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <ScopeBadge scope={task.scope || "work-memo"} lang={lang} />
                            {dateLabel && (
                              <span className="text-[11px] tabular-nums" style={{ color: "var(--color-text-quaternary)" }}>
                                {dateLabel}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : !addingSimple ? (
              /* ── Empty state — guided template ── */
              <div className="flex flex-col items-center py-8 gap-3">
                <div className="flex items-center justify-center rounded-full" style={{
                  width: 44, height: 44,
                  background: "var(--color-bg-tertiary)",
                }}>
                  <StickyNote size={20} style={{ color: "var(--color-text-tertiary)" }} />
                </div>
                <div className="text-center">
                  <div className="text-[14px]" style={{ color: "var(--color-text-secondary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
                    {t("home.memo.empty")}
                  </div>
                  <p className="text-[12px] mt-1" style={{ color: "var(--color-text-quaternary)" }}>
                    {lang === "zh" ? "工作与个人备忘统一管理" : "Work & personal memos in one place"}
                  </p>
                </div>
                <button
                  onClick={() => setAddingSimple(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-6)] text-[13px] transition-colors press-feedback mt-1"
                  style={{
                    background: "var(--color-accent)",
                    color: "var(--color-text-on-color)",
                    fontWeight: "var(--font-weight-medium)",
                  } as React.CSSProperties}
                >
                  <Plus size={14} /> {t("home.memo.add")}
                </button>
              </div>
            ) : null}

            {/* ── Manual add inline ── */}
            {addingSimple && (
              <div className="p-2 mt-1 space-y-2 rounded-[var(--radius-8)]" style={{ background: "var(--color-bg-tertiary)" }}>
                <div className="flex items-center gap-2">
                  <ScopeToggle value={memoScope} onChange={setMemoScope} lang={lang} size="md" />
                  <input type="text" value={simpleTitle} onChange={e => setSimpleTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) addMemo(); if (e.key === "Escape") { setAddingSimple(false); setSimpleTitle(""); setSimpleDate(""); setSimpleTime(""); } }}
                    placeholder={t("home.memo.placeholder")} className="input-base flex-1 px-2.5 py-2 text-[14px]" autoFocus />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Calendar size={13} className="shrink-0" style={{ color: "var(--color-text-quaternary)" }} />
                  <input type="date" value={simpleDate} onChange={e => setSimpleDate(e.target.value)}
                    className="input-base px-2 py-1 text-[13px]" style={{ color: simpleDate ? "var(--color-text-primary)" : "var(--color-text-quaternary)" }} />
                  <TimePicker24 value={simpleTime} onChange={setSimpleTime} />
                  {(simpleDate || simpleTime) && <button onClick={() => { setSimpleDate(""); setSimpleTime(""); }} className="btn-icon-sm"><X size={12} /></button>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={addMemo} disabled={!simpleTitle.trim()} className="btn-primary compact text-[13px] disabled:opacity-40">{t("common.add")}</button>
                  <button onClick={() => { setAddingSimple(false); setSimpleTitle(""); setSimpleDate(""); setSimpleTime(""); }} className="btn-ghost compact text-[13px]">{t("common.cancel")}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
