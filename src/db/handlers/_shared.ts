/**
 * Shared helpers, constants, types, and router plumbing for the handler modules.
 * Everything here was originally inside `db/api.ts`.
 */
import { Database } from 'sql.js';
import { all, run } from '../index';
import { todayDateKey, monthKey, currentMonth } from '../../lib/date-utils';

// ── Input validation constants (must match supabase-api.ts) ────────────────
export const VALID_LEAD_COLUMNS = ['new', 'contacted', 'proposal', 'won', 'lost'] as const;
export const VALID_CLIENT_STATUSES = ['Active', 'Paused', 'Cancelled', 'Completed'] as const;
export const VALID_BILLING_TYPES = ['subscription', 'project'] as const;
export const VALID_TAX_MODES = ['none', 'exclusive', 'inclusive'] as const;
export const VALID_TASK_PRIORITIES = ['High', 'Medium', 'Low'] as const;
export const VALID_TASK_COLUMNS = ['todo', 'inProgress', 'review', 'done'] as const;
export const VALID_TASK_SCOPES = ['work', 'personal', 'work-memo'] as const;
export const VALID_PAYMENT_METHODS = ['auto', 'manual'] as const;
export const VALID_TX_TYPES = ['income', 'expense'] as const;
export const VALID_TX_STATUSES = ['已完成', '待收款 (应收)', '待支付 (应付)'] as const;
export const VALID_MS_STATUSES = ['pending', 'paid'] as const;
export const VALID_PROJECT_STATUSES = ['active', 'completed', 'cancelled'] as const;

// ── Types ────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- sql.js rows have dynamic columns
export type DbRow = Record<string, any>;

export type HandlerResult = { status: number; data: unknown };

export interface HandlerCtx {
  db: Database;
  method: string;
  path: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- request body is dynamically typed JSON
  body: Record<string, any>;
}

export type Handler = (ctx: HandlerCtx) => Promise<HandlerResult | null>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- response data varies by endpoint
export const ok = (data: any): HandlerResult => ({ status: 200, data });
export const err = (status: number, msg: string): HandlerResult => ({ status, data: { error: msg } });

// ── Helpers ──────────────────────────────────────────────────────────────

export function safeJsonParse<T>(val: unknown, fallback: T): T {
  if (typeof val !== 'string') return fallback;
  try { return JSON.parse(val) as T; } catch { return fallback; }
}

export { sanitizeSubscriptionTimeline } from '../../lib/subscription-timeline';

export function logActivity(
  db: Database,
  entityType: string,
  action: string,
  title: string,
  detail = '',
  entityId?: number | string
) {
  run(
    db,
    `INSERT INTO activity_log (entity_type, entity_id, action, title, detail)
     VALUES (?, ?, ?, ?, ?)`,
    [entityType, entityId ?? null, action, title, detail]
  );
}

// Re-export under the legacy name so internal callers don't need to migrate
// in this pass; the canonical impl lives in `src/lib/tax.ts`.
export { calcTaxAmount as calcTaxOffline } from '../../lib/tax';
import { calcTaxAmount } from '../../lib/tax';

export function syncClientSubscriptionLedger(db: Database) {
  const clients = all(
    db,
    `SELECT id, name, plan_tier, mrr, status, joined_at,
            subscription_start_date, paused_at, resumed_at,
            cancelled_at, mrr_effective_from, subscription_timeline,
            tax_mode, tax_rate, payment_method
     FROM clients WHERE COALESCE(mrr, 0) > 0 AND soft_deleted=0`
  );

  const now = new Date();
  const cm = currentMonth();

  const shouldExist = new Map<string, DbRow>();

  for (const client of clients) {
    const joined = client.joined_at ? new Date(String(client.joined_at).replace(' ', 'T')) : now;
    const safeJoined = Number.isNaN(joined.getTime()) ? now : joined;

    let timeline: { type: string; date: string }[] = [];
    try { timeline = JSON.parse(client.subscription_timeline || '[]'); } catch { timeline = []; }
    if (!timeline.length && client.subscription_start_date) {
      timeline = [{ type: 'start', date: client.subscription_start_date as string }];
      if (client.paused_at) timeline.push({ type: 'pause', date: client.paused_at as string });
      if (client.resumed_at) timeline.push({ type: 'resume', date: client.resumed_at as string });
      if (client.cancelled_at) timeline.push({ type: 'cancel', date: client.cancelled_at as string });
    }
    if (!timeline.length) continue;
    timeline.sort((a, b) => a.date.localeCompare(b.date));
    const startDate = timeline[0].date;
    const startM = monthKey(startDate, safeJoined);

    let [year, month] = startM.split('-').map(Number);
    while (`${year}-${String(month).padStart(2, '0')}` <= cm) {
      const lm = `${year}-${String(month).padStart(2, '0')}`;
      let active = false;
      for (const evt of timeline) {
        const evtM = monthKey(evt.date);
        if (evtM && evtM <= lm) {
          if (evt.type === 'start' || evt.type === 'resume') active = true;
          else if (evt.type === 'pause' || evt.type === 'cancel') active = false;
        }
      }
      if (active) {
        const amt = Number(client.mrr || 0);
        const tm = (client.tax_mode as string) || 'none';
        const tr = Number(client.tax_rate || 0);
        const billingDate = lm === startM ? startDate : (() => {
          const startDay = parseInt(startDate.split('-')[2] || '1', 10);
          const [y, m] = lm.split('-').map(Number);
          const lastDay = new Date(y, m, 0).getDate();
          const day = Math.min(startDay, lastDay);
          return `${lm}-${String(day).padStart(2, '0')}`;
        })();
        const isFuture = billingDate > todayDateKey();
        const txStatus = isFuture ? '待收款 (应收)'
          : client.payment_method === 'manual' ? '待收款 (应收)' : '已完成';
        shouldExist.set(`${client.id}-${lm}`, {
          type: 'income', source: 'subscription', source_id: client.id,
          amount: amt, category: '订阅收入',
          description: `${client.name || '未命名客户'} · ${client.plan_tier || '订阅'} · ${lm}`,
          date: billingDate,
          status: txStatus,
          client_id: client.id, client_name: client.name || '未命名客户',
          tax_mode: tm, tax_rate: tr, tax_amount: calcTaxAmount(amt, tm, tr),
        });
      }
      month += 1;
      if (month > 12) { month = 1; year += 1; }
    }
  }

  const existing = all(db, `SELECT id, source_id, date, status FROM finance_transactions WHERE source='subscription' AND soft_deleted=0`);
  const existingMap = new Map<string, { id: number; status: string }>();
  for (const row of existing) {
    const m = String(row.date || '').substring(0, 7);
    existingMap.set(`${row.source_id}-${m}`, { id: row.id as number, status: String(row.status || '') });
  }

  for (const [key, row] of shouldExist) {
    const exist = existingMap.get(key);
    if (exist) {
      const isFutureBilling = row.date > todayDateKey();
      const preservedStatus = (!isFutureBilling && exist.status === '已完成') ? '已完成' : row.status;
      const clientForRow = clients.find((c: DbRow) => c.id === row.source_id);
      const effectiveMonth = clientForRow?.mrr_effective_from ? String(clientForRow.mrr_effective_from).substring(0, 7) : '';
      const rowMonth = String(row.date).substring(0, 7);
      const isBeforeEffective = effectiveMonth && rowMonth < effectiveMonth;
      if (!isBeforeEffective) {
        run(db, `UPDATE finance_transactions SET amount=?, description=?, date=?, status=?, tax_mode=?, tax_rate=?, tax_amount=?, client_name=?, soft_deleted=0 WHERE id=?`,
          [row.amount, row.description, row.date, preservedStatus, row.tax_mode, row.tax_rate, row.tax_amount, row.client_name, exist.id]);
      }
      existingMap.delete(key);
    } else {
      run(db, `INSERT INTO finance_transactions (type, source, source_id, amount, category, description, date, status, client_id, client_name, tax_mode, tax_rate, tax_amount) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [row.type, row.source, row.source_id, row.amount, row.category, row.description, row.date, row.status, row.client_id, row.client_name, row.tax_mode, row.tax_rate, row.tax_amount]);
    }
  }

  for (const entry of existingMap.values()) {
    run(db, `UPDATE finance_transactions SET soft_deleted=1 WHERE id=?`, [entry.id]);
  }
}

export function getRecentSubscriptionEvents(db: Database): DbRow[] {
  const rows = all(
    db,
    `SELECT client_id, client_name, amount, ledger_month
     FROM client_subscription_ledger
     ORDER BY ledger_month DESC, id DESC LIMIT 8`
  );
  return rows.map((row) => ({
    activity: `订阅入账：${row.client_name || '未命名客户'}`,
    detail: `$${Number(row.amount || 0).toLocaleString()} · ${row.ledger_month}`,
    time: `${row.ledger_month}-01 00:00:00`,
    type: 'finance',
    action: 'subscription',
    sortKey: `${row.ledger_month}-01 00:00:00`,
  }));
}

export function getTodayFocusStateMap(
  db: Database,
  focusDate = todayDateKey()
): Record<string, string> {
  const rows = all(
    db,
    `SELECT focus_key, status FROM today_focus_state WHERE focus_date = ?`,
    [focusDate]
  );
  return Object.fromEntries(
    rows.map((r) => [String(r.focus_key), String(r.status || 'pending')])
  );
}

export function upsertTodayFocusState(
  db: Database,
  focusKey: string,
  status: string,
  focusDate = todayDateKey()
) {
  db.run(
    `INSERT INTO today_focus_state (focus_date, focus_key, status, updated_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(focus_date, focus_key)
     DO UPDATE SET status = excluded.status, updated_at = CURRENT_TIMESTAMP`,
    [focusDate, focusKey, status]
  );
}

export function normalizePlanTier(t: string): string {
  if (!t) return '';
  if (['Basic', 'basic'].includes(t)) return '基础版';
  if (['Pro', 'pro', 'Professional', 'professional'].includes(t)) return '专业版';
  if (['Enterprise', 'enterprise'].includes(t)) return '企业版';
  return t;
}

export function getFinanceRows(db: Database): DbRow[] {
  return all(db, 'SELECT * FROM finance_transactions WHERE soft_deleted=0 ORDER BY date DESC, id DESC');
}
