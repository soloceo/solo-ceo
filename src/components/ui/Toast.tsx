import React from "react";
import { Check } from "lucide-react";
import { useUIStore } from "../../store/useUIStore";

export function GlobalToast() {
  const toastMessage = useUIStore((s) => s.toastMessage);
  if (!toastMessage) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 md:bottom-6 right-4 md:right-6 px-4 py-2 rounded-[var(--radius-8)] z-[9999] flex items-center gap-2 text-[13px] animate-fade-in"
      style={{
        background: "var(--color-text-primary)",
        color: "var(--color-bg-primary)",
        boxShadow: "var(--shadow-high)",
        fontWeight: "var(--font-weight-medium)",
      } as React.CSSProperties}
    >
      <Check size={14} style={{ color: "var(--color-success)" }} /> {toastMessage}
    </div>
  );
}
