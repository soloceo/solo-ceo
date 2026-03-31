import React from "react";
import { Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useUIStore } from "../../store/useUIStore";
import { useIsMobile } from "../../hooks/useIsMobile";

export function GlobalToast() {
  const toastMessage = useUIStore((s) => s.toastMessage);
  const toastAction = useUIStore((s) => s.toastAction);
  const toastActionLabel = useUIStore((s) => s.toastActionLabel);
  const clearToast = useUIStore((s) => s.clearToast);
  const isMobile = useIsMobile();

  return (
    <AnimatePresence>
      {toastMessage && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 8, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.92 }}
          transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
          className="fixed right-4 md:right-6 px-4 py-2 rounded-full flex items-center gap-2 text-[15px]"
          style={{
            zIndex: "var(--layer-toasts)",
            bottom: isMobile ? "calc(env(safe-area-inset-bottom, 0px) + 80px)" : "24px",
            background: "var(--color-text-primary)",
            color: "var(--color-bg-primary)",
            boxShadow: "var(--shadow-high)",
            fontWeight: "var(--font-weight-medium)",
          } as React.CSSProperties}
        >
          <Check size={14} style={{ color: "var(--color-success)" }} />
          <span>{toastMessage}</span>
          {toastAction && toastActionLabel && (
            <button
              onClick={() => { toastAction(); clearToast(); }}
              className="ml-1 px-2 py-0.5 rounded-[var(--radius-4)] text-[14px] transition-colors"
              style={{ color: "var(--color-accent)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}
              onMouseEnter={(e) => e.currentTarget.style.background = "color-mix(in srgb, var(--color-bg-primary) 20%, transparent)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              {toastActionLabel}
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
