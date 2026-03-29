import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Plus, X } from "lucide-react";
import { useT } from "../../../i18n/context";
import { useWidgetScale } from "./useWidgetScale";

const STORAGE_KEY = "solo-ceo-countdowns";
const LEGACY_KEY = "solo-ceo-countdown";
const DAY_MS = 86400000;
const HOUR_MS = 3600000;
const REFRESH_MS = 60000;
const MAX_ITEMS = 3;

const COLORS = [
  "var(--color-blue)",
  "var(--color-success)",
  "var(--color-accent)",
];

interface CountdownItem {
  id: string;
  name: string;
  date: string;
  color: string;
  createdAt: string;
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function loadItems(): CountdownItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const old = JSON.parse(legacy);
      if (old && old.date) {
        const migrated: CountdownItem = {
          id: genId(), name: old.name || "", date: old.date,
          color: COLORS[0], createdAt: new Date().toISOString(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify([migrated]));
        localStorage.removeItem(LEGACY_KEY);
        return [migrated];
      }
    }
  } catch {}
  return [];
}

function saveItems(items: CountdownItem[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch {}
}

function calcDays(dateStr: string): number {
  const target = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.ceil((target.getTime() - todayStart.getTime()) / DAY_MS);
}

function calcHoursRemaining(dateStr: string): number {
  const target = new Date(dateStr + "T23:59:59");
  return Math.max(0, Math.ceil((target.getTime() - Date.now()) / HOUR_MS));
}

function calcProgress(createdAt: string, dateStr: string): number {
  const created = new Date(createdAt).getTime();
  const target = new Date(dateStr + "T00:00:00").getTime();
  const total = target - created;
  if (total <= 0) return 1;
  return Math.min(1, Math.max(0, (Date.now() - created) / total));
}

function nextColor(items: CountdownItem[]): string {
  const used = new Set(items.map((i) => i.color));
  for (const c of COLORS) if (!used.has(c)) return c;
  return COLORS[items.length % COLORS.length];
}

/* ── Progress Ring ── */
function ProgressRing({ progress, color, size, strokeWidth, children }: {
  progress: number; color: string; size: number; strokeWidth: number; children: React.ReactNode;
}) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(1, Math.max(0, progress)));
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-border-primary)" strokeWidth={strokeWidth} opacity={0.4} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{ transition: "stroke-dashoffset 0.6s ease" }} />
      </svg>
      <div className="relative flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

/* ── Display text ── */
function useDisplayText(item: CountdownItem, t: (key: string) => string) {
  const days = calcDays(item.date);
  const hours = calcHoursRemaining(item.date);
  const progress = calcProgress(item.createdAt, item.date);

  if (days < 0) {
    const passedText = (t("widgets.countdown.passed" as any) || "{n} days ago").replace("{n}", String(Math.abs(days)));
    return { label: passedText, value: "", passed: true, progress: 1, color: item.color };
  }
  if (days <= 1) return { label: t("widgets.countdown.hours" as any), value: String(hours), passed: false, progress, color: item.color };
  if (days <= 30) return { label: t("widgets.countdown.days" as any), value: String(days), passed: false, progress, color: item.color };
  const w = Math.floor(days / 7), d = days % 7;
  const value = `${w}${t("widgets.countdown.weeks" as any)}${d}${t("widgets.countdown.days" as any)}`;
  return { label: "", value, passed: false, progress, color: item.color };
}

/* ── Compact row ── */
function CompactItem({ item, onRemove, onEdit, t, s }: {
  key?: React.Key; item: CountdownItem; onRemove: (id: string) => void; onEdit: (item: CountdownItem) => void; t: (key: string) => string; s: (px: number) => number;
}) {
  const d = useDisplayText(item, t);
  return (
    <div className="group flex items-center w-full press-feedback relative" style={{ minHeight: s(22), gap: s(6) }}>
      <div className="rounded-full shrink-0" style={{ width: s(5), height: s(5), backgroundColor: item.color }} />
      <button onClick={() => onEdit(item)} className="flex-1 flex items-center justify-between min-w-0 text-left">
        <span className="truncate max-w-[55%]" style={{ fontSize: s(11), color: d.passed ? "var(--color-text-quaternary)" : "var(--color-text-secondary)" }}>
          {item.name || t("widgets.countdown.name" as any)}
        </span>
        <span className="font-semibold tabular-nums shrink-0" style={{ fontSize: s(11), color: d.passed ? "var(--color-text-quaternary)" : item.color }}>
          {d.passed ? d.label : d.value || d.label}
        </span>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
        className=" shrink-0 press-feedback p-0.5 rounded-full"
        style={{ color: "var(--color-text-quaternary)" }}
        aria-label={t("common.delete" as any)}
      >
        <X size={s(9)} />
      </button>
    </div>
  );
}

/* ── Large single item ── */
function LargeItem({ item, onRemove, onEdit, t, s }: {
  item: CountdownItem; onRemove: (id: string) => void; onEdit: (item: CountdownItem) => void; t: (key: string) => string; s: (px: number) => number;
}) {
  const d = useDisplayText(item, t);
  return (
    <div className="group flex flex-col items-center justify-center flex-1 relative w-full">
      <button onClick={() => onEdit(item)} className="flex flex-col items-center press-feedback">
        {d.passed ? (
          <span style={{ fontSize: s(11), color: "var(--color-text-quaternary)" }}>{d.label}</span>
        ) : d.value ? (
          <ProgressRing progress={d.progress} color={d.color} size={s(48)} strokeWidth={s(2.5)}>
            <span className="font-bold tabular-nums leading-none" style={{ fontSize: s(17), color: "var(--color-text-primary)" }}>{d.value}</span>
            {d.label && <span className="mt-0.5" style={{ fontSize: s(9), color: "var(--color-text-tertiary)" }}>{d.label}</span>}
          </ProgressRing>
        ) : (
          <span className="font-semibold tabular-nums" style={{ fontSize: s(11), color: item.color }}>{d.label}</span>
        )}
        {item.name && (
          <span className="max-w-full truncate" style={{ fontSize: s(10), marginTop: s(4), color: "var(--color-text-secondary)" }}>{item.name}</span>
        )}
      </button>
      <button
        onClick={() => onRemove(item.id)}
        className="absolute top-0 right-0  press-feedback p-0.5 rounded-full"
        style={{ color: "var(--color-text-quaternary)" }}
        aria-label={t("common.delete" as any)}
      >
        <X size={s(9)} />
      </button>
    </div>
  );
}

/* ── Edit Form ── */
function EditForm({ initialName, initialDate, isNew, onSave, onCancel, t, s }: {
  initialName: string; initialDate: string; isNew: boolean;
  onSave: (name: string, date: string) => void; onCancel: () => void; t: (key: string) => string; s: (px: number) => number;
}) {
  const [name, setName] = useState(initialName);
  const [date, setDate] = useState(initialDate);
  return (
    <div className="flex flex-col items-center w-full px-1" style={{ gap: s(6) }}>
      <span style={{ fontSize: s(11), fontWeight: 600, color: "var(--color-text-primary)" }}>
        {isNew ? t("widgets.countdown.addTitle" as any) : t("widgets.countdown.editTitle" as any)}
      </span>
      <input
        type="text" value={name} onChange={(e) => setName(e.target.value)}
        placeholder={t("widgets.countdown.name" as any)}
        className="w-full bg-transparent outline-none text-center placeholder:text-[var(--color-text-quaternary)]"
        style={{ fontSize: s(11), color: "var(--color-text-primary)", padding: `${s(5)}px ${s(8)}px`, borderRadius: s(8), border: "1.5px solid var(--color-border-translucent)" }}
      />
      <input
        type="date" value={date} onChange={(e) => setDate(e.target.value)}
        className="w-full bg-transparent outline-none text-center"
        style={{ fontSize: s(11), color: "var(--color-text-primary)", padding: `${s(5)}px ${s(8)}px`, borderRadius: s(8), border: "1.5px solid var(--color-border-translucent)" }}
      />
      <div className="flex items-center w-full" style={{ gap: s(6) }}>
        <button
          onClick={onCancel}
          className="flex-1 press-feedback rounded-[var(--radius-8)] active:scale-[0.97] transition-transform"
          style={{ padding: `${s(5)}px 0`, fontSize: s(10), color: "var(--color-text-quaternary)", border: "1px solid var(--color-border-translucent)" }}
        >
          {t("widgets.countdown.cancel" as any)}
        </button>
        <button
          onClick={() => date && onSave(name.trim(), date)}
          className="flex-1 press-feedback rounded-[var(--radius-8)] active:scale-[0.97] transition-transform"
          style={{ padding: `${s(5)}px 0`, fontSize: s(10), fontWeight: 600, background: "var(--color-accent-tint)", color: "var(--color-accent)" }}
        >
          {t("widgets.countdown.confirm" as any)}
        </button>
      </div>
    </div>
  );
}

/* ── Main Widget ── */
function CountdownWidget() {
  const { t } = useT();
  const [items, setItems] = useState<CountdownItem[]>(loadItems);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const { s } = useWidgetScale(rootRef);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  const handleRemove = useCallback((id: string) => {
    setItems((prev) => { const next = prev.filter((i) => i.id !== id); saveItems(next); return next; });
  }, []);
  const handleEdit = useCallback((item: CountdownItem) => setEditingId(item.id), []);
  const handleAdd = useCallback(() => setEditingId("new"), []);
  const handleCancel = useCallback(() => setEditingId(null), []);

  const handleSave = useCallback((name: string, date: string) => {
    setItems((prev) => {
      let next: CountdownItem[];
      if (editingId === "new") {
        next = [...prev, { id: genId(), name, date, color: nextColor(prev), createdAt: new Date().toISOString() }];
      } else {
        next = prev.map((i) => i.id === editingId ? { ...i, name, date } : i);
      }
      saveItems(next);
      return next;
    });
    setEditingId(null);
  }, [editingId]);

  const editingItem = useMemo(() => {
    if (!editingId || editingId === "new") return null;
    return items.find((i) => i.id === editingId) || null;
  }, [editingId, items]);

  const title = t("widgets.countdown" as any) || "Countdown";
  const isEditing = editingId !== null;
  const canAdd = items.length < MAX_ITEMS && !isEditing;

  return (
    <div ref={rootRef} className="h-full flex flex-col overflow-hidden" style={{ padding: `${s(12)}px ${s(6)}px ${s(6)}px` }}>
      {/* Header */}
      <div className="shrink-0" style={{ marginBottom: s(4), paddingInline: s(4) }}>
        <span style={{ fontSize: s(13), fontWeight: 700, color: "var(--color-accent)", lineHeight: 1 }}>
          {title}
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-0">
        {isEditing ? (
          <EditForm
            initialName={editingId === "new" ? "" : editingItem?.name || ""}
            initialDate={editingId === "new" ? "" : editingItem?.date || ""}
            isNew={editingId === "new"}
            onSave={handleSave} onCancel={handleCancel} t={t} s={s}
          />
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center" style={{ gap: s(2) }}>
            <span style={{ fontSize: s(11), color: "var(--color-text-quaternary)", textAlign: "center" }}>
              {t("widgets.countdown.trackDates" as any)}
            </span>
            <button
              onClick={handleAdd}
              className="flex items-center gap-1 press-feedback rounded-[var(--radius-8)] active:scale-[0.97] transition-transform"
              style={{ padding: `${s(6)}px ${s(14)}px`, fontSize: s(11), fontWeight: 600, background: "var(--color-accent-tint)", color: "var(--color-accent)" }}
            >
              <Plus size={s(11)} />
              {t("widgets.countdown.new" as any)}
            </button>
          </div>
        ) : items.length === 1 ? (
          <LargeItem item={items[0]} onRemove={handleRemove} onEdit={handleEdit} t={t} s={s} />
        ) : (
          <div className="flex flex-col w-full flex-1 justify-center" style={{ gap: s(2) }}>
            {items.map((item) => (
              <CompactItem key={item.id} item={item} onRemove={handleRemove} onEdit={handleEdit} t={t} s={s} />
            ))}
          </div>
        )}

        {canAdd && items.length > 0 && (
          <button
            onClick={handleAdd}
            className="flex items-center justify-center mt-1.5 press-feedback shrink-0 rounded-[var(--radius-8)] w-full active:scale-[0.97] transition-transform"
            style={{ padding: `${s(5)}px 0`, color: "var(--color-accent)", fontSize: s(10), fontWeight: 500, gap: s(2), border: "1px dashed var(--color-border-translucent)" }}
          >
            <Plus size={s(10)} />
            {t("widgets.countdown.add" as any)}
          </button>
        )}
      </div>
    </div>
  );
}

export default React.memo(CountdownWidget);
