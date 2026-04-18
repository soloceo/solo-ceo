import React, { Suspense, lazy } from "react";
import {
  Home as HomeIcon,
  ClipboardList,
  Users,
  Wallet,
  Settings as SettingsIcon,
  UserPlus,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { PageErrorBoundary } from "../components/PageErrorBoundary";
import { PageSkeleton } from "../components/ui";
import type { TabId } from "../store/useUIStore";

const HomePage = lazy(() => import("../features/home/HomePage"));
const WorkPage = lazy(() => import("../features/work/WorkPage"));
const LeadsPage = lazy(() => import("../features/clients/LeadsPage"));
const ClientListPage = lazy(() => import("../features/clients/ClientListPage"));
const FinancePage = lazy(() => import("../features/finance/FinancePage"));
const SettingsPage = lazy(() => import("../features/settings/SettingsPage"));

export interface TabDef {
  id: TabId;
  labelKey: string;
  icon: React.ReactNode;
  component: React.LazyExoticComponent<React.ComponentType>;
  shortcut?: string;
  badgeKey?: string;
}

export const MAIN_TABS: TabDef[] = [
  { id: "home", labelKey: "nav.home", icon: <HomeIcon size={16} aria-hidden="true" />, component: HomePage, shortcut: "1" },
  { id: "leads",   labelKey: "nav.leads",   icon: <UserPlus size={16} aria-hidden="true" />,  component: LeadsPage,      shortcut: "2" },
  { id: "work", labelKey: "nav.work", icon: <ClipboardList size={16} aria-hidden="true" />, component: WorkPage, shortcut: "3" },
  { id: "clients", labelKey: "nav.clients", icon: <Users size={16} aria-hidden="true" />,     component: ClientListPage, shortcut: "4" },
  { id: "finance", labelKey: "nav.finance", icon: <Wallet size={16} aria-hidden="true" />,    component: FinancePage,    shortcut: "5", badgeKey: "monthIncome" },
];

export const SETTINGS_TAB: TabDef = {
  id: "settings", labelKey: "nav.settings", icon: <SettingsIcon size={16} aria-hidden="true" />, component: SettingsPage,
};

export const ALL_TABS = [...MAIN_TABS, SETTINGS_TAB];
export const TAB_MAP = Object.fromEntries(ALL_TABS.map((t) => [t.id, t]));

export type NavBadges = {
  tasks: number;
  todoCount: number;
  inProgressCount: number;
  leads: number;
  leadsNew: number;
  leadsContacted: number;
  leadsProposal: number;
  monthIncome: number;
};

export const Content = React.memo(({ activeTab }: { activeTab: string }) => {
  const Page = TAB_MAP[activeTab]?.component ?? HomePage;
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ type: "spring", stiffness: 380, damping: 32, mass: 0.6 }}
        style={{ width: "100%", height: "100%" }}
      >
        <PageErrorBoundary key={activeTab} pageName={activeTab}>
          <Suspense fallback={<PageSkeleton />}>
            <Page />
          </Suspense>
        </PageErrorBoundary>
      </motion.div>
    </AnimatePresence>
  );
});
