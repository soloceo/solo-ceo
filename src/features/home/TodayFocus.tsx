import React, { useMemo, useState } from "react";
import { Check, Undo2, ChevronDown, ChevronRight, DollarSign, Package, Settings } from "lucide-react";
import { useT } from "../../i18n/context";

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

/* ── Props ──────────────────────────────────────────────────────── */
interface TodayFocusProps {
  todayFocus: FocusItem[];
  loading: boolean;
  onUpdateStatus: (key: string, status: "pending" | "completed") => Promise<void>;
}

export function TodayFocus({
  todayFocus,
  loading,
  onUpdateStatus,
}: TodayFocusProps) {
  const { t } = useT();
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

  /* ── Derived — one item per type (revenue/delivery/system) ── */
  const pending = useMemo(() => {
    const all = todayFocus.filter((i) => i.status !== "completed");
    const seen = new Set<string>();
    return all.filter((item) => { if (seen.has(item.type)) return false; seen.add(item.type); return true; });
  }, [todayFocus]);

  const completed = useMemo(() => todayFocus.filter((i) => i.status === "completed"), [todayFocus]);

  const [showCompleted, setShowCompleted] = useState(false);

  const revenueLabel = t("home.focus.revenue");
  const deliveryLabel = t("home.focus.delivery");

  const badgeVariant = (type: string): "success" | "warning" | "accent" =>
    type === revenueLabel ? "success" : type === deliveryLabel ? "accent" : "warning";

  const badgeIcon = (type: string) =>
    type === revenueLabel ? DollarSign : type === deliveryLabel ? Package : Settings;

  return (
    <section>
      {/* Header — clean, no action button */}
      <div className="flex items-center mb-3">
        <h3 className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-bold)" } as React.CSSProperties}>
          {t("home.focus.title")}
        </h3>
      </div>

      {/* Focus list */}
      <div className="card overflow-hidden">
        <div className="flex flex-col">
          {pending.map((item) => (
            <FocusRow
              key={item.key}
              item={item}
              badgeVariant={badgeVariant(item.type)}
              badgeIcon={badgeIcon(item.type)}
              saving={savingKey === item.key}
              onToggle={() => handleStatus(item.key, "completed")}
            />
          ))}
        </div>

        {/* Empty state */}
        {!loading && !pending.length && (
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
      {completed.length > 0 && (
        <>
          <button
            onClick={() => setShowCompleted((p) => !p)}
            className="flex items-center gap-1.5 mt-3 text-[13px] transition-colors"
            style={{ color: "var(--color-text-quaternary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}
          >
            {showCompleted ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {t("home.completed.title", { count: completed.length })}
          </button>
          {showCompleted && (
            <div className="card mt-1.5 overflow-hidden">
              <div className="flex flex-col">
                {completed.map((item) => (
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

/* ── Focus Row — pure display + toggle ──────────────────────────── */
function FocusRow({ item, badgeVariant, badgeIcon: BadgeIcon, saving, onToggle }: {
  item: FocusItem;
  badgeVariant: "success" | "warning" | "accent";
  badgeIcon: React.ElementType;
  saving: boolean;
  onToggle: () => void;
}) {
  const badgeColorMap = {
    success: "var(--color-success)",
    accent: "var(--color-accent)",
    warning: "var(--color-warning)",
  };
  const badgeColor = badgeColorMap[badgeVariant];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
      className="flex items-start gap-3 px-4 py-3.5 group cursor-pointer transition-colors hover:bg-[var(--color-bg-tertiary)] press-feedback"
    >
      {/* Checkbox */}
      <div className="shrink-0 mt-0.5 transition-colors" style={{ opacity: saving ? 0.5 : 1 }}>
        <div className="rounded-full" style={{ width: 20, height: 20, border: "2px solid var(--color-border-secondary)" }} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[14px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
            {item.title}
          </span>
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
        </div>
        {item.reason && (
          <p className="text-[12px] mt-1.5 leading-relaxed" style={{ color: "var(--color-text-tertiary)" }}>{item.reason}</p>
        )}
      </div>
    </div>
  );
}
