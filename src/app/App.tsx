import React, { Suspense, lazy, useEffect, useRef, useState, useMemo } from "react";
import {
  Home as HomeIcon,
  ClipboardList,
  Users,
  Wallet,
  Settings as SettingsIcon,
  Loader2,
  Moon,
  Sun,
  Monitor,
  PanelLeftClose,
  PanelLeft,
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
import { PageErrorBoundary } from "../components/PageErrorBoundary";
import { OfflineBanner } from "../components/OfflineBanner";
import { Avatar, PageSkeleton, GlobalToast } from "../components/ui";
import { useUIStore } from "../store/useUIStore";
import { useSettingsStore } from "../store/useSettingsStore";
import { useWidgetStore } from "../features/home/widgets/useWidgetStore";
import { todayDateKey, dateToKey } from "../lib/date-utils";
import { api } from "../lib/api";
import { CommandPalette } from "./CommandPalette";
import { QuickCreateMenu } from "./QuickCreateMenu";
import { UserMenu } from "./UserMenu";
import { SyncIndicator } from "./SyncIndicator";
import { useClickOutside } from "./useClickOutside";

/* ── Lazy page imports ─────────────────────────────────────────── */
const HomePage = lazy(() => import("../features/home/HomePage"));
const WorkPage = lazy(() => import("../features/work/WorkPage"));
const LeadsPage = lazy(() => import("../features/clients/LeadsPage"));
const ClientListPage = lazy(() => import("../features/clients/ClientListPage"));
const FinancePage = lazy(() => import("../features/finance/FinancePage"));
const SettingsPage = lazy(() => import("../features/settings/SettingsPage"));

/* ── Tab definitions ───────────────────────────────────────────── */
type TabId = "home" | "work" | "leads" | "clients" | "finance" | "settings";

interface TabDef {
  id: TabId;
  labelKey: string;
  icon: React.ReactNode;
  component: React.LazyExoticComponent<React.ComponentType>;
  shortcut?: string;         // keyboard shortcut hint
  badgeKey?: string;          // key in NavBadges
}

const MAIN_TABS: TabDef[] = [
  { id: "home", labelKey: "nav.home", icon: <HomeIcon size={16} aria-hidden="true" />, component: HomePage, shortcut: "1" },
  { id: "work", labelKey: "nav.work", icon: <ClipboardList size={16} aria-hidden="true" />, component: WorkPage, shortcut: "2" },
  { id: "leads",   labelKey: "nav.leads",   icon: <UserPlus size={16} aria-hidden="true" />,  component: LeadsPage,      shortcut: "3" },
  { id: "clients", labelKey: "nav.clients", icon: <Users size={16} aria-hidden="true" />,     component: ClientListPage, shortcut: "4" },
  { id: "finance", labelKey: "nav.finance", icon: <Wallet size={16} aria-hidden="true" />,    component: FinancePage,    shortcut: "5", badgeKey: "monthIncome" },
];

const SETTINGS_TAB: TabDef = {
  id: "settings", labelKey: "nav.settings", icon: <SettingsIcon size={16} aria-hidden="true" />, component: SettingsPage,
};

const ALL_TABS = [...MAIN_TABS, SETTINGS_TAB];
const TAB_MAP = Object.fromEntries(ALL_TABS.map((t) => [t.id, t]));

/* ── Badge counts type ─────────────────────────────────────────── */
type NavBadges = {
  tasks: number;
  todoCount: number;
  inProgressCount: number;
  leads: number;
  leadsNew: number;
  leadsContacted: number;
  leadsProposal: number;
  monthIncome: number;
};

/* ── Content renderer ──────────────────────────────────────────── */
const Content = React.memo(({ activeTab }: { activeTab: string }) => {
  const Page = TAB_MAP[activeTab]?.component ?? HomePage;
  return (
    <PageErrorBoundary key={activeTab} pageName={activeTab}>
      <Suspense fallback={<PageSkeleton />}>
        <Page />
      </Suspense>
    </PageErrorBoundary>
  );
});

/* ══════════════════════════════════════════════════════════════════
   App — Linear-identical layout
   ══════════════════════════════════════════════════════════════════ */
function App() {
  const { user, loading: authLoading, offlineMode, signOut, exitOfflineMode } = useAuth();
  const { t } = useT();

  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const sidebarExpanded = useUIStore((s) => s.sidebarExpanded);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const themeMode = useUIStore((s) => s.themeMode);
  const setThemeMode = useUIStore((s) => s.setThemeMode);
  const toggleDarkMode = useUIStore((s) => s.toggleDarkMode);
  const hideMobileNav = useUIStore((s) => s.hideMobileNav);

  // Cycle: light → auto → dark → light
  const cycleTheme = () => {
    const next = themeMode === "light" ? "auto" : themeMode === "auto" ? "dark" : "light";
    setThemeMode(next);
  };
  const themeIcon = themeMode === "dark" ? <Moon size={14} /> : themeMode === "auto" ? <Monitor size={14} /> : <Sun size={14} />;
  const themeMobileIcon = themeMode === "dark" ? <Moon size={16} /> : themeMode === "auto" ? <Monitor size={16} /> : <Sun size={16} />;
  const themeLabel = t(`settings.theme${themeMode.charAt(0).toUpperCase() + themeMode.slice(1)}`) || themeMode;

  const operatorName = useSettingsStore((s) => s.operatorName);
  const operatorAvatar = useSettingsStore((s) => s.operatorAvatar);
  const setOperator = useSettingsStore((s) => s.setOperator);
  const isOnline = useSettingsStore((s) => s.isOnline);
  const setOnline = useSettingsStore((s) => s.setOnline);
  const syncStatus = useSettingsStore((s) => s.syncStatus);
  const setSyncStatus = useSettingsStore((s) => s.setSyncStatus);
  const pendingOps = useSettingsStore((s) => s.pendingOps);
  const setPendingOps = useSettingsStore((s) => s.setPendingOps);

  const sidebarRef = useRef<HTMLElement>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const isExpanded = sidebarExpanded;

  /* ── Reset scroll position on tab change ── */
  useEffect(() => {
    if (mainScrollRef.current) mainScrollRef.current.scrollTop = 0;
  }, [activeTab]);

  /* ── Protocol streak ── */
  const [protocolStreakRaw, setProtocolStreakRaw] = useState<string | null>(null);

  /* ── Nav badge counts ── */
  const [badges, setBadges] = useState<NavBadges>({ tasks: 0, todoCount: 0, inProgressCount: 0, leads: 0, leadsNew: 0, leadsContacted: 0, leadsProposal: 0, monthIncome: 0 });

  useEffect(() => {
    if (!user) return;
    const fetchBadges = async () => {
      try {
        const data = await api.get<any>("/api/dashboard");
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
    // Refresh every 60s
    const interval = setInterval(fetchBadges, 60_000);
    return () => clearInterval(interval);
  }, [user]);

  /* ── Mobile FAB menu ── */
  const [fabMenuOpen, setFabMenuOpen] = useState(false);
  const fabMenuRef = useRef<HTMLDivElement>(null);

  // Reusable quick create items for both desktop and mobile
  const quickCreateItems = useMemo(() => [
    { icon: <ListTodo size={14} aria-hidden="true" />, label: t("app.quickCreate.task"), action: () => { setActiveTab("work"); setTimeout(() => window.dispatchEvent(new CustomEvent("quick-create", { detail: { type: "task" } })), 100); } },
    { icon: <UserPlus size={14} aria-hidden="true" />, label: t("app.quickCreate.lead"), action: () => { setActiveTab("leads"); setTimeout(() => window.dispatchEvent(new CustomEvent("quick-create", { detail: { type: "lead" } })), 100); } },
    { icon: <Users size={14} aria-hidden="true" />, label: t("app.quickCreate.client"), action: () => { setActiveTab("clients"); setTimeout(() => window.dispatchEvent(new CustomEvent("quick-create", { detail: { type: "client" } })), 100); } },
    { icon: <FileText size={14} aria-hidden="true" />, label: t("app.quickCreate.bizFinance"), action: () => { setActiveTab("finance"); setTimeout(() => window.dispatchEvent(new CustomEvent("quick-create", { detail: { type: "biz-transaction" } })), 100); } },
  ], [t]);

  useClickOutside(fabMenuRef, () => setFabMenuOpen(false), fabMenuOpen);

  // Realtime
  useEffect(() => {
    if (user) startRealtime();
    else stopRealtime();
    return () => stopRealtime();
  }, [user]);

  // Sync operator profile
  useEffect(() => {
    if (!user) return;
    api.get<Record<string, string>>("/api/settings")
      .then((s) => {
        // Always sync from server — use empty string if not set (prevents stale data from previous user)
        setOperator(s.OPERATOR_NAME || '', s.OPERATOR_AVATAR || '');
        if (s.CURRENCY) useSettingsStore.getState().setCurrency(s.CURRENCY);
        if (s.TIMEZONE) useSettingsStore.getState().setTimezone(s.TIMEZONE);
        if (s.protocol_streak) setProtocolStreakRaw(s.protocol_streak);
        // Restore UI preferences from cloud
        const ui = useUIStore.getState();
        if (s.THEME_MODE && s.THEME_MODE !== ui.themeMode) ui.setThemeMode(s.THEME_MODE as "light" | "dark" | "auto");
        if (s.STYLE_ID && s.STYLE_ID !== ui.styleId) ui.setStyleId(s.STYLE_ID);
        if (s.PALETTE_ID && s.PALETTE_ID !== ui.paletteId) ui.setPaletteId(s.PALETTE_ID);
        if (s.WIDGET_LAYOUT) try { useWidgetStore.getState().setLayout(JSON.parse(s.WIDGET_LAYOUT)); } catch {}
        // Restore widget data from cloud (only if local is empty)
        if (s.COUNTDOWNS && !localStorage.getItem("solo-ceo-countdowns")) {
          try { localStorage.setItem("solo-ceo-countdowns", s.COUNTDOWNS); } catch {}
        }
        if (s.ENERGY_DATA && !localStorage.getItem("solo-ceo-energy-v3")) {
          try { localStorage.setItem("solo-ceo-energy-v3", s.ENERGY_DATA); } catch {}
        }
      })
      .catch((e) => {
        // operator profile sync failed — non-critical
      });
  }, [user, setOperator]);

  const streak = useMemo(() => {
    try {
      if (!protocolStreakRaw) return 0;
      const s = JSON.parse(protocolStreakRaw);
      const today = todayDateKey();
      const yesterday = dateToKey(new Date(Date.now() - 86400000));
      if (s.lastDate === today || s.lastDate === yesterday) return s.count || 0;
    } catch (e) {
      // streak parse failed — return 0
    }
    return 0;
  }, [protocolStreakRaw]);

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

  /* ── Keyboard shortcuts: 1-5 jump to tabs, 6 = settings ── */
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
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
      // N = quick create for current tab
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        const typeMap: Record<string, string> = { home: "task", work: "task", leads: "lead", clients: "client", finance: "transaction" };
        const type = typeMap[activeTabRef.current] || "task";
        window.dispatchEvent(new CustomEvent("quick-create", { detail: { type } }));
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
      {/* ═══════════ Desktop Sidebar ═══════════ */}
      <aside
        ref={sidebarRef}
        className="hidden lg:flex flex-col shrink-0 transition-[width] duration-200 sidebar-glass"
        style={{
          width: isExpanded ? "var(--sidebar-width)" : 56,
          background: "var(--color-bg-secondary)",
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
            <QuickCreateMenu setActiveTab={setActiveTab} />
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
              onClick={setActiveTab}
              badge={tab.badgeKey ? badges[tab.badgeKey as keyof NavBadges] : undefined}
              badgeSegments={undefined}
            />
          ))}
        </nav>

        {/* Bottom — compact Linear-style */}
        <div className={`mt-auto flex flex-col px-3 pb-3 pt-2 ${isExpanded ? "" : "items-center gap-2"}`}>
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
        className="flex flex-1 flex-col overflow-hidden lg:my-2 lg:mr-2 content-panel app-grid-bg"
        style={{
          backgroundColor: "var(--color-bg-primary)",
        }}
      >
        {/* Mobile header */}
        <header
          className="lg:hidden shrink-0 flex items-center justify-between header-glass"
          style={{
            paddingTop: "calc(var(--mobile-header-pt, env(safe-area-inset-top, 0px)) + 8px)",
            paddingBottom: "8px",
            paddingLeft: "max(env(safe-area-inset-left), 16px)",
            paddingRight: "max(env(safe-area-inset-right), 16px)",
            borderBottom: "1px solid var(--color-line-tertiary)",
            background: "var(--color-bg-primary)",
          }}
        >
          <span className="text-[16px] truncate" style={{ fontWeight: "var(--font-weight-semibold)", color: "var(--color-text-primary)" } as React.CSSProperties}>
            {pageTitle}
          </span>
          <div className="flex items-center gap-1">
            {streak > 1 && (
              <span className="text-[13px] tabular-nums" style={{ fontWeight: "var(--font-weight-bold)", color: "var(--color-warning)" } as React.CSSProperties}>
                🔥{streak}
              </span>
            )}
            <SyncIndicator isOnline={isOnline} syncStatus={syncStatus} pendingOps={pendingOps} compact />
            <button
              onClick={cycleTheme}
              className="btn-icon"
              style={{ color: "var(--color-text-tertiary)" }}
              aria-label={`Theme: ${themeMode}`}
            >
              {themeMobileIcon}
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className="btn-icon"
              aria-label="Settings"
            >
              <Avatar src={operatorAvatar || undefined} name={operatorDisplayName} size="sm" />
            </button>
          </div>
        </header>

        <OfflineBanner />

        {/* Page content — instant switch, no animation (Linear-style) */}
        <main className="flex-1 overflow-hidden">
          <div ref={mainScrollRef} className="h-full overflow-y-auto" style={{ overscrollBehavior: "contain" }}>
            <Content activeTab={activeTab} />
          </div>
        </main>

        {/* Mobile bottom row — nav + FAB side by side, independent */}
        {!hideMobileNav && (
          <div
            className="lg:hidden fixed left-0 right-0 z-30 flex items-center gap-2"
            style={{
              bottom: 0,
              padding: "0 20px",
              paddingBottom: "max(20px, env(safe-area-inset-bottom, 20px))",
              pointerEvents: "none",
            }}
          >
            {/* Tab bar */}
            <nav
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
                  <Plus size={20} style={{ transition: "transform 0.2s", transform: fabMenuOpen ? "rotate(45deg)" : undefined }} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <CommandPalette />
      <GlobalToast />
      <SyncToast />
    </div>
  );
}

/* ── Sidebar item — with badge segments ────────────────────────── */
interface BadgeSegment { count: number; color: string; }

const SidebarItem = React.memo(function SidebarItem({
  id, icon, label, active, expanded, onClick, badge, badgeSegments,
}: {
  id: string; icon: React.ReactNode; label: string; active: boolean; expanded: boolean;
  onClick: (id: string) => void; badge?: number; badgeSegments?: BadgeSegment[];
}) {
  // No native title — we use a custom tooltip for collapsed state
  const hasSegments = badgeSegments && badgeSegments.some(s => s.count > 0);

  return (
    <button
      onClick={() => onClick(id)}
      aria-current={active ? "page" : undefined}
      className={`group relative flex items-center select-none cursor-pointer rounded-[var(--radius-6)] text-[15px] ${expanded ? "gap-2 px-2 py-1.5" : "justify-center w-9 h-9 mx-auto"}`}
      style={{
        color: active ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
        fontWeight: active ? "var(--font-weight-semibold)" : "var(--font-weight-normal)",
        background: active ? "var(--color-bg-tertiary)" : undefined,
        border: "1px solid transparent",
        transition: "all 80ms var(--ease-out-quad)",
      } as React.CSSProperties}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "var(--color-bg-tertiary)"; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = ""; }}
    >
      <span className="shrink-0 relative" style={{ color: active ? "var(--color-text-primary)" : "var(--color-text-quaternary)" }}>
        {icon}
        {/* Collapsed badge dot */}
        {!expanded && (hasSegments || (badge !== undefined && badge > 0)) && (
          <span
            className="absolute -top-0.5 -right-0.5 w-[6px] h-[6px] rounded-full"
            style={{ background: "var(--color-text-quaternary)" }}
          />
        )}
      </span>
      {/* Collapsed tooltip — shows on hover */}
      {!expanded && (
        <span className="absolute left-full ml-2 px-2 py-1 text-[13px] whitespace-nowrap rounded-[var(--radius-4)] opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"
          style={{ background: "var(--color-text-primary)", color: "var(--color-bg-primary)", fontWeight: "var(--font-weight-medium)", boxShadow: "var(--shadow-medium)", zIndex: 50 } as React.CSSProperties}>
          {label}
        </span>
      )}
      {expanded && (
        <>
          <span className="whitespace-nowrap truncate flex-1 text-left">{label}</span>
          {/* Segmented badge: colored pills */}
          {hasSegments ? (
            <span className="flex items-center gap-1">
              {badgeSegments!.map((seg, i) => seg.count > 0 && (
                <span
                  key={i}
                  className="flex items-center justify-center rounded-full text-[10px] tabular-nums"
                  style={{
                    minWidth: 18, height: 18, padding: "0 5px",
                    background: seg.color, color: "var(--color-text-on-color)",
                    fontWeight: "var(--font-weight-bold)", lineHeight: 1,
                  } as React.CSSProperties}
                >
                  {seg.count > 99 ? "99+" : seg.count}
                </span>
              ))}
            </span>
          ) : badge !== undefined && badge > 0 ? (
            <span
              className="text-[13px] tabular-nums"
              style={{ color: "var(--color-text-quaternary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}
            >
              {badge > 99 ? "99+" : badge}
            </span>
          ) : null}
        </>
      )}
    </button>
  );
});

/* ── Mobile nav item ───────────────────────────────────────────── */
const MobileNavItem = React.memo(function MobileNavItem({
  id, icon, label, active, onClick,
}: {
  id: string; icon: React.ReactNode; label: string; active: boolean; onClick: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onClick(id)}
      aria-current={active ? "page" : undefined}
      className={`relative flex-1 flex flex-col items-center justify-center gap-1 select-none rounded-full py-1.5 min-h-[44px] transition-all press-feedback`}
      style={{
        color: active ? "var(--color-accent)" : "var(--color-text-quaternary)",
        background: active ? "var(--color-accent-tint)" : "transparent",
      }}
    >
      {icon}
      <span className="text-[13px]" style={{ fontWeight: active ? "var(--font-weight-semibold)" : "var(--font-weight-medium)" } as React.CSSProperties}>{label}</span>
    </button>
  );
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
      className="fixed left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2.5 text-[15px]"
      style={{
        top: "max(env(safe-area-inset-top, 0px), 16px)",
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
