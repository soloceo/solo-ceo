import React, { useState, Suspense, lazy, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Home as HomeIcon,
  ClipboardList,
  Users,
  Wallet,
  Loader2,
  Moon,
  Sun,
  PanelLeftClose,
  PanelLeft,
  Cloud,
  CloudOff,
  RefreshCw,
  Settings as SettingsIcon,
  LogOut,
} from "lucide-react";
import { LanguageProvider, useT } from "./i18n/context";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import LoginPage from "./auth/LoginPage";
import { startRealtime, stopRealtime } from "./db/realtime";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react";

/* ── Lazy page imports ─────────────────────────────────────────── */
const HomePage          = lazy(() => import("./components/Home"));
const WorkPage          = lazy(() => import("./components/Work"));
const PipelinePage      = lazy(() => import("./components/Pipeline"));
const FinancePage       = lazy(() => import("./components/Finance"));
const SettingsPage      = lazy(() => import("./components/Settings"));

/* ── Tab definitions ───────────────────────────────────────────── */
type TabId = "home" | "work" | "clients" | "finance" | "settings";

interface TabDef {
  id: TabId;
  labelKey: string;
  icon: React.ReactNode;
  component: React.LazyExoticComponent<React.ComponentType>;
}

const TABS: TabDef[] = [
  { id: "home",     labelKey: "nav.home",     icon: <HomeIcon size={18} />,        component: HomePage },
  { id: "work",     labelKey: "nav.work",     icon: <ClipboardList size={18} />,    component: WorkPage },
  { id: "clients",  labelKey: "nav.clients",  icon: <Users size={18} />,            component: PipelinePage },
  { id: "finance",  labelKey: "nav.finance",  icon: <Wallet size={18} />,           component: FinancePage },
  { id: "settings", labelKey: "nav.settings", icon: <SettingsIcon size={18} />,     component: SettingsPage },
];

const TAB_MAP = Object.fromEntries(TABS.map(t => [t.id, t]));

const LOADING = (
  <div className="space-y-5 p-4 animate-skeleton-in" role="status" aria-label="Loading">
    <div className="skeleton-bone h-[180px] rounded-2xl" />
    <div className="skeleton-bone h-4 w-24 rounded" />
    <div className="space-y-3">
      <div className="skeleton-bone h-[100px] rounded-xl" />
      <div className="skeleton-bone h-[100px] rounded-xl" />
    </div>
  </div>
);

/* ── Content renderer ──────────────────────────────────────────── */
const Content = React.memo(({ activeTab }: { activeTab: string }) => {
  const Page = TAB_MAP[activeTab]?.component ?? HomePage;
  return (
    <ErrorBoundary key={activeTab}>
      <Suspense fallback={LOADING}>
        <Page />
      </Suspense>
    </ErrorBoundary>
  );
});

/* ── App ───────────────────────────────────────────────────────── */
function App() {
  const { user, loading: authLoading, offlineMode, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("home");
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [hideMobileNav, setHideMobileNav] = useState(false);

  // Start / stop realtime based on auth state
  React.useEffect(() => {
    if (user) {
      startRealtime();
    } else {
      stopRealtime();
    }
    return () => stopRealtime();
  }, [user]);

  // Operator profile — from localStorage, synced from cloud on login
  const [operatorName, setOperatorName] = useState(() => localStorage.getItem("OPERATOR_NAME") || "");
  const [operatorAvatar, setOperatorAvatar] = useState(() => localStorage.getItem("OPERATOR_AVATAR") || "");

  // Sync settings from cloud when user is logged in
  React.useEffect(() => {
    if (!user) return;
    fetch("/api/settings")
      .then(r => r.json())
      .then((s: Record<string, string>) => {
        if (s.OPERATOR_NAME) {
          localStorage.setItem("OPERATOR_NAME", s.OPERATOR_NAME);
          setOperatorName(s.OPERATOR_NAME);
        }
        if (s.OPERATOR_AVATAR) {
          localStorage.setItem("OPERATOR_AVATAR", s.OPERATOR_AVATAR);
          setOperatorAvatar(s.OPERATOR_AVATAR);
        }
      })
      .catch(() => {});
  }, [user]);

  const operatorDisplayName = operatorName.trim() || (user?.email?.split("@")[0] || "Andy");
  const operatorInitial = operatorDisplayName.charAt(0).toUpperCase();

  // Avatar dropdown
  const [avatarMenu, setAvatarMenu] = useState(false);
  const desktopAvatarRef = useRef<HTMLDivElement>(null);
  const mobileAvatarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!avatarMenu) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (desktopAvatarRef.current?.contains(t) || mobileAvatarRef.current?.contains(t)) return;
      setAvatarMenu(false);
    };
    const id = setTimeout(() => document.addEventListener("click", close), 0);
    return () => { clearTimeout(id); document.removeEventListener("click", close); };
  }, [avatarMenu]);

  // Connection & sync status
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing">("idle");
  const [pendingOps, setPendingOps] = useState(0);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    const onSync = (e: Event) => {
      const { status, pending } = (e as CustomEvent).detail || {};
      if (status) setSyncStatus(status);
      if (typeof pending === "number") setPendingOps(pending);
    };
    const onElectronNav = (e: Event) => {
      const action = (e as CustomEvent).detail;
      if (action === "quick-add") {
        // Navigate to home and trigger quick action
        setActiveTab("home");
      } else if (["home", "work", "clients", "finance", "settings"].includes(action)) {
        setActiveTab(action);
      }
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    window.addEventListener("sync-status", onSync);
    window.addEventListener("electron-nav", onElectronNav);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("sync-status", onSync);
      window.removeEventListener("electron-nav", onElectronNav);
    };
  }, []);

  // Dark mode
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("DARK_MODE") === "true");

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("DARK_MODE", String(darkMode));
  }, [darkMode]);

  const toggleDarkMode = React.useCallback(() => setDarkMode(p => !p), []);

  const handleTabChange = React.useCallback((tab: string) => {
    setActiveTab(tab);
  }, []);

  // Listen for programmatic tab navigation from child components
  React.useEffect(() => {
    const handler = (e: Event) => {
      const tab = (e as CustomEvent).detail?.tab;
      if (tab) setActiveTab(tab);
    };
    window.addEventListener("navigate-tab", handler);
    return () => window.removeEventListener("navigate-tab", handler);
  }, []);

  // Sync operator profile + mobile nav visibility
  React.useEffect(() => {
    const syncProfile = () => {
      setOperatorName(localStorage.getItem("OPERATOR_NAME") || "Andy");
      setOperatorAvatar(localStorage.getItem("OPERATOR_AVATAR") || "");
    };
    const syncNavVisibility = (e: Event) => {
      setHideMobileNav(Boolean((e as CustomEvent<{ hidden?: boolean }>).detail?.hidden));
    };
    window.addEventListener("storage", syncProfile);
    window.addEventListener("operator-name-updated", syncProfile as EventListener);
    window.addEventListener("operator-avatar-updated", syncProfile as EventListener);
    window.addEventListener("mobile-nav-visibility", syncNavVisibility as EventListener);
    return () => {
      window.removeEventListener("storage", syncProfile);
      window.removeEventListener("operator-name-updated", syncProfile as EventListener);
      window.removeEventListener("operator-avatar-updated", syncProfile as EventListener);
      window.removeEventListener("mobile-nav-visibility", syncNavVisibility as EventListener);
    };
  }, []);

  const { t } = useT();
  const currentTab = TAB_MAP[activeTab];
  const pageTitle = currentTab ? t(currentTab.labelKey as any) : t("nav.home" as any);

  // Auth gate: show loading or login page
  // But NEVER block the app if offline — allow local-only usage
  if (authLoading && !offlineMode) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: "var(--bg)" }}>
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  if (!user && !offlineMode) {
    return <LoginPage />;
  }

  return (
    <div
      className="flex overflow-hidden"
      style={{ height: "100dvh", background: "var(--bg)", color: "var(--text)", WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* ═══════════ Desktop Sidebar ═══════════ */}
      <aside
        className="hidden lg:flex flex-col shrink-0 border-r transition-[width] duration-200 ease-out"
        style={{
          width: sidebarExpanded ? 192 : 56,
          borderColor: "var(--border)",
          background: "var(--bg)",
          WebkitAppRegion: "no-drag",
        } as React.CSSProperties}
      >
        {/* spacer */}
        <div className="h-3 shrink-0" />

        {/* Sidebar toggle */}
        <button
          onClick={() => setSidebarExpanded(p => !p)}
          className="mx-auto mb-3 flex h-7 w-7 items-center justify-center rounded-md transition-opacity hover:opacity-80"
          style={{ color: "var(--text-secondary)" }}
          aria-label={sidebarExpanded ? t("app.collapseSidebar" as any) : t("app.expandSidebar" as any)}
        >
          {sidebarExpanded ? <PanelLeftClose size={15} /> : <PanelLeft size={15} />}
        </button>

        {/* Nav items */}
        <nav className="flex-1 flex flex-col gap-1 px-2">
          {TABS.map(tab => (
            <SidebarItem
              key={tab.id}
              id={tab.id}
              icon={tab.icon}
              label={t(tab.labelKey as any)}
              active={activeTab === tab.id}
              expanded={sidebarExpanded}
              onClick={handleTabChange}
            />
          ))}
        </nav>

        {/* Bottom area: sync status + settings avatar */}
        <div className="mt-auto flex flex-col gap-1 px-2 pb-3">
          {/* Sync status */}
          <div className={`flex items-center ${sidebarExpanded ? "px-2 py-2" : "justify-center py-2"}`}>
            <SyncIndicator isOnline={isOnline} syncStatus={syncStatus} pendingOps={pendingOps} compact={!sidebarExpanded} />
            {sidebarExpanded && (
              <span className="ml-1.5 text-[11px] truncate" style={{ color: "var(--text-secondary)" }}>
                {syncStatus === "syncing"
                  ? (pendingOps > 0 ? `${t("settings.sync.syncing" as any)}` : t("settings.sync.syncing" as any))
                  : !isOnline
                    ? t("settings.cloudSync.offline" as any)
                    : t("settings.cloudSync.connected" as any)}
              </span>
            )}
          </div>
          <div className="relative" ref={desktopAvatarRef}>
            <button
              onClick={() => setAvatarMenu(p => !p)}
              className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors w-full"
              style={{
                background: avatarMenu ? "var(--surface-alt)" : "transparent",
              }}
              aria-label="Settings"
            >
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full text-[11px] font-bold"
                style={{
                  background: operatorAvatar ? "transparent" : "var(--accent)",
                  color: operatorAvatar ? undefined : "#fff",
                }}
              >
                {operatorAvatar
                  ? <img src={operatorAvatar} alt={operatorDisplayName} className="h-full w-full object-cover" />
                  : operatorInitial}
              </div>
              {sidebarExpanded && (
                <span className="text-[13px] font-medium truncate" style={{ color: "var(--text)" }}>
                  {operatorDisplayName}
                </span>
              )}
            </button>
            {avatarMenu && (
              <div className="absolute bottom-full left-0 mb-2 w-56 rounded-xl overflow-hidden z-50" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)" }}>
                <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
                  <div className="text-[13px] font-semibold truncate" style={{ color: "var(--text)" }}>{operatorDisplayName}</div>
                  {user?.email && <div className="text-[11px] truncate" style={{ color: "var(--text-secondary)" }}>{user.email}</div>}
                </div>
                <button onClick={() => { setAvatarMenu(false); signOut(); }} className="flex items-center gap-2.5 w-full px-4 py-3 text-[13px] transition-colors hover:bg-[var(--surface-alt)]" style={{ color: "var(--danger)" }}>
                  <LogOut size={14} />
                  {t("auth.logoutBtn" as any)}
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ═══════════ Main Content Area ═══════════ */}
      <div className="flex flex-1 flex-col overflow-hidden" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        {/* Mobile top bar — in normal flow (shrink-0), not fixed */}
        <header
          className="lg:hidden shrink-0 flex items-center justify-between"
          style={{
            paddingTop: "var(--mobile-header-pt, max(env(safe-area-inset-top), 0px))",
            paddingLeft: "max(env(safe-area-inset-left), 16px)",
            paddingRight: "max(env(safe-area-inset-right), 16px)",
            minHeight: 52,
            background: "var(--bg)",
            touchAction: "none",
          }}
        >
          <span className="text-[15px] font-semibold tracking-tight" style={{ color: "var(--text)" }}>
            {pageTitle}
          </span>
          <div className="flex items-center gap-1.5">
            <SyncIndicator isOnline={isOnline} syncStatus={syncStatus} pendingOps={pendingOps} compact />
            <button
              onClick={toggleDarkMode}
              className="flex h-10 w-10 items-center justify-center rounded-lg transition-colors"
              style={{ color: "var(--text-secondary)" }}
              aria-label={darkMode ? t("app.lightMode" as any) : t("app.darkMode" as any)}
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div className="relative" ref={mobileAvatarRef}>
              <button
                onClick={() => setAvatarMenu(p => !p)}
                className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full text-[11px] font-bold"
                style={{
                  background: operatorAvatar ? "transparent" : "var(--accent)",
                  color: operatorAvatar ? undefined : "#fff",
                }}
                aria-label="Settings"
              >
                {operatorAvatar
                  ? <img src={operatorAvatar} alt={operatorDisplayName} className="h-full w-full object-cover rounded-full" />
                  : operatorInitial}
              </button>
              {avatarMenu && (
                <div className="absolute top-full right-0 mt-2 w-56 rounded-xl overflow-hidden z-50" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)" }}>
                  <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
                    <div className="text-[13px] font-semibold truncate" style={{ color: "var(--text)" }}>{operatorDisplayName}</div>
                    {user?.email && <div className="text-[11px] truncate" style={{ color: "var(--text-secondary)" }}>{user.email}</div>}
                  </div>
                  <button onClick={() => { setAvatarMenu(false); signOut(); }} className="flex items-center gap-2.5 w-full px-4 py-3 text-[13px] transition-colors" style={{ color: "var(--danger)" }}>
                    <LogOut size={14} />
                    {t("auth.logoutBtn" as any)}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ type: "spring", damping: 28, stiffness: 280, mass: 0.8 }}
              className="h-full overflow-y-auto"
              style={{ overscrollBehavior: "contain" }}
            >
              <Content activeTab={activeTab} />
            </motion.div>
          </AnimatePresence>
        </main>

        {/* ═══════════ Mobile Bottom Navigation ═══════════ */}
        {!hideMobileNav && (
          <nav
            className="lg:hidden shrink-0"
            style={{
              paddingBottom: "max(env(safe-area-inset-bottom), 4px)",
              background: "var(--bg)",
              touchAction: "none",
              overscrollBehavior: "none",
              WebkitAppRegion: "no-drag",
            } as React.CSSProperties}
          >
            <div className="flex items-center justify-around px-2 pt-1.5 pb-1">
              {TABS.map(tab => (
                <MobileNavItem
                  key={tab.id}
                  id={tab.id}
                  icon={tab.icon}
                  label={t(tab.labelKey as any)}
                  active={activeTab === tab.id}
                  onClick={handleTabChange}
                />
              ))}
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}

/* ── Sidebar nav item (Linear-style) ──────────────────────────── */
const SidebarItem = React.memo(function SidebarItem({
  id, icon, label, active, expanded, onClick,
}: {
  id: string; icon: React.ReactNode; label: string; active: boolean; expanded: boolean; onClick: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onClick(id)}
      aria-current={active ? "page" : undefined}
      className="relative flex items-center gap-2.5 rounded-lg px-2 py-[7px] text-[13px] font-medium transition-colors"
      style={{
        background: active ? "var(--surface)" : "transparent",
        color: active ? "var(--text)" : "var(--text-secondary)",
        boxShadow: active ? "var(--shadow-xs)" : "none",
      }}
    >
      {/* Left accent bar */}
      {active && (
        <motion.div
          layoutId="sidebar-active"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-4 rounded-full"
          style={{ background: "var(--accent)" }}
          transition={{ type: "spring", damping: 28, stiffness: 320 }}
        />
      )}
      <span className="shrink-0" style={{ color: active ? "var(--accent)" : "var(--text-secondary)" }}>{icon}</span>
      {expanded && <span className="whitespace-nowrap">{label}</span>}
    </button>
  );
});

/* ── Mobile nav item ───────────────────────────────────────────── */
const MobileNavItem = React.memo(function MobileNavItem({
  id, icon, label, active, onClick,
}: {
  id: string; icon: React.ReactNode; label: string; active: boolean; onClick: ((id: string) => void) | (() => void);
}) {
  return (
    <button
      onClick={() => (onClick as (id: string) => void)(id)}
      aria-current={active ? "page" : undefined}
      className="relative flex flex-col items-center justify-center gap-1 rounded-lg px-3 py-2 min-w-[52px] min-h-[44px] transition-colors active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      style={{ color: active ? "var(--accent)" : "var(--text-secondary)" }}
    >
      {/* Active dot indicator */}
      {active && id !== "__more__" && (
        <motion.div
          layoutId="mobile-nav-dot"
          className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
          style={{ background: "var(--accent)" }}
          transition={{ type: "spring", damping: 30, stiffness: 350 }}
        />
      )}
      <span className="relative z-10">{icon}</span>
      <span className="relative z-10 text-[10px] font-medium">{label}</span>
    </button>
  );
});

/* ── Sync status indicator ─────────────────────────────────────── */
const SyncIndicator = React.memo(function SyncIndicator({
  isOnline, syncStatus, pendingOps, compact = false,
}: {
  isOnline: boolean; syncStatus: "idle" | "syncing"; pendingOps: number; compact?: boolean;
}) {
  const { t } = useT();

  if (syncStatus === "syncing") {
    return (
      <div className="flex items-center gap-1.5" title={t("settings.cloudSync.status" as any)}>
        <RefreshCw size={compact ? 13 : 14} className="animate-spin" style={{ color: "var(--accent)" }} />
        {!compact && (
          <span className="text-[11px] font-medium" style={{ color: "var(--accent)" }}>
            {pendingOps > 0 ? `${pendingOps}` : ""}
          </span>
        )}
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div className="flex items-center gap-1.5" title={t("settings.cloudSync.offline" as any)}>
        <CloudOff size={compact ? 13 : 14} style={{ color: "var(--warning, #f59e0b)" }} />
        {!compact && pendingOps > 0 && (
          <span className="text-[11px] font-medium" style={{ color: "var(--warning, #f59e0b)" }}>
            {pendingOps}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center" title={t("settings.cloudSync.connected" as any)}>
      <Cloud size={compact ? 13 : 14} style={{ color: "var(--success, #22c55e)" }} />
    </div>
  );
});

/* ── Sync Toast ────────────────────────────────────────────────── */
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

  const icon = toast.type === "success"
    ? <CheckCircle2 size={14} style={{ color: "var(--success, #22c55e)" }} />
    : toast.type === "warning"
    ? <AlertTriangle size={14} style={{ color: "var(--warning, #f59e0b)" }} />
    : <Info size={14} style={{ color: "var(--accent)" }} />;

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2 px-4 py-3 rounded-xl text-[13px] font-medium shadow-lg"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        color: "var(--text)",
        animation: "fadeInDown 0.25s ease-out",
      }}
    >
      {icon}
      {toast.message}
    </div>
  );
}

function WrappedApp() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <SyncToast />
        <App />
      </AuthProvider>
    </LanguageProvider>
  );
}

export default WrappedApp;
