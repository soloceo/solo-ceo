import React from "react";
import { Check } from "lucide-react";
import { useUIStore } from "../../store/useUIStore";
import { useIsMobile } from "../../hooks/useIsMobile";

export function GlobalToast() {
  const toastMessage = useUIStore((s) => s.toastMessage);
  const toastAction = useUIStore((s) => s.toastAction);
  const toastActionLabel = useUIStore((s) => s.toastActionLabel);
  const clearToast = useUIStore((s) => s.clearToast);
  const isMobile = useIsMobile();

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed right-4 md:right-6 px-4 py-2 rounded-full flex items-center gap-2 text-[15px] toast popover-spring"
      data-open={!!toastMessage}
      style={{
        zIndex: "var(--layer-toasts)",
        bottom: isMobile ? "max(80px, calc(60px + var(--safe-bottom-capped, 20px)))" : "24px",
        transform: toastMessage ? "translateY(0) scale(1)" : "translateY(12px) scale(0.88)",
      } as React.CSSProperties}
    >
      <Check size={14} style={{ color: "var(--color-success)" }} />
      <span>{toastMessage}</span>
      {toastAction && toastActionLabel && (
        <button
          onClick={() => { useUIStore.getState().toastAction?.(); clearToast(); }}
          aria-label={toastActionLabel}
          className="ml-1 px-2 py-0.5 rounded-[var(--radius-4)] text-[14px] transition-colors"
          style={{ color: "var(--color-accent)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}
          onMouseEnter={(e) => e.currentTarget.style.background = "color-mix(in srgb, var(--color-bg-primary) 20%, transparent)"}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
        >
          {toastActionLabel}
        </button>
      )}
    </div>
  );
}
