import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useT } from "../../../i18n/context";
import { useWidgetScale } from "./useWidgetScale";
import { api } from "../../../lib/api";

interface ActivityItem {
  activity: string;
  detail?: string;
  time: string;
  type?: string;
  action?: string;
}

interface GroupedItem {
  activity: string;
  type?: string;
  action?: string;
  time: string;
  count: number;
}

const POLL_INTERVAL = 30000;
const TIME_REFRESH = 60000;
const GROUP_WINDOW_MS = 5 * 60 * 1000;
const VISIBLE_COUNT = 3;

function dotColor(type?: string, action?: string): string {
  if (action === "deleted") return "var(--color-danger)";
  if (action === "paid") return "var(--color-success)";
  if (action === "undo_paid") return "var(--color-warning)";
  if (action === "converted") return "var(--color-success)";
  switch (type) {
    case "lead": return "var(--color-accent)";
    case "client": return "var(--color-blue)";
    case "task": return "var(--color-warning)";
    case "finance": return "var(--color-success)";
    case "milestone": return "var(--color-accent)";
    default: return "var(--color-text-tertiary)";
  }
}

function ago(iso: string, t: (k: string) => string) {
  if (!iso) return "";
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return t("home.activity.justNow");
  if (m < 60) return String(t("home.activity.minutesAgo") || "").replace("{n}", String(m));
  const h = Math.floor(m / 60);
  if (h < 24) return String(t("home.activity.hoursAgo") || "").replace("{n}", String(h));
  return String(t("home.activity.daysAgo") || "").replace("{n}", String(Math.floor(h / 24)));
}

function groupItems(items: ActivityItem[]): GroupedItem[] {
  if (!items.length) return [];
  const sorted = [...items].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  const groupMap = new Map<string, GroupedItem>();

  for (const item of sorted) {
    const ts = new Date(item.time).getTime();
    // Create a time bucket key (round to GROUP_WINDOW_MS intervals)
    const bucket = Math.floor(ts / GROUP_WINDOW_MS);
    const key = `${item.type}|${item.action}|${bucket}`;

    const existing = groupMap.get(key);
    if (existing) {
      existing.count++;
      if (ts > new Date(existing.time).getTime()) existing.time = item.time;
    } else {
      groupMap.set(key, {
        activity: item.activity,
        type: item.type,
        action: item.action,
        time: item.time,
        count: 1,
      });
    }
  }

  return Array.from(groupMap.values()).sort(
    (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
  );
}

function ActivityWidget() {
  const { t, lang } = useT();
  const [rawItems, setRawItems] = useState<ActivityItem[]>([]);
  const [, setTick] = useState(0);
  const prevCountRef = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const { s } = useWidgetScale(rootRef);

  const fetchActivity = useCallback(() => {
    api.get<any>("/api/dashboard")
      .then((d) => {
        if (!d || typeof d !== 'object') return;
        const raw = Array.isArray(d.recentActivity) ? d.recentActivity : [];
        const items: ActivityItem[] = raw.slice(0, 20);
        setRawItems(items);
        prevCountRef.current = items.length;
      })
      .catch(() => { /* activity load failed */ });
  }, []);

  useEffect(() => {
    fetchActivity();
    const id = setInterval(fetchActivity, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchActivity]);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), TIME_REFRESH);
    return () => clearInterval(id);
  }, []);

  const grouped = useMemo(() => groupItems(rawItems), [rawItems]);
  const [expanded, setExpanded] = useState(false);
  const visible = useMemo(() => expanded ? grouped : grouped.slice(0, VISIBLE_COUNT), [grouped, expanded]);

  /* Empty state */
  if (!rawItems.length) {
    return (
      <div ref={rootRef} className="h-full flex flex-col items-center justify-center overflow-hidden" style={{ padding: `${s(12)}px ${s(6)}px ${s(6)}px`, gap: s(6) }}>
        <span style={{ fontSize: s(13), fontWeight: 700, color: "var(--color-accent)", lineHeight: 1 }}>
          {t("home.activity.title")}
        </span>
        <span style={{ fontSize: s(11), color: "var(--color-text-quaternary)" }}>
          {t("home.activity.emptyHint")}
        </span>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="h-full flex flex-col overflow-hidden" style={{ padding: `${s(12)}px ${s(6)}px ${s(6)}px` }}>
      {/* Header */}
      <div className="flex items-center justify-between shrink-0" style={{ paddingInline: s(4), marginBottom: s(6) }}>
        <span style={{ fontSize: s(13), fontWeight: 700, color: "var(--color-accent)", lineHeight: 1 }}>
          {t("home.activity.title")}
        </span>
        <span className="tabular-nums" style={{ fontSize: s(10), color: "var(--color-text-quaternary)" }}>
          {rawItems.length}
        </span>
      </div>

      {/* List */}
      <div className="flex-1 flex flex-col justify-center min-h-0 overflow-hidden" style={{ gap: s(2) }}>
        {visible.map((item, idx) => {
          const c = dotColor(item.type, item.action);
          return (
            <div key={`${item.time}-${idx}`} className="flex items-center" style={{ paddingInline: s(4), gap: s(6) }}>
              {/* Color dot */}
              <div
                className="shrink-0 rounded-full"
                style={{ width: s(5), height: s(5), background: c }}
              />
              {/* Activity text */}
              <span className="flex-1 min-w-0 truncate" style={{ fontSize: s(11), color: "var(--color-text-secondary)" }}>
                {item.activity}
                {item.count > 1 && (
                  <span
                    className="ml-0.5"
                    style={{ fontSize: s(9), color: c, fontWeight: 600, background: `color-mix(in srgb, ${c} 8%, transparent)`, borderRadius: "var(--radius-2)", padding: "0 3px" }}
                  >
                    x{item.count}
                  </span>
                )}
              </span>
              {/* Time */}
              <span className="shrink-0 tabular-nums" style={{ fontSize: s(9), color: "var(--color-text-quaternary)" }}>
                {ago(item.time, t)}
              </span>
            </div>
          );
        })}
      </div>

      {/* More / collapse toggle */}
      {grouped.length > VISIBLE_COUNT && (
        <div className="shrink-0 text-center" style={{ marginTop: s(4) }}>
          <button
            onClick={() => setExpanded(p => !p)}
            className="tabular-nums cursor-pointer transition-colors hover:opacity-80"
            style={{ fontSize: s(9), color: "var(--color-accent)", background: "none", border: "none", padding: 0 }}
          >
            {expanded
              ? t("common.collapse")
              : `+${grouped.length - VISIBLE_COUNT} ${t("widgets.calendar.more")}`
            }
          </button>
        </div>
      )}
    </div>
  );
}

export default React.memo(ActivityWidget);
