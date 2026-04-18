import React from "react";
import { motion } from "motion/react";
import type { TabId } from "../store/useUIStore";

export const MobileNavItem = React.memo(function MobileNavItem({
  id, icon, label, active, onClick,
}: {
  id: TabId; icon: React.ReactNode; label: string; active: boolean; onClick: (id: TabId) => void;
}) {
  return (
    <button
      onClick={() => onClick(id)}
      aria-current={active ? "page" : undefined}
      className={`relative flex-1 flex flex-col items-center justify-center gap-1 select-none rounded-full py-1.5 min-h-[44px] press-feedback`}
      style={{
        color: active ? "var(--color-accent)" : "var(--color-text-quaternary)",
        transition: "color var(--duration-normal) var(--ease-ios), transform var(--duration-fast) var(--ease-ios-bounce)",
      } as React.CSSProperties}
    >
      {active && (
        <motion.div
          layoutId="mobile-tab-indicator"
          className="mobile-tab-indicator absolute inset-0 rounded-full"
          style={{ background: "var(--color-accent-tint)" }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
      <span className="relative z-10">{icon}</span>
      <span className="relative z-10 text-[13px]" style={{ fontWeight: active ? "var(--font-weight-semibold)" : "var(--font-weight-medium)" } as React.CSSProperties}>{label}</span>
    </button>
  );
});
