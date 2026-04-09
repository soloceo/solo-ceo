/**
 * Supabase API handler — replaces both server.ts and api.ts
 * Same signature as api.ts handleApiRequest() so the interceptor
 * can swap between online (Supabase) and offline (sql.js) seamlessly.
 */
import { supabase } from './supabase-client';
import { todayDateKey, dateToKey, monthKey, currentMonth } from '../lib/date-utils';
import { str, enumVal } from '../lib/validate';

// ── Types ─────────────────────────────────────────────────────────

interface SubscriptionLedgerRow {
  user_id: string;
  type: string;
  source: string;
  source_id: number;
  amount: number;
  category: string;
  description: string;
  date: string;
  status: string;
  client_id: number;
  client_name: string;
  tax_mode: string;
  tax_rate: number;
  tax_amount: number;
}

interface LedgerUpdateData {
  amount: number;
  description: string;
  date: string;
  status: string;
  tax_mode: string;
  tax_rate: number;
  tax_amount: number;
  client_name: string;
}

interface AmountRow {
  amount: number;
}

interface TaxAmountRow {
  amount: number;
  tax_amount: number;
}

interface FinanceTransactionRow {
  id: number;
  date: string;
  amount: number;
  type: string;
  status: string;
  description: string;
  category?: string;
  tax_amount?: number;
  source?: string;
}

interface MilestoneRow {
  id: number;
  status: string;
  due_date: string;
  [key: string]: unknown;
}

interface TaskRow {
  id: number;
  title: string;
  client: string;
  priority: string;
  due: string;
  column: string;
  scope: string;
  parent_id: number | null;
}

interface LeadRow {
  id: number;
  name: string;
  industry: string;
  needs: string;
  column: string;
}

interface ClientMrrRow {
  id: number;
  mrr: number;
}

interface FocusCandidate {
  key: string;
  type: string;
  title: string;
  reason: string;
  actionHint: string;
  isManual?: boolean;
  status?: string;
  entityType?: 'task' | 'memo' | 'lead' | 'milestone' | null;
  entityId?: number | null;
  dueDate?: string | null;
  isOverdue?: boolean;
  daysOverdue?: number;
}

interface OverdueMilestoneRow {
  id: number;
  label: string;
  amount: number;
  due_date: string;
  client_id: number;
  clients: { name: string } | null;
}

// ── helpers ────────────────────────────────────────────────────────

// Cache userId from session (local, no network call) instead of getUser() (network)
let _cachedUserId: string | null = null;
let _authSub: { unsubscribe: () => void } | null = null;

async function getUserId(): Promise<string> {
  if (_cachedUserId) return _cachedUserId;
  // getSession() reads from localStorage — instant, no network
  const { data } = await supabase.auth.getSession();
  if (!data.session?.user) throw new Error('Not authenticated');
  _cachedUserId = data.session.user.id;
  return _cachedUserId;
}

// Setup auth listener with cleanup (hot reload safety)
function setupAuthListener() {
  // Clean up previous subscription
  _authSub?.unsubscribe();

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    _cachedUserId = session?.user?.id ?? null;
  });
  _authSub = data.subscription;
}

setupAuthListener();

/** Clear cached userId on sign-out to prevent cross-user contamination */
export function resetCachedUserId(): void {
  _cachedUserId = null;
}

function normalizePlanTier(t: string): string {
  if (!t) return '';
  if (['Basic', 'basic'].includes(t)) return '基础版';
  if (['Pro', 'pro', 'Professional', 'professional'].includes(t)) return '专业版';
  if (['Enterprise', 'enterprise'].includes(t)) return '企业版';
  return t;
}

function safeJson<T>(val: unknown, fallback: T): T {
  if (Array.isArray(val)) return val as T;
  if (typeof val !== 'string') return fallback;
  try { return JSON.parse(val) as T; } catch { return fallback; }
}

async function logActivity(
  userId: string,
  entityType: string,
  action: string,
  title: string,
  detail = '',
  entityId?: number | string,
) {
  await supabase.from('activity_log').insert({
    user_id: userId,
    entity_type: entityType,
    entity_id: entityId ? Number(entityId) : null,
    action,
    title,
    detail,
  });
}

// ── Input validation helpers ─────────────────────────────────────

const VALID_LEAD_COLUMNS = ['new', 'contacted', 'proposal', 'won', 'lost'] as const;
const VALID_CLIENT_STATUSES = ['Active', 'Paused', 'Cancelled', 'Completed'] as const;
const VALID_BILLING_TYPES = ['subscription', 'project'] as const;
const VALID_TAX_MODES = ['none', 'exclusive', 'inclusive'] as const;
const VALID_TASK_PRIORITIES = ['High', 'Medium', 'Low'] as const;
const VALID_TASK_COLUMNS = ['todo', 'inProgress', 'review', 'done'] as const;
const VALID_TASK_SCOPES = ['work', 'personal', 'work-memo'] as const;
const VALID_PAYMENT_METHODS = ['auto', 'manual'] as const;
const VALID_TX_TYPES = ['income', 'expense'] as const;
const VALID_TX_STATUSES = ['已完成', '待收款 (应收)', '待支付 (应付)'] as const;
const VALID_MS_STATUSES = ['pending', 'paid'] as const;
const VALID_PROJECT_STATUSES = ['active', 'completed', 'cancelled'] as const;

// ── Tax calc helper ───────────────────────────────────────────────
function calcTax(amount: number, mode: string, rate: number): number {
  if (mode === 'none' || !rate) return 0;
  if (mode === 'exclusive') return Math.round(amount * rate / 100 * 100) / 100;
  if (mode === 'inclusive') return Math.round(amount * rate / (100 + rate) * 100) / 100;
  return 0;
}

// ── Subscription sync → writes real finance_transactions ──────────
let syncLedgerRunning = false;
async function syncClientSubscriptionLedger(userId: string) {
  if (syncLedgerRunning) return;
  syncLedgerRunning = true;
  try {
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, plan_tier, mrr, status, joined_at, subscription_start_date, paused_at, resumed_at, cancelled_at, mrr_effective_from, subscription_timeline, tax_mode, tax_rate, payment_method')
    .eq('user_id', userId)
    .eq('soft_deleted', false)
    .gt('mrr', 0);

  // Collect all months that SHOULD have subscription income
  const now = new Date();
  const cm = currentMonth();
  const shouldExist: Map<string, SubscriptionLedgerRow> = new Map(); // key: "${clientId}-${month}"

  for (const client of (clients || [])) {
    const joined = client.joined_at ? new Date(String(client.joined_at).replace(' ', 'T')) : now;
    const safeJoined = Number.isNaN(joined.getTime()) ? now : joined;

    // Parse timeline — prefer new timeline array, fallback to legacy 4-field
    let timeline: { type: string; date: string }[] = [];
    try { timeline = JSON.parse(client.subscription_timeline || '[]'); } catch { timeline = []; }
    if (!timeline.length && client.subscription_start_date) {
      // Migrate legacy fields into timeline format
      timeline = [{ type: 'start', date: client.subscription_start_date }];
      if (client.paused_at) timeline.push({ type: 'pause', date: client.paused_at });
      if (client.resumed_at) timeline.push({ type: 'resume', date: client.resumed_at });
      if (client.cancelled_at) timeline.push({ type: 'cancel', date: client.cancelled_at });
    }
    if (!timeline.length) continue;

    // Sort by date
    timeline.sort((a, b) => a.date.localeCompare(b.date));
    const startDate = timeline[0].date;
    const startM = monthKey(startDate, safeJoined);

    // Build a map of month → active/paused based on timeline events
    let [year, month] = startM.split('-').map(Number);
    while (`${year}-${String(month).padStart(2, '0')}` <= cm) {
      const lm = `${year}-${String(month).padStart(2, '0')}`;

      // Determine billing state for this month by replaying timeline
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
        const tm = client.tax_mode || 'none';
        const tr = Number(client.tax_rate || 0);
        const billingDate = lm === startM ? startDate : (() => {
          const startDay = parseInt(startDate.split('-')[2] || '1', 10);
          const [y, m] = lm.split('-').map(Number);
          const lastDay = new Date(y, m, 0).getDate(); // last day of month
          const day = Math.min(startDay, lastDay);
          return `${lm}-${String(day).padStart(2, '0')}`;
        })();
        // Future billing dates are always pending, regardless of payment method
        const isFuture = billingDate > todayDateKey();
        const txStatus = isFuture ? '待收款 (应收)'
          : client.payment_method === 'manual' ? '待收款 (应收)' : '已完成';
        shouldExist.set(`${client.id}-${lm}`, {
          user_id: userId,
          type: 'income',
          source: 'subscription',
          source_id: client.id,
          amount: amt,
          category: '订阅收入',
          description: `${client.name || '未命名客户'} · ${client.plan_tier || '订阅'} · ${lm}`,
          date: billingDate,
          status: txStatus,
          client_id: client.id,
          client_name: client.name || '未命名客户',
          tax_mode: tm,
          tax_rate: tr,
          tax_amount: calcTax(amt, tm, tr),
        });
      }
      month += 1;
      if (month > 12) { month = 1; year += 1; }
    }
  }

  // Fetch existing subscription transactions for this user
  const { data: existing } = await supabase
    .from('finance_transactions')
    .select('id, source_id, date, status')
    .eq('user_id', userId)
    .eq('source', 'subscription')
    .eq('soft_deleted', false);

  const existingMap = new Map<string, { id: number; status: string }>();
  for (const row of (existing || [])) {
    const m = String(row.date || '').substring(0, 7);
    existingMap.set(`${row.source_id}-${m}`, { id: row.id, status: row.status || '' });
  }

  // Upsert: insert missing, update changed, soft-delete removed
  const toInsert: SubscriptionLedgerRow[] = [];
  const toUpdate: { id: number; data: LedgerUpdateData }[] = [];

  for (const [key, row] of shouldExist) {
    const exist = existingMap.get(key);
    if (exist) {
      // Already exists — update amount/description/tax in case client changed
      // IMPORTANT: preserve user-confirmed receipt (已完成) for PAST dates only.
      // Future-dated transactions must revert to pending — billing hasn't happened yet.
      const isFutureTx = row.date > todayDateKey();
      const preservedStatus = (!isFutureTx && exist.status === '已完成') ? '已完成' : row.status;
      toUpdate.push({ id: exist.id, data: { amount: row.amount, description: row.description, date: row.date, status: preservedStatus, tax_mode: row.tax_mode, tax_rate: row.tax_rate, tax_amount: row.tax_amount, client_name: row.client_name } });
      existingMap.delete(key);
    } else {
      toInsert.push(row);
    }
  }

  // Remaining in existingMap are rows that should no longer exist → soft delete
  const toDelete = [...existingMap.values()].map(e => e.id);

  // Execute — parallel batches to avoid N+1
  const BATCH = 20; // concurrent updates per wave
  if (toInsert.length > 0) {
    for (let i = 0; i < toInsert.length; i += 500) {
      await supabase.from('finance_transactions').insert(toInsert.slice(i, i + 500));
    }
  }
  // Batch updates in parallel waves of BATCH size
  for (let i = 0; i < toUpdate.length; i += BATCH) {
    await Promise.all(
      toUpdate.slice(i, i + BATCH).map(u =>
        supabase.from('finance_transactions').update(u.data).eq('id', u.id).eq('user_id', userId)
      )
    );
  }
  if (toDelete.length > 0) {
    await supabase.from('finance_transactions').update({ soft_deleted: true }).in('id', toDelete).eq('user_id', userId);
  }
  } finally {
    syncLedgerRunning = false;
  }
}

// ── Main route handler ────────────────────────────────────────────

export async function handleSupabaseRequest(
  method: string,
  path: string,
  body: Record<string, unknown>,
): Promise<{ status: number; data: unknown }> {
  const ok = (data: unknown) => ({ status: 200, data });
  const err = (status: number, msg: string) => ({ status, data: { error: msg } });

  let userId: string;
  try {
    userId = await getUserId();
  } catch {
    return err(401, 'Not authenticated');
  }

  // ── LEADS ──────────────────────────────────────────────────────
  if (path === '/api/leads' && method === 'GET') {
    const { data, error: e } = await supabase
      .from('leads')
      .select('id, name, industry, needs, website, column, aiDraft, source, created_at, updated_at')
      .eq('user_id', userId)
      .eq('soft_deleted', false)
      .order('created_at', { ascending: false });
    if (e) return err(500, e.message);
    return ok(data);
  }

  if (path === '/api/leads' && method === 'POST') {
    const { name, industry, needs, website, column, aiDraft, source } = body;
    const { data, error: e } = await supabase
      .from('leads')
      .insert({
        user_id: userId,
        name: str(name, 255), industry: str(industry, 100), needs: str(needs, 2000),
        website: str(website, 2048), column: enumVal(column, VALID_LEAD_COLUMNS, 'new'),
        aiDraft: str(aiDraft, 5000), source: str(source, 100),
      })
      .select('id')
      .single();
    if (e) return err(500, e.message);
    await logActivity(userId, 'lead', 'created', `新增线索：${name || '未命名线索'}`, source ? `来源：${source}` : '', data.id);
    return ok({ id: data.id });
  }

  const leadMatch = path.match(/^\/api\/leads\/(\d+)$/);
  if (leadMatch) {
    const id = Number(leadMatch[1]);
    if (method === 'PUT') {
      const patch: Record<string, unknown> = {};
      if (body.name !== undefined) patch.name = str(body.name, 255);
      if (body.industry !== undefined) patch.industry = str(body.industry, 100);
      if (body.needs !== undefined) patch.needs = str(body.needs, 2000);
      if (body.website !== undefined) patch.website = str(body.website, 2048);
      if (body.column !== undefined) patch.column = enumVal(body.column, VALID_LEAD_COLUMNS, 'new');
      if (body.aiDraft !== undefined) patch.aiDraft = str(body.aiDraft, 5000);
      if (body.source !== undefined) patch.source = str(body.source, 100);
      if (Object.keys(patch).length === 0) return ok({ success: true });
      const { error: e } = await supabase
        .from('leads')
        .update(patch)
        .eq('id', id).eq('user_id', userId);
      if (e) return err(500, e.message);
      await logActivity(userId, 'lead', 'updated', `更新线索：${body.name || '未命名线索'}`, '', id);
      return ok({ success: true });
    }
    if (method === 'DELETE') {
      const { data: prev } = await supabase.from('leads').select('name').eq('id', id).eq('user_id', userId).single();
      const { error: delErr } = await supabase.from('leads').update({ soft_deleted: true }).eq('id', id).eq('user_id', userId);
      if (delErr) return err(500, delErr.message);
      await logActivity(userId, 'lead', 'deleted', `删除线索：${prev?.name || '未命名线索'}`, '', id);
      return ok({ success: true });
    }
  }

  const convertMatch = path.match(/^\/api\/leads\/(\d+)\/convert$/);
  if (convertMatch && method === 'POST') {
    const id = Number(convertMatch[1]);
    const { data: lead } = await supabase.from('leads').select('id, name, industry, needs').eq('id', id).eq('user_id', userId).single();
    if (!lead) return err(404, 'Lead not found');
    const { plan_tier, status, mrr, subscription_start_date, mrr_effective_from, billing_type, project_fee } = body || {};
    const np = normalizePlanTier(String(plan_tier || ''));
    const bt = enumVal(billing_type, VALID_BILLING_TYPES, 'subscription');
    const today = todayDateKey();
    const { data: newClient, error: e } = await supabase
      .from('clients')
      .insert({
        user_id: userId,
        name: str(lead.name, 255) || '', industry: str(lead.industry, 100) || '',
        plan_tier: np, status: enumVal(status, VALID_CLIENT_STATUSES, 'Active'), brand_context: str(lead.needs, 2000) || '',
        mrr: bt === 'subscription' ? Number(mrr || 0) : 0,
        billing_type: bt,
        project_fee: bt === 'project' ? Number(project_fee || 0) : 0,
        subscription_start_date: subscription_start_date || today,
        paused_at: '', resumed_at: '', cancelled_at: '',
        mrr_effective_from: mrr_effective_from || subscription_start_date || today,
        subscription_timeline: JSON.stringify([{ type: 'start', date: subscription_start_date || today }]),
      })
      .select('id')
      .single();
    if (e) return err(500, e.message);
    await supabase.from('leads').update({ column: 'won' }).eq('id', id).eq('user_id', userId);
    syncClientSubscriptionLedger(userId).catch((err) => console.error('[SyncLedger]', err));
    await logActivity(userId, 'lead', 'converted', `线索转客户：${lead.name || '未命名线索'}`, np ? `方案：${np}` : '', id);
    await logActivity(userId, 'client', 'created', `新增客户：${lead.name || '未命名客户'}`, np ? `来自线索转化 · 方案：${np}` : '来自线索转化', newClient!.id);
    return ok({ success: true, clientId: newClient!.id });
  }

  // ── CLIENTS ────────────────────────────────────────────────────
  if (path === '/api/clients' && method === 'GET') {
    const currentYear = new Date().getFullYear();
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, company_name, plan_tier, status, mrr, billing_type, project_fee, tax_mode, tax_rate, payment_method, industry, brand_context, subscription_start_date, paused_at, resumed_at, cancelled_at, mrr_effective_from, subscription_timeline, joined_at, created_at, updated_at')
      .eq('user_id', userId)
      .eq('soft_deleted', false)
      .order('joined_at', { ascending: false });
    // Calculate lifetime/YTD revenue from finance_transactions (completed income per client)
    const { data: revRows } = await supabase
      .from('finance_transactions')
      .select('client_id, amount, date')
      .eq('user_id', userId)
      .eq('type', 'income')
      .eq('status', '已完成')
      .eq('soft_deleted', false)
      .in('client_id', (clients || []).map(c => c.id).filter(id => id != null));
    const revMap = new Map<number, Array<{ amount: number; date: string }>>();
    for (const r of (revRows || [])) {
      const cid = Number(r.client_id);
      if (!revMap.has(cid)) revMap.set(cid, []);
      revMap.get(cid)!.push(r);
    }
    const rows = (clients || []).map((client) => {
      const cl = revMap.get(Number(client.id)) || [];
      const lifetimeRevenue = cl.reduce((s, r) => s + Number(r.amount || 0), 0);
      const ytdRevenue = cl
        .filter((r) => String(r.date || '').startsWith(`${currentYear}-`))
        .reduce((s, r) => s + Number(r.amount || 0), 0);
      return { ...client, lifetimeRevenue, ytdRevenue };
    });
    return ok(rows);
  }

  if (path === '/api/clients' && method === 'POST') {
    const { name, industry, plan_tier, status, brand_context, mrr,
            subscription_start_date, paused_at, resumed_at, cancelled_at, mrr_effective_from, subscription_timeline,
            company_name, contact_name, contact_email, contact_phone, billing_type, project_fee, project_end_date, tax_mode, tax_rate, drive_folder_url, payment_method } = body;
    const np = normalizePlanTier(String(plan_tier || ''));
    const bt = enumVal(billing_type, VALID_BILLING_TYPES, 'subscription');
    const { data, error: e } = await supabase
      .from('clients')
      .insert({
        user_id: userId,
        name: str(name, 255), industry: str(industry, 100), plan_tier: np,
        status: enumVal(status, VALID_CLIENT_STATUSES, 'Active'),
        brand_context: str(brand_context, 2000), mrr: mrr || 0,
        subscription_start_date: str(subscription_start_date, 10), paused_at: str(paused_at, 10),
        resumed_at: str(resumed_at, 10), cancelled_at: str(cancelled_at, 10),
        mrr_effective_from: str(mrr_effective_from, 10) || str(subscription_start_date, 10),
        subscription_timeline: subscription_timeline || JSON.stringify(subscription_start_date ? [{ type: 'start', date: subscription_start_date }] : []),
        company_name: str(company_name, 255), contact_name: str(contact_name, 255),
        contact_email: str(contact_email, 320), contact_phone: str(contact_phone, 30),
        billing_type: bt, project_fee: project_fee || 0,
        project_end_date: str(project_end_date, 10),
        tax_mode: enumVal(tax_mode, VALID_TAX_MODES, 'none'), tax_rate: tax_rate || 0,
        drive_folder_url: str(drive_folder_url, 2048),
        payment_method: enumVal(payment_method, VALID_PAYMENT_METHODS, 'auto'),
      })
      .select('id')
      .single();
    if (e || !data) return err(500, e?.message || 'Insert failed');
    syncClientSubscriptionLedger(userId).catch((err) => console.error('[SyncLedger]', err));
    await logActivity(userId, 'client', 'created', `新增客户：${name || '未命名客户'}`, np ? `方案：${np}` : '', data.id);
    return ok({ id: data.id });
  }

  const clientMatch = path.match(/^\/api\/clients\/(\d+)$/);
  if (clientMatch) {
    const id = Number(clientMatch[1]);
    if (method === 'PUT') {
      // Build partial update — only include fields explicitly provided to avoid wiping data
      // (e.g. industry/brand_context are set during lead conversion but not in the edit form)
      const patch: Record<string, unknown> = {};
      if (body.name !== undefined) patch.name = str(body.name, 255);
      if (body.industry !== undefined) patch.industry = str(body.industry, 100);
      if (body.plan_tier !== undefined) patch.plan_tier = normalizePlanTier(String(body.plan_tier || ''));
      if (body.status !== undefined) patch.status = enumVal(body.status, VALID_CLIENT_STATUSES, 'Active');
      if (body.brand_context !== undefined) patch.brand_context = str(body.brand_context, 2000);
      if (body.mrr !== undefined) patch.mrr = body.mrr || 0;
      if (body.subscription_start_date !== undefined) patch.subscription_start_date = str(body.subscription_start_date, 10);
      if (body.paused_at !== undefined) patch.paused_at = str(body.paused_at, 10);
      if (body.resumed_at !== undefined) patch.resumed_at = str(body.resumed_at, 10);
      if (body.cancelled_at !== undefined) patch.cancelled_at = str(body.cancelled_at, 10);
      if (body.mrr_effective_from !== undefined) patch.mrr_effective_from = str(body.mrr_effective_from, 10) || str(body.subscription_start_date, 10);
      if (body.subscription_timeline !== undefined) patch.subscription_timeline = body.subscription_timeline || '[]';
      if (body.company_name !== undefined) patch.company_name = str(body.company_name, 255);
      if (body.contact_name !== undefined) patch.contact_name = str(body.contact_name, 255);
      if (body.contact_email !== undefined) patch.contact_email = str(body.contact_email, 320);
      if (body.contact_phone !== undefined) patch.contact_phone = str(body.contact_phone, 30);
      if (body.billing_type !== undefined) {
        patch.billing_type = enumVal(body.billing_type, VALID_BILLING_TYPES, 'subscription');
        // Clear incompatible fields when switching billing type
        if (patch.billing_type === 'subscription') {
          patch.project_fee = 0;
          patch.project_end_date = null;
        } else if (patch.billing_type === 'project') {
          patch.mrr = 0;
          patch.plan_tier = '';
        }
      }
      if (body.project_fee !== undefined) patch.project_fee = body.project_fee || 0;
      if (body.project_end_date !== undefined) patch.project_end_date = str(body.project_end_date, 10);
      if (body.tax_mode !== undefined) patch.tax_mode = enumVal(body.tax_mode, VALID_TAX_MODES, 'none');
      if (body.tax_rate !== undefined) patch.tax_rate = body.tax_rate || 0;
      if (body.drive_folder_url !== undefined) patch.drive_folder_url = str(body.drive_folder_url, 2048);
      if (body.payment_method !== undefined) patch.payment_method = enumVal(body.payment_method, VALID_PAYMENT_METHODS, 'auto');
      if (Object.keys(patch).length === 0) return ok({ success: true });
      const { error: e } = await supabase
        .from('clients')
        .update(patch)
        .eq('id', id).eq('user_id', userId);
      if (e) return err(500, e.message);
      syncClientSubscriptionLedger(userId).catch((err) => console.error('[SyncLedger]', err));
      await logActivity(userId, 'client', 'updated', `更新客户：${body.name || '未命名客户'}`, '客户信息已更新', id);
      return ok({ success: true });
    }
    if (method === 'DELETE') {
      const { data: prev } = await supabase.from('clients').select('name, company_name').eq('id', id).eq('user_id', userId).single();

      // Fix Bug 1: Clean up related records before soft-deleting the client
      const clientCompanyName = prev?.company_name || prev?.name || '';

      // Unlink tasks by client_id (reliable), fallback to name match for legacy data
      await supabase.from('tasks').update({ client: '', client_id: null }).eq('client_id', id).eq('user_id', userId);
      await supabase.from('tasks').update({ client: '' }).eq('client', clientCompanyName).is('client_id', null).eq('user_id', userId);

      // Unlink finance transactions - set client_id to null but preserve client_name for display
      await supabase.from('finance_transactions').update({ client_id: null, client_name: clientCompanyName || prev?.name || '' }).eq('client_id', id).eq('user_id', userId);

      // Soft-delete payment milestones and projects
      await supabase.from('payment_milestones').update({ soft_deleted: true }).eq('client_id', id).eq('user_id', userId);
      await supabase.from('client_projects').update({ soft_deleted: true }).eq('client_id', id).eq('user_id', userId);

      // Soft-delete the client
      const { error: delErr } = await supabase.from('clients').update({ soft_deleted: true }).eq('id', id).eq('user_id', userId);
      if (delErr) return err(500, delErr.message);
      syncClientSubscriptionLedger(userId).catch((err) => console.error('[SyncLedger]', err));
      await logActivity(userId, 'client', 'deleted', `删除客户：${prev?.name || '未命名客户'}`, '', id);
      return ok({ success: true });
    }
  }

  // ── CLIENT PROJECTS ──────────────────────────────────────────
  const projectListMatch = path.match(/^\/api\/clients\/(\d+)\/projects$/);
  if (projectListMatch) {
    const clientId = Number(projectListMatch[1]);
    if (method === 'GET') {
      const { data, error: e } = await supabase
        .from('client_projects')
        .select('id, client_id, name, description, status, total_fee, sort_order, created_at, updated_at')
        .eq('user_id', userId)
        .eq('client_id', clientId)
        .eq('soft_deleted', false)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });
      if (e) return err(500, e.message);
      return ok(data || []);
    }
    if (method === 'POST') {
      const { data, error: e } = await supabase
        .from('client_projects')
        .insert({
          user_id: userId,
          client_id: clientId,
          name: str(body.name, 255) || 'New Project',
          project_fee: body.project_fee || 0,
          project_start_date: str(body.project_start_date, 10),
          project_end_date: str(body.project_end_date, 10),
          status: 'active',
          tax_mode: enumVal(body.tax_mode, VALID_TAX_MODES, 'none'),
          tax_rate: body.tax_rate || 0,
          note: str(body.note, 2000),
        })
        .select('id')
        .single();
      if (e || !data) return err(500, e?.message || 'Insert failed');
      await logActivity(userId, 'project', 'created', `New project: ${body.name || 'New Project'}`, '', data.id);
      return ok({ id: data.id });
    }
  }

  const projectMatch = path.match(/^\/api\/projects\/(\d+)$/);
  if (projectMatch) {
    const id = Number(projectMatch[1]);
    if (method === 'PUT') {
      const patch: Record<string, unknown> = {};
      if (body.name !== undefined) patch.name = str(body.name, 255);
      if (body.project_fee !== undefined) patch.project_fee = body.project_fee || 0;
      if (body.project_start_date !== undefined) patch.project_start_date = str(body.project_start_date, 10);
      if (body.project_end_date !== undefined) patch.project_end_date = str(body.project_end_date, 10);
      if (body.status !== undefined) patch.status = enumVal(body.status, VALID_PROJECT_STATUSES, 'active');
      if (body.tax_mode !== undefined) patch.tax_mode = enumVal(body.tax_mode, VALID_TAX_MODES, 'none');
      if (body.tax_rate !== undefined) patch.tax_rate = body.tax_rate || 0;
      if (body.note !== undefined) patch.note = str(body.note, 2000);
      if (body.sort_order !== undefined) patch.sort_order = body.sort_order;
      if (Object.keys(patch).length === 0) return ok({ success: true });
      await supabase.from('client_projects').update(patch).eq('id', id).eq('user_id', userId);
      return ok({ success: true });
    }
    if (method === 'DELETE') {
      // Soft-delete project + its milestones + linked finance txs
      await supabase.from('payment_milestones').update({ soft_deleted: true }).eq('project_id', id).eq('user_id', userId);
      await supabase.from('client_projects').update({ soft_deleted: true }).eq('id', id).eq('user_id', userId);
      return ok({ success: true });
    }
  }

  // ── PAYMENT MILESTONES ────────────────────────────────────────
  const milestoneListMatch = path.match(/^\/api\/clients\/(\d+)\/milestones$/);
  if (milestoneListMatch) {
    const clientId = Number(milestoneListMatch[1]);
    if (method === 'GET') {
      const today = todayDateKey();
      const { data, error: e } = await supabase
        .from('payment_milestones')
        .select('id, client_id, label, amount, percentage, due_date, status, finance_tx_id, sort_order, paid_date, payment_method, created_at')
        .eq('user_id', userId)
        .eq('client_id', clientId)
        .eq('soft_deleted', false)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (e) return err(500, e.message);
      // Mark overdue milestones
      const rows = (data || []).map((m: MilestoneRow) => ({
        ...m,
        status: m.status === 'pending' && m.due_date && m.due_date < today ? 'overdue' : m.status,
      }));
      return ok(rows);
    }
    if (method === 'POST') {
      const { label, amount, percentage, due_date, payment_method, invoice_number, note, sort_order, project_id } = body;
      const insertData: Record<string, unknown> = {
          user_id: userId,
          client_id: clientId,
          label: str(label, 255), amount: amount || 0, percentage: percentage || 0,
          due_date: str(due_date, 10), payment_method: str(payment_method, 50),
          invoice_number: str(invoice_number, 100), note: str(note, 1000),
          sort_order: sort_order ?? 0, status: 'pending',
      };
      if (project_id) insertData.project_id = project_id;
      const { data, error: e } = await supabase
        .from('payment_milestones')
        .insert(insertData)
        .select('id')
        .single();
      if (e || !data) return err(500, e?.message || 'Insert failed');
      // Get client info for finance transaction
      const { data: client } = await supabase.from('clients').select('name, company_name, tax_mode, tax_rate').eq('id', clientId).single();
      const cName = client?.company_name || client?.name || '';
      const txAmt = Number(amount || 0);
      // If project_id is provided, get tax from project; else fallback to client
      let tm = client?.tax_mode || 'none';
      let tr = Number(client?.tax_rate || 0);
      if (project_id) {
        const { data: proj } = await supabase.from('client_projects').select('tax_mode, tax_rate').eq('id', project_id).single();
        if (proj) { tm = proj.tax_mode || 'none'; tr = Number(proj.tax_rate || 0); }
      }
      // Auto-create receivable finance transaction (with rollback on failure)
      if (txAmt > 0) {
        const { data: tx, error: txErr } = await supabase.from('finance_transactions').insert({
          user_id: userId, type: 'income', source: 'milestone', source_id: data.id,
          amount: txAmt, category: '项目收入',
          description: `${cName} · ${label || '项目付款'}`,
          date: due_date || '', status: '待收款 (应收)',
          client_id: clientId, client_name: cName,
          tax_mode: tm, tax_rate: tr, tax_amount: calcTax(txAmt, tm, tr),
          project_id: project_id || null,
        }).select('id').single();
        if (txErr) {
          // Rollback: delete the milestone we just created
          console.warn('[supabase-api] Finance tx failed, rolling back milestone', txErr);
          await supabase.from('payment_milestones').update({ soft_deleted: true }).eq('id', data.id).eq('user_id', userId);
          return err(500, `创建财务记录失败: ${txErr.message}`);
        }
        // Link milestone to finance transaction
        if (tx) await supabase.from('payment_milestones').update({ finance_tx_id: tx.id }).eq('id', data.id).eq('user_id', userId);
      }
      await logActivity(userId, 'milestone', 'created',
        `新增付款节点：${cName} · ${label || ''}`,
        amount ? `$${Number(amount).toLocaleString()}` : '', data.id);
      return ok({ id: data.id });
    }
  }

  const milestoneMatch = path.match(/^\/api\/milestones\/(\d+)$/);
  if (milestoneMatch) {
    const id = Number(milestoneMatch[1]);
    if (method === 'PUT') {
      const { label, amount, percentage, due_date, payment_method, status, invoice_number, note, sort_order } = body;
      // Partial update — only include provided fields to avoid wiping invoice_number/payment_method/sort_order
      const msPatch: Record<string, unknown> = {};
      if (body.label !== undefined) msPatch.label = str(body.label, 255);
      if (body.amount !== undefined) msPatch.amount = body.amount || 0;
      if (body.percentage !== undefined) msPatch.percentage = body.percentage || 0;
      if (body.due_date !== undefined) msPatch.due_date = str(body.due_date, 10);
      if (body.payment_method !== undefined) msPatch.payment_method = str(body.payment_method, 50);
      if (body.status !== undefined) msPatch.status = enumVal(body.status, VALID_MS_STATUSES, 'pending');
      if (body.invoice_number !== undefined) msPatch.invoice_number = str(body.invoice_number, 100);
      if (body.note !== undefined) msPatch.note = str(body.note, 1000);
      if (body.paid_date !== undefined) msPatch.paid_date = str(body.paid_date, 16);
      if (body.sort_order !== undefined) msPatch.sort_order = body.sort_order ?? 0;
      if (body.project_id !== undefined) msPatch.project_id = body.project_id;
      if (Object.keys(msPatch).length === 0) return ok({ success: true });
      const { error: e } = await supabase
        .from('payment_milestones')
        .update(msPatch)
        .eq('id', id).eq('user_id', userId);
      if (e) return err(500, e.message);
      // Cascade paid_date / amount changes to linked finance transaction
      if (body.paid_date !== undefined || body.amount !== undefined) {
        const { data: msRow } = await supabase.from('payment_milestones').select('finance_tx_id').eq('id', id).eq('user_id', userId).single();
        if (msRow?.finance_tx_id) {
          const txPatch: Record<string, unknown> = {};
          if (body.paid_date !== undefined) txPatch.date = str(body.paid_date, 16);
          if (body.amount !== undefined) {
            const newAmt = Number(body.amount) || 0;
            txPatch.amount = newAmt;
            // Recalculate tax from the linked finance_transaction's own tax_mode/tax_rate
            const { data: ftx } = await supabase.from('finance_transactions').select('tax_mode, tax_rate').eq('id', Number(msRow.finance_tx_id)).eq('user_id', userId).single();
            if (ftx) {
              txPatch.tax_amount = calcTax(newAmt, ftx.tax_mode || 'none', Number(ftx.tax_rate || 0));
            }
          }
          await supabase.from('finance_transactions').update(txPatch).eq('id', Number(msRow.finance_tx_id)).eq('user_id', userId);
        }
      }
      return ok({ success: true });
    }
    if (method === 'DELETE') {
      const { data: prev } = await supabase.from('payment_milestones').select('label, client_id, finance_tx_id').eq('id', id).eq('user_id', userId).single();
      await supabase.from('payment_milestones').update({ soft_deleted: true }).eq('id', id).eq('user_id', userId);
      // Also soft-delete linked finance transaction if exists
      if (prev?.finance_tx_id) {
        await supabase.from('finance_transactions').update({ soft_deleted: true }).eq('id', Number(prev.finance_tx_id)).eq('user_id', userId);
      }
      await logActivity(userId, 'milestone', 'deleted', `删除付款节点：${prev?.label || ''}`, '', id);
      return ok({ success: true });
    }
  }

  const markPaidMatch = path.match(/^\/api\/milestones\/(\d+)\/mark-paid$/);
  if (markPaidMatch && method === 'POST') {
    const id = Number(markPaidMatch[1]);
    const { payment_method, paid_date } = body || {};
    const actualDate = paid_date || todayDateKey();

    const { data: milestone } = await supabase.from('payment_milestones').select('id, client_id, project_id, label, amount, percentage, due_date, status, finance_tx_id, sort_order, paid_date, payment_method').eq('id', id).eq('user_id', userId).single();
    if (!milestone) return err(404, 'Milestone not found');

    // Fix Bug 2: Check idempotency - if milestone is already marked as paid, return early
    if (milestone.status === 'paid') {
      return ok({ success: true, financeId: milestone.finance_tx_id, alreadyPaid: true });
    }

    const { data: client } = await supabase.from('clients').select('name, company_name, tax_mode, tax_rate').eq('id', milestone.client_id).single();
    const clientName = client?.company_name || client?.name || '';

    // If milestone already has a linked finance transaction, UPDATE it
    if (milestone.finance_tx_id) {
      await supabase.from('finance_transactions').update({
        status: '已完成', date: actualDate,
      }).eq('id', Number(milestone.finance_tx_id)).eq('user_id', userId);
    } else {
      // Create new transaction (for milestones created before the refactor)
      const txAmount = Number(milestone.amount || 0);
      let tm = client?.tax_mode || 'none';
      let tr = Number(client?.tax_rate || 0);
      // Prefer project-level tax settings if milestone belongs to a project
      if (milestone.project_id) {
        const { data: proj } = await supabase.from('client_projects').select('tax_mode, tax_rate').eq('id', milestone.project_id).single();
        if (proj) { tm = proj.tax_mode || tm; tr = Number(proj.tax_rate || 0) || tr; }
      }
      const { data: tx, error: txErr } = await supabase.from('finance_transactions').insert({
        user_id: userId, type: 'income', source: 'milestone', source_id: id,
        amount: txAmount, category: '项目收入',
        description: `${clientName} · ${milestone.label || '项目付款'}`,
        date: actualDate, status: '已完成',
        client_id: milestone.client_id, client_name: clientName,
        tax_mode: tm, tax_rate: tr, tax_amount: calcTax(txAmount, tm, tr),
      }).select('id').single();
      if (txErr) {
        console.warn('[supabase-api] Mark-paid finance tx failed', txErr);
        return err(500, `创建收款记录失败: ${txErr.message}`);
      }
      if (tx) await supabase.from('payment_milestones').update({ finance_tx_id: tx.id }).eq('id', id).eq('user_id', userId);
    }

    // Update milestone status
    await supabase.from('payment_milestones').update({
      status: 'paid', paid_date: actualDate,
      payment_method: payment_method || milestone.payment_method || '',
    }).eq('id', id).eq('user_id', userId);

    await logActivity(userId, 'milestone', 'paid',
      `确认收款：${clientName} · ${milestone.label || '项目付款'}`,
      `$${Number(milestone.amount || 0).toLocaleString()} · ${payment_method || ''}`, id);

    return ok({ success: true, financeId: milestone.finance_tx_id });
  }

  // ── Undo mark-paid ──
  const undoPaidMatch = path.match(/^\/api\/milestones\/(\d+)\/undo-paid$/);
  if (undoPaidMatch && method === 'POST') {
    const id = Number(undoPaidMatch[1]);
    const { data: milestone } = await supabase.from('payment_milestones').select('id, client_id, label, amount, status, finance_tx_id').eq('id', id).eq('user_id', userId).single();
    if (!milestone) return err(404, 'Milestone not found');
    // Idempotency: already pending, nothing to undo
    if (milestone.status === 'pending') return ok({ success: true, alreadyPending: true });
    // Delete linked finance transaction
    if (milestone.finance_tx_id) {
      await supabase.from('finance_transactions').update({ soft_deleted: true }).eq('id', Number(milestone.finance_tx_id)).eq('user_id', userId);
    }
    // Reset milestone to pending
    await supabase.from('payment_milestones').update({
      status: 'pending', paid_date: '', payment_method: '', finance_tx_id: null,
    }).eq('id', id).eq('user_id', userId);
    const { data: client } = await supabase.from('clients').select('name, company_name').eq('id', milestone.client_id).single();
    await logActivity(userId, 'milestone', 'undo_paid',
      `撤销收款：${client?.company_name || client?.name || ''} · ${milestone.label || ''}`,
      `$${Number(milestone.amount || 0).toLocaleString()}`, id);
    return ok({ success: true });
  }

  // ── TASKS ──────────────────────────────────────────────────────
  if (path === '/api/tasks' && method === 'GET') {
    const { data } = await supabase
      .from('tasks')
      .select('id, title, client, client_id, priority, due, column, scope, parent_id, originalRequest, aiBreakdown, aiMjPrompts, aiStory, created_at, updated_at')
      .eq('user_id', userId)
      .eq('soft_deleted', false)
      .order('created_at', { ascending: false });
    return ok(data || []);
  }

  if (path === '/api/tasks' && method === 'POST') {
    const { title, client, client_id, priority, due, column, originalRequest, aiBreakdown, aiMjPrompts, aiStory, scope, parent_id } = body;
    const { data, error: e } = await supabase
      .from('tasks')
      .insert({
        user_id: userId,
        title: str(title, 500), client: str(client, 255), client_id: client_id || null,
        priority: enumVal(priority, VALID_TASK_PRIORITIES, 'Medium'),
        due: str(due, 16), column: enumVal(column, VALID_TASK_COLUMNS, 'todo'),
        originalRequest: str(originalRequest, 5000), aiBreakdown: str(aiBreakdown, 10000),
        aiMjPrompts: str(aiMjPrompts, 5000), aiStory: str(aiStory, 5000),
        scope: enumVal(scope, VALID_TASK_SCOPES, 'work'), parent_id: parent_id || null,
      })
      .select('id')
      .single();
    if (e || !data) return err(500, e?.message || 'Insert failed');
    await logActivity(userId, 'task', 'created', `新增任务：${title || '未命名任务'}`, client ? `客户：${client}` : '', data.id);
    return ok({ id: data.id });
  }

  const taskMatch = path.match(/^\/api\/tasks\/(\d+)$/);
  if (taskMatch) {
    const id = Number(taskMatch[1]);
    if (method === 'PUT') {
      // Build partial update — only include fields explicitly provided to avoid wiping data
      const patch: Record<string, unknown> = {};
      if (body.title !== undefined) patch.title = str(body.title, 500);
      if (body.client !== undefined) patch.client = str(body.client, 255);
      if (body.client_id !== undefined) patch.client_id = body.client_id || null;
      if (body.priority !== undefined) patch.priority = enumVal(body.priority, VALID_TASK_PRIORITIES, 'Medium');
      if (body.due !== undefined) patch.due = str(body.due, 16);
      if (body.column !== undefined) patch.column = enumVal(body.column, VALID_TASK_COLUMNS, 'todo');
      if (body.originalRequest !== undefined) patch.originalRequest = str(body.originalRequest, 5000);
      if (body.aiBreakdown !== undefined) patch.aiBreakdown = str(body.aiBreakdown, 10000);
      if (body.aiMjPrompts !== undefined) patch.aiMjPrompts = str(body.aiMjPrompts, 5000);
      if (body.aiStory !== undefined) patch.aiStory = str(body.aiStory, 5000);
      if (body.scope !== undefined) patch.scope = enumVal(body.scope, VALID_TASK_SCOPES, 'work');
      if (body.parent_id !== undefined) patch.parent_id = body.parent_id || null;
      if (Object.keys(patch).length === 0) return ok({ success: true });
      const { error: e } = await supabase
        .from('tasks')
        .update(patch)
        .eq('id', id).eq('user_id', userId);
      if (e) return err(500, e.message);
      await logActivity(userId, 'task', 'updated', `更新任务：${body.title || '未命名任务'}`, '', id);
      return ok({ success: true });
    }
    if (method === 'DELETE') {
      const { data: prev } = await supabase.from('tasks').select('title').eq('id', id).eq('user_id', userId).single();
      const { error: delErr } = await supabase.from('tasks').update({ soft_deleted: true }).eq('id', id).eq('user_id', userId);
      if (delErr) return err(500, delErr.message);
      // Also delete subtasks if this is a parent task
      await supabase.from('tasks').update({ soft_deleted: true }).eq('parent_id', id).eq('user_id', userId);
      await logActivity(userId, 'task', 'deleted', `删除任务：${prev?.title || '未命名任务'}`, '', id);
      return ok({ success: true });
    }
  }

  // ── PLANS ──────────────────────────────────────────────────────
  if (path === '/api/plans' && method === 'GET') {
    const { data: planClientCounts } = await supabase
      .from('clients')
      .select('plan_tier')
      .eq('user_id', userId)
      .eq('status', 'Active')
      .eq('soft_deleted', false);
    const countMap = new Map<string, number>();
    for (const r of (planClientCounts || [])) {
      countMap.set(r.plan_tier || '', (countMap.get(r.plan_tier || '') || 0) + 1);
    }

    const aliases: Record<string, string[]> = {
      '基础版': ['基础版', 'Basic', 'basic'],
      '专业版': ['专业版', 'Pro', 'pro', 'Professional', 'professional'],
      '企业版': ['企业版', 'Enterprise', 'enterprise'],
    };

    const { data: plans } = await supabase
      .from('plans')
      .select('id, name, price, deliverySpeed, features, created_at, updated_at')
      .eq('user_id', userId)
      .eq('soft_deleted', false);
    const rows = (plans || []).map((p) => {
      const al = aliases[p.name as string] || [p.name];
      const clients = al.reduce((s, a) => s + (countMap.get(a) || 0), 0);
      let features: unknown;
      try { features = JSON.parse(p.features as string); } catch { features = []; }
      return { ...p, features, clients };
    });
    return ok(rows);
  }

  if (path === '/api/plans' && method === 'POST') {
    const { name, price, deliverySpeed, features, clients } = body;
    const { data, error: e } = await supabase
      .from('plans')
      .insert({
        user_id: userId,
        name: name || '', price: price || 0, deliverySpeed: deliverySpeed || '',
        features: JSON.stringify(features || []), clients: clients || 0,
      })
      .select('id')
      .single();
    if (e || !data) return err(500, e?.message || 'Insert failed');
    await logActivity(userId, 'plan', 'created', `新增方案：${name || '未命名方案'}`, price ? `价格：$${price}/月` : '', data.id);
    return ok({ id: data.id });
  }

  const planMatch = path.match(/^\/api\/plans\/(\d+)$/);
  if (planMatch) {
    const id = Number(planMatch[1]);
    if (method === 'PUT') {
      const patch: Record<string, unknown> = {};
      if (body.name !== undefined) patch.name = body.name || '';
      if (body.price !== undefined) patch.price = body.price || 0;
      if (body.deliverySpeed !== undefined) patch.deliverySpeed = body.deliverySpeed || '';
      if (body.features !== undefined) patch.features = JSON.stringify(body.features || []);
      if (body.clients !== undefined) patch.clients = body.clients || 0;
      if (Object.keys(patch).length === 0) return ok({ success: true });
      const { error: e } = await supabase
        .from('plans')
        .update(patch)
        .eq('id', id).eq('user_id', userId);
      if (e) return err(500, e.message);
      await logActivity(userId, 'plan', 'updated', `更新方案：${body.name || '未命名方案'}`, '', id);
      return ok({ success: true });
    }
    if (method === 'DELETE') {
      const { data: prev } = await supabase.from('plans').select('name').eq('id', id).eq('user_id', userId).single();
      await supabase.from('plans').update({ soft_deleted: true }).eq('id', id).eq('user_id', userId);
      await logActivity(userId, 'plan', 'deleted', `删除方案：${prev?.name || '未命名方案'}`, '', id);
      return ok({ success: true });
    }
  }

  // ── FINANCE ────────────────────────────────────────────────────
  if (path === '/api/finance' && method === 'GET') {
    // Single table query — no more virtual rows!
    const { data, error: e } = await supabase
      .from('finance_transactions')
      .select('id, type, amount, category, description, date, status, source, source_id, tax_mode, tax_rate, tax_amount, client_id, client_name, created_at, updated_at')
      .eq('user_id', userId)
      .eq('soft_deleted', false)
      .order('date', { ascending: false });
    if (e) return err(500, e.message);
    return ok(data || []);
  }

  if (path === '/api/finance/report' && method === 'GET') {
    // Fetch all transactions with optimized queries
    const [
      { data: completedIncomeRows },
      { data: completedExpenseRows },
      { data: receivablesRows },
      { data: payablesRows },
      { data: taxableRows },
      { data: recentRows },
    ] = await Promise.all([
      supabase.from('finance_transactions').select('amount').eq('user_id', userId).eq('type', 'income').eq('status', '已完成').eq('soft_deleted', false),
      supabase.from('finance_transactions').select('amount').eq('user_id', userId).eq('type', 'expense').eq('status', '已完成').eq('soft_deleted', false),
      supabase.from('finance_transactions').select('amount').eq('user_id', userId).eq('soft_deleted', false).eq('status', '待收款 (应收)'),
      supabase.from('finance_transactions').select('amount').eq('user_id', userId).eq('soft_deleted', false).eq('status', '待支付 (应付)'),
      supabase.from('finance_transactions').select('amount, tax_amount').eq('user_id', userId).eq('status', '已完成').eq('soft_deleted', false).gt('tax_amount', 0),
      supabase.from('finance_transactions').select('id, type, amount, category, description, date, status, source, source_id, tax_mode, tax_rate, tax_amount, client_id').eq('user_id', userId).eq('soft_deleted', false).order('date', { ascending: false }).limit(50),
    ]);
    const completedIncome = (completedIncomeRows || []).reduce((s: number, r: AmountRow) => s + Number(r.amount || 0), 0);
    const completedExpense = (completedExpenseRows || []).reduce((s: number, r: AmountRow) => s + Number(r.amount || 0), 0);
    const receivables = (receivablesRows || []).reduce((s: number, r: AmountRow) => s + Number(r.amount || 0), 0);
    const payables = (payablesRows || []).reduce((s: number, r: AmountRow) => s + Number(r.amount || 0), 0);
    const totalTax = (taxableRows || []).reduce((s: number, r: TaxAmountRow) => s + Number(r.tax_amount || 0), 0);
    const rows = (recentRows || []).map((t: FinanceTransactionRow) => { const taxInfo = Number(t.tax_amount || 0) > 0 ? ` (税$${Number(t.tax_amount).toLocaleString()})` : ''; return `<tr><td>${t.date || ''}</td><td>${t.description || ''}</td><td>${t.category || ''}</td><td>${t.type === 'income' ? '+' : '-'}$${Number(t.amount || 0).toLocaleString()}${taxInfo}</td><td>${t.status || '已完成'}</td></tr>`; }).join('');
    const html = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"/><title>一人CEO - 财务月度报表</title><style>body{font-family:-apple-system,sans-serif;padding:32px;color:#18181b}h1{font-size:28px;margin:0 0 8px}p{color:#71717a;margin:0 0 24px}.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:24px}.card{border:1px solid #e4e4e7;border-radius:16px;padding:16px}.label{font-size:12px;color:#71717a;margin-bottom:8px}.value{font-size:24px;font-weight:700}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px 12px;border-bottom:1px solid #e4e4e7;font-size:12px}th{background:#f4f4f5;color:#52525b}</style></head><body><h1>财务月度报表</h1><p>一人CEO · 导出时间 ${new Date().toLocaleString('zh-CN')}</p><div class="grid"><div class="card"><div class="label">已完成收入</div><div class="value">$${completedIncome.toLocaleString()}</div></div><div class="card"><div class="label">已完成支出</div><div class="value">$${completedExpense.toLocaleString()}</div></div><div class="card"><div class="label">净利润</div><div class="value">$${(completedIncome - completedExpense).toLocaleString()}</div></div><div class="card"><div class="label">应收 / 应付</div><div class="value">$${receivables.toLocaleString()} / $${payables.toLocaleString()}</div></div><div class="card"><div class="label">税费合计</div><div class="value">$${totalTax.toLocaleString()}</div></div></div><table><thead><tr><th>日期</th><th>描述</th><th>分类</th><th>金额</th><th>状态</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
    return { status: 200, data: html };
  }

  if (path === '/api/finance' && method === 'POST') {
    const { type, amount, category, description, date, status, tax_mode, tax_rate, tax_amount, client_id, client_name } = body;
    const { data, error: e } = await supabase
      .from('finance_transactions')
      .insert({
        user_id: userId,
        type: enumVal(type, VALID_TX_TYPES, 'income'), amount: amount || 0, category: str(category, 100),
        description: str(description, 500), date: str(date, 10), status: enumVal(status, VALID_TX_STATUSES, '已完成'),
        tax_mode: enumVal(tax_mode, VALID_TAX_MODES, 'none'), tax_rate: tax_rate || 0, tax_amount: tax_amount || 0,
        client_id: client_id || null, client_name: str(client_name, 255),
        source: body.source || 'manual', source_id: body.source_id || null,
      })
      .select('id')
      .single();
    if (e || !data) return err(500, e?.message || 'Insert failed');
    await logActivity(userId, 'finance', 'created', `新增交易：${str(description, 500) || '未命名交易'}`,
      `${type === 'income' ? '+' : '-'}$${Number(amount || 0).toLocaleString()} · ${category || '未分类'}`, data.id);
    return ok({ id: data.id });
  }

  // ── Confirm receipt for subscription transactions ──
  const confirmReceiptMatch = path.match(/^\/api\/finance\/(\d+)\/confirm-receipt$/);
  if (confirmReceiptMatch && method === 'POST') {
    const id = Number(confirmReceiptMatch[1]);
    const { data: txRow } = await supabase.from('finance_transactions').select('source, status, description').eq('id', id).eq('user_id', userId).single();
    if (!txRow) return err(404, 'Transaction not found');
    if (txRow.source !== 'subscription') return err(400, 'Only subscription transactions can use confirm-receipt');
    if (txRow.status === '已完成') return err(400, 'Already confirmed');
    const { error: e } = await supabase.from('finance_transactions').update({ status: '已完成' }).eq('id', id).eq('user_id', userId);
    if (e) return err(500, e.message);
    await logActivity(userId, 'finance', 'updated', `确认收款：${txRow.description || '未命名交易'}`, '', id);
    return ok({ success: true });
  }

  // ── Undo receipt for subscription transactions ──
  const undoReceiptMatch = path.match(/^\/api\/finance\/(\d+)\/undo-receipt$/);
  if (undoReceiptMatch && method === 'POST') {
    const id = Number(undoReceiptMatch[1]);
    const { data: txRow } = await supabase.from('finance_transactions').select('source, status, description').eq('id', id).eq('user_id', userId).single();
    if (!txRow) return err(404, 'Transaction not found');
    if (txRow.source !== 'subscription') return err(400, 'Only subscription transactions can use undo-receipt');
    if (txRow.status !== '已完成') return err(400, 'Not yet confirmed');
    const { error: e } = await supabase.from('finance_transactions').update({ status: '待收款 (应收)' }).eq('id', id).eq('user_id', userId);
    if (e) return err(500, e.message);
    await logActivity(userId, 'finance', 'updated', `撤销收款确认：${txRow.description || '未命名交易'}`, '', id);
    return ok({ success: true });
  }

  const financeMatch = path.match(/^\/api\/finance\/(\d+)$/);
  if (financeMatch) {
    const id = Number(financeMatch[1]);
    // Check source — only manual transactions can be edited/deleted
    const { data: txRow } = await supabase.from('finance_transactions').select('source, description').eq('id', id).eq('user_id', userId).single();
    if (!txRow) return err(404, 'Transaction not found');
    const src = txRow.source || 'manual';
    if (src === 'subscription') return err(400, '订阅流水由客户状态自动生成，请在客户管理中编辑');
    if (src === 'milestone') return err(400, '此交易由里程碑自动生成，请前往签约客户中修改');
    if (src === 'project_fee') return err(400, '项目总费待收款，请在客户管理中编辑');

    if (method === 'PUT') {
      const patch: Record<string, unknown> = {};
      if (body.type !== undefined) patch.type = enumVal(body.type, VALID_TX_TYPES, 'income');
      if (body.amount !== undefined) patch.amount = body.amount || 0;
      if (body.category !== undefined) patch.category = str(body.category, 100);
      if (body.description !== undefined) patch.description = str(body.description, 500);
      if (body.date !== undefined) patch.date = str(body.date, 10);
      if (body.status !== undefined) patch.status = enumVal(body.status, VALID_TX_STATUSES, '已完成');
      if (body.tax_mode !== undefined) patch.tax_mode = enumVal(body.tax_mode, VALID_TAX_MODES, 'none');
      if (body.tax_rate !== undefined) patch.tax_rate = body.tax_rate || 0;
      if (body.tax_amount !== undefined) patch.tax_amount = body.tax_amount || 0;
      if (body.client_id !== undefined) patch.client_id = body.client_id || null;
      if (body.client_name !== undefined) patch.client_name = str(body.client_name, 255);
      if (Object.keys(patch).length === 0) return ok({ success: true });
      const { error: e } = await supabase
        .from('finance_transactions')
        .update(patch)
        .eq('id', id).eq('user_id', userId);
      if (e) return err(500, e.message);
      await logActivity(userId, 'finance', 'updated', `更新交易：${body.description || txRow.description || '未命名交易'}`, '', id);
      return ok({ success: true });
    }
    if (method === 'DELETE') {
      const { error: delErr } = await supabase.from('finance_transactions').update({ soft_deleted: true }).eq('id', id).eq('user_id', userId);
      if (delErr) return err(500, delErr.message);
      await logActivity(userId, 'finance', 'deleted', `删除交易：${txRow.description || '未命名交易'}`, '', id);
      return ok({ success: true });
    }
  }

  // ── CONTENT DRAFTS ─────────────────────────────────────────────
  if (path === '/api/content-drafts' && method === 'GET') {
    const { data } = await supabase
      .from('content_drafts')
      .select('id, topic, platform, language, content, created_at, updated_at')
      .eq('user_id', userId)
      .eq('soft_deleted', false)
      .order('updated_at', { ascending: false })
      .limit(20);
    return ok(data || []);
  }

  if (path === '/api/content-drafts' && method === 'POST') {
    const { id, topic, platform, language, content } = body;
    if (id) {
      const { error: e } = await supabase
        .from('content_drafts')
        .update({ topic: str(topic, 255) || '', platform: str(platform, 50) || '', language: str(language, 10) || 'zh', content: content || '' })
        .eq('id', Number(id)).eq('user_id', userId).eq('soft_deleted', false);
      if (e) return err(500, e.message);
      await logActivity(userId, 'content', 'updated', `更新草稿：${topic || '未命名草稿'}`, platform ? `平台：${platform}` : '', String(id));
      return ok({ id, success: true });
    }
    const { data, error: e } = await supabase
      .from('content_drafts')
      .insert({
        user_id: userId,
        topic: str(topic, 255) || '', platform: str(platform, 50) || '', language: str(language, 10) || 'zh', content: content || '',
      })
      .select('id')
      .single();
    if (e || !data) return err(500, e?.message || 'Insert failed');
    await logActivity(userId, 'content', 'created', `保存草稿：${topic || '未命名草稿'}`, platform ? `平台：${platform}` : '', data.id);
    return ok({ id: data.id, success: true });
  }

  const contentMatch = path.match(/^\/api\/content-drafts\/(\d+)$/);
  if (contentMatch && method === 'DELETE') {
    const id = Number(contentMatch[1]);
    const { data: prev } = await supabase.from('content_drafts').select('topic').eq('id', id).eq('user_id', userId).single();
    await supabase.from('content_drafts').update({ soft_deleted: true }).eq('id', id).eq('user_id', userId);
    await logActivity(userId, 'content', 'deleted', `删除草稿：${prev?.topic || '未命名草稿'}`, '', id);
    return ok({ success: true });
  }

  // ── TODAY FOCUS ────────────────────────────────────────────────
  if (path === '/api/today-focus/state' && method === 'POST') {
    const { focusKey, status } = body || {};
    if (!focusKey) return err(400, 'focusKey is required');
    const norm = status === 'completed' ? 'completed' : 'pending';
    const focusDate = todayDateKey();
    const { error: ue } = await supabase
      .from('today_focus_state')
      .upsert(
        { user_id: userId, focus_date: focusDate, focus_key: String(focusKey), status: norm },
        { onConflict: 'user_id,focus_date,focus_key' },
      );
    if (ue) return err(500, ue.message);
    return ok({ success: true, focusKey: String(focusKey), status: norm });
  }

  if (path === '/api/today-focus/manual' && method === 'POST') {
    const { type, title, note } = body || {};
    if (!title || !String(title).trim()) return err(400, 'title is required');
    const focusDate = todayDateKey();
    const { data, error: e } = await supabase
      .from('today_focus_manual')
      .insert({
        user_id: userId,
        focus_date: focusDate, type: type || '系统',
        title: String(title).trim(), note: String(note || '').trim(),
      })
      .select('id')
      .single();
    if (e || !data) return err(500, e?.message || 'Insert failed');
    const focusKey = `manual-${data.id}`;
    const { error: ue2 } = await supabase
      .from('today_focus_state')
      .upsert(
        { user_id: userId, focus_date: focusDate, focus_key: focusKey, status: 'pending' },
        { onConflict: 'user_id,focus_date,focus_key' },
      );
    if (ue2) return err(500, ue2.message);
    await logActivity(userId, 'today_focus', 'manual_created', `记录今日事件：${String(title).trim()}`, type ? `类型：${type}` : '', data.id);
    return ok({ success: true, id: data.id, focusKey });
  }

  const manualMatch = path.match(/^\/api\/today-focus\/manual\/(\d+)$/);
  if (manualMatch) {
    const id = Number(manualMatch[1]);
    if (method === 'PUT') {
      const patch: Record<string, unknown> = {};
      if (body.type !== undefined) patch.type = body.type;
      if (body.title !== undefined) patch.title = String(body.title).trim();
      if (body.note !== undefined) patch.note = String(body.note || '').trim();
      if (Object.keys(patch).length === 0) return ok({ success: true });
      const { error: e } = await supabase
        .from('today_focus_manual')
        .update(patch)
        .eq('id', id).eq('user_id', userId).eq('soft_deleted', false);
      if (e) return err(500, e.message);
      await logActivity(userId, 'today_focus', 'manual_updated', `更新今日事件：${patch.title || ''}`, '', id);
      return ok({ success: true, id });
    }
    if (method === 'DELETE') {
      const { data: prev } = await supabase.from('today_focus_manual').select('title').eq('id', id).eq('user_id', userId).single();
      if (!prev) return err(404, 'manual event not found');
      await supabase.from('today_focus_manual').update({ soft_deleted: true }).eq('id', id).eq('user_id', userId);
      await supabase
        .from('today_focus_state')
        .delete()
        .eq('user_id', userId)
        .eq('focus_date', todayDateKey())
        .eq('focus_key', `manual-${id}`);
      await logActivity(userId, 'today_focus', 'manual_deleted', `删除今日事件：${prev?.title || '未命名事件'}`, '', id);
      return ok({ success: true });
    }
  }

  // ── DASHBOARD ──────────────────────────────────────────────────
  if (path === '/api/dashboard' && method === 'GET') {
    // All queries run in PARALLEL — no serial waterfall
    const focusDate = todayDateKey();
    const currentYear = new Date().getFullYear();

    // Merged queries: 7 parallel instead of 11 (tasks, leads, finance each merged)
    const [
      { data: activeClients },
      { data: allTasks },
      { data: allLeads },
      { data: allFinance },
      { data: recentActivityRows },
      { data: focusStates },
      { data: overdueMsArr },
      { data: manualFocusRows },
    ] = await Promise.all([
      supabase.from('clients').select('id, mrr').eq('user_id', userId).eq('status', 'Active').eq('soft_deleted', false),
      supabase.from('tasks').select('id, title, client, priority, due, column, scope, parent_id').eq('user_id', userId).eq('soft_deleted', false),
      supabase.from('leads').select('id, name, industry, needs, column').eq('user_id', userId).eq('soft_deleted', false),
      supabase.from('finance_transactions').select('id, date, amount, type, status, description, tax_amount, source').eq('user_id', userId).eq('soft_deleted', false),
      supabase.from('activity_log').select('title, detail, created_at, entity_type, action').eq('user_id', userId).order('created_at', { ascending: false }).limit(8),
      supabase.from('today_focus_state').select('focus_key, status').eq('user_id', userId).eq('focus_date', focusDate),
      supabase.from('payment_milestones').select('id, label, amount, due_date, client_id, clients(name)').eq('user_id', userId).eq('status', 'pending').eq('soft_deleted', false).not('due_date', 'is', null).lt('due_date', todayDateKey()).order('due_date', { ascending: true }).limit(1),
      supabase.from('today_focus_manual').select('id, type, title, note').eq('user_id', userId).eq('focus_date', focusDate).eq('soft_deleted', false).order('id', { ascending: false }),
    ]);

    // Derive subsets from merged queries (client-side filtering, zero network cost)
    const todayKey = todayDateKey();
    const taskData = (allTasks || []).filter((t: TaskRow) => t.column !== 'done');
    const leadData = allLeads || [];
    const ledgerSeries = (allFinance || []).filter((t: FinanceTransactionRow) => t.type === 'income' && t.status === '已完成');
    const receivablesData = (allFinance || []).filter((t: FinanceTransactionRow) =>
      (t.status || '').includes('应收') && (t.date || '') <= todayKey && t.source !== 'subscription'
    );
    const bestLeadArr = leadData.filter((l: LeadRow) => ['proposal', 'contacted', 'new'].includes(l.column)).slice(0, 4);
    const urgentTaskArr = taskData
      .filter((t: TaskRow) => t.scope !== 'personal' && t.scope !== 'work-memo')
      .sort((a: TaskRow, b: TaskRow) => {
        const aOverdue = a.due && a.due.slice(0, 10) <= todayKey ? 0 : 1;
        const bOverdue = b.due && b.due.slice(0, 10) <= todayKey ? 0 : 1;
        if (aOverdue !== bOverdue) return aOverdue - bOverdue;
        const p: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
        return (p[a.priority] ?? 1) - (p[b.priority] ?? 1);
      }).slice(0, 4);

    // ── Due Today Items — tasks + memos with due <= today ──
    function daysBetween(dateStr: string, todayStr: string): number {
      const d1 = new Date(dateStr + 'T00:00:00');
      const d2 = new Date(todayStr + 'T00:00:00');
      return Math.floor((d2.getTime() - d1.getTime()) / 86400000);
    }
    const dueWorkTasks = taskData
      .filter((t: TaskRow) => t.scope !== 'personal' && t.scope !== 'work-memo' && t.due && t.due.slice(0, 10) <= todayKey)
      .sort((a: TaskRow, b: TaskRow) => {
        const ad = a.due!.slice(0, 10), bd = b.due!.slice(0, 10);
        if (ad !== bd) return ad.localeCompare(bd);
        const p: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
        return (p[a.priority] ?? 1) - (p[b.priority] ?? 1);
      }).slice(0, 5);
    const dueMemos = taskData
      .filter((t: TaskRow) => (t.scope === 'work-memo' || t.scope === 'personal') && t.due && t.due.slice(0, 10) <= todayKey)
      .sort((a: TaskRow, b: TaskRow) => (a.due!.slice(0, 10)).localeCompare(b.due!.slice(0, 10)))
      .slice(0, 3);
    const dueTodayItems: FocusCandidate[] = [
      ...dueWorkTasks.map((t: TaskRow) => {
        const days = daysBetween(t.due!.slice(0, 10), todayKey);
        return {
          key: `due-task-${t.id}`, type: '交付',
          title: t.title || '未命名任务',
          reason: days > 0 ? `已逾期 ${days} 天` : (t.due!.length > 10 ? `今日 ${t.due!.slice(11, 16)} 截止` : '今日截止'),
          actionHint: t.client ? `客户：${t.client}` : '点击查看任务详情',
          entityType: 'task' as const, entityId: t.id, dueDate: t.due, isOverdue: days > 0, daysOverdue: days,
        };
      }),
      ...dueMemos.map((t: TaskRow) => {
        const days = daysBetween(t.due!.slice(0, 10), todayKey);
        return {
          key: `due-memo-${t.id}`, type: t.scope === 'personal' ? '个人' : '备忘',
          title: t.title || '未命名备忘',
          reason: days > 0 ? `已逾期 ${days} 天` : (t.due!.length > 10 ? `今日 ${t.due!.slice(11, 16)}` : '今日截止'),
          actionHint: '点击查看备忘详情',
          entityType: 'memo' as const, entityId: t.id, dueDate: t.due, isOverdue: days > 0, daysOverdue: days,
        };
      }),
    ];

    const clientsCount = activeClients?.length || 0;
    // Derive MRR from current month's income transactions (more accurate than static client.mrr)
    const currentMonthStr = `${currentYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    // MRR = sum of subscription clients' monthly fee (not one-time project income)
    const mrr = (activeClients || []).reduce((s: number, r: ClientMrrRow) => s + Number(r.mrr || 0), 0);
    const activeTasks = taskData?.length || 0;
    const todoCount = (taskData || []).filter((t: TaskRow) => t.column === 'todo').length;
    const inProgressCount = (taskData || []).filter((t: TaskRow) => t.column === 'inProgress').length;
    const workTasks = (taskData || []).filter((t: TaskRow) => t.scope !== 'personal' && t.column !== 'done').length;
    const personalTasks = (taskData || []).filter((t: TaskRow) => t.scope === 'personal' && t.column !== 'done' && !t.parent_id).length;
    const leadsCount = (leadData || []).length;
    const leadsNew = (leadData || []).filter((l: LeadRow) => l.column === 'new').length;
    const leadsContacted = (leadData || []).filter((l: LeadRow) => l.column === 'contacted').length;
    const leadsProposal = (leadData || []).filter((l: LeadRow) => l.column === 'proposal').length;

    const monthTotals = new Map<string, number>();
    for (const r of (ledgerSeries || [])) {
      const m = String(r.date || '').substring(0, 7);
      if (m) monthTotals.set(m, (monthTotals.get(m) || 0) + Number(r.amount || 0));
    }
    const sortedMonths = [...monthTotals.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const mrrSeries = sortedMonths.slice(-12).map(([m, total]) => {
      const [year, month] = m.split('-');
      return { name: `${year.slice(2)}-${month}`, mrr: total };
    });
    const ytdRevenue = sortedMonths
      .filter(([m]) => m.startsWith(`${currentYear}-`))
      .reduce((s, [, total]) => s + total, 0);

    // Today's income
    const today = todayDateKey();
    const todayIncome = (ledgerSeries || [])
      .filter(r => String(r.date || '').startsWith(today))
      .reduce((s, r) => s + Number(r.amount || 0), 0);

    // Current month's income
    const currentMonth = today.substring(0, 7); // YYYY-MM
    const monthlyIncome = (ledgerSeries || [])
      .filter(r => String(r.date || '').startsWith(currentMonth))
      .reduce((s, r) => s + Number(r.amount || 0), 0);

    const recentActivity = (recentActivityRows || []).map((r) => ({
      activity: r.title, detail: r.detail, time: r.created_at, type: r.entity_type, action: r.action,
    }));

    const focusStateMap: Record<string, string> = {};
    for (const r of (focusStates || [])) {
      focusStateMap[String(r.focus_key)] = String(r.status || 'pending');
    }

    const receivables = receivablesData || [];
    const leads = bestLeadArr || [];
    const tasks = urgentTaskArr || [];
    const rawMs = overdueMsArr?.[0];
    const overdueMs: OverdueMilestoneRow | undefined = rawMs ? {
      id: rawMs.id, label: rawMs.label, amount: rawMs.amount,
      due_date: rawMs.due_date, client_id: rawMs.client_id,
      clients: Array.isArray(rawMs.clients) ? (rawMs.clients[0] ?? null) : (rawMs.clients ?? null),
    } : undefined;

    // Build multiple candidates per category so "swap" has replacements
    const revenueCandidates: FocusCandidate[] = leads.map((l: LeadRow) => ({
      key: `revenue-lead-${l.id}`, type: '收入',
      title: `推进线索：${l.name || '未命名线索'}`,
      reason: l.column === 'proposal' ? '已进入报价阶段，推一把就能成交。' : '当前最值得跟进的销售机会。',
      actionHint: l.column === 'proposal' ? '发提案跟进 / 促成确认' : '发送开发信或安排跟进',
      entityType: 'lead', entityId: l.id,
    }));
    if (!revenueCandidates.length) revenueCandidates.push({ key: 'revenue-fallback', type: '收入', title: '跟进一位潜在客户', reason: '开拓新生意：找客户、谈合作、发报价、签单。', actionHint: 'home.focus.hint.leads' });

    const deliveryCandidates: FocusCandidate[] = tasks.map((t: TaskRow) => {
      const dueDay = t.due ? t.due.slice(0, 10) : '';
      const isOd = dueDay && dueDay < todayKey;
      const isDt = dueDay === todayKey;
      return {
        key: `delivery-task-${t.id}`, type: '交付',
        title: `推进任务：${t.title || '未命名任务'}`,
        reason: isOd ? `此任务已逾期（截止 ${dueDay}），需优先处理。` : isDt ? '此任务今日截止，需尽快完成。' : t.priority === 'High' ? '高优先级任务最容易影响客户满意度和交付节奏。' : '先推进当前最接近交付的任务。',
        actionHint: t.client ? `关联客户：${t.client}` : '打开任务卡继续执行',
        entityType: 'task' as const, entityId: t.id, dueDate: t.due || null,
        isOverdue: !!isOd, daysOverdue: isOd ? daysBetween(dueDay, todayKey) : 0,
      };
    });
    if (!deliveryCandidates.length) deliveryCandidates.push({ key: 'delivery-fallback', type: '交付', title: '完成一个关键交付', reason: '交付 = 产出成果：写代码、做设计、完成客户项目。', actionHint: 'home.focus.hint.tasks' });

    const systemCandidates: FocusCandidate[] = [];
    if (overdueMs) systemCandidates.push({ key: `system-overdue-ms-${overdueMs.id}`, type: '系统', title: `催收逾期款：${overdueMs.clients?.name || '客户'} — ${overdueMs.label} $${Number(overdueMs.amount||0).toLocaleString()}`, reason: `已于 ${overdueMs.due_date} 到期，尽快催收避免坏账。`, actionHint: '去客户面板确认收款并标记已付', entityType: 'milestone', entityId: overdueMs.id });
    for (const r of receivables.slice(0, 2)) systemCandidates.push({ key: `system-receivable-${r.id}`, type: '系统', title: `处理应收：${r.description || '未命名账款'}`, reason: '有待收款项时，先收钱比继续堆工作更重要。', actionHint: '去财务管理跟进回款' });
    for (const l of leads.slice(0, 2)) systemCandidates.push({ key: `system-lead-${l.id}`, type: '系统', title: `补齐线索信息：${l.name || '未命名线索'}`, reason: '线索信息越完整，后续跟进转化率越高。', actionHint: '完善需求、来源和下一步动作', entityType: 'lead', entityId: l.id });
    if (!systemCandidates.length) systemCandidates.push({ key: 'system-content-asset', type: '系统', title: '整理一条内容资产', reason: '系统 = 维护运转：催收款、对账、整理数据、优化流程。', actionHint: '去内容工坊保存一条可复用内容' });

    const autoFocus = [
      ...revenueCandidates,
      ...deliveryCandidates,
      ...systemCandidates,
    ];

    const manualTodayEvents = (manualFocusRows || []).map((row) => ({
      key: `manual-${row.id}`,
      type: row.type || '系统',
      title: row.title || '未命名事件',
      reason: row.note ? row.note : '手动记录的今日事件。',
      actionHint: '可作为今天的手动推进事项保存与追踪',
      isManual: true,
      status: focusStateMap[`manual-${row.id}`] || 'pending',
    }));

    const todayFocus = autoFocus.map((item: FocusCandidate) => ({ ...item, status: focusStateMap[item.key] || 'pending' }));
    const dueTodayWithStatus = dueTodayItems.map((item: FocusCandidate) => ({ ...item, status: focusStateMap[item.key] || 'pending' }));

    return ok({ clientsCount, mrr, activeTasks, todoCount, inProgressCount, leadsCount, leadsNew, leadsContacted, leadsProposal, mrrSeries, recentActivity, ytdRevenue, todayIncome, monthlyIncome, todayFocus, dueTodayItems: dueTodayWithStatus, manualTodayEvents, workTasks, personalTasks });
  }

  // ── WEEKLY REPORT ──────────────────────────────────────────────
  if (path === '/api/weekly-report' && method === 'GET') {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const weekStart = dateToKey(monday);
    const weekEnd = dateToKey(sunday);

    const [
      { data: incomeTx },
      { data: expenseTx },
      { data: completedTasks },
      { data: newClients },
      { data: newLeads },
      { data: activities },
    ] = await Promise.all([
      supabase.from('finance_transactions').select('amount').eq('user_id', userId).eq('type', 'income').eq('status', '已完成').eq('soft_deleted', false).gte('date', weekStart).lte('date', weekEnd),
      supabase.from('finance_transactions').select('amount').eq('user_id', userId).eq('type', 'expense').eq('status', '已完成').eq('soft_deleted', false).gte('date', weekStart).lte('date', weekEnd),
      supabase.from('tasks').select('id').eq('user_id', userId).eq('column', 'done').eq('soft_deleted', false).gte('updated_at', `${weekStart}T00:00:00`).lte('updated_at', `${weekEnd}T23:59:59`),
      supabase.from('clients').select('id').eq('user_id', userId).eq('soft_deleted', false).gte('created_at', `${weekStart}T00:00:00`).lte('created_at', `${weekEnd}T23:59:59`),
      supabase.from('leads').select('id').eq('user_id', userId).eq('soft_deleted', false).gte('created_at', `${weekStart}T00:00:00`).lte('created_at', `${weekEnd}T23:59:59`),
      supabase.from('activity_log').select('title, detail, created_at, entity_type, action').eq('user_id', userId).gte('created_at', `${weekStart}T00:00:00`).lte('created_at', `${weekEnd}T23:59:59`).order('created_at', { ascending: false }).limit(20),
    ]);

    const income = (incomeTx || []).reduce((s, r) => s + Number(r.amount || 0), 0);
    const expenses = Math.abs((expenseTx || []).reduce((s, r) => s + Number(r.amount || 0), 0));

    return ok({
      weekStart,
      weekEnd,
      income,
      expenses,
      netIncome: income - expenses,
      tasksCompleted: completedTasks?.length || 0,
      newClients: newClients?.length || 0,
      newLeads: newLeads?.length || 0,
      activities: (activities || []).map(a => ({ title: a.title, detail: a.detail, time: a.created_at, type: a.entity_type, action: a.action })),
    });
  }

  // ── SETTINGS ───────────────────────────────────────────────────
  if (path === '/api/settings' && method === 'GET') {
    const { data } = await supabase
      .from('app_settings')
      .select('key, value')
      .eq('user_id', userId);
    const settings: Record<string, string> = {};
    for (const r of (data || [])) settings[r.key] = r.value;
    return ok(settings);
  }

  if (path === '/api/settings' && method === 'POST') {
    const entries = Object.entries(body || {});
    for (const [key, value] of entries) {
      const { error: ue } = await supabase
        .from('app_settings')
        .upsert(
          { user_id: userId, key, value: String(value ?? '') },
          { onConflict: 'user_id,key' },
        );
      if (ue) return err(500, ue.message);
    }
    return ok({ success: true });
  }

  // ── AI AGENTS ───────────────────────────────────────────────────
  if (path === '/api/agents' && method === 'GET') {
    const { data } = await supabase
      .from('ai_agents')
      .select('id, name, avatar, role, personality, rules, tools, conversation_starters, template_id, is_default, sort_order, created_at, updated_at')
      .eq('user_id', userId)
      .eq('soft_deleted', false)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    // Parse JSON text fields
    const parsed = (data || []).map((r) => ({
      ...r,
      tools: safeJson(r.tools, []),
      conversation_starters: safeJson(r.conversation_starters, []),
    }));
    return ok(parsed);
  }

  if (path === '/api/agents' && method === 'POST') {
    const { name, avatar, role, personality, rules, tools, conversation_starters, template_id, is_default, sort_order } = body;
    if (!name || !String(name).trim()) return err(400, 'name is required');
    const { data, error: e } = await supabase
      .from('ai_agents')
      .insert({
        user_id: userId,
        name: str(name, 100),
        avatar: str(avatar || '', 10),
        role: str(role || '', 2000),
        personality: str(personality || '', 2000),
        rules: str(rules || '', 2000),
        tools: JSON.stringify(Array.isArray(tools) ? tools : []),
        conversation_starters: JSON.stringify(Array.isArray(conversation_starters) ? conversation_starters : []),
        template_id: str(template_id || '', 50),
        is_default: !!is_default,
        sort_order: Number(sort_order) || 0,
      })
      .select('id')
      .single();
    if (e || !data) return err(500, e?.message || 'Insert failed');
    await logActivity(userId, 'ai_agent', 'created', `创建 Agent：${String(name).trim()}`, '', data.id);
    return ok({ id: data.id, success: true });
  }

  const agentMatch = path.match(/^\/api\/agents\/(\d+)$/);
  if (agentMatch && method === 'PUT') {
    const id = Number(agentMatch[1]);
    const patch: Record<string, unknown> = {};
    if (body.name !== undefined) patch.name = str(body.name, 100);
    if (body.avatar !== undefined) patch.avatar = str(body.avatar, 10);
    if (body.role !== undefined) patch.role = str(body.role, 2000);
    if (body.personality !== undefined) patch.personality = str(body.personality, 2000);
    if (body.rules !== undefined) patch.rules = str(body.rules, 2000);
    if (body.tools !== undefined) patch.tools = JSON.stringify(Array.isArray(body.tools) ? body.tools : []);
    if (body.conversation_starters !== undefined) patch.conversation_starters = JSON.stringify(Array.isArray(body.conversation_starters) ? body.conversation_starters : []);
    if (body.template_id !== undefined) patch.template_id = str(body.template_id, 50);
    if (body.is_default !== undefined) patch.is_default = !!body.is_default;
    if (body.sort_order !== undefined) patch.sort_order = Number(body.sort_order) || 0;
    if (Object.keys(patch).length === 0) return ok({ success: true });
    const { error: e } = await supabase.from('ai_agents').update(patch).eq('id', id).eq('user_id', userId);
    if (e) return err(500, e.message);
    await logActivity(userId, 'ai_agent', 'updated', `更新 Agent：${body.name || ''}`, '', id);
    return ok({ success: true });
  }

  if (agentMatch && method === 'DELETE') {
    const id = Number(agentMatch[1]);
    const { data: prev } = await supabase.from('ai_agents').select('name').eq('id', id).eq('user_id', userId).single();
    const { error: delErr } = await supabase.from('ai_agents').update({ soft_deleted: true }).eq('id', id).eq('user_id', userId);
    if (delErr) return err(500, delErr.message);
    await logActivity(userId, 'ai_agent', 'deleted', `删除 Agent：${prev?.name || ''}`, '', id);
    return ok({ success: true });
  }

  // ── AI CONVERSATIONS ──────────────────────────────────────────────
  if (path === '/api/conversations' && method === 'GET') {
    const { data } = await supabase
      .from('ai_conversations')
      .select('id, title, agent_id, agent_ids, messages, created_at, updated_at')
      .eq('user_id', userId)
      .eq('soft_deleted', false)
      .order('updated_at', { ascending: false });
    const parsed = (data || []).map((r) => ({
      ...r,
      agent_ids: safeJson(r.agent_ids, []),
      messages: safeJson(r.messages, []),
    }));
    return ok(parsed);
  }

  if (path === '/api/conversations' && method === 'POST') {
    const { id, title, agent_id, agent_ids, messages } = body;
    if (!id) return err(400, 'id is required');
    const { error: e } = await supabase
      .from('ai_conversations')
      .insert({
        id: String(id),
        user_id: userId,
        title: str(String(title || ''), 200),
        agent_id: agent_id != null ? Number(agent_id) : null,
        agent_ids: Array.isArray(agent_ids) ? agent_ids : [],
        messages: Array.isArray(messages) ? messages : [],
      });
    if (e) return err(500, e.message);
    return ok({ id, success: true });
  }

  const convMatch = path.match(/^\/api\/conversations\/(.+)$/);
  if (convMatch && method === 'PUT') {
    const id = convMatch[1];
    const patch: Record<string, unknown> = {};
    if (body.title !== undefined) patch.title = str(String(body.title), 200);
    if (body.agent_id !== undefined) patch.agent_id = body.agent_id != null ? Number(body.agent_id) : null;
    if (body.agent_ids !== undefined) patch.agent_ids = Array.isArray(body.agent_ids) ? body.agent_ids : [];
    if (body.messages !== undefined) {
      const msgs = Array.isArray(body.messages) ? body.messages.slice(-100) : [];
      patch.messages = msgs.map((m: Record<string, unknown>) => ({
        role: m.role, content: String(m.content || '').slice(0, 50_000),
        ...(m.agentId != null ? { agentId: m.agentId } : {}),
        ...(m.timestamp ? { timestamp: m.timestamp } : {}),
      }));
    }
    patch.updated_at = new Date().toISOString();
    if (Object.keys(patch).length <= 1) return ok({ success: true }); // only updated_at
    const { error: e } = await supabase.from('ai_conversations').update(patch).eq('id', id).eq('user_id', userId);
    if (e) return err(500, e.message);
    return ok({ success: true });
  }

  if (convMatch && method === 'DELETE') {
    const id = convMatch[1];
    const { error: convDelErr } = await supabase.from('ai_conversations').update({ soft_deleted: true }).eq('id', id).eq('user_id', userId);
    if (convDelErr) return err(500, convDelErr.message);
    return ok({ success: true });
  }

  // ── SERVER TIME ─────────────────────────────────────────────────
  if (path === '/api/server-time' && method === 'GET') {
    return ok({ unixMs: Date.now() });
  }

  // ── SERVER INFO (stub) ─────────────────────────────────────────
  if (path === '/api/server-info' && method === 'GET') {
    return ok({ name: '一人CEO Cloud', cloud: true });
  }

  return err(404, `No handler for ${method} ${path}`);
}
