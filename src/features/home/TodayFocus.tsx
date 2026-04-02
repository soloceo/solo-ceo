import React, { useMemo, useState } from "react";
import { Check, Undo2, ChevronDown, ChevronRight, ChevronRight as ArrowRight, DollarSign, Package, Settings, Clock, AlertTriangle, StickyNote, User } from "lucide-react";
import { useT } from "../../i18n/context";
import { useUIStore } from "../../store/useUIStore";

/* ── Types ──────────────────────────────────────────────────────── */
export type FocusItem = {
  key: string;
  type: string;
  title: string;
  reason: string;
  actionHint: string;
  status?: "pending" | "completed";
  isManual?: boolean;
  entityType?: "task" | "memo" | "lead" | "milestone" | null;
  entityId?: number | null;
  dueDate?: string | null;
  isOverdue?: boolean;
  daysOverdue?: number;
};

/* ── Props ──────────────────────────────────────────────────────── */
interface TodayFocusProps {
  todayFocus: FocusItem[];
  dueTodayItems: FocusItem[];
  loading: boolean;
  onUpdateStatus: (key: string, status: "pending" | "completed") => Promise<void>;
}

export function TodayFocus({
  todayFocus,
  dueTodayItems,
  loading,
  onUpdateStatus,
}: TodayFocusProps) {
  const { t, lang } = useT();
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const handleStatus = async (key: string, status: "pending" | "completed") => {
    setSavingKey(key);
    try {
      await onUpdateStatus(key, status);
    } catch {
      // update status failed
    } finally {
      setSavingKey(null);
    }
  };

  /* ── Navigate to entity ── */
  const handleNavigate = (item: FocusItem) => {
    if (!item.entityType || !item.entityId) return;
    switch (item.entityType) {
      case "task":
        setActiveTab("work");
        setTimeout(() => window.dispatchEvent(new CustomEvent("navigate-to-entity", { detail: { type: "task", id: item.entityId } })), 200);
        break;
      case "lead":
        setActiveTab("leads");
        setTimeout(() => window.dispatchEvent(new CustomEvent("navigate-to-entity", { detail: { type: "lead", id: item.entityId } })), 200);
        break;
      case "memo": {
        const el = document.querySelector(`[data-memo-id="${item.entityId}"]`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add("highlight-pulse");
          setTimeout(() => el.classList.remove("highlight-pulse"), 2000);
        }
        break;
      }
      case "milestone":
        setActiveTab("clients");
        setTimeout(() => window.dispatchEvent(new CustomEvent("navigate-to-entity", { detail: { type: "milestone", id: item.entityId } })), 200);
        break;
    }
  };

  /* ── Due today: split into pending/completed ── */
  const dueItems = dueTodayItems || [];
  const focusItems = todayFocus || [];
  const duePending = useMemo(() => dueItems.filter((i) => i.status !== "completed"), [dueItems]);
  const dueCompleted = useMemo(() => dueItems.filter((i) => i.status === "completed"), [dueItems]);

  /* ── AI focus: one per type, pending vs completed ── */
  const aiPending = useMemo(() => {
    const all = focusItems.filter((i) => i.status !== "completed");
    const seen = new Set<string>();
    return all.filter((item) => { if (seen.has(item.type)) return false; seen.add(item.type); return true; });
  }, [focusItems]);

  const aiCompleted = useMemo(() => focusItems.filter((i) => i.status === "completed"), [focusItems]);
  const allCompleted = [...dueCompleted, ...aiCompleted];

  const [showCompleted, setShowCompleted] = useState(false);

  const revenueLabel = t("home.focus.revenue");
  const deliveryLabel = t("home.focus.delivery");

  const badgeConfig = (type: string): { variant: "success" | "warning" | "accent" | "info" | "danger"; icon: React.ElementType } => {
    if (type === revenueLabel || type === "收入") return { variant: "success", icon: DollarSign };
    if (type === deliveryLabel || type === "交付") return { variant: "accent", icon: Package };
    if (type === "个人") return { variant: "info", icon: User };
    if (type === "备忘") return { variant: "info", icon: StickyNote };
    return { variant: "warning", icon: Settings };
  };

  return (
    <section>
      {/* Header */}
      <div className="flex items-center mb-3">
        <h3 className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-bold)" } as React.CSSProperties}>
          {t("home.focus.title")}
        </h3>
      </div>

      {/* ── Tier 1: Due Today / Overdue ── */}
      {duePending.length > 0 && (
        <div className="card overflow-hidden mb-3">
          <div className="flex items-center gap-1.5 px-4 pt-3 pb-1.5">
            <Clock size={12} style={{ color: "var(--color-text-tertiary)" }} />
            <span className="text-[12px]" style={{ color: "var(--color-text-tertiary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>
              {lang === "zh" ? "截止事项" : "Due Items"}
            </span>
            <span className="text-[11px] tabular-nums px-1.5 py-0.5 rounded-[var(--radius-4)]"
              style={{ background: "color-mix(in srgb, var(--color-error) 8%, transparent)", color: "var(--color-error)", fontWeight: "var(--font-weight-bold)" } as React.CSSProperties}>
              {duePending.length}
            </span>
          </div>
          <div className="flex flex-col">
            {duePending.map((item) => (
              <FocusRow
                key={item.key}
                item={item}
                badge={badgeConfig(item.type)}
                saving={savingKey === item.key}
                onToggle={() => handleStatus(item.key, "completed")}
                onNavigate={() => handleNavigate(item)}
                urgency={item.isOverdue ? "overdue" : "today"}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Tier 2: AI Recommended Focus ── */}
      <div className="card overflow-hidden">
        {duePending.length > 0 && (
          <div className="flex items-center gap-1.5 px-4 pt-3 pb-1.5">
            <span className="text-[12px]" style={{ color: "var(--color-text-tertiary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>
              {lang === "zh" ? "AI 推荐" : "AI Recommended"}
            </span>
          </div>
        )}
        <div className="flex flex-col">
          {aiPending.map((item) => (
            <FocusRow
              key={item.key}
              item={item}
              badge={badgeConfig(item.type)}
              saving={savingKey === item.key}
              onToggle={() => handleStatus(item.key, "completed")}
              onNavigate={() => handleNavigate(item)}
            />
          ))}
        </div>

        {/* Empty state */}
        {!loading && !aiPending.length && !duePending.length && (
          <div className="px-4 py-8 text-center">
            <div className="flex items-center justify-center mx-auto mb-3 rounded-full" style={{
              width: 48, height: 48,
              background: "color-mix(in srgb, var(--color-success) 8%, transparent)",
            }}>
              <Check size={22} style={{ color: "var(--color-success)" }} />
            </div>
            <div className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>
              {t("home.focus.allDoneTitle")}
            </div>
            <p className="text-[13px] mt-1" style={{ color: "var(--color-text-quaternary)" }}>
              {t("home.focus.allDoneHint")}
            </p>
          </div>
        )}
      </div>

      {/* Completed toggle */}
      {allCompleted.length > 0 && (
        <>
          <button
            onClick={() => setShowCompleted((p) => !p)}
            className="flex items-center gap-1.5 mt-3 text-[13px] transition-colors"
            style={{ color: "var(--color-text-quaternary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}
          >
            {showCompleted ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {t("home.completed.title", { count: allCompleted.length })}
          </button>
          {showCompleted && (
            <div className="card mt-1.5 overflow-hidden">
              <div className="flex flex-col">
                {allCompleted.map((item) => (
                  <div key={item.key} className="flex items-center gap-3 px-4 py-2.5 group">
                    <div className="shrink-0 flex items-center justify-center rounded-full" style={{ width: 18, height: 18, background: "var(--color-success)" }}>
                      <Check size={10} strokeWidth={2.5} style={{ color: "var(--color-text-on-color)" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] line-through truncate" style={{ color: "var(--color-text-quaternary)" }}>{item.title}</p>
                    </div>
                    <button
                      onClick={() => handleStatus(item.key, "pending")}
                      disabled={savingKey === item.key}
                      className="btn-icon-sm transition-all disabled:opacity-50"
                      aria-label="Undo completion"
                    >
                      <Undo2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/* ── Focus Row ────────────────────────────────────────────────────── */
function FocusRow({ item, badge, saving, onToggle, onNavigate, urgency }: {
  item: FocusItem;
  badge: { variant: "success" | "warning" | "accent" | "info" | "danger"; icon: React.ElementType };
  saving: boolean;
  onToggle: () => void;
  onNavigate: () => void;
  urgency?: "overdue" | "today";
}) {
  const colorMap: Record<string, string> = {
    success: "var(--color-success)",
    accent: "var(--color-accent)",
    warning: "var(--color-warning)",
    info: "var(--color-info)",
    danger: "var(--color-error)",
  };
  const badgeColor = colorMap[badge.variant];
  const BadgeIcon = badge.icon;
  const hasLink = !!(item.entityType && item.entityId);

  return (
    <div className="flex items-start gap-3 px-4 py-3.5 group transition-colors hover:bg-[var(--color-bg-tertiary)]">
      {/* Checkbox — 44px touch target */}
      <button
        onClick={onToggle}
        className="shrink-0 mt-0.5 flex items-center justify-center"
        style={{ width: 44, height: 44, marginLeft: -12, marginTop: -10, marginBottom: -10, borderRadius: "50%", background: "transparent", border: "none", opacity: saving ? 0.5 : 1 }}
      >
        <div className="rounded-full" style={{ width: 20, height: 20, border: "2px solid var(--color-border-secondary)" }} />
      </button>

      {/* Content — clickable for navigation */}
      <div
        className={`flex-1 min-w-0 ${hasLink ? "cursor-pointer" : ""}`}
        onClick={hasLink ? onNavigate : undefined}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[14px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
            {item.title}
          </span>
          {/* Type badge */}
          <span
            className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[var(--radius-4)] text-[11px]"
            style={{
              background: `color-mix(in srgb, ${badgeColor} 10%, transparent)`,
              color: badgeColor,
              fontWeight: "var(--font-weight-semibold)",
            } as React.CSSProperties}
          >
            <BadgeIcon size={10} />
            {item.type}
          </span>
          {/* Urgency badge */}
          {urgency === "overdue" && (
            <span
              className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[var(--radius-4)] text-[11px]"
              style={{
                background: "color-mix(in srgb, var(--color-error) 10%, transparent)",
                color: "var(--color-error)",
                fontWeight: "var(--font-weight-semibold)",
              } as React.CSSProperties}
            >
              <AlertTriangle size={10} />
              {item.reason}
            </span>
          )}
          {urgency === "today" && (
            <span
              className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[var(--radius-4)] text-[11px]"
              style={{
                background: "color-mix(in srgb, var(--color-warning) 10%, transparent)",
                color: "var(--color-warning)",
                fontWeight: "var(--font-weight-semibold)",
              } as React.CSSProperties}
            >
              <Clock size={10} />
              {item.reason}
            </span>
          )}
        </div>
        {/* Reason (only show for AI recommended items, not urgency items which show reason in badge) */}
        {!urgency && item.reason && (
          <p className="text-[12px] mt-1.5 leading-relaxed" style={{ color: "var(--color-text-tertiary)" }}>{item.reason}</p>
        )}
      </div>

      {/* Navigate arrow */}
      {hasLink && (
        <button
          onClick={onNavigate}
          className="shrink-0 mt-0.5 opacity-0 group-hover:opacity-60 transition-opacity"
          style={{ color: "var(--color-text-quaternary)" }}
        >
          <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
}
