import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useT } from "../../../i18n/context";
import { useWidgetScale } from "./useWidgetScale";

interface Task {
  id: string;
  title: string;
  due: string | null;
  column: string;
}

function MiniCalendarWidget() {
  const { t, lang } = useT();
  const [viewDate, setViewDate] = useState(() => new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const { s } = useWidgetScale(containerRef);

  const today = useMemo(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth(), date: d.getDate() };
  }, []);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/tasks");
        const data = await res.json();
        if (!cancelled && Array.isArray(data)) setTasks(data.filter((t: Task) => t.due));
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  const taskMap = useMemo(() => {
    const map: Record<string, { active: boolean; done: boolean }> = {};
    for (const task of tasks) {
      if (!task.due) continue;
      const key = task.due.slice(0, 10);
      if (!map[key]) map[key] = { active: false, done: false };
      if (task.column === "done") map[key].done = true;
      else map[key].active = true;
    }
    return map;
  }, [tasks]);

  const selectedTasks = useMemo(() => {
    if (!selectedDate) return [];
    return tasks.filter((t) => t.due && t.due.slice(0, 10) === selectedDate);
  }, [selectedDate, tasks]);

  const dayNames = lang === "zh"
    ? ["日", "一", "二", "三", "四", "五", "六"]
    : ["S", "M", "T", "W", "T", "F", "S"];

  const monthName = lang === "zh"
    ? `${month + 1}月`
    : viewDate.toLocaleString("en", { month: "short" });

  const days = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const startPad = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: { day: number; current: boolean; dateStr: string }[] = [];
    for (let i = 0; i < startPad; i++) cells.push({ day: 0, current: false, dateStr: "" });
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        day: d, current: true,
        dateStr: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      });
    }
    const remaining = 7 - (cells.length % 7);
    if (remaining < 7) for (let i = 0; i < remaining; i++) cells.push({ day: 0, current: false, dateStr: "" });
    return cells;
  }, [year, month]);

  const weeks = useMemo(() => {
    const rows: typeof days[] = [];
    for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
    return rows;
  }, [days]);

  const goPrev = () => { setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1)); setSelectedDate(null); };
  const goNext = () => { setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1)); setSelectedDate(null); };
  const goToday = () => { setViewDate(new Date()); setSelectedDate(null); };

  const isToday = (day: number) => day === today.date && month === today.month && year === today.year;

  useEffect(() => {
    if (!selectedDate) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setSelectedDate(null);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("touchstart", handler); };
  }, [selectedDate]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);
  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) goNext(); else goPrev();
    }
  }, []);

  const handleDateClick = (dateStr: string) => {
    if (!dateStr) return;
    if (taskMap[dateStr]) {
      setSelectedDate((prev) => (prev === dateStr ? null : dateStr));
    }
  };

  const isCurrentMonth = month === today.month && year === today.year;

  return (
    <div
      ref={containerRef}
      className="h-full flex flex-col overflow-hidden relative"
      style={{ padding: `${s(12)}px ${s(6)}px ${s(6)}px` }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Header: month + nav */}
      <div className="shrink-0 flex items-center justify-between" style={{ marginBottom: s(4), paddingInline: s(4) }}>
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: s(13), fontWeight: 700, color: "var(--color-accent)", lineHeight: 1, cursor: "pointer" }} onClick={goToday}>
            {monthName}
          </span>
          {!isCurrentMonth && (
            <span style={{ fontSize: s(10), color: "var(--color-text-quaternary)" }}>
              {year}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0">
          {!isCurrentMonth && (
            <button
              onClick={goToday}
              className="press-feedback rounded-full"
              style={{ fontSize: s(9), color: "var(--color-accent)", padding: `${s(1)}px ${s(6)}px`, background: "var(--color-accent-tint)" }}
            >
              {t("widgets.calendar.today")}
            </button>
          )}
          <button onClick={goPrev} className="flex items-center justify-center press-feedback" style={{ width: s(22), height: s(22), color: "var(--color-text-quaternary)" }} aria-label="Prev">
            <ChevronLeft size={s(13)} />
          </button>
          <button onClick={goNext} className="flex items-center justify-center press-feedback" style={{ width: s(22), height: s(22), color: "var(--color-text-quaternary)" }} aria-label="Next">
            <ChevronRight size={s(13)} />
          </button>
        </div>
      </div>

      {/* Day names */}
      <div className="grid shrink-0" style={{ gridTemplateColumns: "repeat(7, 1fr)", marginBottom: s(2) }}>
        {dayNames.map((name, i) => (
          <div key={i} className="text-center" style={{ fontSize: s(10), fontWeight: 600, color: "var(--color-text-quaternary)", lineHeight: 1 }}>
            {name}
          </div>
        ))}
      </div>

      {/* Date grid */}
      <div className="flex-1 flex flex-col justify-evenly">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
            {week.map((cell, ci) => {
              if (cell.day === 0) return <div key={ci} />;
              const td = isToday(cell.day);
              const hasTasks = !!taskMap[cell.dateStr];
              const isSel = selectedDate === cell.dateStr;

              return (
                <div
                  key={ci}
                  className="flex flex-col items-center justify-center"
                  style={{ cursor: hasTasks ? "pointer" : "default" }}
                  onClick={() => handleDateClick(cell.dateStr)}
                >
                  <span
                    className="flex items-center justify-center tabular-nums"
                    style={{
                      width: s(20), height: s(20), borderRadius: "50%",
                      fontSize: s(11), fontWeight: td ? 700 : 400,
                      background: td ? "var(--color-accent)" : isSel ? "color-mix(in srgb, var(--color-accent) 12%, transparent)" : "transparent",
                      color: td ? "var(--color-text-on-color)" : "var(--color-text-primary)",
                      transition: "background 0.15s",
                    }}
                  >
                    {cell.day}
                  </span>
                  {hasTasks && (
                    <div style={{
                      width: s(3), height: s(3), borderRadius: s(1.5), marginTop: s(1),
                      background: taskMap[cell.dateStr].active ? "var(--color-accent)" : "var(--color-success)",
                    }} />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Task popover */}
      {selectedDate && selectedTasks.length > 0 && (
        <div
          ref={popoverRef}
          className="absolute left-2 right-2"
          style={{
            bottom: s(8), padding: `${s(8)}px ${s(10)}px`, borderRadius: s(12),
            background: "var(--color-bg-secondary)", border: "1px solid var(--color-border-primary)",
            boxShadow: "var(--shadow-high)", zIndex: 10,
          }}
        >
          <div style={{ fontSize: s(10), fontWeight: 600, color: "var(--color-text-tertiary)", marginBottom: s(4) }}>
            {selectedDate}
          </div>
          {selectedTasks.slice(0, 3).map((task) => (
            <div key={task.id} className="flex items-center" style={{ gap: s(6), paddingBlock: s(2) }}>
              <span style={{ width: s(3), height: s(3), borderRadius: "50%", flexShrink: 0, background: task.column === "done" ? "var(--color-success)" : "var(--color-accent)" }} />
              <span className="truncate" style={{ fontSize: s(11), fontWeight: 500, color: "var(--color-text-primary)", textDecoration: task.column === "done" ? "line-through" : "none", opacity: task.column === "done" ? 0.5 : 1 }}>
                {task.title}
              </span>
            </div>
          ))}
          {selectedTasks.length > 3 && (
            <div style={{ fontSize: s(10), color: "var(--color-text-quaternary)", marginTop: s(3) }}>
              +{selectedTasks.length - 3} {t("widgets.calendar.more")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default React.memo(MiniCalendarWidget);
