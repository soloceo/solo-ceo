import React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X, Check } from "lucide-react";
import { useT } from "../../../i18n/context";
import { useWidgetStore } from "./useWidgetStore";
import { WIDGET_REGISTRY } from "./WidgetRegistry";

interface Props { open: boolean; onClose: () => void; }

export default function WidgetStore({ open, onClose }: Props) {
  const { t } = useT();
  const { layout, toggleWidget } = useWidgetStore();
  const isEnabled = (id: string) => layout.find((w) => w.id === id)?.enabled ?? false;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 flex flex-col justify-end md:items-center md:justify-center"
          style={{ zIndex: "var(--layer-dialog)" } as React.CSSProperties}
          role="dialog" aria-modal="true"
        >
          <motion.div
            className="absolute inset-0"
            style={{ background: "var(--color-overlay-primary)" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="relative w-full md:w-[400px] md:max-h-[80vh] overflow-hidden rounded-t-[var(--radius-28)] md:rounded-[var(--radius-20)]"
            style={{ background: "var(--color-bg-primary)", boxShadow: "var(--shadow-high)", paddingBottom: "max(env(safe-area-inset-bottom, 0px), 8px)" }}
          >
            <div className="flex justify-center pt-2 pb-1 shrink-0 md:hidden">
              <div className="w-8 h-1 rounded-full" style={{ background: "var(--color-border-primary)" }} />
            </div>
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid var(--color-line-tertiary)" }}>
              <h3 className="text-[15px]" style={{ fontWeight: "var(--font-weight-semibold)", color: "var(--color-text-primary)" } as React.CSSProperties}>
                {t("widgets.store" as any)}
              </h3>
              <button onClick={onClose} className="btn-icon-sm" aria-label="Close"><X size={16} /></button>
            </div>
            <div className="px-3 py-2 space-y-1">
              {WIDGET_REGISTRY.map((w) => {
                const enabled = isEnabled(w.id);
                return (
                  <button
                    key={w.id}
                    onClick={() => toggleWidget(w.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-[var(--radius-12)] transition-colors hover:bg-[var(--color-bg-tertiary)] press-feedback"
                  >
                    <div
                      className="flex items-center justify-center shrink-0 rounded-[var(--radius-8)]"
                      style={{
                        width: 36, height: 36,
                        background: enabled ? "color-mix(in srgb, var(--color-accent) 12%, transparent)" : "var(--color-bg-tertiary)",
                        color: enabled ? "var(--color-accent)" : "var(--color-text-quaternary)",
                      }}
                    >
                      {w.icon}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="text-[13px]" style={{ fontWeight: "var(--font-weight-medium)", color: "var(--color-text-primary)" } as React.CSSProperties}>
                        {t(w.nameKey as any) || w.id}
                      </div>
                      <div className="text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>
                        {t(w.descKey as any) || ""}
                      </div>
                    </div>
                    <div
                      className="shrink-0 flex items-center justify-center rounded-full"
                      style={{
                        width: 22, height: 22,
                        background: enabled ? "var(--color-accent)" : "var(--color-bg-quaternary)",
                        color: enabled ? "var(--color-brand-text)" : "transparent",
                        transition: "all 0.15s",
                      }}
                    >
                      <Check size={12} />
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
