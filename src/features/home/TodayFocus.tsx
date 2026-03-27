import React, { useMemo, useState } from "react";
import { Check, Circle, Undo2, ChevronDown, ChevronRight, Pencil, Trash2, Plus } from "lucide-react";
import { useT } from "../../i18n/context";
import { Button, Badge, Modal } from "../../components/ui";

/* ── Types ──────────────────────────────────────────────────────── */
export type FocusItem = {
  key: string;
  type: string;
  title: string;
  reason: string;
  actionHint: string;
  status?: "pending" | "completed";
  isManual?: boolean;
};

type ManualForm = { type: string; title: string; note: string };

/* ── Props ──────────────────────────────────────────────────────── */
interface TodayFocusProps {
  todayFocus: FocusItem[];
  manualEvents: FocusItem[];
  loading: boolean;
  onUpdateStatus: (key: string, status: "pending" | "completed") => Promise<void>;
  onSaveManual: (form: ManualForm, editKey?: string) => Promise<void>;
  onDeleteManual: (item: FocusItem) => Promise<void>;
  openFormTrigger?: number;
}

export function TodayFocus({
  todayFocus,
  manualEvents,
  loading,
  onUpdateStatus,
  onSaveManual,
  onDeleteManual,
  openFormTrigger,
}: TodayFocusProps) {
  const { t } = useT();
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const emptyForm: ManualForm = { type: t("home.form.type.system" as any), title: "", note: "" };
  const [form, setForm] = useState<ManualForm>(emptyForm);

  const skipKey = `today-focus-skipped-${new Date().toISOString().split("T")[0]}`;
  const [skipped, setSkipped] = useState<string[]>(() => {
    try { const s = localStorage.getItem(skipKey); return s ? JSON.parse(s) : []; } catch { return []; }
  });

  React.useEffect(() => {
    try { localStorage.setItem(skipKey, JSON.stringify(skipped)); } catch {}
  }, [skipped, skipKey]);

  // Open form when FAB is tapped (trigger increments)
  React.useEffect(() => {
    if (openFormTrigger && openFormTrigger > 0) {
      setEditKey(null);
      setForm(emptyForm);
      setShowForm(true);
    }
  }, [openFormTrigger]);

  const handleStatus = async (key: string, status: "pending" | "completed") => {
    setSavingKey(key);
    try {
      await onUpdateStatus(key, status);
      if (status === "pending") setSkipped((p) => p.filter((k) => k !== key));
    } catch (e) {
      console.error("Failed to update status:", e);
    } finally {
      setSavingKey(null);
    }
  };

  const handleDelete = async (item: FocusItem) => {
    setSavingKey(item.key);
    try {
      await onDeleteManual(item);
    } catch (e) {
      console.error("Failed to delete item:", e);
    } finally {
      setSavingKey(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSubmitting(true);
    try {
      await onSaveManual(form, editKey || undefined);
      setForm(emptyForm);
      setEditKey(null);
      setShowForm(false);
    } catch (e) {
      console.error("Failed to save item:", e);
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (item: FocusItem) => {
    setEditKey(item.key);
    setForm({ type: item.type, title: item.title, note: item.reason || "" });
    setShowForm(true);
  };

  /* ── Derived ── */
  const pending = useMemo(() => {
    const all = todayFocus.filter((i) => i.status !== "completed" && !skipped.includes(i.key));
    const seen = new Set<string>();
    return all.filter((item) => { if (seen.has(item.type)) return false; seen.add(item.type); return true; });
  }, [todayFocus, skipped]);

  const completed = useMemo(() => todayFocus.filter((i) => i.status === "completed"), [todayFocus]);
  const pendingManual = useMemo(() => manualEvents.filter((i) => i.status !== "completed"), [manualEvents]);
  const completedManual = useMemo(() => manualEvents.filter((i) => i.status === "completed"), [manualEvents]);

  const [showCompleted, setShowCompleted] = useState(false);

  const revenueLabel = t("home.focus.revenue" as any);
  const deliveryLabel = t("home.focus.delivery" as any);

  const badgeVariant = (type: string) =>
    type === revenueLabel ? "success" as const : type === deliveryLabel ? "blue" as const : "default" as const;

  return (
    <section>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>
          {t("home.focus.title" as any)}
        </h3>
        <button
          onClick={() => { setEditKey(null); setForm(emptyForm); setShowForm(true); }}
          className="flex items-center gap-1 text-[14px] transition-colors hover:opacity-80"
          style={{ color: "var(--color-text-quaternary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}
        >
          <Plus size={14} /> {t("home.quickMemo" as any)}
        </button>
      </div>

      {/* Issue list */}
      <div className="card overflow-hidden divide-y divide-[var(--color-line-secondary)]">
        {pending.map((item) => {
          const sameType = todayFocus.filter((i) => i.type === item.type && i.status !== "completed" && !skipped.includes(i.key));
          return (
            <FocusRow
              key={item.key}
              item={item}
              badgeVariant={badgeVariant(item.type)}
              saving={savingKey === item.key}
              canSwap={sameType.length > 1}
              onToggle={() => handleStatus(item.key, "completed")}
              onSkip={() => setSkipped((p) => [...new Set([...p, item.key])])}
            />
          );
        })}
        {pendingManual.map((item) => (
          <FocusRow
            key={item.key}
            item={item}
            badgeVariant={badgeVariant(item.type)}
            saving={savingKey === item.key}
            canSwap={false}
            onToggle={() => handleStatus(item.key, "completed")}
            onEdit={() => startEdit(item)}
            onDelete={() => handleDelete(item)}
          />
        ))}

        {/* Empty state */}
        {!loading && !pending.length && !pendingManual.length && (
          <div className="px-4 py-5 text-center">
            <div className="text-[15px]" style={{ color: "var(--color-success)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
              {t("home.focus.allDoneEmoji" as any)}
            </div>
          </div>
        )}
      </div>

      {/* Completed toggle */}
      {(completed.length > 0 || completedManual.length > 0) && (
        <>
          <button
            onClick={() => setShowCompleted((p) => !p)}
            className="flex items-center gap-1.5 mt-3 text-[13px] transition-colors"
            style={{ color: "var(--color-text-quaternary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}
          >
            {showCompleted ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {t("home.completed.title" as any, { count: completed.length + completedManual.length })}
          </button>
          {showCompleted && (
            <div className="card mt-1.5 overflow-hidden divide-y divide-[var(--color-line-secondary)]">
              {[...completed, ...completedManual].map((item) => (
                <div key={item.key} className="flex items-center gap-2.5 px-3 py-2 group">
                  <Check size={14} style={{ color: "var(--color-success)" }} className="shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] line-through truncate" style={{ color: "var(--color-text-quaternary)" }}>{item.title}</p>
                  </div>
                  <button
                    onClick={() => handleStatus(item.key, "pending")}
                    disabled={savingKey === item.key}
                    className="btn-icon-sm lg:opacity-0 lg:group-hover:opacity-100 transition-all disabled:opacity-50"
                    aria-label="Undo completion"
                  >
                    <Undo2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Manual event form modal */}
      <Modal open={showForm} onClose={() => { setShowForm(false); setEditKey(null); }} title={editKey ? t("home.form.editEvent" as any) : t("home.quickMemo" as any)}>
        <form onSubmit={handleSave} className="space-y-3">
          <div className="space-y-1.5">
            <span className="text-[14px]" style={{ color: "var(--color-text-tertiary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{t("home.form.type" as any)}</span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: "revenue", label: t("home.form.type.revenue" as any), hint: t("home.form.typeHint.revenue" as any) },
                { key: "delivery", label: t("home.form.type.delivery" as any), hint: t("home.form.typeHint.delivery" as any) },
                { key: "system", label: t("home.form.type.system" as any), hint: t("home.form.typeHint.system" as any) },
              ].map((opt) => {
                const active = form.type === opt.label;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, type: opt.label }))}
                    className="card px-3 py-2 text-center transition-colors text-[14px]"
                    style={active ? { borderColor: "var(--color-accent)", background: "var(--color-accent-tint)" } : {}}
                  >
                    <span style={{ color: active ? "var(--color-accent)" : "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
                      {opt.label}
                    </span>
                    <p className="text-[10px] mt-1 leading-tight" style={{ color: active ? "var(--color-accent)" : "var(--color-text-quaternary)", opacity: active ? 0.8 : 1 }}>
                      {opt.hint}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-[14px]" style={{ color: "var(--color-text-tertiary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{t("home.form.title" as any)}</span>
            <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder={t("home.form.titlePlaceholder" as any)} className="input-base w-full px-3 py-2 text-[15px]" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[14px]" style={{ color: "var(--color-text-tertiary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{t("home.form.note" as any)}</span>
            <input value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} placeholder={t("home.form.notePlaceholder" as any)} className="input-base w-full px-3 py-2 text-[15px]" />
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" size="sm" type="button" onClick={() => { setShowForm(false); setEditKey(null); }}>
              {t("common.cancel" as any)}
            </Button>
            <Button size="sm" type="submit" disabled={submitting || !form.title.trim()} loading={submitting}>
              {editKey ? t("home.form.saveEdit" as any) : t("common.save" as any)}
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}

/* ── Focus Row (Linear issue-list style) ──────────────────────── */
function FocusRow({ item, badgeVariant, saving, canSwap, onToggle, onSkip, onEdit, onDelete }: {
  item: FocusItem;
  badgeVariant: "success" | "warning" | "accent";
  saving: boolean;
  canSwap?: boolean;
  onToggle: () => void;
  onSkip?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const { t } = useT();

  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 group transition-colors hover:bg-[var(--color-bg-tertiary)]">
      {/* Checkbox */}
      <button
        onClick={onToggle}
        disabled={saving}
        className="btn-icon-sm transition-colors disabled:opacity-50"
        aria-label="Mark as complete"
      >
        <Circle size={16} strokeWidth={1.5} />
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[15px] truncate" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
            {item.title}
          </span>
          <Badge variant={badgeVariant} className="shrink-0">{item.type}</Badge>
        </div>
        {item.reason && (
          <p className="text-[13px] mt-0.5 truncate" style={{ color: "var(--color-text-tertiary)" }}>{item.reason}</p>
        )}
      </div>

      {/* Actions — always visible on mobile, hover on desktop */}
      <div className="flex items-center gap-0.5 shrink-0 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
        {canSwap && onSkip && (
          <button
            onClick={onSkip}
            disabled={saving}
            className="text-[13px] px-2 py-1 rounded-[var(--radius-4)] hover:bg-[var(--color-bg-quaternary)] transition-colors"
            style={{ color: "var(--color-text-quaternary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}
          >
            {t("home.focus.swap" as any)}
          </button>
        )}
        {onEdit && (
          <button
            onClick={onEdit}
            className="btn-icon-sm"
            aria-label="Edit item"
          >
            <Pencil size={14} />
          </button>
        )}
        {onDelete && (
          <button
            onClick={onDelete}
            disabled={saving}
            className="btn-icon-sm disabled:opacity-50"
            style={{ color: "var(--color-danger)" }}
            aria-label="Delete item"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
