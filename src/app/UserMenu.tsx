import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Moon, Sun, SettingsIcon, LogOut } from "lucide-react";
import { useT } from "../i18n/context";
import { Avatar } from "../components/ui";
import { SyncIndicator } from "./SyncIndicator";
import { useClickOutside } from "./useClickOutside";

export interface UserMenuProps {
  operatorDisplayName: string;
  operatorAvatar?: string;
  streak: number;
  isOnline: boolean;
  syncStatus: "idle" | "syncing";
  pendingOps: number;
  isExpanded: boolean;
  user: any;
  darkMode: boolean;
  toggleDarkMode: () => void;
  setActiveTab: (tab: string) => void;
  onSignOut: () => void;
}

export function UserMenu({
  operatorDisplayName,
  operatorAvatar,
  streak,
  isOnline,
  syncStatus,
  pendingOps,
  isExpanded,
  user,
  darkMode,
  toggleDarkMode,
  setActiveTab,
  onSignOut,
}: UserMenuProps) {
  const { t } = useT();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useClickOutside(userMenuRef, () => setUserMenuOpen(false), userMenuOpen);

  const handleSignOut = () => {
    setUserMenuOpen(false);
    onSignOut();
  };

  const handleSettingsClick = () => {
    setActiveTab("settings" as any);
    setUserMenuOpen(false);
  };

  return (
    <div className="relative" ref={userMenuRef}>
      <button
        onClick={() => setUserMenuOpen((p) => !p)}
        title={isExpanded ? undefined : operatorDisplayName}
        aria-expanded={userMenuOpen}
        aria-haspopup="true"
        className={`flex items-center w-full rounded-[var(--radius-6)] py-1.5 transition-colors hover:bg-[var(--color-bg-tertiary)] ${
          isExpanded ? "gap-2 px-2" : "justify-center"
        }`}
      >
        <span className="relative">
          <Avatar
            src={operatorAvatar || undefined}
            name={operatorDisplayName}
            size="sm"
          />
          <span
            className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[var(--color-bg-panel)]"
            style={{
              background: isOnline
                ? "var(--color-success)"
                : "var(--color-text-quaternary)",
            }}
          />
        </span>
        {isExpanded && (
          <>
            <span
              className="text-[14px] truncate flex-1 text-left"
              style={{
                fontWeight: "var(--font-weight-medium)",
                color: "var(--color-text-secondary)",
              } as React.CSSProperties}
            >
              {operatorDisplayName}
            </span>
            {streak > 1 && (
              <span
                className="text-[13px] shrink-0 tabular-nums"
                style={{
                  fontWeight: "var(--font-weight-bold)",
                  color: "var(--color-warning)",
                } as React.CSSProperties}
              >
                🔥{streak}
              </span>
            )}
          </>
        )}
      </button>
      <AnimatePresence>
        {userMenuOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 4 }}
            transition={{ duration: 0.12, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="absolute bottom-[calc(100%+6px)] left-0 w-48 py-1 overflow-hidden"
            role="menu"
            style={{
              background: "var(--color-bg-primary)",
              border: "1px solid var(--color-border-primary)",
              borderRadius: "var(--radius-8)",
              boxShadow: "var(--shadow-medium)",
              zIndex: 10,
            }}
          >
            {/* User info header */}
            <div
              className="px-3 py-2"
              style={{ borderBottom: "1px solid var(--color-line-tertiary)" }}
            >
              <div
                className="text-[14px] truncate"
                style={{
                  fontWeight: "var(--font-weight-medium)",
                  color: "var(--color-text-primary)",
                } as React.CSSProperties}
              >
                {operatorDisplayName}
              </div>
              {user?.email && (
                <div
                  className="text-[13px] truncate mt-0.5"
                  style={{ color: "var(--color-text-quaternary)" }}
                >
                  {user.email}
                </div>
              )}
            </div>
            {/* Cloud status */}
            <div
              className="flex items-center gap-3 px-3 py-2 text-[14px]"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              <SyncIndicator
                isOnline={isOnline}
                syncStatus={syncStatus}
                pendingOps={pendingOps}
                compact
              />
              <span>
                {isOnline
                  ? t("app.cloudConnected" as any)
                  : t("app.offline" as any)}
              </span>
            </div>
            {/* Dark mode toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleDarkMode();
              }}
              role="menuitem"
              className="flex items-center gap-3 w-full px-3 py-2 text-[15px] cursor-pointer transition-colors hover:bg-[var(--color-bg-tertiary)]"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {darkMode ? (
                <Sun
                  size={14}
                  aria-hidden="true"
                  style={{ color: "var(--color-text-quaternary)" }}
                />
              ) : (
                <Moon
                  size={14}
                  aria-hidden="true"
                  style={{ color: "var(--color-text-quaternary)" }}
                />
              )}
              {darkMode
                ? t("app.lightMode" as any)
                : t("app.darkMode" as any)}
            </button>
            {/* Settings */}
            <button
              onClick={handleSettingsClick}
              role="menuitem"
              className="flex items-center gap-3 w-full px-3 py-2 text-[15px] cursor-pointer transition-colors hover:bg-[var(--color-bg-tertiary)]"
              style={{ color: "var(--color-text-secondary)" }}
            >
              <SettingsIcon
                size={14}
                aria-hidden="true"
                style={{ color: "var(--color-text-quaternary)" }}
              />
              {t("nav.settings" as any)}
            </button>
            {/* Divider */}
            <div
              style={{
                height: 1,
                background: "var(--color-line-tertiary)",
                margin: "2px 0",
              }}
            />
            {/* Sign out */}
            <button
              onClick={handleSignOut}
              role="menuitem"
              className="flex items-center gap-3 w-full px-3 py-2 text-[15px] cursor-pointer transition-colors hover:bg-[var(--color-bg-tertiary)]"
              style={{ color: "var(--color-danger)" }}
            >
              <LogOut size={14} aria-hidden="true" />
              {t("common.signOut" as any) || "Sign out"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
