import React from "react";
import {
  UserPlus, UserCheck, Briefcase, CheckCircle2, DollarSign,
  Trash2, RefreshCw, FileText, Package, Activity,
} from "lucide-react";
import { useT } from "../../i18n/context";
import { EmptyState } from "../../components/ui/EmptyState";

export interface ActivityItem {
  activity: string;
  detail?: string;
  time: string;
  type?: string;   // entity_type: lead, client, task, finance, milestone, plan
  action?: string;  // created, updated, deleted, converted, paid, undo_paid
}

interface ActivityTimelineProps {
  items: ActivityItem[];
  loading: boolean;
}

/* ── Icon + color by entity type & action ── */
function activityIcon(type?: string, action?: string) {
  if (action === "deleted") return { icon: <Trash2 size={14} />, color: "var(--color-danger)" };
  if (action === "paid") return { icon: <DollarSign size={14} />, color: "var(--color-success)" };
  if (action === "undo_paid") return { icon: <RefreshCw size={14} />, color: "var(--color-warning)" };
  if (action === "converted") return { icon: <UserCheck size={14} />, color: "var(--color-success)" };

  switch (type) {
    case "lead": return { icon: <UserPlus size={14} />, color: "var(--color-accent)" };
    case "client": return { icon: <Briefcase size={14} />, color: "var(--color-blue)" };
    case "task": return { icon: <CheckCircle2 size={14} />, color: "var(--color-warning)" };
    case "finance": return { icon: <DollarSign size={14} />, color: "var(--color-success)" };
    case "milestone": return { icon: <DollarSign size={14} />, color: "var(--color-accent)" };
    case "plan": return { icon: <Package size={14} />, color: "var(--color-text-tertiary)" };
    default: return { icon: <Activity size={14} />, color: "var(--color-text-tertiary)" };
  }
}

/* ── Relative time ── */
function relativeTime(isoTime: string, t: (k: string) => string): string {
  if (!isoTime) return "";
  const now = Date.now();
  const then = new Date(isoTime).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return t("home.activity.justNow");
  if (diffMin < 60) return String(t("home.activity.minutesAgo") || "").replace("{n}", String(diffMin));
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return String(t("home.activity.hoursAgo") || "").replace("{n}", String(diffHours));
  const diffDays = Math.floor(diffHours / 24);
  return String(t("home.activity.daysAgo") || "").replace("{n}", String(diffDays));
}

export function ActivityTimeline({ items, loading }: ActivityTimelineProps) {
  const { t } = useT();

  if (loading) return null;
  if (!items.length) {
    return (
      <section>
        <div className="flex items-center gap-2 mb-2 px-1">
          <Activity size={14} style={{ color: "var(--color-text-quaternary)" }} />
          <h3 className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>
            {t("home.activity.title")}
          </h3>
        </div>
        <div className="card">
          <EmptyState title={t("home.activity.empty")} />
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-center gap-2 mb-2 px-1">
        <Activity size={14} style={{ color: "var(--color-text-quaternary)" }} />
        <h3 className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>
          {t("home.activity.title")}
        </h3>
        <span className="text-[13px] tabular-nums" style={{ color: "var(--color-text-tertiary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
          {items.length}
        </span>
      </div>

      <div className="card overflow-hidden">
        {items.map((item, i) => {
          const { icon, color } = activityIcon(item.type, item.action);
          const isLast = i === items.length - 1;

          return (
            <div
              key={`${item.time}-${i}`}
              className="flex gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--color-bg-tertiary)]"
              style={!isLast ? { borderBottom: "1px solid var(--color-line-tertiary)" } : undefined}
            >
              {/* Timeline dot */}
              <div className="flex flex-col items-center pt-0.5">
                <div
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                  style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}
                >
                  {icon}
                </div>
                {!isLast && (
                  <div className="flex-1 w-px mt-1" style={{ background: "var(--color-line-tertiary)" }} />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 py-0.5">
                <div className="text-[15px] truncate" style={{ color: "var(--color-text-primary)" }}>
                  {item.activity}
                </div>
                {item.detail && (
                  <div className="text-[13px] truncate mt-0.5" style={{ color: "var(--color-text-tertiary)" }}>
                    {item.detail}
                  </div>
                )}
              </div>

              {/* Time */}
              <span className="text-[13px] shrink-0 pt-0.5" style={{ color: "var(--color-text-quaternary)" }}>
                {relativeTime(item.time, t)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
