import React, { Suspense, lazy, useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Home as HomeIcon,
  ClipboardList,
  Users,
  Wallet,
  Settings as SettingsIcon,
  Loader2,
  Moon,
  Sun,
  PanelLeftClose,
  PanelLeft,
  Cloud,
  CloudOff,
  RefreshCw,
  LogOut,
  Search,
  CheckCircle2,
  AlertTriangle,
  Info,
  Plus,
  UserPlus,
  FileText,
  ListTodo,
} from "lucide-react";
import { useT } from "../i18n/context";
import { useAuth } from "../auth/AuthProvider";
import LoginPage from "../auth/LoginPage";
import { startRealtime, stopRealtime } from "../db/realtime";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { Avatar, PageSkeleton, GlobalToast } from "../components/ui";
import { useUIStore } from "../store/useUIStore";
import { useSettingsStore } from "../store/useSettingsStore";
import { CommandPalette } from "./CommandPalette";

/* ── Lazy page imports ─────────────────────────────────────────── */
const HomePage = lazy(() => import("../features/home/HomePage"));
const WorkPage = lazy(() => import("../features/work/WorkPage"));
const PipelinePage = lazy(() => import("../features/clients/ClientsPage"));
const FinancePage = lazy(() => import("../features/finance/FinancePage"));
const SettingsPage = lazy(() => import("../features/settings/SettingsPage"));

/* ── Tab definitions ───────────────────────────────────────────── */
type TabId = "home" | "work" | "clients" | "finance" | "settings";

interface TabDef {
  id: TabId;
  labelKey: string;
  icon: React.ReactNode;
  component: React.LazyExoticComponent<React.ComponentType>;
  shortcut?: string;         // keyboard shortcut hint
  badgeKey?: string;          // key in NavBadges
}

const MAIN_TABS: TabDef[] = [
  { id: "home", labelKey: "nav.home", icon: <HomeIcon size={16} />, component: HomePage, shortcut: "1" },
  { id: "work", labelKey: "nav.work", icon: <ClipboardList size={16} />, component: WorkPage, shortcut: "2", badgeKey: "tasks" },
  { id: "clients", labelKey: "nav.clients", icon: <Users size={16} />, component: PipelinePage, shortcut: "3", badgeKey: "leads" },
  { id: "finance", labelKey: "nav.finance", icon: <Wallet size={16} />, component: FinancePage, shortcut: "4", badgeKey: "monthIncome" },
];

const SETTINGS_TAB: TabDef = {
  id: "settings", labelKey: "nav.settings", icon: <SettingsIcon size={16} />, component: SettingsPage,
};

const ALL_TABS = [...MAIN_TABS, SETTINGS_TAB];
const TAB_MAP = Object.fromEntries(ALL_TABS.map((t) => [t.id, t]));

/* ── Badge counts type ─────────────────────────────────────────── */
type NavBadges = {
  tasks: number;
  leads: number;
  monthIncome: number;
};

/* ── Content renderer ──────────────────────────────────────────── */
const Content = React.memo(({ activeTab }: { activeTab: string }) => {
  const Page = TAB_MAP[activeTab]?.component ?? HomePage;
  return (
    <ErrorBoundary key={activeTab}>
      <Suspense fallback={<PageSkeleton />}>
        <div className="page-enter">
          <Page />
        </div>
      </Suspense>
    </ErrorBoundary>
  );
});

/* ══════════════════════════════════════════════════════════════════
   App — Linear-identical layout
   ══════════════════════════════════════════════════════════════════ */
function App() {
  const { user, loading: authLoading, offlineMode, signOut } = useAuth();
  const { t } = useT();

  const {
    activeTab, setActiveTab,
    sidebarExpanded, toggleSidebar,
    darkMode, toggleDarkMode,
    hideMobileNav,
  } = useUIStore();

  const {
    operatorName, operatorAvatar,
    setOperator,
    isOnline, setOnline,
    syncStatus, setSyncStatus,
    pendingOps, setPendingOps,
  } = useSettingsStore();

  /* ── Hover-expand for collapsed sidebar ── */
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout>>();
  const sidebarRef = useRef<HTMLElement>(null);

  const isExpanded = sidebarExpanded || hoverExpanded;

  const handleMouseEnter = useCallback(() => {
    if (sidebarExpanded) return;
    hoverTimeout.current = setTimeout(() => setHoverExpanded(true), 300);
  }, [sidebarExpanded]);

  const handleMouseLeave = useCallback(() => {
    clearTimeout(hoverTimeout.current);
    setHoverExpanded(false);
  }, []);

  /* ── Nav badge counts ── */
  const [badges, setBadges] = useState<NavBadges>({ tasks: 0, leads: 0, monthIncome: 0 });

  useEffect(() => {
    if (!user) return;
    const fetchBadges = async () => {
      try {
        const res = await fetch("/api/dashboard");
        const data = await res.json();
        setBadges({
          tasks: data.activeTasks || 0,
          leads: data.leadsCount || 0,
          monthIncome: data.todayIncome || 0,
        });
      } catch {}
    };
    fetchBadges();
    // Refresh every 60s
    const interval = setInterval(fetchBadges, 60_000);
    return () => clearInterval(interval);
  }, [user]);

  /* ── User menu ── */
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [userMenuOpen]);

  /* ── Quick create menu ── */
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const quickCreateRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!quickCreateOpen) return;
    const handler = (e: MouseEvent) => {
      if (quickCreateRef.current && !quickCreateRef.current.contains(e.target as Node)) {
        setQuickCreateOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [quickCreateOpen]);

  const quickCreateActions = [
    { icon: <ListTodo size={14} />, label: t("app.quickCreate.task" as any) || "New Task", action: () => { setActiveTab("work"); setTimeout(() => window.dispatchEvent(new CustomEvent("quick-create", { detail: { type: "task" } })), 100); } },
    { icon: <UserPlus size={14} />, label: t("app.quickCreate.lead" as any) || "New Lead", action: () => { setActiveTab("clients" as any); setTimeout(() => window.dispatchEvent(new CustomEvent("quick-create", { detail: { type: "lead" } })), 100); } },
    { icon: <FileText size={14} />, label: t("app.quickCreate.transaction" as any) || "New Transaction", action: () => { setActiveTab("finance"); setTimeout(() => window.dispatchEvent(new CustomEvent("quick-create", { detail: { type: "transaction" } })), 100); } },
  ];

  // Realtime
  useEffect(() => {
    if (user) startRealtime();
    else stopRealtime();
    return () => stopRealtime();
  }, [user]);

  // Sync operator profile
  useEffect(() => {
    if (!user) return;
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s: Record<string, string>) => {
        if (s.OPERATOR_NAME) setOperator(s.OPERATOR_NAME, s.OPERATOR_AVATAR || undefined);
      })
      .catch(() => {});
  }, [user, setOperator]);

  // Connection listeners
  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    const onSync = (e: Event) => {
      const { status, pending } = (e as CustomEvent).detail || {};
      if (status) setSyncStatus(status);
      if (typeof pending === "number") setPendingOps(pending);
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    window.addEventListener("sync-status", onSync);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("sync-status", onSync);
    };
  }, [setOnline, setSyncStatus, setPendingOps]);

  // Programmatic nav
  useEffect(() => {
    const handler = (e: Event) => {
      const tab = (e as CustomEvent).detail?.tab;
      if (tab) setActiveTab(tab);
    };
    window.addEventListener("navigate-tab", handler);
    return () => window.removeEventListener("navigate-tab", handler);
  }, [setActiveTab]);

  /* ── Keyboard shortcuts: 1-4 jump to tabs, 5 = settings ── */
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const num = parseInt(e.key);
      if (num >= 1 && num <= MAIN_TABS.length) {
        e.preventDefault();
        setActiveTab(MAIN_TABS[num - 1].id);
      }
      if (e.key === "5") {
        e.preventDefault();
        setActiveTab("settings");
      }
      // N = quick create for current tab
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        const typeMap: Record<string, string> = { home: "task", work: "task", clients: "lead", finance: "transaction" };
        const type = typeMap[activeTabRef.current] || "task";
        window.dispatchEvent(new CustomEvent("quick-create", { detail: { type } }));
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [setActiveTab]);

  const operatorDisplayName = operatorName.trim() || user?.email?.split("@")[0] || "User";
  const currentTab = TAB_MAP[activeTab];
  const pageTitle = currentTab ? t(currentTab.labelKey as any) : t("nav.home" as any);

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
      style={{ height: "100dvh", background: "var(--color-bg-panel)", color: "var(--color-text-primary)" }}
    >
      {/* ═══════════ Desktop Sidebar ═══════════ */}
      <aside
        ref={sidebarRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="hidden lg:flex flex-col shrink-0 transition-[width] duration-200"
        style={{
          width: isExpanded ? "var(--sidebar-width)" : 56,
          background: "var(--color-bg-panel)",
          transitionTimingFunction: "var(--ease-out-quad)",
          position: hoverExpanded ? "fixed" : "relative",
          zIndex: hoverExpanded ? 200 : "auto",
          height: hoverExpanded ? "100dvh" : "auto",
          boxShadow: hoverExpanded ? "var(--shadow-high)" : "none",
        } as React.CSSProperties}
      >
        {/* Workspace area — Logo + info */}
        <div className={`flex items-center shrink-0 h-12 ${isExpanded ? "justify-between px-4" : "justify-center"}`}>
          {isExpanded ? (
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-4)] shrink-0"
                style={{ background: "var(--color-accent)", color: "#fff", fontSize: "11px", fontWeight: "var(--font-weight-bold)" } as React.CSSProperties}
              >
                S
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[13px] leading-none truncate" style={{ fontWeight: "var(--font-weight-semibold)", color: "var(--color-text-primary)" } as React.CSSProperties}>
                  Solo CEO
                </span>
                <span className="text-[10px] leading-none mt-0.5 truncate" style={{ color: "var(--color-text-quaternary)" }}>
                  {operatorDisplayName}
                </span>
              </div>
            </div>
          ) : (
            <div
              className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-4)]"
              style={{ background: "var(--color-accent)", color: "#fff", fontSize: "11px", fontWeight: "var(--font-weight-bold)" } as React.CSSProperties}
            >
              S
            </div>
          )}
          <button
            onClick={toggleSidebar}
            className={`flex h-7 w-7 items-center justify-center rounded-[var(--radius-4)] transition-colors hover:bg-[var(--color-bg-tertiary)] ${isExpanded ? "" : "hidden"}`}
            style={{ color: "var(--color-text-tertiary)" }}
          >
            {sidebarExpanded ? <PanelLeftClose size={15} /> : <PanelLeft size={15} />}
          </button>
        </div>

        {/* Search trigger + Quick create */}
        {isExpanded && (
          <div className="flex gap-1.5 mx-3 mb-2">
            <button
              onClick={() => useUIStore.getState().setCommandPaletteOpen(true)}
              className="flex-1 flex items-center gap-2 px-2 h-7 rounded-[var(--radius-6)] text-[12px] transition-colors hover:bg-[var(--color-bg-tertiary)]"
              style={{ color: "var(--color-text-quaternary)", background: "var(--color-bg-translucent)" }}
            >
              <Search size={13} />
              <span className="flex-1 text-left">Search...</span>
              <kbd className="text-[10px]" style={{ fontWeight: "var(--font-weight-medium)", color: "var(--color-text-quaternary)" } as React.CSSProperties}>⌘K</kbd>
            </button>
            {/* Quick create button */}
            <div className="relative" ref={quickCreateRef}>
              <button
                onClick={() => setQuickCreateOpen((p) => !p)}
                className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-6)] transition-colors hover:bg-[var(--color-bg-tertiary)]"
                style={{
                  color: quickCreateOpen ? "var(--color-accent)" : "var(--color-text-quaternary)",
                  background: quickCreateOpen ? "var(--color-accent-tint)" : "var(--color-bg-translucent)",
                }}
                title="Quick create"
              >
                <Plus size={14} style={{ transition: "transform 0.15s", transform: quickCreateOpen ? "rotate(45deg)" : undefined }} />
              </button>
              <AnimatePresence>
                {quickCreateOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    transition={{ duration: 0.12, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="absolute left-0 top-[calc(100%+4px)] w-48 py-1 overflow-hidden"
                    style={{
                      background: "var(--color-bg-primary)",
                      border: "1px solid var(--color-border-primary)",
                      borderRadius: "var(--radius-8)",
                      boxShadow: "var(--shadow-medium)",
                      zIndex: 10,
                    }}
                  >
                    {quickCreateActions.map((item, i) => (
                      <button
                        key={i}
                        onClick={() => { item.action(); setQuickCreateOpen(false); }}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] transition-colors hover:bg-[var(--color-bg-tertiary)]"
                        style={{ color: "var(--color-text-secondary)" }}
                      >
                        <span style={{ color: "var(--color-text-quaternary)" }}>{item.icon}</span>
                        {item.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Collapsed: just search icon */}
        {!isExpanded && (
          <div className="flex flex-col items-center gap-1 mb-2">
            <button
              onClick={() => useUIStore.getState().setCommandPaletteOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-6)] transition-colors hover:bg-[var(--color-bg-tertiary)]"
              style={{ color: "var(--color-text-quaternary)" }}
              title="Search (⌘K)"
            >
              <Search size={15} />
            </button>
            <button
              onClick={() => setQuickCreateOpen((p) => !p)}
              className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-6)] transition-colors hover:bg-[var(--color-bg-tertiary)]"
              style={{ color: "var(--color-text-quaternary)" }}
              title="Quick create"
            >
              <Plus size={15} />
            </button>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 flex flex-col gap-px px-3">
          {isExpanded && (
            <span className="section-label px-2 pt-2 pb-1">{t("nav.workspace" as any) || "Workspace"}</span>
          )}
          {MAIN_TABS.map((tab) => (
            <SidebarItem
              key={tab.id}
              id={tab.id}
              icon={tab.icon}
              label={t(tab.labelKey as any)}
              active={activeTab === tab.id}
              expanded={isExpanded}
              onClick={setActiveTab}
              shortcut={tab.shortcut}
              badge={tab.badgeKey ? badges[tab.badgeKey as keyof NavBadges] : undefined}
            />
          ))}
        </nav>

        {/* Bottom — compact Linear-style */}
        <div className="mt-auto flex flex-col gap-px px-3 pb-3 pt-2">
          {/* Row: sync + dark mode + settings — icon-only row */}
          <div className={`flex items-center ${isExpanded ? "gap-1 px-1 py-1" : "flex-col gap-1 py-1"}`}>
            <SyncIndicator isOnline={isOnline} syncStatus={syncStatus} pendingOps={pendingOps} compact />
            <button
              onClick={toggleDarkMode}
              className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-6)] transition-colors hover:bg-[var(--color-bg-tertiary)]"
              style={{ color: "var(--color-text-quaternary)" }}
              title={darkMode ? "Light mode" : "Dark mode"}
            >
              {darkMode ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <button
              onClick={() => setActiveTab("settings" as any)}
              className={`flex h-7 w-7 items-center justify-center rounded-[var(--radius-6)] transition-colors hover:bg-[var(--color-bg-tertiary)]`}
              style={{ color: activeTab === "settings" ? "var(--color-text-primary)" : "var(--color-text-quaternary)" }}
              title={t("nav.settings" as any)}
            >
              <SettingsIcon size={14} />
            </button>
            {isExpanded && <div className="flex-1" />}
          </div>

          {/* User — click opens menu, NOT sign out */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen((p) => !p)}
              title={isExpanded ? undefined : operatorDisplayName}
              className={`flex items-center w-full rounded-[var(--radius-6)] py-1.5 transition-colors hover:bg-[var(--color-bg-tertiary)] ${isExpanded ? "gap-2 px-2" : "justify-center"}`}
            >
              <Avatar src={operatorAvatar || undefined} name={operatorDisplayName} size="sm" />
              {isExpanded && (
                <span className="text-[12px] truncate flex-1 text-left" style={{ fontWeight: "var(--font-weight-medium)", color: "var(--color-text-secondary)" } as React.CSSProperties}>
                  {operatorDisplayName}
                </span>
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
                  style={{
                    background: "var(--color-bg-primary)",
                    border: "1px solid var(--color-border-primary)",
                    borderRadius: "var(--radius-8)",
                    boxShadow: "var(--shadow-medium)",
                    zIndex: 10,
                  }}
                >
                  {/* User info header */}
                  <div className="px-3 py-2" style={{ borderBottom: "1px solid var(--color-line-tertiary)" }}>
                    <div className="text-[12px] truncate" style={{ fontWeight: "var(--font-weight-medium)", color: "var(--color-text-primary)" } as React.CSSProperties}>
                      {operatorDisplayName}
                    </div>
                    {user?.email && (
                      <div className="text-[11px] truncate mt-0.5" style={{ color: "var(--color-text-quaternary)" }}>
                        {user.email}
                      </div>
                    )}
                  </div>
                  {/* Settings */}
                  <button
                    onClick={() => { setActiveTab("settings" as any); setUserMenuOpen(false); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] transition-colors hover:bg-[var(--color-bg-tertiary)]"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    <SettingsIcon size={14} style={{ color: "var(--color-text-quaternary)" }} />
                    {t("nav.settings" as any)}
                  </button>
                  {/* Divider */}
                  <div style={{ height: 1, background: "var(--color-line-tertiary)", margin: "2px 0" }} />
                  {/* Sign out */}
                  <button
                    onClick={() => { setUserMenuOpen(false); signOut(); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] transition-colors hover:bg-[var(--color-bg-tertiary)]"
                    style={{ color: "var(--color-danger)" }}
                  >
                    <LogOut size={14} />
                    {t("common.signOut" as any) || "Sign out"}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </aside>

      {/* Spacer when hover-expanded (keeps content from shifting) */}
      {hoverExpanded && <div className="hidden lg:block shrink-0" style={{ width: 56 }} />}

      {/* ═══════════ Main Content — floating panel ═══════════ */}
      <div
        className="flex flex-1 flex-col overflow-hidden lg:my-2 lg:mr-2 content-panel"
        style={{
          background: "var(--color-bg-primary)",
        }}
      >
        {/* Mobile header */}
        <header
          className="lg:hidden shrink-0 flex items-center justify-between"
          style={{
            paddingTop: "var(--mobile-header-pt, max(env(safe-area-inset-top), 0px))",
            paddingLeft: "max(env(safe-area-inset-left), 16px)",
            paddingRight: "max(env(safe-area-inset-right), 16px)",
            height: "var(--header-height)",
            background: "var(--color-bg-primary)",
            borderBottom: "1px solid var(--color-line-tertiary)",
          }}
        >
          <span className="text-[14px]" style={{ fontWeight: "var(--font-weight-semibold)", color: "var(--color-text-primary)" } as React.CSSProperties}>
            {pageTitle}
          </span>
          <div className="flex items-center gap-1">
            <SyncIndicator isOnline={isOnline} syncStatus={syncStatus} pendingOps={pendingOps} compact />
            <button
              onClick={toggleDarkMode}
              className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-6)] transition-colors hover:bg-[var(--color-bg-tertiary)]"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              onClick={() => setActiveTab("settings" as any)}
              className="flex h-8 w-8 items-center justify-center"
            >
              <Avatar src={operatorAvatar || undefined} name={operatorDisplayName} size="sm" />
            </button>
          </div>
        </header>

        {/* Page content — instant switch, no animation (Linear-style) */}
        <main className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto" style={{ overscrollBehavior: "contain" }}>
            <Content activeTab={activeTab} />
          </div>
        </main>

        {/* Mobile bottom nav */}
        {!hideMobileNav && (
          <nav
            className="lg:hidden shrink-0 glass"
            style={{
              paddingBottom: "max(env(safe-area-inset-bottom), 4px)",
            }}
          >
            <div className="flex items-center justify-around px-2 pt-1 pb-0.5">
              {MAIN_TABS.map((tab) => (
                <MobileNavItem
                  key={tab.id}
                  id={tab.id}
                  icon={tab.icon}
                  label={t(tab.labelKey as any)}
                  active={activeTab === tab.id}
                  onClick={setActiveTab}
                  badge={tab.badgeKey ? badges[tab.badgeKey as keyof NavBadges] : undefined}
                />
              ))}
            </div>
          </nav>
        )}
      </div>

      <CommandPalette />
      <GlobalToast />
      <SyncToast />
    </div>
  );
}

/* ── Sidebar item — with badge + shortcut ──────────────────────── */
const SidebarItem = React.memo(function SidebarItem({
  id, icon, label, active, expanded, onClick, shortcut, badge,
}: {
  id: string; icon: React.ReactNode; label: string; active: boolean; expanded: boolean;
  onClick: (id: any) => void; shortcut?: string; badge?: number;
}) {
  return (
    <button
      onClick={() => onClick(id)}
      aria-current={active ? "page" : undefined}
      title={expanded ? undefined : label}
      className={`group relative flex items-center rounded-[var(--radius-6)] text-[13px] ${expanded ? "gap-2 px-2 py-1.5" : "justify-center w-8 h-8 mx-auto"}`}
      style={{
        color: active ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
        fontWeight: active ? "var(--font-weight-medium)" : "var(--font-weight-normal)",
        transition: "all 50ms var(--ease-out-quad)",
      } as React.CSSProperties}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "var(--color-bg-translucent)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      {/* Active indicator line */}
      {active && expanded && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] rounded-full"
          style={{ height: 16, background: "var(--color-accent)" }}
        />
      )}
      <span className="shrink-0" style={{ color: active ? "var(--color-text-primary)" : "var(--color-text-quaternary)" }}>
        {icon}
      </span>
      {expanded && (
        <>
          <span className="whitespace-nowrap truncate flex-1 text-left">{label}</span>
          <span className="flex items-center gap-1.5">
            {/* Badge dot */}
            {badge !== undefined && badge > 0 && (
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: "var(--color-accent)" }}
              />
            )}
            {/* Shortcut hint */}
            {shortcut && (
              <span
                className="text-[10px] opacity-0 group-hover:opacity-100"
                style={{ color: "var(--color-text-quaternary)", fontWeight: "var(--font-weight-medium)", transition: "opacity 50ms" } as React.CSSProperties}
              >
                {shortcut}
              </span>
            )}
          </span>
        </>
      )}
      {/* Collapsed: active dot at bottom */}
      {!expanded && active && (
        <span
          className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
          style={{ background: "var(--color-accent)" }}
        />
      )}
    </button>
  );
});

/* ── Mobile nav item ───────────────────────────────────────────── */
const MobileNavItem = React.memo(function MobileNavItem({
  id, icon, label, active, onClick, badge,
}: {
  id: string; icon: React.ReactNode; label: string; active: boolean; onClick: (id: any) => void; badge?: number;
}) {
  return (
    <button
      onClick={() => onClick(id)}
      aria-current={active ? "page" : undefined}
      className="relative flex flex-col items-center justify-center gap-0.5 rounded-[var(--radius-6)] px-3 py-1.5 min-w-[52px] min-h-[44px] transition-colors"
      style={{ color: active ? "var(--color-accent)" : "var(--color-text-quaternary)" }}
    >
      {active && (
        <motion.div
          layoutId="mobile-nav-dot"
          className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
          style={{ background: "var(--color-accent)" }}
          transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
        />
      )}
      <span className="relative">
        {icon}
        {badge !== undefined && badge > 0 && (
          <span
            className="absolute -top-1 -right-1.5 w-1.5 h-1.5 rounded-full"
            style={{ background: "var(--color-accent)" }}
          />
        )}
      </span>
      <span className="text-[10px]" style={{ fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>{label}</span>
    </button>
  );
});

/* ── Sync indicator ────────────────────────────────────────────── */
const SyncIndicator = React.memo(function SyncIndicator({
  isOnline, syncStatus, pendingOps, compact = false,
}: {
  isOnline: boolean; syncStatus: "idle" | "syncing"; pendingOps: number; compact?: boolean;
}) {
  if (syncStatus === "syncing") {
    return (
      <div className="flex items-center gap-1">
        <RefreshCw size={compact ? 13 : 14} className="animate-spin" style={{ color: "var(--color-accent)" }} />
        {!compact && pendingOps > 0 && (
          <span className="text-[11px]" style={{ fontWeight: "var(--font-weight-medium)", color: "var(--color-accent)" } as React.CSSProperties}>{pendingOps}</span>
        )}
      </div>
    );
  }
  if (!isOnline) return <CloudOff size={compact ? 13 : 14} style={{ color: "var(--color-warning)" }} />;
  return <Cloud size={compact ? 13 : 14} style={{ color: "var(--color-green)" }} />;
});

/* ── Toast ──────────────────────────────────────────────────────── */
function SyncToast() {
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const { message, type } = (e as CustomEvent).detail || {};
      if (message) {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3500);
      }
    };
    window.addEventListener("sync-toast", handler);
    return () => window.removeEventListener("sync-toast", handler);
  }, []);

  if (!toast) return null;

  const icon =
    toast.type === "success" ? <CheckCircle2 size={14} style={{ color: "var(--color-green)" }} /> :
    toast.type === "warning" ? <AlertTriangle size={14} style={{ color: "var(--color-warning)" }} /> :
    <Info size={14} style={{ color: "var(--color-accent)" }} />;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2.5 text-[13px]"
      style={{
        zIndex: "var(--layer-toasts)",
        fontWeight: "var(--font-weight-medium)",
        background: "var(--color-bg-primary)",
        border: "1px solid var(--color-border-primary)",
        borderRadius: "var(--radius-8)",
        color: "var(--color-text-primary)",
        boxShadow: "var(--shadow-medium)",
        animation: "fade-in-down 0.2s var(--ease-out-quad)",
      } as React.CSSProperties}
    >
      {icon}
      {toast.message}
    </div>
  );
}

export default App;
