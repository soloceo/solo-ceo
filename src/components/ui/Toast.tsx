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

  if (!toastMessage) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed right-4 md:right-6 px-4 py-2 rounded-full flex items-center gap-2 text-[15px] animate-fade-in"
      style={{
        zIndex: 800,
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
          className="ml-1 px-2 py-0.5 rounded-[var(--radius-4)] text-[14px] transition-colors hover:bg-white/20"
          style={{ color: "var(--color-accent)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}
        >
          {toastActionLabel}
        </button>
      )}
    </div>
  );
}
