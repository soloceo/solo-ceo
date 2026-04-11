import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

/**
 * A minimal popover that anchors to a trigger element.
 * Renders a floating panel aligned to the trigger's position.
 * Closes on outside click or Escape.
 */

interface InlinePopoverProps {
  /** The trigger element — rendered inline, clicking it toggles the popover */
  trigger: React.ReactNode;
  /** Popover content */
  children: React.ReactNode;
  /** Alignment relative to trigger */
  align?: "start" | "center" | "end";
  /** Additional className on the popover panel */
  className?: string;
  /** Callback when popover opens/closes */
  onOpenChange?: (open: boolean) => void;
}

export function InlinePopover({ trigger, children, align = "start", className = "", onOpenChange }: InlinePopoverProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const toggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setOpen(v => {
      const next = !v;
      onOpenChange?.(next);
      return next;
    });
  }, [onOpenChange]);

  // Position calculation
  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const panelWidth = panelRef.current?.offsetWidth || 160;
    let left = align === "end" ? rect.right - panelWidth : align === "center" ? rect.left + rect.width / 2 - panelWidth / 2 : rect.left;
    // Clamp to viewport
    left = Math.max(8, Math.min(left, window.innerWidth - panelWidth - 8));
    const top = rect.bottom + 4;
    setPos({ top, left });
  }, [open, align]);

  // Close on outside click or Escape
  // Delay listener registration to avoid the opening touch from immediately closing
  useEffect(() => {
    if (!open) return;
    let active = true;
    const handleClick = (e: MouseEvent | TouchEvent) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      if (triggerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
      onOpenChange?.(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); onOpenChange?.(false); triggerRef.current?.focus(); }
    };
    const timer = setTimeout(() => {
      if (!active) return; // unmounted during delay — skip adding listeners
      document.addEventListener("mousedown", handleClick);
      document.addEventListener("touchstart", handleClick);
      document.addEventListener("keydown", handleKey);
    }, 10);
    return () => {
      active = false;
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("touchstart", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onOpenChange]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        className="inline-flex cursor-pointer items-center bg-transparent border-none p-0"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {trigger}
      </button>
      {open && createPortal(
        <div
          ref={panelRef}
          role="listbox"
          className={`fixed rounded-[var(--radius-8)] shadow-lg overflow-hidden ${className}`}
          style={{
            top: pos.top,
            left: pos.left,
            zIndex: "var(--layer-popover)",
            background: "var(--color-bg-panel)",
            border: "1px solid var(--color-border-primary)",
            minWidth: 120,
            animation: "popoverIn 0.15s ease-out",
          }}
        >
          {children}
        </div>,
        document.body,
      )}
    </>
  );
}

/**
 * A single option row inside InlinePopover, with optional checkmark
 */
export function PopoverOption({
  selected,
  onClick,
  children,
  color,
}: {
  key?: React.Key;
  selected?: boolean;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <button
      role="option"
      aria-selected={!!selected}
      onClick={(e) => { e.stopPropagation(); onClick(e); }}
      className="flex items-center gap-2 w-full px-3 py-2.5 text-[14px] transition-colors hover:bg-[var(--color-bg-tertiary)] cursor-pointer text-left"
      style={{ color: color || "var(--color-text-primary)", fontWeight: selected ? "var(--font-weight-semibold)" : "var(--font-weight-normal)", background: "transparent", border: "none" } as React.CSSProperties}
    >
      <span className="flex-1">{children}</span>
      {selected && <span aria-hidden="true" style={{ color: "var(--color-accent)", fontSize: "14px" }}>✓</span>}
    </button>
  );
}
