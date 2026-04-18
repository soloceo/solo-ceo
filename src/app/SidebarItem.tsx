import React from "react";
import { motion } from "motion/react";

export interface BadgeSegment { count: number; color: string; }

export const SidebarItem = React.memo(function SidebarItem({
  id, icon, label, active, expanded, onClick, badge, badgeSegments,
}: {
  id: string; icon: React.ReactNode; label: string; active: boolean; expanded: boolean;
  onClick: (id: string) => void; badge?: number; badgeSegments?: BadgeSegment[];
}) {
  const hasSegments = badgeSegments && badgeSegments.some(s => s.count > 0);

  return (
    <button
      onClick={() => onClick(id)}
      aria-current={active ? "page" : undefined}
      className={`group relative nav-glow flex items-center select-none cursor-pointer rounded-[var(--radius-6)] text-[15px] ${expanded ? "gap-2 px-2 py-1.5" : "justify-center w-9 h-9 mx-auto"}`}
      style={{
        color: active ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
        fontWeight: active ? "var(--font-weight-semibold)" : "var(--font-weight-normal)",
        border: "1px solid transparent",
        transition: "color 0.15s var(--ease-ios), font-weight 0.15s var(--ease-ios)",
      } as React.CSSProperties}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "var(--color-bg-tertiary)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}
    >
      {active && (
        <motion.div
          layoutId="sidebar-indicator"
          className="sidebar-indicator absolute inset-0 rounded-[var(--radius-6)]"
          style={{ background: "var(--color-bg-tertiary)" }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
      <span className="shrink-0 relative z-10" style={{ color: active ? "var(--color-text-primary)" : "var(--color-text-quaternary)" }}>
        {icon}
        {!expanded && (hasSegments || (badge !== undefined && badge > 0)) && (
          <span
            className="absolute -top-0.5 -right-0.5 w-[6px] h-[6px] rounded-full"
            style={{ background: "var(--color-text-quaternary)" }}
          />
        )}
      </span>
      {!expanded && (
        <span className="absolute left-full ml-2 px-2 py-1 text-[13px] whitespace-nowrap rounded-[var(--radius-4)] opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"
          style={{ background: "var(--color-text-primary)", color: "var(--color-bg-primary)", fontWeight: "var(--font-weight-medium)", boxShadow: "var(--shadow-medium)", zIndex: "var(--layer-header)" } as React.CSSProperties}>
          {label}
        </span>
      )}
      {expanded && (
        <>
          <span className="relative z-10 whitespace-nowrap truncate flex-1 min-w-0 text-left">{label}</span>
          {hasSegments ? (
            <span className="flex items-center gap-1">
              {badgeSegments!.map((seg, i) => seg.count > 0 && (
                <span
                  key={i}
                  className="flex items-center justify-center rounded-full text-[10px] tabular-nums"
                  style={{
                    minWidth: 18, height: 18, padding: "0 5px",
                    background: seg.color, color: "var(--color-text-on-color)",
                    fontWeight: "var(--font-weight-bold)", lineHeight: 1,
                  } as React.CSSProperties}
                >
                  {seg.count > 99 ? "99+" : seg.count}
                </span>
              ))}
            </span>
          ) : badge !== undefined && badge > 0 ? (
            <span
              className="text-[13px] tabular-nums"
              style={{ color: "var(--color-text-quaternary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}
            >
              {badge > 99 ? "99+" : badge}
            </span>
          ) : null}
        </>
      )}
    </button>
  );
});
