import React, { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/cn";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function BottomSheet({ open, onClose, title, children, className }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  // Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Focus trap
  const trapFocus = useCallback((e: KeyboardEvent) => {
    if (e.key !== "Tab" || !sheetRef.current) return;
    const focusable = sheetRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", trapFocus);
    requestAnimationFrame(() => {
      const el = sheetRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      el?.focus();
    });
    return () => document.removeEventListener("keydown", trapFocus);
  }, [open, trapFocus]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 flex flex-col justify-end"
          style={{ zIndex: "var(--layer-dialog)" } as React.CSSProperties}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0"
            style={{ background: "var(--color-overlay-primary)", backdropFilter: "blur(2px) saturate(180%)", WebkitBackdropFilter: "blur(2px) saturate(180%)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            ref={sheetRef}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
            className={cn(
              "relative w-full max-h-[90vh] flex flex-col overflow-hidden",
              "rounded-t-[var(--radius-16)]",
              className,
            )}
            style={{
              background: "var(--color-bg-primary)",
              boxShadow: "var(--shadow-high)",
              paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
            }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-2 pb-1 shrink-0">
              <div
                className="w-8 h-1 rounded-full"
                style={{ background: "var(--color-border-primary)" }}
              />
            </div>

            {/* Visually-hidden close button for screen readers */}
            <button
              className="sr-only"
              onClick={onClose}
              aria-label="Close"
            >
              Close
            </button>

            {/* Header */}
            {title && (
              <div className="px-5 py-3 shrink-0">
                <h2 className="text-[15px]" style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-semibold)" } as React.CSSProperties}>
                  {title}
                </h2>
              </div>
            )}

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 pb-4">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
