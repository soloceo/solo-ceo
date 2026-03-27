import React, { useState, useEffect, useRef, useCallback } from "react";
import { useT } from "../../../i18n/context";
import { useWidgetScale } from "./useWidgetScale";

const STORAGE_KEY = "solo-ceo-quick-notes";
const DEBOUNCE_MS = 500;
const MAX_NOTES = 5;
const MAX_CHARS = 500;

interface NotesData {
  notes: string[];
  activeIndex: number;
  timestamps: number[];
}

function loadNotes(): NotesData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.notes) && parsed.notes.length > 0) {
        return {
          notes: parsed.notes.slice(0, MAX_NOTES),
          activeIndex: Math.min(parsed.activeIndex ?? 0, parsed.notes.length - 1),
          timestamps: parsed.timestamps || parsed.notes.map(() => 0),
        };
      }
    }
  } catch {}
  try {
    const old = localStorage.getItem("solo-ceo-quick-note");
    if (old) {
      localStorage.removeItem("solo-ceo-quick-note");
      const data: NotesData = { notes: [old], activeIndex: 0, timestamps: [Date.now()] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return data;
    }
  } catch {}
  return { notes: [""], activeIndex: 0, timestamps: [0] };
}

function saveNotes(data: NotesData) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

export default function QuickNoteWidget() {
  const { t } = useT();
  const [data, setData] = useState<NotesData>(loadNotes);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const { s } = useWidgetScale(rootRef);

  const activeNote = data.notes[data.activeIndex] || "";

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  const persistData = useCallback((next: NotesData) => {
    setData(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveNotes(next), DEBOUNCE_MS);
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value.slice(0, MAX_CHARS);
    const next = { ...data, notes: [...data.notes], timestamps: [...data.timestamps] };
    next.notes[data.activeIndex] = val;
    next.timestamps[data.activeIndex] = Date.now();
    persistData(next);
  }, [data, persistData]);

  const switchNote = useCallback((idx: number) => {
    if (idx === data.activeIndex) return;
    persistData({ ...data, activeIndex: idx });
  }, [data, persistData]);

  const addNote = useCallback(() => {
    if (data.notes.length >= MAX_NOTES) return;
    persistData({
      notes: [...data.notes, ""],
      activeIndex: data.notes.length,
      timestamps: [...data.timestamps, 0],
    });
  }, [data, persistData]);

  const charRatio = activeNote.length / MAX_CHARS;

  return (
    <div ref={rootRef} className="h-full flex flex-col overflow-hidden" style={{ padding: `${s(12)}px ${s(8)}px ${s(6)}px` }}>
      {/* Header — title only */}
      <div className="shrink-0" style={{ paddingInline: s(2), marginBottom: s(4) }}>
        <span style={{ fontSize: s(13), fontWeight: 700, color: "var(--color-accent)", lineHeight: 1 }}>
          {t("widgets.quickNote" as any) || "Quick Note"}
        </span>
      </div>

      {/* Textarea — always active */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <textarea
          value={activeNote}
          onChange={handleChange}
          maxLength={MAX_CHARS}
          placeholder={t("widgets.quickNote.placeholder" as any) || "Quick note..."}
          className="w-full h-full leading-[1.5] resize-none border-none outline-none bg-transparent placeholder:text-[var(--color-text-quaternary)]"
          style={{ fontSize: s(12), color: "var(--color-text-primary)", padding: 0 }}
        />
      </div>

      {/* Bottom: dots + char count */}
      <div className="flex items-center justify-between shrink-0" style={{ marginTop: s(2) }}>
        <div className="flex items-center gap-1">
          {data.notes.map((_, i) => (
            <div
              key={i}
              onClick={() => switchNote(i)}
              style={{
                width: i === data.activeIndex ? s(10) : s(5),
                height: s(5),
                borderRadius: s(2.5),
                cursor: "pointer",
                background: i === data.activeIndex ? "var(--color-accent)" : "var(--color-border-subtle, rgba(128,128,128,0.2))",
                transition: "width 0.2s, background 0.2s",
              }}
              aria-label={`Note ${i + 1}`}
            />
          ))}
          {data.notes.length < MAX_NOTES && (
            <button
              onClick={addNote}
              style={{
                width: s(12), height: s(12), borderRadius: s(6),
                border: "1px dashed var(--color-text-quaternary)",
                background: "transparent", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: s(8), lineHeight: 1, color: "var(--color-text-quaternary)",
                padding: 0,
              }}
              aria-label="Add note"
            >
              +
            </button>
          )}
        </div>

        {activeNote.length > 0 && (
          <span
            className="tabular-nums"
            style={{ fontSize: s(9), color: charRatio > 0.9 ? "var(--color-danger)" : "var(--color-text-quaternary)" }}
          >
            {activeNote.length}/{MAX_CHARS}
          </span>
        )}
      </div>
    </div>
  );
}
