import React, { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { cn } from "../../lib/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizes = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
};

export function Modal({ open, onClose, title, children, className, size = "md" }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

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
    if (e.key !== "Tab" || !dialogRef.current) return;
    const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
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
    // Auto-focus first focusable element
    requestAnimationFrame(() => {
      const el = dialogRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      el?.focus();
    });
    return () => document.removeEventListener("keydown", trapFocus);
  }, [open, trapFocus]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ zIndex: "var(--layer-dialog)" } as React.CSSProperties}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <div className="absolute inset-0" style={{ background: "var(--color-overlay-primary)" }} onClick={onClose} />

          <motion.div
            ref={dialogRef}
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 4 }}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className={cn(
              "relative w-full overflow-hidden flex flex-col max-h-[85vh]",
              sizes[size],
              className,
            )}
            style={{
              background: "var(--color-bg-primary)",
              border: "1px solid var(--color-border-primary)",
              borderRadius: "var(--radius-12)",
              boxShadow: "var(--shadow-high)",
            }}
          >
            {title && (
              <div
                className="flex items-center justify-between px-5 py-3 shrink-0"
                style={{ borderBottom: "1px solid var(--color-line-secondary)" }}
              >
                <h2 className="text-[14px]" style={{ fontWeight: "var(--font-weight-semibold)", color: "var(--color-text-primary)" }}>
                  {title}
                </h2>
                <button
                  onClick={onClose}
                  className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-4)] transition-colors hover:bg-[var(--color-bg-tertiary)]"
                  style={{ color: "var(--color-text-quaternary)" }}
                  aria-label="Close"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
