import React, { useState, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Plus,
  ListTodo,
  UserPlus,
  Users,
  FileText,
} from "lucide-react";
import { useT } from "../i18n/context";
import { useClickOutside } from "./useClickOutside";
import { useUIStore, type QuickCreateType } from "../store/useUIStore";

/* Quick-create FAB — navigate to page (no form) */
export function QuickCreateMenu() {
  const setPendingQuickCreate = useUIStore((s) => s.setPendingQuickCreate);
  const { t } = useT();
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const quickCreateRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  useClickOutside(quickCreateRef, () => setQuickCreateOpen(false), quickCreateOpen);

  const handleToggle = () => {
    if (!quickCreateOpen) {
      const rect = quickCreateRef.current?.getBoundingClientRect();
      if (rect) {
        setMenuStyle({ top: rect.bottom + 4, left: rect.left });
      }
    }
    setQuickCreateOpen((p) => !p);
  };

  const dispatchQuickCreate = (type: QuickCreateType) => {
    // Store drives both the tab switch AND the intent payload in one update,
    // so the target page's useQuickCreateIntent hook fires atomically on
    // mount — no more race between lazy-chunk loading and a fire-and-forget
    // CustomEvent.
    setPendingQuickCreate(type);
  };

  const quickCreateItems = [
    { icon: <UserPlus size={14} aria-hidden="true" />, label: t("app.quickCreate.lead"), action: () => dispatchQuickCreate("lead") },
    { icon: <ListTodo size={14} aria-hidden="true" />, label: t("app.quickCreate.task"), action: () => dispatchQuickCreate("task") },
    { icon: <Users size={14} aria-hidden="true" />, label: t("app.quickCreate.client"), action: () => dispatchQuickCreate("client") },
    { icon: <FileText size={14} aria-hidden="true" />, label: t("app.quickCreate.bizFinance"), action: () => dispatchQuickCreate("biz-transaction") },
  ];

  return (
    <div className="relative" ref={quickCreateRef}>
      <button
        onClick={handleToggle}
        aria-expanded={quickCreateOpen}
        aria-haspopup="true"
        className="flex items-center justify-center w-8 h-8 shrink-0 rounded-[var(--radius-6)] transition-colors hover:bg-[var(--color-bg-tertiary)]"
        style={{
          color: quickCreateOpen ? "var(--color-accent)" : "var(--color-text-quaternary)",
          background: quickCreateOpen ? "var(--color-accent-tint)" : "var(--color-bg-translucent)",
        }}
        title={t("app.quickCreate")}
        aria-label={t("app.quickCreate")}
      >
        <Plus
          size={14}
          style={{
            transition: "transform var(--duration-fast)",
            transform: quickCreateOpen ? "rotate(45deg)" : undefined,
          }}
        />
      </button>
      {createPortal(
        <div
          role="menu"
          data-open={quickCreateOpen}
          className="fixed w-48 py-1 overflow-hidden popover-spring origin-top-left"
          // The menu is portaled to document.body, so it is NOT a descendant
          // of quickCreateRef. Without this, useClickOutside's document-level
          // mousedown listener fires FIRST, closes the menu, and unmounts the
          // <button> before React's onClick can run — navigation is lost.
          // Stopping propagation here keeps the event from reaching document.
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          style={{
            ...menuStyle,
            background: "var(--color-bg-primary)",
            border: "1px solid var(--color-border-primary)",
            borderRadius: "var(--radius-8)",
            boxShadow: "var(--shadow-medium)",
            zIndex: "var(--layer-popover)",
            transform: quickCreateOpen ? "scale(1) translateY(0)" : "scale(0.9) translateY(-8px)",
          } as React.CSSProperties}
        >
          {quickCreateItems.map((item, i) => (
            <button
              key={i}
              role="menuitem"
              onClick={() => {
                item.action();
                setQuickCreateOpen(false);
              }}
              className="flex items-center gap-3 w-full px-3 py-2 text-[15px] cursor-pointer transition-colors hover:bg-[var(--color-bg-tertiary)]"
              style={{ color: "var(--color-text-secondary)" }}
            >
              <span style={{ color: "var(--color-text-quaternary)" }}>
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
