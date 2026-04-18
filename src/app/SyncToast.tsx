import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react";

export function SyncToast() {
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const { message, type } = (e as CustomEvent).detail || {};
      if (message) {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3500);
      }
    };
    window.addEventListener("sync-toast", handler);
    return () => window.removeEventListener("sync-toast", handler);
  }, []);

  if (!toast) return null;

  const icon =
    toast.type === "success" ? <CheckCircle2 size={14} style={{ color: "var(--color-green)" }} /> :
    toast.type === "warning" ? <AlertTriangle size={14} style={{ color: "var(--color-warning)" }} /> :
    <Info size={14} style={{ color: "var(--color-accent)" }} />;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2.5 text-[15px]"
      style={{
        top: "max(env(safe-area-inset-top, 0px), 16px)",
        zIndex: "var(--layer-toasts)",
        fontWeight: "var(--font-weight-medium)",
        background: "var(--color-bg-primary)",
        border: "1px solid var(--color-border-primary)",
        borderRadius: "var(--radius-8)",
        color: "var(--color-text-primary)",
        boxShadow: "var(--shadow-medium)",
        animation: "fade-in-down 0.2s var(--ease-out-quad)",
      } as React.CSSProperties}
    >
      {icon}
      {toast.message}
    </div>
  );
}
