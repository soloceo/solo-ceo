import React, { useState, useCallback } from "react";
import { Plus, Check, Circle, Trash2 } from "lucide-react";
import { useT } from "../../../i18n/context";
import { useWidgetScale } from "./useWidgetScale";

const STORAGE_KEY = "solo-ceo-weekly-learning";
const MAX_ITEMS = 10;
const MAX_CHARS = 100;

interface LearningItem { text: string; done: boolean }
interface LearningData { weekKey: string; items: LearningItem[] }

function getWeekKey() {
  const d = new Date();
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function loadData(): LearningData {
  const currentWeek = getWeekKey();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LearningData;
      if (parsed.weekKey === currentWeek) return parsed;
    }
  } catch {}
  return { weekKey: currentWeek, items: [] };
}

function saveData(data: LearningData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export default function LearningWidget() {
  const { t } = useT();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const { s } = useWidgetScale(containerRef);
  const [data, setData] = useState(loadData);
  const [input, setInput] = useState("");

  const update = useCallback((fn: (d: LearningData) => LearningData) => {
    setData(prev => {
      const next = fn(prev);
      saveData(next);
      return next;
    });
  }, []);

  const addItem = () => {
    const text = input.trim().slice(0, MAX_CHARS);
    if (!text || data.items.length >= MAX_ITEMS) return;
    update(d => ({ ...d, items: [...d.items, { text, done: false }] }));
    setInput("");
  };

  const toggleItem = (i: number) => {
    update(d => ({ ...d, items: d.items.map((item, idx) => idx === i ? { ...item, done: !item.done } : item) }));
  };

  const deleteItem = (i: number) => {
    update(d => ({ ...d, items: d.items.filter((_, idx) => idx !== i) }));
  };

  const doneCount = data.items.filter(i => i.done).length;

  return (
    <div ref={containerRef} className="card h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
        <span className="text-[13px]" style={{ color: "var(--color-text-secondary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>
          {t("widgets.learning" as any)}
        </span>
        {data.items.length > 0 && (
          <span className="text-[12px] tabular-nums" style={{ color: "var(--color-text-quaternary)" }}>
            {doneCount}/{data.items.length}
          </span>
        )}
      </div>

      {/* Input */}
      <div className="flex items-center gap-1 px-2 pb-1.5">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") addItem(); }}
          placeholder={t("widgets.learningPlaceholder" as any)}
          className="input-base flex-1 px-2 py-1 text-[13px]"
          maxLength={MAX_CHARS}
          style={{ minWidth: 0 }}
        />
        <button onClick={addItem} disabled={!input.trim() || data.items.length >= MAX_ITEMS} className="btn-icon-sm shrink-0 disabled:opacity-30">
          <Plus size={14} />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
        {data.items.length === 0 && (
          <p className="text-center text-[12px] py-3" style={{ color: "var(--color-text-quaternary)" }}>
            {t("widgets.learningEmpty" as any)}
          </p>
        )}
        {data.items.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 px-1 py-1 rounded-[var(--radius-4)] group cursor-pointer transition-colors hover:bg-[var(--color-bg-tertiary)]"
            onClick={() => toggleItem(i)}
          >
            {item.done
              ? <Check size={13} className="shrink-0" style={{ color: "var(--color-success)" }} />
              : <Circle size={13} className="shrink-0" style={{ color: "var(--color-border-secondary)" }} />
            }
            <span className="flex-1 text-[13px] leading-snug min-w-0 truncate" style={{
              color: item.done ? "var(--color-text-quaternary)" : "var(--color-text-primary)",
              textDecoration: item.done ? "line-through" : "none",
            }}>
              {item.text}
            </span>
            <button
              onClick={e => { e.stopPropagation(); deleteItem(i); }}
              className="btn-icon-sm shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Delete"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
