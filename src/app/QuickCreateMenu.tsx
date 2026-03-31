import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus,
  ListTodo,
  UserPlus,
  Users,
  FileText,
} from "lucide-react";
import { useT } from "../i18n/context";
import { useUIStore } from "../store/useUIStore";
import { useClickOutside } from "./useClickOutside";

export interface QuickCreateMenuProps {
  setActiveTab: (tab: string) => void;
}

export function QuickCreateMenu({ setActiveTab }: QuickCreateMenuProps) {
  const { t } = useT();
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const quickCreateRef = useRef<HTMLDivElement>(null);

  useClickOutside(quickCreateRef, () => setQuickCreateOpen(false), quickCreateOpen);

  const quickCreateGroups = [
    {
      label: t("app.quickCreate.groupWork" as any),
      items: [
        {
          icon: <ListTodo size={14} aria-hidden="true" />,
          label: t("app.quickCreate.task" as any),
          action: () => {
            setActiveTab("work");
            setTimeout(
              () =>
                window.dispatchEvent(
                  new CustomEvent("quick-create", {
                    detail: { type: "task" },
                  })
                ),
              100
            );
          },
        },
        {
          icon: <UserPlus size={14} aria-hidden="true" />,
          label: t("app.quickCreate.lead" as any),
          action: () => {
            setActiveTab("leads" as any);
            setTimeout(
              () =>
                window.dispatchEvent(
                  new CustomEvent("quick-create", {
                    detail: { type: "lead" },
                  })
                ),
              100
            );
          },
        },
        {
          icon: <Users size={14} aria-hidden="true" />,
          label: t("app.quickCreate.client" as any),
          action: () => {
            setActiveTab("clients");
            setTimeout(
              () =>
                window.dispatchEvent(
                  new CustomEvent("quick-create", {
                    detail: { type: "client" },
                  })
                ),
              100
            );
          },
        },
        {
          icon: <FileText size={14} aria-hidden="true" />,
          label: t("app.quickCreate.bizFinance" as any),
          action: () => {
            setActiveTab("finance");
            setTimeout(
              () =>
                window.dispatchEvent(
                  new CustomEvent("quick-create", {
                    detail: { type: "biz-transaction" },
                  })
                ),
              100
            );
          },
        },
      ],
    },
    {
      label: t("app.quickCreate.groupPersonal" as any),
      items: [
        {
          icon: <ListTodo size={14} aria-hidden="true" />,
          label: t("app.quickCreate.personalTask" as any),
          action: () => {
            setActiveTab("work");
            setTimeout(
              () =>
                window.dispatchEvent(
                  new CustomEvent("quick-create", {
                    detail: { type: "personal-task" },
                  })
                ),
              100
            );
          },
        },
        {
          icon: <FileText size={14} aria-hidden="true" />,
          label: t("app.quickCreate.personalFinance" as any),
          action: () => {
            setActiveTab("finance");
            setTimeout(
              () =>
                window.dispatchEvent(
                  new CustomEvent("quick-create", {
                    detail: { type: "personal-transaction" },
                  })
                ),
              100
            );
          },
        },
      ],
    },
  ];

  return (
    <div className="relative" ref={quickCreateRef}>
      <button
        onClick={() => setQuickCreateOpen((p) => !p)}
        aria-expanded={quickCreateOpen}
        aria-haspopup="true"
        className="flex items-center justify-center w-8 h-8 shrink-0 rounded-[var(--radius-6)] transition-colors hover:bg-[var(--color-bg-tertiary)]"
        style={{
          color: quickCreateOpen ? "var(--color-accent)" : "var(--color-text-quaternary)",
          background: quickCreateOpen ? "var(--color-accent-tint)" : "var(--color-bg-translucent)",
        }}
        title={t("app.quickCreate" as any)}
        aria-label={t("app.quickCreate" as any)}
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
        <AnimatePresence>
          {quickCreateOpen && (() => {
            const rect = quickCreateRef.current?.getBoundingClientRect();
            const top = rect ? rect.bottom + 4 : 0;
            const left = rect ? rect.left : 0;
            return (
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: -6 }}
                transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
                role="menu"
                className="fixed w-48 py-1 overflow-hidden"
                style={{
                  top, left,
                  background: "var(--color-bg-primary)",
                  border: "1px solid var(--color-border-primary)",
                  borderRadius: "var(--radius-8)",
                  boxShadow: "var(--shadow-medium)",
                  zIndex: 600,
                }}
              >
            {quickCreateGroups.map((group, gi) => (
              <div key={gi}>
                {gi > 0 && (
                  <div
                    className="my-1"
                    style={{ borderTop: "1px solid var(--color-line-secondary)" }}
                  />
                )}
                <div
                  className="px-3 pt-1.5 pb-0.5 text-[11px] uppercase tracking-wider"
                  style={{
                    color: "var(--color-text-quaternary)",
                    fontWeight: "var(--font-weight-semibold)",
                  } as React.CSSProperties}
                >
                  {group.label}
                </div>
                {group.items.map((item, i) => (
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
              </div>
            ))}
              </motion.div>
            );
          })()}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
