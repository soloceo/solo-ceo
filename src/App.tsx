import React, { useState, Suspense, lazy, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Home as HomeIcon,
  ClipboardList,
  UserSearch,
  Users,
  Receipt,
  Layers,
  Sparkles,
  MoreHorizontal,
  Loader2,
  Moon,
  Sun,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { LanguageProvider, useT } from "./i18n/context";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import LoginPage from "./auth/LoginPage";
import { startRealtime, stopRealtime } from "./db/realtime";

/* ── Lazy page imports ─────────────────────────────────────────── */
const HomePage          = lazy(() => import("./components/Home"));
const WorkPage          = lazy(() => import("./components/Work"));
const LeadsPage         = lazy(() => import("./components/Leads"));
const ClientsPage       = lazy(() => import("./components/Clients"));
const TransactionsPage  = lazy(() => import("./components/Transactions"));
const PlansPage         = lazy(() => import("./components/Plans"));
const CreatePage        = lazy(() => import("./components/Create"));
const SettingsPage      = lazy(() => import("./components/Settings"));

/* ── Tab definitions ───────────────────────────────────────────── */
type TabId = "home" | "work" | "leads" | "clients" | "transactions" | "plans" | "create";

interface TabDef {
  id: TabId;
  labelKey: string;
  icon: React.ReactNode;
  component: React.LazyExoticComponent<React.ComponentType>;
}

const TABS: TabDef[] = [
  { id: "home",         labelKey: "nav.home",         icon: <HomeIcon size={18} />,      component: HomePage },
  { id: "work",         labelKey: "nav.work",         icon: <ClipboardList size={18} />,  component: WorkPage },
  { id: "leads",        labelKey: "nav.leads",        icon: <UserSearch size={18} />,     component: LeadsPage },
  { id: "clients",      labelKey: "nav.clients",      icon: <Users size={18} />,          component: ClientsPage },
  { id: "transactions", labelKey: "nav.transactions", icon: <Receipt size={18} />,        component: TransactionsPage },
  { id: "plans",        labelKey: "nav.plans",        icon: <Layers size={18} />,         component: PlansPage },
  { id: "create",       labelKey: "nav.create",       icon: <Sparkles size={18} />,       component: CreatePage },
];

/* Primary tabs shown in bottom nav; rest go into "More" menu */
const PRIMARY_TABS = TABS.slice(0, 4);   // home, work, leads, clients
const MORE_TABS    = TABS.slice(4);       // transactions, plans, create
const MORE_TAB_IDS = new Set(MORE_TABS.map(t => t.id));

const TAB_MAP = Object.fromEntries(TABS.map(t => [t.id, t]));

const LOADING = (
  <div className="flex h-full items-center justify-center">
    <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--text-tertiary)" }} />
  </div>
);

/* ── Content renderer ──────────────────────────────────────────── */
const Content = React.memo(({ activeTab }: { activeTab: string }) => {
  const Page = activeTab === "settings"
    ? SettingsPage
    : (TAB_MAP[activeTab]?.component ?? HomePage);
  return (
    <Suspense fallback={LOADING}>
      <Page />
    </Suspense>
  );
});

/* ── App ───────────────────────────────────────────────────────── */
function App() {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("home");
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [hideMobileNav, setHideMobileNav] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  // Start / stop realtime based on auth state
  React.useEffect(() => {
    if (user) {
      startRealtime();
    } else {
      stopRealtime();
    }
    return () => stopRealtime();
  }, [user]);

  // Operator profile
  const [operatorName, setOperatorName] = useState(() => localStorage.getItem("OPERATOR_NAME") || "Andy");
  const [operatorAvatar, setOperatorAvatar] = useState(() => localStorage.getItem("OPERATOR_AVATAR") || "");
  const operatorDisplayName = operatorName.trim() || "Andy";
  const operatorInitial = operatorDisplayName.charAt(0).toUpperCase();

  // Dark mode
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("DARK_MODE") === "true");

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("DARK_MODE", String(darkMode));
  }, [darkMode]);

  const toggleDarkMode = React.useCallback(() => setDarkMode(p => !p), []);

  const handleTabChange = React.useCallback((tab: string) => {
    setActiveTab(tab);
    setMoreOpen(false);
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
  const isSettings = activeTab === "settings";
  const currentTab = TAB_MAP[activeTab];
  const pageTitle = isSettings ? t("nav.settings" as any) : (currentTab ? t(currentTab.labelKey as any) : t("nav.home" as any));

  // Auth gate: show loading or login page
  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: "var(--bg)" }}>
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  if (!user) {
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
        {/* macOS traffic-light spacer */}
        <div className="h-11 shrink-0" style={{ WebkitAppRegion: "drag" } as React.CSSProperties} />

        {/* Sidebar toggle */}
        <button
          onClick={() => setSidebarExpanded(p => !p)}
          className="mx-auto mb-3 flex h-7 w-7 items-center justify-center rounded-md opacity-0 hover:opacity-100 transition-opacity"
          style={{ color: "var(--text-tertiary)" }}
          aria-label={sidebarExpanded ? t("app.collapseSidebar" as any) : t("app.expandSidebar" as any)}
        >
          {sidebarExpanded ? <PanelLeftClose size={15} /> : <PanelLeft size={15} />}
        </button>

        {/* Nav items */}
        <nav className="flex-1 flex flex-col gap-0.5 px-2">
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

        {/* Bottom area: settings avatar */}
        <div className="mt-auto flex flex-col gap-1 px-2 pb-3">
          <button
            onClick={() => handleTabChange("settings")}
            className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors"
            style={{
              background: isSettings ? "var(--surface-alt)" : "transparent",
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
            <button
              onClick={toggleDarkMode}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
              style={{ color: "var(--text-secondary)" }}
              aria-label={darkMode ? t("app.lightMode" as any) : t("app.darkMode" as any)}
            >
              {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              onClick={() => handleTabChange("settings")}
              className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full text-[10px] font-bold"
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
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15, ease: [0.25, 1, 0.5, 1] }}
              className="h-full overflow-y-auto"
              style={{ overscrollBehavior: "contain" }}
            >
              <Content activeTab={activeTab} />
            </motion.div>
          </AnimatePresence>
        </main>

        {/* ═══════════ Mobile Bottom Navigation — in normal flow ═══════════ */}
        {!hideMobileNav && (
          <nav
            className="lg:hidden shrink-0 relative"
            style={{
              paddingBottom: "max(env(safe-area-inset-bottom), 4px)",
              background: "var(--bg)",
              touchAction: "none",
              overscrollBehavior: "none",
              WebkitAppRegion: "no-drag",
            } as React.CSSProperties}
          >
            {/* "More" popover menu */}
            <AnimatePresence>
              {moreOpen && (
                <>
                  <motion.div
                    className="fixed inset-0 z-40"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    onClick={() => setMoreOpen(false)}
                  />
                  <motion.div
                    className="absolute right-3 bottom-full mb-2 z-50 rounded-xl py-1.5 min-w-[160px]"
                    style={{
                      background: "var(--surface)",
                      boxShadow: "0 8px 30px rgba(0,0,0,.12), 0 2px 8px rgba(0,0,0,.08)",
                      border: "1px solid var(--border)",
                    }}
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.15, ease: [0.25, 1, 0.5, 1] }}
                  >
                    {MORE_TABS.map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => handleTabChange(tab.id)}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-[14px] font-medium transition-colors"
                        style={{
                          color: activeTab === tab.id ? "var(--accent)" : "var(--text)",
                          background: activeTab === tab.id ? "var(--surface-alt)" : "transparent",
                        }}
                      >
                        <span style={{ color: activeTab === tab.id ? "var(--accent)" : "var(--text-tertiary)" }}>
                          {tab.icon}
                        </span>
                        {t(tab.labelKey as any)}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            <div className="flex items-center justify-around px-2 pt-1.5 pb-1">
              {PRIMARY_TABS.map(tab => (
                <MobileNavItem
                  key={tab.id}
                  id={tab.id}
                  icon={tab.icon}
                  label={t(tab.labelKey as any)}
                  active={activeTab === tab.id}
                  onClick={handleTabChange}
                />
              ))}
              {/* "More" button */}
              <MobileNavItem
                id="__more__"
                icon={<MoreHorizontal size={18} />}
                label={t("nav.more" as any)}
                active={moreOpen || MORE_TAB_IDS.has(activeTab as TabId)}
                onClick={() => setMoreOpen(p => !p)}
              />
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
      <span className="shrink-0" style={{ color: active ? "var(--accent)" : "var(--text-tertiary)" }}>{icon}</span>
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
      className="relative flex flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-1.5 min-w-[52px] transition-colors active:scale-90"
      style={{ color: active ? "var(--accent)" : "var(--text-tertiary)" }}
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

function WrappedApp() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </LanguageProvider>
  );
}

export default WrappedApp;
