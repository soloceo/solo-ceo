import React, { useMemo } from "react";
import { Check, ChevronRight as ArrowRight, DollarSign, Package, Settings, Clock, AlertTriangle, StickyNote, User } from "lucide-react";
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
}

export function TodayFocus({
  todayFocus,
  dueTodayItems,
  loading,
}: TodayFocusProps) {
  const { t, lang } = useT();
  const setActiveTab = useUIStore((s) => s.setActiveTab);

  /* ── Navigate to entity ── */
  const navigateToEntity = (tab: string, type: string, id: number | string) => {
    setActiveTab(tab as Parameters<typeof setActiveTab>[0]);
    requestAnimationFrame(() => {
      setTimeout(() => window.dispatchEvent(new CustomEvent("navigate-to-entity", { detail: { type, id } })), 150);
    });
  };

  const handleNavigate = (item: FocusItem) => {
    if (!item.entityType || !item.entityId) return;
    switch (item.entityType) {
      case "task":
        navigateToEntity("work", "task", item.entityId);
        break;
      case "lead":
        navigateToEntity("leads", "lead", item.entityId);
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
        navigateToEntity("clients", "milestone", item.entityId);
        break;
    }
  };

  /* ── Due today items ── */
  const dueItems = useMemo(() => dueTodayItems || [], [dueTodayItems]);
  const focusItems = useMemo(() => todayFocus || [], [todayFocus]);

  /* ── AI focus: one per type ── */
  const aiItems = useMemo(() => {
    const seen = new Set<string>();
    return focusItems.filter((item) => { if (seen.has(item.type)) return false; seen.add(item.type); return true; });
  }, [focusItems]);

  const revenueLabel = t("home.focus.revenue");
  const deliveryLabel = t("home.focus.delivery");

  const badgeConfig = (type: string): { variant: "success" | "warning" | "accent" | "info" | "danger"; icon: React.ElementType } => {
    if (type === revenueLabel || type === "收入") return { variant: "success", icon: DollarSign };
    if (type === deliveryLabel || type === "交付") return { variant: "accent", icon: Package };
    if (type === "个人") return { variant: "warning", icon: User };
    if (type === "备忘") return { variant: "warning", icon: StickyNote };
    return { variant: "info", icon: Settings };
  };

  return (
    <section>
      {/* Header */}
      <div className="mb-3">
        <h3 className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-bold)" } as React.CSSProperties}>
          {t("home.focus.title")}
        </h3>
        <p className="text-[12px] mt-1" style={{ color: "var(--color-text-quaternary)" }}>{t("home.focus.desc")}</p>
      </div>

      {/* ── Tier 1: Due Today / Overdue ── */}
      {dueItems.length > 0 && (
        <div className="card overflow-hidden mb-3">
          <div className="flex items-center gap-1.5 px-4 pt-3 pb-1.5">
            <Clock size={12} style={{ color: "var(--color-text-tertiary)" }} />
            <span className="text-[12px]" style={{ color: "var(--color-text-tertiary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>
              {lang === "zh" ? "截止事项" : "Due Items"}
            </span>
            <span className="text-[11px] tabular-nums px-1.5 py-0.5 rounded-[var(--radius-4)]"
              style={{ background: "color-mix(in srgb, var(--color-error) 8%, transparent)", color: "var(--color-error)", fontWeight: "var(--font-weight-bold)" } as React.CSSProperties}>
              {dueItems.length}
            </span>
          </div>
          <div className="flex flex-col">
            {dueItems.map((item) => (
              <FocusRow
                key={item.key}
                item={item}
                badge={badgeConfig(item.type)}
                onNavigate={() => handleNavigate(item)}
                urgency={item.isOverdue ? "overdue" : "today"}
                lang={lang}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Tier 2: AI Recommended Focus ── */}
      <div className="card overflow-hidden">
        {dueItems.length > 0 && (
          <div className="flex items-center gap-1.5 px-4 pt-3 pb-1.5">
            <span className="text-[12px]" style={{ color: "var(--color-text-tertiary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>
              {lang === "zh" ? "AI 推荐" : "AI Recommended"}
            </span>
          </div>
        )}
        <div className="flex flex-col">
          {aiItems.map((item) => (
            <FocusRow
              key={item.key}
              item={item}
              badge={badgeConfig(item.type)}
              onNavigate={() => handleNavigate(item)}
              lang={lang}
            />
          ))}
        </div>

        {/* Empty state */}
        {!loading && !aiItems.length && !dueItems.length && (
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
    </section>
  );
}

/* ── Focus Row ────────────────────────────────────────────────────── */

function FocusRow({ item, badge, onNavigate, urgency }: {
  item: FocusItem;
  badge: { variant: "success" | "warning" | "accent" | "info" | "danger"; icon: React.ElementType };
  onNavigate: () => void;
  urgency?: "overdue" | "today";
  lang: string;
}) {
  const colorMap: Record<string, string> = {
    success: "var(--color-success)",
    accent: "var(--color-accent)",
    warning: "var(--color-warning)",
    info: "var(--color-purple)",
    danger: "var(--color-error)",
  };
  const badgeColor = colorMap[badge.variant];
  const hasLink = !!(item.entityType && item.entityId);

  return (
    <div
      className={`flex items-center gap-3 group transition-colors hover:bg-[var(--color-bg-tertiary)] px-4 py-2.5 ${hasLink ? "cursor-pointer" : ""}`}
      style={{ borderBottom: "1px solid var(--color-border-primary)" }}
      onClick={hasLink ? onNavigate : undefined}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[14px] truncate" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
            {item.title}
          </span>
          <span
            className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-[var(--radius-4)] text-[10px]"
            style={{ background: `color-mix(in srgb, ${badgeColor} 8%, transparent)`, color: badgeColor, fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}
          >
            {item.type}
          </span>
          {urgency === "overdue" && (
            <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[var(--radius-4)] text-[10px]"
              style={{ background: "color-mix(in srgb, var(--color-error) 8%, transparent)", color: "var(--color-error)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>
              <AlertTriangle size={9} />{item.reason}
            </span>
          )}
          {urgency === "today" && (
            <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[var(--radius-4)] text-[10px]"
              style={{ background: "color-mix(in srgb, var(--color-warning) 8%, transparent)", color: "var(--color-warning)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>
              <Clock size={9} />{item.reason}
            </span>
          )}
        </div>
      </div>
      {hasLink && (
        <div className="shrink-0 opacity-40 group-hover:opacity-60 transition-opacity" style={{ color: "var(--color-text-quaternary)" }}>
          <ArrowRight size={14} />
        </div>
      )}
    </div>
  );
}
