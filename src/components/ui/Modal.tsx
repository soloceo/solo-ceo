import React, { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { cn } from "../../lib/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit?: () => void;
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

export function Modal({ open, onClose, onSubmit, title, children, className, size = "md" }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);

  // Escape key + Cmd/Ctrl+Enter to submit
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && onSubmit) {
        e.preventDefault();
        onSubmit();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose, onSubmit]);

  // Body scroll lock
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

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
    // Capture the element that triggered the modal so we can restore focus on close
    prevFocusRef.current = document.activeElement as HTMLElement;
    document.addEventListener("keydown", trapFocus);
    // Auto-focus first focusable element
    const timer = setTimeout(() => {
      const el = dialogRef.current?.querySelector<HTMLElement>(
        'input:not([type="hidden"]), textarea, select, button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      el?.focus();
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", trapFocus);
      // Restore focus to the element that opened the modal
      prevFocusRef.current?.focus();
      prevFocusRef.current = null;
    };
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
          transition={{ duration: 0.2 }}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <div className="absolute inset-0 modal-overlay" onClick={onClose} />

          <motion.div
            ref={dialogRef}
            initial={{ opacity: 0, scale: 0.92, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 4 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className={cn(
              "relative w-full overflow-hidden flex flex-col max-h-[85vh] modal-content",
              sizes[size],
              className,
            )}
            style={{
              border: "1px solid var(--color-border-translucent)",
            }}
          >
            {title && (
              <div
                className="flex items-center justify-between px-5 py-3 shrink-0"
                style={{ borderBottom: "1px solid var(--color-line-secondary)" }}
              >
                <h2 className="text-[16px]" style={{ fontWeight: "var(--font-weight-semibold)", color: "var(--color-text-primary)" }}>
                  {title}
                </h2>
                <button
                  onClick={onClose}
                  className="btn-icon"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto px-5 py-4" style={{ paddingBottom: "16px" }}>
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
