import React, { useEffect, useMemo, useState, useCallback, useRef, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import {
  Check, Undo2, Plus, Pencil, Trash2, X, ChevronDown, ChevronRight,
  ArrowUpRight, ArrowDownRight,
  UserPlus, ClipboardList, Wallet,
} from "lucide-react";
import { useT } from "../i18n/context";
import { useRealtimeRefresh } from "../hooks/useRealtimeRefresh";
import { usePullToRefresh } from "../hooks/usePullToRefresh";

const DailyProtocol = lazy(() => import("./DailyProtocol"));
const BreakthroughFull = lazy(() => import("./Breakthrough"));
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

type DashboardData = {
  todayFocus: FocusItem[];
  manualTodayEvents: FocusItem[];
  clientsCount: number;
  mrr: number;
  activeTasks: number;
  leadsCount: number;
  ytdRevenue?: number;
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

  // Pull-to-refresh (mobile)
  const scrollRef = useRef<HTMLDivElement>(null);
  usePullToRefresh(scrollRef, fetchData);

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
  // Show one card per type (收入/交付/系统), pick first non-skipped non-completed
  const pending = useMemo(() => {
    const all = data.todayFocus.filter(i => i.status !== "completed" && !skipped.includes(i.key));
    const seen = new Set<string>();
    const result: typeof all = [];
    for (const item of all) {
      if (!seen.has(item.type)) { seen.add(item.type); result.push(item); }
    }
    return result;
  }, [data.todayFocus, skipped]);
  const completed = useMemo(() => data.todayFocus.filter(i => i.status === "completed"), [data.todayFocus]);
  const pendingManual = useMemo(() => data.manualTodayEvents.filter(i => i.status !== "completed"), [data.manualTodayEvents]);
  const completedManual = useMemo(() => data.manualTodayEvents.filter(i => i.status === "completed"), [data.manualTodayEvents]);
  const total = 3; // always 3 types: revenue, delivery, system
  const doneCount = completed.length > 3 ? 3 : completed.length;
  const manualCount = pendingManual.length + completedManual.length;
  const progressPct = total ? Math.round((doneCount / total) * 100) : 0;

  /* ── Accordion state ── */
  const [openSection, setOpenSection] = useState<string | null>(null);
  const toggleSection = useCallback((id: string) => setOpenSection(p => p === id ? null : id), []);

  /* ── Render ───────────────────────────────────────────────────── */
  return (
    <div ref={scrollRef} className="mobile-page page-wrap">
      <div className="space-y-5">
        {/* ═══ LAYER 1: Hero card (greeting + KPI + quick actions) ═══ */}
        <header className="rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg, var(--brand-blue-deep) 0%, var(--brand-blue) 100%)" }}>
          {/* Greeting */}
          <div className="px-5 pt-5 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.55)" }}>{greeting(t)}</p>
                <h1 className="text-[17px] font-bold mt-0.5" style={{ color: "#fff" }}>
                  {operatorName.trim() || "Solo CEO"}
                </h1>
              </div>
              <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>{todayStr(lang)}</span>
            </div>
          </div>
          {/* KPI — 2 big + 3 small */}
          <div className="px-5 pb-3">
            <div className="flex items-end gap-4 mb-2">
              <div>
                <div className="text-[22px] font-bold leading-none" style={{ color: "#fff" }}>{loading ? "—" : `$${Number(data.mrr || 0).toLocaleString()}`}</div>
                <div className="text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>MRR</div>
              </div>
              <div>
                <div className="text-[22px] font-bold leading-none" style={{ color: "var(--accent)" }}>{loading ? "—" : `$${Number(data.ytdRevenue || 0).toLocaleString()}`}</div>
                <div className="text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>{t("home.kpi.ytdRevenue" as any)}</div>
              </div>
              <div className="flex-1" />
              <div className="flex gap-4">
                {[
                  { label: t("home.kpi.activeClients" as any), value: loading ? "—" : String(data.clientsCount || 0) },
                  { label: t("home.kpi.leads" as any), value: loading ? "—" : String(data.leadsCount || 0) },
                  { label: t("home.kpi.inProgress" as any), value: loading ? "—" : String(data.activeTasks || 0) },
                ].map(kpi => (
                  <div key={kpi.label} className="text-center">
                    <div className="text-[15px] font-bold leading-none" style={{ color: "#fff" }}>{kpi.value}</div>
                    <div className="text-[9px] mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>{kpi.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Quick actions — frosted glass bar */}
          <div className="flex gap-1 px-4 py-2.5" style={{ background: "rgba(0,0,0,0.15)" }}>
            <button onClick={() => goToTab("clients")} className="flex-1 text-[10px] font-medium py-1.5 rounded-md transition-colors text-center" style={{ background: "var(--accent)", color: "#fff" }}>
              {t("home.welcome.addLead" as any)}
            </button>
            <button onClick={() => goToTab("work")} className="flex-1 text-[10px] font-medium py-1.5 rounded-md transition-colors text-center" style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.85)" }}>
              {t("home.welcome.addTask" as any)}
            </button>
            <button onClick={() => goToTab("finance")} className="flex-1 text-[10px] font-medium py-1.5 rounded-md transition-colors text-center" style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.85)" }}>
              {t("home.welcome.addIncome" as any)}
            </button>
            <button onClick={() => { setEditKey(null); setForm(emptyForm); setShowForm(p => !p); }} className="flex-1 text-[10px] font-medium py-1.5 rounded-md transition-colors text-center" style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.85)" }}>
              {t("home.quickMemo" as any)}
            </button>
          </div>
        </header>

        {/* ═══ LAYER 2: Today's Focus (main content area) ═══ */}

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
                <div className="space-y-1.5">
                  <span className="section-label">{t("home.form.type" as any)}</span>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { key: "revenue", emoji: "💰", label: t("home.form.type.revenue" as any), hint: t("home.form.typeHint.revenue" as any) },
                      { key: "delivery", emoji: "📦", label: t("home.form.type.delivery" as any), hint: t("home.form.typeHint.delivery" as any) },
                      { key: "system", emoji: "⚙️", label: t("home.form.type.system" as any), hint: t("home.form.typeHint.system" as any) },
                    ]).map(opt => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setForm(p => ({ ...p, type: opt.label }))}
                        className="card p-2.5 text-left transition-colors"
                        style={form.type === opt.label ? { borderColor: "var(--accent)", background: "var(--accent-light)" } : {}}
                      >
                        <div className="text-[14px] mb-0.5">{opt.emoji}</div>
                        <div className="text-[12px] font-semibold" style={{ color: form.type === opt.label ? "var(--accent)" : "var(--text)" }}>{opt.label}</div>
                        <div className="text-[10px] leading-tight mt-0.5" style={{ color: "var(--text-tertiary)" }}>{opt.hint}</div>
                      </button>
                    ))}
                  </div>
                </div>
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
          <div className="mb-3">
            <h3 className="section-label">{t("home.focus.title" as any)}</h3>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>{t("home.focus.desc" as any)}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {pending.map(item => {
              const sameType = data.todayFocus.filter(i => i.type === item.type && i.status !== "completed" && !skipped.includes(i.key));
              return (
                <FocusCard
                  key={item.key}
                  item={item}
                  saving={savingKey === item.key}
                  canSwap={sameType.length > 1}
                  onComplete={() => updateStatus(item.key, "completed")}
                  onSkip={() => setSkipped(p => [...new Set([...p, item.key])])}
                />
              );
            })}
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

        {/* ═══ LAYER 3: Expandable sections (accordions) ═══ */}
        <div className="space-y-1">
          {/* Daily Protocol */}
          <Accordion label={t("home.protocol.title" as any)} badge={`${([] as boolean[]).length}/5`} open={openSection === "protocol"} toggle={() => toggleSection("protocol")}>
            <Suspense fallback={null}><DailyProtocol /></Suspense>
          </Accordion>

          {/* Breakthrough Plan — full task tracker */}
          <Accordion label={t("home.breakthrough.title" as any)} open={openSection === "breakthrough"} toggle={() => toggleSection("breakthrough")}>
            <Suspense fallback={null}><BreakthroughFull /></Suspense>
          </Accordion>

          {/* Today's Principle */}
          <Accordion label={t("home.principle.title" as any)} open={openSection === "principle"} toggle={() => toggleSection("principle")}>
            <Suspense fallback={null}><TodayPrinciple /></Suspense>
          </Accordion>

          {/* Completed focus */}
          <Accordion label={t("home.completed.title" as any, { count: completed.length })} open={openSection === "completed"} toggle={() => toggleSection("completed")}>
            {!completed.length && <EmptyHint text={t("home.completed.empty" as any)} />}
            <div className="card overflow-hidden">
              {completed.map((item, i) => (
                <CompletedRow key={item.key} item={item} saving={savingKey === item.key} onUndo={() => updateStatus(item.key, "pending")} last={i === completed.length - 1} />
              ))}
            </div>
          </Accordion>

          {/* Manual events */}
          <Accordion label={t("home.events.title" as any, { count: manualCount })} open={openSection === "events"} toggle={() => toggleSection("events")}>
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
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────── */

function FocusCard({ item, saving, canSwap = true, onComplete, onSkip }: {
  item: FocusItem; saving: boolean; canSwap?: boolean; onComplete: () => void; onSkip: () => void;
}) {
  const { t } = useT();
  const revenueLabel = t("home.focus.revenue" as any);
  const deliveryLabel = t("home.focus.delivery" as any);
  const isRevenue = item.type === revenueLabel;
  const isDelivery = item.type === deliveryLabel;
  const badgeColor = isRevenue ? "var(--success)" : isDelivery ? "var(--warning)" : "var(--accent)";
  const badgeBg = isRevenue ? "var(--success-light)" : isDelivery ? "var(--warning-light)" : "var(--accent-light)";

  return (
    <article className="card p-4 flex flex-col justify-between gap-2.5" style={isRevenue ? { borderLeft: "3px solid var(--success)" } : isDelivery ? { borderLeft: "3px solid var(--warning)" } : { borderLeft: "3px solid var(--accent)" }}>
      <div>
        <span className="badge text-[10px] mb-1.5 inline-block" style={{ background: badgeBg, color: badgeColor }}>{item.type}</span>
        <h4 className="text-[13px] font-semibold leading-snug" style={{ color: "var(--text)" }}>{item.title}</h4>
        <p className="text-[11px] mt-0.5 line-clamp-2" style={{ color: "var(--text-tertiary)" }}>{item.reason}</p>
      </div>
      <div className="flex items-center gap-1.5">
        <button onClick={onComplete} disabled={saving} className="text-[11px] font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50" style={{ background: "var(--accent)", color: "#fff" }}>
          <Check size={11} className="inline mr-0.5" style={{ verticalAlign: "-1px" }} /> {t("common.complete" as any)}
        </button>
        {canSwap && (
          <button onClick={onSkip} disabled={saving} className="text-[11px] font-medium px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50" style={{ background: "var(--surface-alt)", color: "var(--text-secondary)" }}>
            {t("home.focus.swap" as any)}
          </button>
        )}
      </div>
    </article>
  );
}

function Accordion({ label, badge, open, toggle, children }: { label: string; badge?: string; open: boolean; toggle: () => void; children: React.ReactNode }) {
  return (
    <section className="card overflow-hidden">
      <button onClick={toggle} className="flex items-center gap-2 w-full px-4 py-3 transition-colors" style={{ background: open ? "var(--surface-alt)" : undefined }}>
        <span style={{ color: "var(--text-tertiary)" }}>
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
        <span className="flex-1 text-left text-[13px] font-medium" style={{ color: "var(--text)" }}>{label}</span>
        {badge && <span className="text-[11px] tabular-nums" style={{ color: "var(--text-tertiary)" }}>{badge}</span>}
      </button>
      {open && <div className="px-4 pb-4 pt-2">{children}</div>}
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
