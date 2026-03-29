import React, { useEffect, useState } from "react";
import { Command } from "cmdk";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Home,
  ClipboardList,
  Users,
  Wallet,
  Settings,
  Search,
  Moon,
  Sun,
  Monitor,
  ListTodo,
  UserPlus,
  FileText,
  Briefcase,
  Target,
  DollarSign,
  UserSearch,
} from "lucide-react";
import { useUIStore } from "../store/useUIStore";
import { useT } from "../i18n/context";

const NAV_ITEMS = [
  { id: "home" as const, icon: Home, labelKey: "nav.home" },
  { id: "work" as const, icon: ClipboardList, labelKey: "nav.work" },
  { id: "leads" as const, icon: UserPlus, labelKey: "nav.leads" },
  { id: "clients" as const, icon: Users, labelKey: "nav.clients" },
  { id: "finance" as const, icon: Wallet, labelKey: "nav.finance" },
] as const;

type SearchResult = { type: "task" | "client" | "lead" | "finance"; id: number; title: string; sub?: string };

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen, setActiveTab, themeMode, setThemeMode } = useUIStore();
  const { t } = useT();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);

  // Global keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  // Search tasks + clients when query changes
  useEffect(() => {
    if (!commandPaletteOpen) { setQuery(""); setResults([]); return; }
    if (query.length < 2) { setResults([]); return; }

    const controller = new AbortController();
    const search = async () => {
      try {
        const [tasksRes, clientsRes, leadsRes, financeRes] = await Promise.all([
          fetch("/api/tasks", { signal: controller.signal }),
          fetch("/api/clients", { signal: controller.signal }),
          fetch("/api/leads", { signal: controller.signal }),
          fetch("/api/finance", { signal: controller.signal }),
        ]);
        const [tasks, clients, leads, finance] = await Promise.all([tasksRes.json(), clientsRes.json(), leadsRes.json(), financeRes.json()]);
        const q = query.toLowerCase();
        const matched: SearchResult[] = [];

        for (const task of (Array.isArray(tasks) ? tasks : [])) {
          if (task.title?.toLowerCase().includes(q) || task.client?.toLowerCase().includes(q)) {
            matched.push({ type: "task", id: task.id, title: task.title, sub: task.client });
          }
        }
        for (const client of (Array.isArray(clients) ? clients : [])) {
          const name = client.company_name || client.name || "";
          if (name.toLowerCase().includes(q) && !client.soft_deleted) {
            matched.push({ type: "client", id: client.id, title: name, sub: client.contact_name });
          }
        }
        for (const lead of (Array.isArray(leads) ? leads : [])) {
          if (lead.name?.toLowerCase().includes(q) || lead.industry?.toLowerCase().includes(q) || lead.needs?.toLowerCase().includes(q)) {
            matched.push({ type: "lead", id: lead.id, title: lead.name, sub: lead.industry });
          }
        }
        for (const tx of (Array.isArray(finance) ? finance : [])) {
          const desc = tx.description || tx.desc || tx.client_name || "";
          if (desc.toLowerCase().includes(q) || tx.category?.toLowerCase().includes(q)) {
            matched.push({ type: "finance", id: tx.id, title: desc || tx.category, sub: tx.category });
          }
        }
        setResults(matched.slice(0, 10));
      } catch { /* abort or network error */ }
    };

    const debounce = setTimeout(search, 200);
    return () => { clearTimeout(debounce); controller.abort(); };
  }, [query, commandPaletteOpen]);

  const go = (tab: string) => { setActiveTab(tab as any); setCommandPaletteOpen(false); };
  const quickCreate = (type: string) => {
    const tabMap: Record<string, string> = { task: "work", lead: "leads", transaction: "finance" };
    setActiveTab((tabMap[type] || "home") as any);
    setCommandPaletteOpen(false);
    setTimeout(() => window.dispatchEvent(new CustomEvent("quick-create", { detail: { type } })), 100);
  };

  const itemClass = "flex items-center gap-3 px-3 py-2 rounded-[var(--radius-6)] text-[15px] cursor-pointer transition-colors data-[selected=true]:bg-[var(--color-bg-tertiary)]";

  return createPortal(
    <AnimatePresence>
      {commandPaletteOpen && (
        <motion.div
          className="fixed inset-0 flex items-start justify-center pt-[20vh]"
          style={{ zIndex: "var(--layer-command-menu)" } as React.CSSProperties}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
        >
          <div
            className="absolute inset-0"
            style={{ background: "var(--color-overlay-primary)" }}
            onClick={() => setCommandPaletteOpen(false)}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            className="relative w-full max-w-[520px] mx-4 overflow-hidden"
            style={{
              background: "var(--color-bg-primary)",
              border: "1px solid var(--color-border-primary)",
              borderRadius: "var(--radius-12)",
              boxShadow: "var(--shadow-high)",
            }}
          >
            <Command
              loop
              onKeyDown={(e) => { if (e.key === "Escape") setCommandPaletteOpen(false); }}
            >
              {/* Search input */}
              <div
                className="flex items-center gap-2 px-4 h-12"
                style={{ borderBottom: "1px solid var(--color-line-secondary)" }}
              >
                <Search size={16} style={{ color: "var(--color-text-tertiary)" }} />
                <Command.Input
                  placeholder={t("app.searchPlaceholder" as any) || "Search or jump to..."}
                  className="flex-1 bg-transparent text-[16px] outline-none placeholder:text-[var(--color-text-quaternary)]"
                  style={{ color: "var(--color-text-primary)" }}
                  value={query}
                  onValueChange={setQuery}
                  autoFocus
                />
                <kbd
                  className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] rounded-[var(--radius-4)]"
                  style={{
                    background: "var(--color-bg-tertiary)",
                    color: "var(--color-text-tertiary)",
                    border: "1px solid var(--color-border-secondary)",
                    fontWeight: "var(--font-weight-medium)",
                  } as React.CSSProperties}
                >
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <Command.List className="max-h-[360px] overflow-y-auto p-2">
                <Command.Empty className="py-6 text-center text-[15px]" style={{ color: "var(--color-text-tertiary)" }}>
                  {t("app.noResults" as any) || "No results found."}
                </Command.Empty>

                {/* Search results */}
                {results.length > 0 && (
                  <Command.Group heading={<span className="section-label px-2 py-1">{t("app.searchResults" as any) || "Results"}</span>}>
                    {results.map((r) => (
                      <Command.Item
                        key={`${r.type}-${r.id}`}
                        value={`${r.type} ${r.title} ${r.sub || ""}`}
                        onSelect={() => {
                          const tabMap: Record<string, string> = { task: "work", client: "clients", lead: "leads", finance: "finance" };
                          go(tabMap[r.type] || "home");
                        }}
                        className={itemClass}
                        style={{ color: "var(--color-text-primary)" }}
                      >
                        {r.type === "task" ? <Target size={16} style={{ color: "var(--color-text-tertiary)" }} />
                          : r.type === "lead" ? <UserSearch size={16} style={{ color: "var(--color-text-tertiary)" }} />
                          : r.type === "finance" ? <DollarSign size={16} style={{ color: "var(--color-text-tertiary)" }} />
                          : <Briefcase size={16} style={{ color: "var(--color-text-tertiary)" }} />}
                        <div className="flex-1 min-w-0">
                          <span className="truncate block">{r.title}</span>
                          {r.sub && <span className="text-[13px] truncate block" style={{ color: "var(--color-text-quaternary)" }}>{r.sub}</span>}
                        </div>
                        <span className="text-[10px] shrink-0 px-1.5 py-0.5 rounded-[var(--radius-4)]" style={{ background: "var(--color-bg-tertiary)", color: "var(--color-text-quaternary)" }}>
                          {r.type === "task" ? t("nav.work" as any) : r.type === "lead" ? t("nav.leads" as any) : r.type === "finance" ? t("nav.finance" as any) : t("nav.clients" as any)}
                        </span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {/* Quick create */}
                <Command.Group heading={<span className="section-label px-2 py-1">{t("app.quickCreate" as any) || "Quick Create"}</span>}>
                  <Command.Item value="new task create" onSelect={() => quickCreate("task")} className={itemClass} style={{ color: "var(--color-text-primary)" }}>
                    <ListTodo size={16} style={{ color: "var(--color-text-tertiary)" }} />
                    {t("app.quickCreate.task" as any) || "New Task"}
                  </Command.Item>
                  <Command.Item value="add lead prospect" onSelect={() => quickCreate("lead")} className={itemClass} style={{ color: "var(--color-text-primary)" }}>
                    <UserPlus size={16} style={{ color: "var(--color-text-tertiary)" }} />
                    {t("app.quickCreate.lead" as any) || "New Lead"}
                  </Command.Item>
                  <Command.Item value="record transaction income" onSelect={() => quickCreate("transaction")} className={itemClass} style={{ color: "var(--color-text-primary)" }}>
                    <FileText size={16} style={{ color: "var(--color-text-tertiary)" }} />
                    {t("app.quickCreate.transaction" as any) || "New Transaction"}
                  </Command.Item>
                </Command.Group>

                {/* Navigation */}
                <Command.Group heading={<span className="section-label px-2 py-1">{t("app.navigation" as any) || "Navigation"}</span>}>
                  {NAV_ITEMS.map((item) => (
                    <Command.Item key={item.id} value={`go to ${item.id}`} onSelect={() => go(item.id)} className={itemClass} style={{ color: "var(--color-text-primary)" }}>
                      <item.icon size={16} style={{ color: "var(--color-text-tertiary)" }} />
                      {t(item.labelKey as any)}
                    </Command.Item>
                  ))}
                  <Command.Item value="go to settings" onSelect={() => go("settings")} className={itemClass} style={{ color: "var(--color-text-primary)" }}>
                    <Settings size={16} style={{ color: "var(--color-text-tertiary)" }} />
                    {t("nav.settings" as any)}
                  </Command.Item>
                </Command.Group>

                {/* Actions */}
                <Command.Group heading={<span className="section-label px-2 py-1">{t("settings.colorMode" as any) || "Color Mode"}</span>}>
                  {([
                    { value: "light" as const, icon: Sun, labelKey: "settings.themeLight", fallback: "Light" },
                    { value: "dark" as const, icon: Moon, labelKey: "settings.themeDark", fallback: "Dark" },
                    { value: "auto" as const, icon: Monitor, labelKey: "settings.themeAuto", fallback: "Auto" },
                  ] as const).map(({ value, icon: Icon, labelKey, fallback }) => (
                    <Command.Item
                      key={value}
                      value={`theme ${value} mode`}
                      onSelect={() => { setThemeMode(value); setCommandPaletteOpen(false); }}
                      className={itemClass}
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      <Icon size={16} style={{ color: themeMode === value ? "var(--color-accent)" : "var(--color-text-tertiary)" }} />
                      <span>{t(labelKey as any) || fallback}</span>
                      {themeMode === value && <span className="ml-auto text-[12px]" style={{ color: "var(--color-accent)" }}>✓</span>}
                    </Command.Item>
                  ))}
                </Command.Group>
              </Command.List>

              {/* Footer */}
              <div
                className="flex items-center gap-3 px-4 py-2 text-[13px]"
                style={{ borderTop: "1px solid var(--color-line-secondary)", color: "var(--color-text-quaternary)" }}
              >
                <span className="flex items-center gap-1"><kbd className="inline-flex items-center px-1.5 py-0.5 text-[11px] rounded-[var(--radius-4)]" style={{ fontWeight: "var(--font-weight-medium)", background: "var(--color-bg-tertiary)", border: "1px solid var(--color-border-secondary)" } as React.CSSProperties}>↑↓</kbd> {t("app.cmdFooter.navigate" as any) || "navigate"}</span>
                <span className="flex items-center gap-1"><kbd className="inline-flex items-center px-1.5 py-0.5 text-[11px] rounded-[var(--radius-4)]" style={{ fontWeight: "var(--font-weight-medium)", background: "var(--color-bg-tertiary)", border: "1px solid var(--color-border-secondary)" } as React.CSSProperties}>↵</kbd> {t("app.cmdFooter.select" as any) || "select"}</span>
                <span className="flex items-center gap-1"><kbd className="inline-flex items-center px-1.5 py-0.5 text-[11px] rounded-[var(--radius-4)]" style={{ fontWeight: "var(--font-weight-medium)", background: "var(--color-bg-tertiary)", border: "1px solid var(--color-border-secondary)" } as React.CSSProperties}>esc</kbd> {t("app.cmdFooter.close" as any) || "close"}</span>
              </div>
            </Command>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
