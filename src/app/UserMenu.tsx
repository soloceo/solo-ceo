import React, { useState, useRef } from "react";
import { Moon, Sun, Monitor, SettingsIcon, LogOut, LogIn } from "lucide-react";
import { useT } from "../i18n/context";
import { Avatar } from "../components/ui";
import { SyncIndicator } from "./SyncIndicator";
import { useClickOutside } from "./useClickOutside";

type ThemeMode = "light" | "dark" | "auto";

export interface UserMenuProps {
  operatorDisplayName: string;
  operatorAvatar?: string;
  streak: number;
  isOnline: boolean;
  syncStatus: "idle" | "syncing";
  pendingOps: number;
  isExpanded: boolean;
  user: { email?: string } | null;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  setActiveTab: (tab: string) => void;
  onSignOut: () => void;
  onSignIn?: () => void;
}

const themeModes: { value: ThemeMode; icon: typeof Sun; labelKey: string }[] = [
  { value: "light", icon: Sun, labelKey: "settings.themeLight" },
  { value: "auto", icon: Monitor, labelKey: "settings.themeAuto" },
  { value: "dark", icon: Moon, labelKey: "settings.themeDark" },
];

export function UserMenu({
  operatorDisplayName,
  operatorAvatar,
  streak,
  isOnline,
  syncStatus,
  pendingOps,
  isExpanded,
  user,
  themeMode,
  setThemeMode,
  setActiveTab,
  onSignOut,
  onSignIn,
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
    setActiveTab("settings");
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
      <div
        className="absolute bottom-[calc(100%+6px)] left-0 w-48 py-1 overflow-hidden popover-spring origin-bottom-left"
        role="menu"
        data-open={userMenuOpen}
        style={{
          background: "var(--color-bg-primary)",
          border: "1px solid var(--color-border-primary)",
          borderRadius: "var(--radius-8)",
          boxShadow: "var(--shadow-medium)",
          zIndex: 10,
          transform: userMenuOpen ? "scale(1) translateY(0)" : "scale(0.9) translateY(8px)",
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
              ? t("app.cloudConnected")
              : t("app.offline")}
          </span>
        </div>
        {/* Theme mode — 3-way segmented control */}
        <div className="px-3 py-2">
          <div
            className="text-[12px] mb-1.5"
            style={{ color: "var(--color-text-quaternary)" }}
          >
            {t("settings.colorMode") || "Color Mode"}
          </div>
          <div
            className="flex rounded-[var(--radius-6)] overflow-hidden"
            style={{ border: "1px solid var(--color-border-primary)" }}
          >
            {themeModes.map(({ value, icon: Icon }) => (
              <button
                key={value}
                onClick={(e) => {
                  e.stopPropagation();
                  setThemeMode(value);
                }}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 cursor-pointer transition-colors"
                style={{
                  background:
                    themeMode === value
                      ? "var(--color-accent)"
                      : "transparent",
                  color:
                    themeMode === value
                      ? "var(--color-text-on-color)"
                      : "var(--color-text-tertiary)",
                  fontSize: "12px",
                  fontWeight: "var(--font-weight-medium)",
                } as React.CSSProperties}
                title={t(`settings.theme${value.charAt(0).toUpperCase() + value.slice(1)}`) || value}
              >
                <Icon size={13} />
                <span>{t(`settings.theme${value.charAt(0).toUpperCase() + value.slice(1)}`) || value}</span>
              </button>
            ))}
          </div>
        </div>
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
          {t("nav.settings")}
        </button>
        {/* Divider */}
        <div
          style={{
            height: 1,
            background: "var(--color-line-tertiary)",
            margin: "2px 0",
          }}
        />
        {/* Sign out / Sign in */}
        {user ? (
          <button
            onClick={handleSignOut}
            role="menuitem"
            className="flex items-center gap-3 w-full px-3 py-2 text-[15px] cursor-pointer transition-colors hover:bg-[var(--color-bg-tertiary)]"
            style={{ color: "var(--color-danger)" }}
          >
            <LogOut size={14} aria-hidden="true" />
            {t("common.signOut") || "Sign out"}
          </button>
        ) : (
          <button
            onClick={() => { setUserMenuOpen(false); onSignIn?.(); }}
            role="menuitem"
            className="flex items-center gap-3 w-full px-3 py-2 text-[15px] cursor-pointer transition-colors hover:bg-[var(--color-bg-tertiary)]"
            style={{ color: "var(--color-accent)" }}
          >
            <LogIn size={14} aria-hidden="true" />
            {t("auth.loginOrRegister") || "Sign in"}
          </button>
        )}
      </div>
    </div>
  );
}
