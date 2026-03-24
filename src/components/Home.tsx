import React, { useEffect, useMemo, useState, useCallback, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import {
  TrendingUp, Users, Briefcase, CheckSquare,
  CircleDollarSign, FolderCog,
  Check, Undo2, Plus, Pencil, Trash2, X, ChevronDown, ChevronRight,
  ArrowUpRight, ArrowDownRight,
  UserPlus, ClipboardList, Wallet,
} from "lucide-react";
import { useT } from "../i18n/context";
import { useRealtimeRefresh } from "../hooks/useRealtimeRefresh";

const DailyProtocol = lazy(() => import("./DailyProtocol"));
const BreakthroughProgress = lazy(() => import("./BreakthroughProgress"));
const TodayPrinciple = lazy(() => import("./TodayPrinciple"));

/* ── Types ──────────────────────────────────────────────────────── */
type FocusItem = {
  key: string;
  type: string;
  title: string;
  reason: string;
  actionHint: string;
  status?: "pending" | "completed";
  isManual?: boolean;
};

type MrrPoint = { name: string; mrr: number };

type DashboardData = {
  todayFocus: FocusItem[];
  manualTodayEvents: FocusItem[];
  clientsCount: number;
  mrr: number;
  activeTasks: number;
  leadsCount: number;
  mrrSeries?: MrrPoint[];
  prevClientsCount?: number;
  prevLeadsCount?: number;
  prevActiveTasks?: number;
};

type ManualForm = { type: string; title: string; note: string };

/* ── Helpers ────────────────────────────────────────────────────── */
function greeting(t: (k: any, v?: any) => string) {
  const h = new Date().getHours();
  if (h < 6) return t("home.greeting.late" as any);
  if (h < 12) return t("home.greeting.morning" as any);
  if (h < 14) return t("home.greeting.noon" as any);
  if (h < 18) return t("home.greeting.afternoon" as any);
  return t("home.greeting.evening" as any);
}

function todayStr(lang: string) {
  return new Date().toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", {
    year: "numeric", month: "long", day: "numeric", weekday: "long",
  });
}

const manualIdFromKey = (k: string) => k.replace("manual-", "");

function pctChange(curr: number, prev: number): number | null {
  if (prev === 0 && curr === 0) return null;
  if (prev === 0) return curr > 0 ? 100 : null;
  return Math.round(((curr - prev) / prev) * 100);
}

/* ── Component ──────────────────────────────────────────────────── */
export default function Home() {
  const { t, lang } = useT();
  const emptyForm: ManualForm = { type: t("home.form.type.system" as any), title: "", note: "" };

  const [data, setData] = useState<DashboardData>({
    todayFocus: [], manualTodayEvents: [],
    clientsCount: 0, mrr: 0, activeTasks: 0, leadsCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<ManualForm>(emptyForm);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showManual, setShowManual] = useState(false);

  const skipKey = `today-focus-skipped-${new Date().toISOString().split("T")[0]}`;
  const operatorName = localStorage.getItem("OPERATOR_NAME") || "";

  const fetchData = async () => {
    try {
      const res = await fetch("/api/dashboard");
      setData(await res.json());
    } catch (e) {
      console.error("Failed to fetch dashboard:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    try {
      const s = localStorage.getItem(skipKey);
      if (s) setSkipped(JSON.parse(s));
    } catch {}
  }, []);

  useRealtimeRefresh(['leads', 'clients', 'tasks', 'finance_transactions', 'today_focus_state', 'today_focus_manual', 'payment_milestones'], fetchData);

  useEffect(() => {
    try { localStorage.setItem(skipKey, JSON.stringify(skipped)); } catch {}
  }, [skipped]);

  const goToTab = useCallback((tab: string) => {
    window.dispatchEvent(new CustomEvent("navigate-tab", { detail: { tab } }));
  }, []);

  /* ── Focus actions ── */
  const updateStatus = async (key: string, status: "pending" | "completed") => {
    setSavingKey(key);
    try {
      await fetch("/api/today-focus/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ focusKey: key, status }),
      });
      setData(prev => ({
        ...prev,
        todayFocus: prev.todayFocus.map(i => i.key === key ? { ...i, status } : i),
        manualTodayEvents: prev.manualTodayEvents.map(i => i.key === key ? { ...i, status } : i),
      }));
      if (status === "pending") setSkipped(p => p.filter(k => k !== key));
    } catch (e) { console.error(e); }
    finally { setSavingKey(null); }
  };

  /* ── Manual event CRUD ── */
  const resetForm = () => { setForm(emptyForm); setEditKey(null); setShowForm(false); };

  const saveManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSubmitting(true);
    try {
      const isEdit = Boolean(editKey);
      await fetch(
        isEdit ? `/api/today-focus/manual/${manualIdFromKey(editKey!)}` : "/api/today-focus/manual",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: form.type, title: form.title.trim(), note: form.note.trim() }),
        },
      );
      resetForm();
      await fetchData();
    } catch (e) { console.error(e); }
    finally { setSubmitting(false); }
  };

  const startEdit = (item: FocusItem) => {
    setEditKey(item.key);
    setForm({
      type: item.type || t("home.form.type.system" as any),
      title: item.title || "",
      note: item.reason === t("home.events.manualDefault" as any) ? "" : (item.reason || ""),
    });
    setShowForm(true);
  };

  const deleteManual = async (item: FocusItem) => {
    setDeletingKey(item.key);
    try {
      await fetch(`/api/today-focus/manual/${manualIdFromKey(item.key)}`, { method: "DELETE" });
      await fetchData();
    } catch (e) { console.error(e); }
    finally { setDeletingKey(null); }
  };

  /* ── Derived ── */
  const pending = useMemo(
    () => data.todayFocus.filter(i => i.status !== "completed" && !skipped.includes(i.key)),
    [data.todayFocus, skipped],
  );
  const completed = useMemo(() => data.todayFocus.filter(i => i.status === "completed"), [data.todayFocus]);
  const pendingManual = useMemo(() => data.manualTodayEvents.filter(i => i.status !== "completed"), [data.manualTodayEvents]);
  const completedManual = useMemo(() => data.manualTodayEvents.filter(i => i.status === "completed"), [data.manualTodayEvents]);
  const total = data.todayFocus.length;
  const doneCount = completed.length;
  const manualCount = pendingManual.length + completedManual.length;
  const progressPct = total ? Math.round((doneCount / total) * 100) : 0;

  /* ── Render ───────────────────────────────────────────────────── */
  return (
    <div className="mobile-page page-wrap">
      <div className="space-y-6">
        {/* ── Greeting row ── */}
        <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold" style={{ color: "var(--text)" }}>
              {greeting(t)}{operatorName.trim() ? `，${operatorName.trim()}` : ""}
            </h1>
            <div className="flex items-center gap-2.5 mt-0.5">
              <span className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>{todayStr(lang)}</span>
              <div className="flex items-center gap-1.5">
                <div className="w-16 h-1 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progressPct}%`, background: "var(--accent)" }} />
                </div>
                <span className="text-[11px] tabular-nums font-medium" style={{ color: "var(--text-tertiary)" }}>{doneCount}/{total}</span>
              </div>
            </div>
          </div>
        </header>

        {/* ── Quick actions (permanent) ── */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => goToTab("clients")} className="btn-primary text-[12px]">
            <UserPlus size={13} /> {t("home.welcome.addLead" as any)}
          </button>
          <button onClick={() => goToTab("work")} className="btn-secondary text-[12px]">
            <ClipboardList size={13} /> {t("home.welcome.addTask" as any)}
          </button>
          <button onClick={() => goToTab("finance")} className="btn-secondary text-[12px]">
            <Wallet size={13} /> {t("home.welcome.addIncome" as any)}
          </button>
          <button onClick={() => { setEditKey(null); setForm(emptyForm); setShowForm(p => !p); }} className="btn-secondary text-[12px]">
            <Plus size={13} /> {t("home.quickMemo" as any)}
          </button>
        </div>

        {/* ── KPI Stats ── */}
        {(() => {
          const s = data.mrrSeries;
          const mrrTrend = s && s.length >= 2 ? pctChange(s[s.length - 1].mrr, s[s.length - 2].mrr) : null;
          const clientsTrend = data.prevClientsCount != null ? pctChange(data.clientsCount, data.prevClientsCount) : null;
          const leadsTrend = data.prevLeadsCount != null ? pctChange(data.leadsCount, data.prevLeadsCount) : null;
          const tasksTrend = data.prevActiveTasks != null ? pctChange(data.activeTasks, data.prevActiveTasks) : null;
          return (
            <section className="grid grid-cols-2 gap-3">
              <StatCard label={t("home.kpi.mrr" as any)} value={loading ? "—" : `$${Number(data.mrr || 0).toLocaleString()}`} icon={<TrendingUp size={14} />} color="var(--success)" trend={mrrTrend} />
              <StatCard label={t("home.kpi.activeClients" as any)} value={loading ? "—" : String(data.clientsCount || 0)} icon={<Users size={14} />} color="var(--accent)" trend={clientsTrend} />
              <StatCard label={t("home.kpi.leads" as any)} value={loading ? "—" : String(data.leadsCount || 0)} icon={<Briefcase size={14} />} color="var(--warning)" trend={leadsTrend} />
              <StatCard label={t("home.kpi.inProgress" as any)} value={loading ? "—" : String(data.activeTasks || 0)} icon={<CheckSquare size={14} />} color="var(--accent)" trend={tasksTrend} />
            </section>
          );
        })()}

        {/* ── Daily Protocol + Breakthrough Progress ── */}
        <div className="grid gap-5 md:grid-cols-2">
          <Suspense fallback={null}><DailyProtocol /></Suspense>
          <Suspense fallback={null}><BreakthroughProgress /></Suspense>
        </div>

        {/* ── Today's Principle ── */}
        <Suspense fallback={null}><TodayPrinciple /></Suspense>

        {/* ── Memo modal (portal) ── */}
        {showForm && createPortal(
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={resetForm}>
            <div className="absolute inset-0 bg-black/30" />
            <div
              className="relative card p-5 w-[90vw] max-w-md space-y-3 celebrate-bounce"
              style={{ boxShadow: "var(--shadow-lg)" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-semibold" style={{ color: "var(--text)" }}>
                  {editKey ? t("home.form.editEvent" as any) : t("home.quickMemo" as any)}
                </h3>
                <button onClick={resetForm} className="btn-ghost p-1"><X size={14} /></button>
              </div>
              <form onSubmit={saveManual} className="space-y-3">
                <label className="flex flex-col gap-1">
                  <span className="section-label">{t("home.form.type" as any)}</span>
                  <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} className="input-base px-3 py-2 text-[13px]">
                    <option value={t("home.form.type.revenue" as any)}>{t("home.form.type.revenue" as any)}</option>
                    <option value={t("home.form.type.delivery" as any)}>{t("home.form.type.delivery" as any)}</option>
                    <option value={t("home.form.type.system" as any)}>{t("home.form.type.system" as any)}</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="section-label">{t("home.form.title" as any)}</span>
                  <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder={t("home.form.titlePlaceholder" as any)} className="input-base px-3 py-2 text-[13px]" autoFocus />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="section-label">{t("home.form.note" as any)}</span>
                  <input value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} placeholder={t("home.form.notePlaceholder" as any)} className="input-base px-3 py-2 text-[13px]" />
                </label>
                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={resetForm} className="btn-secondary text-[13px]" style={{ padding: "6px 14px" }}>{t("common.cancel" as any)}</button>
                  <button type="submit" disabled={submitting || !form.title.trim()} className="btn-primary text-[13px] disabled:opacity-50" style={{ padding: "6px 14px" }}>
                    {editKey ? t("home.form.saveEdit" as any) : t("common.save" as any)}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}

        {/* ── Focus cards ── */}
        <section>
          <h3 className="section-label mb-3">{t("home.focus.title" as any)}</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {pending.map(item => (
              <FocusCard
                key={item.key}
                item={item}
                saving={savingKey === item.key}
                onComplete={() => updateStatus(item.key, "completed")}
                onSkip={() => setSkipped(p => [...new Set([...p, item.key])])}
              />
            ))}
            {!loading && !pending.length && (
              <div className="col-span-full card py-8 text-center celebrate-bounce" style={{ background: "var(--success-light)" }}>
                <div className="text-[20px] mb-1">&#10024;</div>
                <div className="text-[13px] font-semibold" style={{ color: "var(--success)" }}>
                  {t("home.focus.allDoneEmoji" as any)}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── Completed accordion ── */}
        <Accordion
          label={t("home.completed.title" as any, { count: completed.length })}
          open={showCompleted}
          toggle={() => setShowCompleted(p => !p)}
        >
          {!completed.length && <EmptyHint text={t("home.completed.empty" as any)} />}
          <div className="card overflow-hidden">
            {completed.map((item, i) => (
              <CompletedRow key={item.key} item={item} saving={savingKey === item.key} onUndo={() => updateStatus(item.key, "pending")} last={i === completed.length - 1} />
            ))}
          </div>
        </Accordion>

        {/* ── Manual events accordion ── */}
        <Accordion
          label={t("home.events.title" as any, { count: manualCount })}
          open={showManual}
          toggle={() => setShowManual(p => !p)}
        >
          {!manualCount && <EmptyHint text={t("home.events.empty" as any)} />}
          {(manualCount > 0) && (
            <div className="card overflow-hidden">
              {pendingManual.map((item, i) => (
                <ManualRow
                  key={item.key} item={item}
                  saving={savingKey === item.key} deleting={deletingKey === item.key}
                  onComplete={() => updateStatus(item.key, "completed")}
                  onEdit={() => startEdit(item)} onDelete={() => deleteManual(item)}
                  last={i === pendingManual.length - 1 && !completedManual.length}
                />
              ))}
              {completedManual.map((item, i) => (
                <ManualRow
                  key={item.key} item={item} done
                  saving={savingKey === item.key} deleting={deletingKey === item.key}
                  onComplete={() => updateStatus(item.key, "pending")}
                  onDelete={() => deleteManual(item)}
                  last={i === completedManual.length - 1}
                />
              ))}
            </div>
          )}
        </Accordion>
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────── */

function StatCard({ label, value, icon, color, trend }: { label: string; value: string; icon: React.ReactNode; color: string; trend?: number | null }) {
  return (
    <div className="stat-card">
      <div className="flex items-center gap-2 mb-1">
        <div className="flex h-6 w-6 items-center justify-center rounded-md" style={{ background: `color-mix(in srgb, ${color} 12%, transparent)` }}>
          <span style={{ color }}>{icon}</span>
        </div>
        <span className="text-[11px] font-medium" style={{ color: "var(--text-tertiary)" }}>{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-xl font-semibold tracking-tight tabular-nums" style={{ color: "var(--text)" }}>{value}</span>
        {trend != null && trend !== 0 && (
          <span className="flex items-center gap-0.5 text-[10px] font-medium" style={{ color: trend > 0 ? "var(--success)" : "var(--danger)" }}>
            {trend > 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
    </div>
  );
}

function FocusCard({ item, saving, onComplete, onSkip }: {
  item: FocusItem; saving: boolean; onComplete: () => void; onSkip: () => void;
}) {
  const { t } = useT();
  const revenueLabel = t("home.focus.revenue" as any);
  const deliveryLabel = t("home.focus.delivery" as any);
  const isRevenue = item.type === revenueLabel;
  const isDelivery = item.type === deliveryLabel;
  const badgeColor = isRevenue ? "var(--success)" : isDelivery ? "var(--warning)" : "var(--accent)";
  const badgeBg = isRevenue ? "var(--success-light)" : isDelivery ? "var(--warning-light)" : "var(--accent-light)";
  const icon = isRevenue ? <CircleDollarSign size={10} /> : isDelivery ? <CheckSquare size={10} /> : <FolderCog size={10} />;

  return (
    <article className="card-interactive p-4 flex flex-col justify-between gap-3">
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="badge" style={{ background: badgeBg, color: badgeColor }}>{icon} {item.type}</span>
          {isRevenue && (
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--success)" }}>{t("home.focus.priority" as any)}</span>
          )}
        </div>
        <h4 className="text-[13px] font-medium leading-snug mb-1" style={{ color: "var(--text)" }}>{item.title}</h4>
        <p className="text-[12px] line-clamp-2" style={{ color: "var(--text-secondary)" }}>{item.reason}</p>
        <p className="text-[11px] mt-1" style={{ color: "var(--text-tertiary)" }}>{item.actionHint}</p>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onComplete} disabled={saving} className="btn-primary flex-1 text-[12px] disabled:opacity-50" style={{ padding: "6px 10px" }}>
          <Check size={13} /> {t("common.complete" as any)}
        </button>
        <button onClick={onSkip} disabled={saving} className="btn-secondary text-[12px] disabled:opacity-50" style={{ padding: "6px 10px" }}>
          {t("home.focus.swap" as any)}
        </button>
      </div>
    </article>
  );
}

function Accordion({ label, open, toggle, children }: { label: string; open: boolean; toggle: () => void; children: React.ReactNode }) {
  return (
    <section>
      <button onClick={toggle} className="flex items-center gap-1.5 mb-2 group">
        <span style={{ color: "var(--text-tertiary)" }}>
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
        <span className="text-[12px] font-medium" style={{ color: "var(--text-tertiary)" }}>{label}</span>
      </button>
      {open && children}
    </section>
  );
}

function CompletedRow({ item, saving, onUndo, last }: { item: FocusItem; saving: boolean; onUndo: () => void; last?: boolean }) {
  const { t } = useT();
  return (
    <div className="list-item" style={last ? { borderBottom: "none" } : undefined}>
      <div className="flex-1 min-w-0">
        <span className="text-[10px] font-medium block" style={{ color: "var(--text-tertiary)" }}>{item.type}</span>
        <p className="text-[13px] line-through truncate" style={{ color: "var(--text-secondary)" }}>{item.title}</p>
      </div>
      <button onClick={onUndo} disabled={saving} className="btn-ghost text-[11px] shrink-0 disabled:opacity-50">
        <Undo2 size={11} /> {t("common.undo" as any)}
      </button>
    </div>
  );
}

function ManualRow({ item, done, saving, deleting, onComplete, onEdit, onDelete, last }: {
  item: FocusItem; done?: boolean; saving: boolean; deleting: boolean;
  onComplete: () => void; onEdit?: () => void; onDelete: () => void; last?: boolean;
}) {
  const { t } = useT();
  const disabled = saving || deleting;
  return (
    <div className="list-item flex-col !items-start !gap-1.5" style={last ? { borderBottom: "none" } : undefined}>
      <div>
        <span className="text-[10px] font-medium" style={{ color: done ? "var(--success)" : "var(--text-tertiary)" }}>
          {item.type} · {done ? t("common.completed" as any) : t("home.events.record" as any)}
        </span>
        <p className={`text-[13px] font-medium ${done ? "line-through" : ""}`} style={{ color: done ? "var(--text-secondary)" : "var(--text)" }}>
          {item.title}
        </p>
        {item.reason && !done && <p className="text-[11px] mt-0.5" style={{ color: "var(--text-secondary)" }}>{item.reason}</p>}
      </div>
      <div className="flex gap-1.5">
        <button onClick={onComplete} disabled={disabled} className={`text-[11px] font-medium px-2 py-0.5 rounded-md transition-colors disabled:opacity-50 ${done ? "" : "text-white"}`}
          style={done ? { border: "1px solid var(--border-strong)", color: "var(--text-secondary)" } : { background: "var(--accent)", color: "#fff" }}>
          {done ? <><Undo2 size={10} className="inline mr-0.5" />{t("common.undo" as any)}</> : <><Check size={10} className="inline mr-0.5" />{t("common.complete" as any)}</>}
        </button>
        {onEdit && !done && (
          <button onClick={onEdit} disabled={disabled} className="text-[11px] font-medium px-2 py-0.5 rounded-md border transition-colors disabled:opacity-50" style={{ borderColor: "var(--border-strong)", color: "var(--text-secondary)" }}>
            <Pencil size={10} className="inline mr-0.5" />{t("common.edit" as any)}
          </button>
        )}
        <button onClick={onDelete} disabled={disabled} className="text-[11px] font-medium px-2 py-0.5 rounded-md transition-colors disabled:opacity-50" style={{ background: "var(--danger-light)", color: "var(--danger)" }}>
          <Trash2 size={10} className="inline mr-0.5" />{t("common.delete" as any)}
        </button>
      </div>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="py-6 text-center text-[12px]" style={{ color: "var(--text-tertiary)" }}>
      {text}
    </div>
  );
}
