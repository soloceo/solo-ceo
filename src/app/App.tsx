import React, { Suspense, lazy, useEffect, useRef, useState, useMemo } from "react";
import {
  Settings as SettingsIcon,
  Loader2,
  Moon,
  Sun,
  Monitor,
  PanelLeftClose,
  PanelLeft,
  Search,
  Plus,
  UserPlus,
  Users,
  FileText,
  ListTodo,
  LogOut,
  LogIn,
  Cloud,
  CloudOff,
  Ellipsis,
  MessageCircle,
} from "lucide-react";
import { useT } from "../i18n/context";
import { useAuth } from "../auth/AuthProvider";
import LoginPage from "../auth/LoginPage";
import { startRealtime, stopRealtime } from "../db/realtime";
import { OfflineBanner } from "../components/OfflineBanner";
import { Avatar, GlobalToast } from "../components/ui";
import { useUIStore, type TabId } from "../store/useUIStore";
import { useSettingsStore } from "../store/useSettingsStore";
import { todayDateKey, dateToKey } from "../lib/date-utils";
import { api } from "../lib/api";
const CommandPalette = lazy(() => import("./CommandPalette").then((m) => ({ default: m.CommandPalette })));
import { QuickCreateMenu } from "./QuickCreateMenu";
const AIChatPanel = lazy(() => import("./AIChatPanel").then(m => ({ default: m.AIChatPanel })));
import { UserMenu } from "./UserMenu";
import { SyncIndicator } from "./SyncIndicator";
import { useClickOutside } from "./useClickOutside";
import { motion, AnimatePresence } from "motion/react";
import { initMouseEffects } from "../lib/mouse-effects";
import { MAIN_TABS, SETTINGS_TAB, ALL_TABS, TAB_MAP, Content, type NavBadges } from "./tabs";
import { PageErrorBoundary } from "../components/PageErrorBoundary";
import { SidebarItem } from "./SidebarItem";
import { MobileNavItem } from "./MobileNavItem";
import { SyncToast } from "./SyncToast";
import { useHashRoute } from "./useHashRoute";
import { useCloudSettingsSync } from "./useCloudSettingsSync";

/* ══════════════════════════════════════════════════════════════════
   App — Linear-identical layout
   ══════════════════════════════════════════════════════════════════ */
function App() {
  useHashRoute();
  const { user, loading: authLoading, offlineMode, signOut, exitOfflineMode } = useAuth();
  const { t } = useT();

  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const commandPaletteOpen = useUIStore((s) => s.commandPaletteOpen);
  const sidebarExpanded = useUIStore((s) => s.sidebarExpanded);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const themeMode = useUIStore((s) => s.themeMode);
  const setThemeMode = useUIStore((s) => s.setThemeMode);
  const toggleDarkMode = useUIStore((s) => s.toggleDarkMode);
  const hideMobileNav = useUIStore((s) => s.hideMobileNav);
  const showToast = useUIStore((s) => s.showToast);

  // Cycle: light → auto → dark → light
  const cycleTheme = () => {
    const next = themeMode === "light" ? "auto" : themeMode === "auto" ? "dark" : "light";
    setThemeMode(next);
  };
  const themeIcon = themeMode === "dark" ? <Moon size={14} /> : themeMode === "auto" ? <Monitor size={14} /> : <Sun size={14} />;
  const themeMobileIcon = themeMode === "dark" ? <Moon size={18} /> : themeMode === "auto" ? <Monitor size={18} /> : <Sun size={18} />;
  const themeLabel = t(`settings.theme${themeMode.charAt(0).toUpperCase() + themeMode.slice(1)}`) || themeMode;

  const operatorName = useSettingsStore((s) => s.operatorName);
  const operatorAvatar = useSettingsStore((s) => s.operatorAvatar);
  const setOperator = useSettingsStore((s) => s.setOperator);
  const isOnline = useSettingsStore((s) => s.isOnline);
  const setOnline = useSettingsStore((s) => s.setOnline);
  const syncStatus = useSettingsStore((s) => s.syncStatus);
  const pendingOps = useSettingsStore((s) => s.pendingOps);

  const sidebarRef = useRef<HTMLElement>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const isExpanded = sidebarExpanded;

  /* ── Reset scroll position on tab change ── */
  useEffect(() => {
    if (mainScrollRef.current) mainScrollRef.current.scrollTop = 0;
  }, [activeTab]);

  /* ── Premium pointer-driven effects (spotlight + border glow).
        Idempotent — internal flag short-circuits if already initialized.
        Self-guards against reduced-motion and touch devices. ── */
  useEffect(() => {
    initMouseEffects();
  }, []);

  /* ── Publish sidebar state to body so the portaled AI chat panel
        can position itself next to the sidebar (chat sits between
        sidebar and content when open on desktop/tablet). ── */
  useEffect(() => {
    const body = document.body;
    body.classList.toggle('sidebar-expanded', isExpanded);
    body.classList.toggle('sidebar-collapsed', !isExpanded);
    return () => {
      body.classList.remove('sidebar-expanded', 'sidebar-collapsed');
    };
  }, [isExpanded]);

  /* ── Protocol streak ── */
  const [protocolStreakRaw, setProtocolStreakRaw] = useState<string | null>(null);

  /* ── Nav badge counts ── */
  const [badges, setBadges] = useState<NavBadges>({ tasks: 0, todoCount: 0, inProgressCount: 0, leads: 0, leadsNew: 0, leadsContacted: 0, leadsProposal: 0, monthIncome: 0 });

  useEffect(() => {
    if (!user) return;
    const fetchBadges = async () => {
      // Skip polling while the tab is hidden — avoids wasted bandwidth and
      // quota (dashboard endpoint fans out across several Supabase queries).
      // A fresh fetch runs on visibilitychange below when the tab comes back.
      if (document.hidden) return;
      try {
        const data = await api.get<any>("/api/dashboard");
        if (!data || typeof data !== 'object') return;
        setBadges({
          tasks: data.activeTasks || 0,
          todoCount: data.todoCount || 0,
          inProgressCount: data.inProgressCount || 0,
          leads: data.leadsCount || 0,
          leadsNew: data.leadsNew || 0,
          leadsContacted: data.leadsContacted || 0,
          leadsProposal: data.leadsProposal || 0,
          monthIncome: data.todayIncome || 0,
        });
      } catch (e) {
        // badge fetch failed — non-critical
      }
    };
    fetchBadges();
    // Refresh every 60s (no-op while hidden — see fetchBadges guard above)
    const interval = setInterval(fetchBadges, 60_000);
    // Refresh immediately when the tab becomes visible again so badges
    // aren't stale for up to 60s after returning from background.
    const onVisible = () => { if (!document.hidden) fetchBadges(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user]);

  /* ── Mobile header menu ── */
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  /* ── Mobile FAB menu ── */
  const [fabMenuOpen, setFabMenuOpen] = useState(false);
  const fabMenuRef = useRef<HTMLDivElement>(null);

  /* ── AI Chat panel ── */
  const [aiChatOpen, setAIChatOpen] = useState(false);

  // Reusable quick create items for both desktop and mobile. Store handles
  // the tab switch + pending intent atomically — no setTimeout race with
  // the target page's lazy chunk.
  const setPendingQuickCreate = useUIStore.getState().setPendingQuickCreate;
  const quickCreateItems = useMemo(() => [
    { icon: <UserPlus size={14} aria-hidden="true" />, label: t("app.quickCreate.lead"), action: () => setPendingQuickCreate("lead") },
    { icon: <ListTodo size={14} aria-hidden="true" />, label: t("app.quickCreate.task"), action: () => setPendingQuickCreate("task") },
    { icon: <Users size={14} aria-hidden="true" />, label: t("app.quickCreate.client"), action: () => setPendingQuickCreate("client") },
    { icon: <FileText size={14} aria-hidden="true" />, label: t("app.quickCreate.bizFinance"), action: () => setPendingQuickCreate("biz-transaction") },
  ], [t, setPendingQuickCreate]);

  useClickOutside(fabMenuRef, () => setFabMenuOpen(false), fabMenuOpen);
  useClickOutside(mobileMenuRef, () => setMobileMenuOpen(false), mobileMenuOpen);

  // Realtime
  useEffect(() => {
    if (user) startRealtime();
    else stopRealtime();
    return () => stopRealtime();
  }, [user]);

  // Sync operator profile + preferences + theme + widgets from /api/settings.
  // Behaviour lives in useCloudSettingsSync — App() just wires the streak
  // handoff (which drives a local state value used by the streak memo below).
  useCloudSettingsSync(user, setProtocolStreakRaw);

  const streak = useMemo(() => {
    try {
      if (!protocolStreakRaw) return 0;
      const s = JSON.parse(protocolStreakRaw);
      const today = todayDateKey();
      const yesterday = dateToKey(new Date(Date.now() - 86400000));
      if (s.lastDate === today || s.lastDate === yesterday) return s.count || 0;
    } catch (e) {
      // Corrupted localStorage entry — surface in dev so we notice migration
      // regressions; in prod silently reset to 0 rather than blowing up the UI.
      if (import.meta.env.DEV) {
        console.warn('[App] protocol streak parse failed, resetting to 0:', e);
      }
    }
    return 0;
  }, [protocolStreakRaw]);

  // Connection listeners. sync-status used to flow through a CustomEvent
  // here — it now writes directly into useSettingsStore from sync-manager,
  // and this component subscribes via `syncStatus` / `pendingOps` below.
  useEffect(() => {
    const goOnline = () => { setOnline(true); showToast(t("app.network.online")); };
    const goOffline = () => { setOnline(false); showToast(t("app.network.offline")); };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [setOnline, showToast, t]);

  // Programmatic nav
  useEffect(() => {
    const handler = (e: Event) => {
      const tab = (e as CustomEvent).detail?.tab;
      if (tab) setActiveTab(tab);
    };
    window.addEventListener("navigate-tab", handler);
    return () => window.removeEventListener("navigate-tab", handler);
  }, [setActiveTab]);

  /* ── Keyboard shortcuts: 1-5 jump to tabs, 6 = settings ── */
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // ⌘K / Ctrl+K — lives here (instead of inside CommandPalette) so the palette
      // can be lazy-loaded and the shortcut still works before it mounts.
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        const s = useUIStore.getState();
        s.setCommandPaletteOpen(!s.commandPaletteOpen);
        return;
      }
      // Don't trigger when typing in inputs or editable areas
      const el = e.target as HTMLElement;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (el?.contentEditable === "true" || el?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= MAIN_TABS.length) {
        e.preventDefault();
        setActiveTab(MAIN_TABS[num - 1].id);
      }
      if (e.key === "6") {
        e.preventDefault();
        setActiveTab("settings");
      }
      // N = quick create for current tab. keepTab: true because the user
      // is already on a tab that makes sense for this intent.
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        const typeMap: Record<string, "task" | "lead" | "client" | "transaction"> = {
          home: "task", work: "task", leads: "lead", clients: "client", finance: "transaction",
        };
        const type = typeMap[activeTabRef.current] || "task";
        useUIStore.getState().setPendingQuickCreate(type, { keepTab: true });
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [setActiveTab]);

  const operatorDisplayName = operatorName.trim() || user?.email?.split("@")[0] || "User";
  const currentTab = TAB_MAP[activeTab];
  const pageTitle = currentTab ? t(currentTab.labelKey) : t("nav.home");

  // Auth gate
  if (authLoading && !offlineMode) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: "var(--color-bg-primary)" }}>
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--color-accent)" }} />
      </div>
    );
  }
  if (!user && !offlineMode) return <LoginPage />;

  return (
    <div
      className="flex overflow-hidden"
      style={{ height: "100dvh", background: "var(--color-bg-primary)", color: "var(--color-text-primary)" }}
    >
      {/* Skip to main content — visible on keyboard focus */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:rounded-[var(--radius-8)]"
        style={{ zIndex: 9999, background: "var(--color-accent)", color: "var(--color-text-on-color)" } as React.CSSProperties}
      >
        Skip to main content
      </a>
      {/* ═══════════ Desktop Sidebar ═══════════ */}
      <aside
        ref={sidebarRef}
        className="hidden md:flex flex-col shrink-0 transition-[width] duration-200 sidebar-glass"
        style={{
          width: isExpanded ? "var(--sidebar-width)" : 56,
          transitionTimingFunction: "var(--ease-out-quad)",
        } as React.CSSProperties}
      >
        {/* Workspace area — Logo + info (expanded only) */}
        {isExpanded && (
          <div className="flex items-center shrink-0 h-12 justify-between px-4">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-6)] shrink-0"
                style={{ background: "var(--color-accent)", color: "var(--color-brand-text)", fontSize: "11px", fontWeight: "var(--font-weight-bold)" } as React.CSSProperties}
              >
                S
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[15px] leading-none truncate" style={{ fontWeight: "var(--font-weight-semibold)", color: "var(--color-text-primary)" } as React.CSSProperties}>
                  Solo CEO
                </span>
                <span className="text-[10px] leading-none mt-0.5 truncate" style={{ color: "var(--color-text-quaternary)" }}>
                  {operatorDisplayName}
                </span>
              </div>
            </div>
            <button
              onClick={toggleSidebar}
              className="btn-icon-sm"
              style={{ color: "var(--color-text-tertiary)" }}
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose size={16} />
            </button>
          </div>
        )}

        {/* Search trigger + Quick create */}
        {isExpanded && (
          <div className="flex items-center gap-1 mx-3 mb-2">
            <button
              onClick={() => useUIStore.getState().setCommandPaletteOpen(true)}
              className="flex-1 flex items-center gap-2 px-2 h-8 min-w-0 rounded-[var(--radius-6)] text-[13px] transition-colors hover:bg-[var(--color-bg-tertiary)]"
              style={{ color: "var(--color-text-quaternary)", background: "var(--color-bg-translucent)" }}
              aria-label={t("common.search")}
            >
              <Search size={14} className="shrink-0" />
              <span className="flex-1 text-left truncate">{t("common.search")}</span>
              <kbd className="shrink-0 text-[10px] px-1 py-px rounded-[var(--radius-2)]" style={{ fontFamily: "inherit", color: "var(--color-text-quaternary)", background: "var(--color-bg-tertiary)", border: "1px solid var(--color-border-primary)" }}>⌘K</kbd>
            </button>
            <QuickCreateMenu />
          </div>
        )}

        {/* Collapsed: expand button + search + create */}
        {!isExpanded && (
          <div className="flex flex-col items-center gap-1 pt-1 pb-2 mb-1" style={{ borderBottom: "1px solid var(--color-line-tertiary)" }}>
            {/* Expand sidebar trigger */}
            <button
              onClick={toggleSidebar}
              className="flex items-center justify-center rounded-[var(--radius-8)] transition-all hover:bg-[var(--color-bg-tertiary)] hover:scale-105 active:scale-95"
              style={{ width: 32, height: 32, color: "var(--color-text-secondary)" }}
              title={t("nav.pinSidebar") || "Expand sidebar"}
              aria-label="Expand sidebar"
            >
              <PanelLeft size={16} />
            </button>
            <button
              onClick={() => useUIStore.getState().setCommandPaletteOpen(true)}
              className="flex items-center justify-center rounded-[var(--radius-6)] transition-colors hover:bg-[var(--color-bg-tertiary)]"
              style={{ width: 32, height: 32, color: "var(--color-text-quaternary)" }}
              title={`${t("common.search")} (⌘K)`}
              aria-label="Search"
            >
              <Search size={14} />
            </button>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 flex flex-col gap-px px-3">
          {isExpanded && (
            <span className="section-label px-2 pt-2 pb-1">{t("nav.workspace") || "Workspace"}</span>
          )}
          {MAIN_TABS.map((tab) => (
            <SidebarItem
              key={tab.id}
              id={tab.id}
              icon={tab.icon}
              label={t(tab.labelKey)}
              active={activeTab === tab.id}
              expanded={isExpanded}
              onClick={() => setActiveTab(tab.id)}
              badge={tab.badgeKey ? badges[tab.badgeKey as keyof NavBadges] : undefined}
              badgeSegments={undefined}
            />
          ))}

          {/* AI Chat — in main nav (toggle) */}
          <SidebarItem
            id="__ai_chat__"
            icon={<MessageCircle size={16} aria-hidden="true" />}
            label={t("ai.chat.title")}
            active={aiChatOpen}
            expanded={isExpanded}
            onClick={() => setAIChatOpen(!aiChatOpen)}
          />
        </nav>

        {/* Bottom — compact Linear-style */}
        <div className={`flex flex-col px-3 pb-3 pt-2 ${isExpanded ? "mt-auto" : "mt-auto items-center gap-2"}`}>
          {/* Collapsed: utility icons stacked */}
          {!isExpanded && (
            <div className="flex flex-col items-center gap-0.5 py-1" style={{ borderTop: "1px solid var(--color-line-tertiary)", paddingTop: 8 }}>
              <SyncIndicator isOnline={isOnline} syncStatus={syncStatus} pendingOps={pendingOps} compact />
              <button
                onClick={cycleTheme}
                className="btn-icon-sm"
                style={{ color: "var(--color-text-quaternary)" }}
                title={themeLabel}
                aria-label={`Theme: ${themeMode}`}
              >
                {themeIcon}
              </button>
              <button
                onClick={() => setActiveTab("settings")}
                className="btn-icon-sm"
                style={{ color: activeTab === "settings" ? "var(--color-text-primary)" : "var(--color-text-quaternary)" }}
                title={t("nav.settings")}
                aria-label="Settings"
              >
                <SettingsIcon size={14} />
              </button>
            </div>
          )}


          {/* User */}
          <UserMenu
            operatorDisplayName={operatorDisplayName}
            operatorAvatar={operatorAvatar}
            streak={streak}
            isOnline={isOnline}
            syncStatus={syncStatus}
            pendingOps={pendingOps}
            isExpanded={isExpanded}
            user={user}
            themeMode={themeMode}
            setThemeMode={setThemeMode}
            setActiveTab={setActiveTab}
            onSignOut={signOut}
            onSignIn={exitOfflineMode}
          />
        </div>
      </aside>

      {/* ═══════════ Main Content — floating panel ═══════════ */}
      <div
        className={`flex flex-1 flex-col overflow-hidden md:my-3 md:mx-3 content-panel app-grid-bg${aiChatOpen ? ' chat-open' : ''}`}
        style={{
          backgroundColor: "var(--color-bg-primary)",
        }}
      >
        {/* Mobile header — floating capsules */}
        <div
          className="md:hidden fixed left-0 right-0 z-[var(--layer-header)] flex items-center justify-between pointer-events-none mobile-top-bar"
          style={{
            top: 0,
            paddingTop: "calc(var(--mobile-header-pt, env(safe-area-inset-top, 0px)) + 8px)",
            paddingLeft: "max(env(safe-area-inset-left), 16px)",
            paddingRight: "max(env(safe-area-inset-right), 16px)",
          }}
        >
          {/* Left capsule — identity + online dot */}
          <div className="mobile-header-pill pointer-events-auto relative">
            <Avatar src={operatorAvatar || undefined} name={operatorDisplayName} size="md" />
            {/* Online status dot */}
            <span
              className="absolute rounded-full border-2"
              style={{
                width: 10, height: 10,
                bottom: 2, right: 2,
                background: isOnline
                  ? syncStatus === "syncing" ? "var(--color-accent)" : "var(--color-green)"
                  : "var(--color-warning)",
                borderColor: "var(--color-bg-primary)",
              }}
            />
          </div>
          {/* Right capsule — menu trigger */}
          <div className="relative pointer-events-auto" ref={mobileMenuRef}>
            <button
              onClick={() => setMobileMenuOpen((p) => !p)}
              className="mobile-header-pill"
              style={{ width: 42, height: 42, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
              aria-expanded={mobileMenuOpen}
              aria-haspopup="true"
              aria-label="Menu"
            >
              <Ellipsis size={20} />
            </button>
            {/* Dropdown menu */}
            <div
              className="absolute right-0 w-52 py-1 overflow-hidden popover-spring origin-top-right"
              role="menu"
              data-open={mobileMenuOpen}
              style={{
                top: "calc(100% + 6px)",
                background: "var(--color-bg-primary)",
                border: "1px solid var(--color-border-primary)",
                borderRadius: "var(--radius-8)",
                boxShadow: "var(--shadow-medium)",
                zIndex: "var(--layer-popover)",
                transform: mobileMenuOpen ? "scale(1) translateY(0)" : "scale(0.9) translateY(-8px)",
              } as React.CSSProperties}
            >
              {/* User info */}
              <div className="px-3 py-2" style={{ borderBottom: "1px solid var(--color-line-tertiary)" }}>
                <div className="text-[14px] truncate" style={{ fontWeight: "var(--font-weight-medium)", color: "var(--color-text-primary)" } as React.CSSProperties}>
                  {operatorDisplayName}
                </div>
                {user?.email && (
                  <div className="text-[13px] truncate mt-0.5" style={{ color: "var(--color-text-quaternary)" }}>{user.email}</div>
                )}
              </div>
              {/* Cloud status */}
              <div className="flex items-center gap-3 px-3 py-2 text-[14px]" style={{ color: "var(--color-text-tertiary)" }}>
                {isOnline
                  ? <Cloud size={16} style={{ color: "var(--color-green)" }} />
                  : <CloudOff size={16} style={{ color: "var(--color-warning)" }} />}
                <span>{isOnline ? t("app.cloudConnected") : t("app.offline")}</span>
              </div>
              {/* Theme mode — 3-way segmented control */}
              <div className="px-3 py-2">
                <div className="text-[12px] mb-1.5" style={{ color: "var(--color-text-quaternary)" }}>
                  {t("settings.colorMode") || "Color Mode"}
                </div>
                <div className="flex rounded-[var(--radius-6)] overflow-hidden" style={{ border: "1px solid var(--color-border-primary)" }}>
                  {(["light", "auto", "dark"] as const).map((value) => {
                    const Icon = value === "light" ? Sun : value === "auto" ? Monitor : Moon;
                    return (
                      <button
                        key={value}
                        onClick={(e) => { e.stopPropagation(); setThemeMode(value); }}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 cursor-pointer transition-colors"
                        style={{
                          background: themeMode === value ? "var(--color-accent)" : "transparent",
                          color: themeMode === value ? "var(--color-text-on-color)" : "var(--color-text-tertiary)",
                          fontSize: "var(--font-size-xs)",
                          fontWeight: "var(--font-weight-medium)",
                        } as React.CSSProperties}
                        title={t(`settings.theme${value.charAt(0).toUpperCase() + value.slice(1)}`) || value}
                      >
                        <Icon size={13} />
                        <span>{t(`settings.theme${value.charAt(0).toUpperCase() + value.slice(1)}`) || value}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Settings */}
              <button
                onClick={() => { setMobileMenuOpen(false); setActiveTab("settings"); }}
                role="menuitem"
                className="flex items-center gap-3 w-full px-3 py-2 text-[15px] cursor-pointer transition-colors hover:bg-[var(--color-bg-tertiary)]"
                style={{ color: "var(--color-text-secondary)" }}
              >
                <SettingsIcon size={14} style={{ color: "var(--color-text-quaternary)" }} />
                {t("nav.settings")}
              </button>
              {/* Divider */}
              <div style={{ height: 1, background: "var(--color-line-tertiary)", margin: "2px 0" }} />
              {/* Sign out / Sign in */}
              {user ? (
                <button
                  onClick={() => { setMobileMenuOpen(false); signOut(); }}
                  role="menuitem"
                  className="flex items-center gap-3 w-full px-3 py-2 text-[15px] cursor-pointer transition-colors hover:bg-[var(--color-bg-tertiary)]"
                  style={{ color: "var(--color-danger)" }}
                >
                  <LogOut size={14} />
                  {t("common.signOut") || "Sign out"}
                </button>
              ) : (
                <button
                  onClick={() => { setMobileMenuOpen(false); exitOfflineMode(); }}
                  role="menuitem"
                  className="flex items-center gap-3 w-full px-3 py-2 text-[15px] cursor-pointer transition-colors hover:bg-[var(--color-bg-tertiary)]"
                  style={{ color: "var(--color-accent)" }}
                >
                  <LogIn size={14} />
                  {t("auth.loginOrRegister") || "Sign in"}
                </button>
              )}
            </div>
          </div>
        </div>

        <OfflineBanner />

        {/* Page content — instant switch, no animation (Linear-style) */}
        <main id="main-content" className="flex-1 overflow-hidden">
          <div ref={mainScrollRef} className="h-full overflow-y-auto mobile-header-spacer" style={{ overscrollBehavior: "contain" }}>
            <Content activeTab={activeTab} />
          </div>
        </main>

        {/* Mobile bottom row — nav + FAB side by side, independent */}
        {!hideMobileNav && (
          <div
            className="md:hidden fixed left-0 right-0 z-[var(--layer-header)] flex items-center gap-2 mobile-bottom-bar"
            style={{
              bottom: 0,
              paddingLeft: 20,
              paddingRight: 20,
              pointerEvents: "none",
            }}
          >
            {/* Tab bar */}
            <nav
              aria-label="Main navigation"
              className="flex-1 flex items-center rounded-full mobile-nav-pill"
              style={{
                pointerEvents: "auto",
              }}
            >
              {MAIN_TABS.map((tab) => (
                <MobileNavItem
                  key={tab.id}
                  id={tab.id}
                  icon={tab.icon}
                  label={t(tab.labelKey)}
                  active={activeTab === tab.id}
                  onClick={setActiveTab}
                />
              ))}
            </nav>
            {/* FAB — global quick-create menu */}
            {activeTab !== "settings" && (
              <div className="shrink-0 relative" ref={fabMenuRef} style={{ pointerEvents: "auto" }}>
                <div
                  className="absolute bottom-[56px] right-0 w-[180px] py-1.5 rounded-[var(--radius-16)] fab-glass-menu transition-all duration-200 origin-bottom-right"
                  role="menu"
                  style={{
                    opacity: fabMenuOpen ? 1 : 0,
                    transform: fabMenuOpen ? "scale(1) translateY(0)" : "scale(0.92) translateY(10px)",
                    pointerEvents: fabMenuOpen ? "auto" : "none",
                  }}
                >
                  {quickCreateItems.map((item, i) => (
                    <button
                      key={i}
                      role="menuitem"
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-[15px] transition-colors hover:bg-[var(--color-bg-tertiary)] press-feedback"
                      style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}
                      onClick={() => { setFabMenuOpen(false); item.action(); }}
                    >
                      <span style={{ color: "var(--color-text-tertiary)" }}>{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
                  <div className="mx-3 my-1" style={{ borderTop: "1px solid var(--color-line-tertiary)" }} />
                  <button
                    role="menuitem"
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-[15px] transition-colors hover:bg-[var(--color-bg-tertiary)] press-feedback"
                    style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}
                    onClick={() => { setFabMenuOpen(false); setAIChatOpen(true); }}
                  >
                    <span style={{ color: "var(--color-accent)" }}><MessageCircle size={14} /></span>
                    {t("ai.chat.title")}
                  </button>
                </div>
                <button
                  onClick={() => setFabMenuOpen(!fabMenuOpen)}
                  className="flex items-center justify-center rounded-full press-feedback"
                  style={{
                    width: 48,
                    height: 48,
                    background: "var(--color-accent)",
                    color: "var(--color-brand-text)",
                    boxShadow: "var(--shadow-medium)",
                  }}
                  aria-label="Quick create"
                  aria-expanded={fabMenuOpen}
                >
                  <Plus size={20} style={{ transition: "transform var(--duration-normal)", transform: fabMenuOpen ? "rotate(45deg)" : undefined }} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {commandPaletteOpen && (
        <Suspense fallback={null}>
          <CommandPalette />
        </Suspense>
      )}
      <PageErrorBoundary pageName="ai-chat">
        <Suspense fallback={null}>
          <AIChatPanel open={aiChatOpen} onClose={() => setAIChatOpen(false)} />
        </Suspense>
      </PageErrorBoundary>
      <GlobalToast />
      <SyncToast />
    </div>
  );
}


export default App;
