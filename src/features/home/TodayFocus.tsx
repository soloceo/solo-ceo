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
        <p className="text-[12px] mt-0.5" style={{ color: "var(--color-text-quaternary)" }}>{t("home.focus.desc")}</p>
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
/* ── Standard category definitions — always visible ── */
const typeHintMap: Record<string, { zh: string; en: string }> = {
  '收入': { zh: '开拓新生意：找客户、谈合作、发报价、签单', en: 'Win new business: find clients, pitch, quote, close deals' },
  '交付': { zh: '产出成果：写代码、做设计、完成客户项目', en: 'Produce output: code, design, ship to client' },
  '系统': { zh: '维护运转：催收款、对账、整理数据、优化流程', en: 'Keep it running: collect payments, reconcile, optimize' },
};

function FocusRow({ item, badge, onNavigate, urgency, lang }: {
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
    info: "var(--color-info)",
    danger: "var(--color-error)",
  };
  const badgeColor = colorMap[badge.variant];
  const BadgeIcon = badge.icon;
  const hasLink = !!(item.entityType && item.entityId);

  /* Dynamic reason: show only if different from static hint and not in urgency badge */
  const showDynamicReason = !urgency && item.reason && (() => {
    const hint = typeHintMap[item.type];
    const hintText = hint ? (lang === "zh" ? hint.zh : hint.en) : "";
    return item.reason !== hintText && !item.reason.includes(hintText);
  })();

  return (
    <div
      className={`flex items-stretch group transition-colors hover:bg-[var(--color-bg-tertiary)] ${hasLink ? "cursor-pointer" : ""}`}
      style={{ borderBottom: "1px solid var(--color-border-primary)" }}
      onClick={hasLink ? onNavigate : undefined}
    >
      {/* Left accent bar */}
      <div className="shrink-0" style={{ width: 3, background: badgeColor, borderRadius: "0 2px 2px 0" }} />

      <div className="flex items-start gap-3 flex-1 min-w-0 px-3.5 py-3">
        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Row 1: Title + badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
              {item.title}
            </span>
            {/* Type badge */}
            <span
              className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[var(--radius-4)] text-[10px]"
              style={{
                background: `color-mix(in srgb, ${badgeColor} 8%, transparent)`,
                color: badgeColor,
                fontWeight: "var(--font-weight-semibold)",
              } as React.CSSProperties}
            >
              <BadgeIcon size={9} />
              {item.type}
            </span>
            {/* Urgency badge */}
            {urgency === "overdue" && (
              <span
                className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[var(--radius-4)] text-[10px]"
                style={{
                  background: "color-mix(in srgb, var(--color-error) 8%, transparent)",
                  color: "var(--color-error)",
                  fontWeight: "var(--font-weight-semibold)",
                } as React.CSSProperties}
              >
                <AlertTriangle size={9} />
                {item.reason}
              </span>
            )}
            {urgency === "today" && (
              <span
                className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[var(--radius-4)] text-[10px]"
                style={{
                  background: "color-mix(in srgb, var(--color-warning) 8%, transparent)",
                  color: "var(--color-warning)",
                  fontWeight: "var(--font-weight-semibold)",
                } as React.CSSProperties}
              >
                <Clock size={9} />
                {item.reason}
              </span>
            )}
          </div>
          {/* Row 2: Category definition (always) + dynamic reason (when available) */}
          <p className="text-[11px] mt-1 leading-relaxed" style={{ color: "var(--color-text-quaternary)" }}>
            {typeHintMap[item.type]
              ? (lang === "zh" ? typeHintMap[item.type].zh : typeHintMap[item.type].en)
              : ""}
            {showDynamicReason && (
              <span style={{ color: "var(--color-text-tertiary)" }}>{" · "}{item.reason}</span>
            )}
          </p>
        </div>

        {/* Navigate arrow */}
        {hasLink && (
          <div className="shrink-0 mt-1 opacity-40 group-hover:opacity-60 transition-opacity"
            style={{ color: "var(--color-text-quaternary)" }}>
            <ArrowRight size={14} />
          </div>
        )}
      </div>
    </div>
  );
}
