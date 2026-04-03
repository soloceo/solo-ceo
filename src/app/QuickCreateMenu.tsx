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

/* Quick-create FAB — navigate to page (no form) */
export interface QuickCreateMenuProps {
  setActiveTab: (tab: string) => void;
}

export function QuickCreateMenu({ setActiveTab }: QuickCreateMenuProps) {
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

  const quickCreateItems = [
    { icon: <ListTodo size={14} aria-hidden="true" />, label: t("app.quickCreate.task"), action: () => { setActiveTab("work"); setTimeout(() => window.dispatchEvent(new CustomEvent("quick-create", { detail: { type: "task" } })), 100); } },
    { icon: <UserPlus size={14} aria-hidden="true" />, label: t("app.quickCreate.lead"), action: () => { setActiveTab("leads"); setTimeout(() => window.dispatchEvent(new CustomEvent("quick-create", { detail: { type: "lead" } })), 100); } },
    { icon: <Users size={14} aria-hidden="true" />, label: t("app.quickCreate.client"), action: () => { setActiveTab("clients"); setTimeout(() => window.dispatchEvent(new CustomEvent("quick-create", { detail: { type: "client" } })), 100); } },
    { icon: <FileText size={14} aria-hidden="true" />, label: t("app.quickCreate.bizFinance"), action: () => { setActiveTab("finance"); setTimeout(() => window.dispatchEvent(new CustomEvent("quick-create", { detail: { type: "biz-transaction" } })), 100); } },
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
            transition: "transform 0.15s",
            transform: quickCreateOpen ? "rotate(45deg)" : undefined,
          }}
        />
      </button>
      {createPortal(
        <div
          role="menu"
          className="fixed w-48 py-1 overflow-hidden transition-all duration-150 origin-top-left"
          style={{
            ...menuStyle,
            background: "var(--color-bg-primary)",
            border: "1px solid var(--color-border-primary)",
            borderRadius: "var(--radius-8)",
            boxShadow: "var(--shadow-medium)",
            zIndex: "var(--layer-popover)",
            opacity: quickCreateOpen ? 1 : 0,
            transform: quickCreateOpen ? "scale(1) translateY(0)" : "scale(0.92) translateY(-6px)",
            pointerEvents: quickCreateOpen ? "auto" : "none",
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
