/**
 * Supabase API handler — replaces both server.ts and api.ts
 * Same signature as api.ts handleApiRequest() so the interceptor
 * can swap between online (Supabase) and offline (sql.js) seamlessly.
 */
import { supabase } from './supabase-client';

// ── helpers ────────────────────────────────────────────────────────

function todayDateKey() {
  return new Date().toISOString().split('T')[0];
}

function currentMonth() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}

function monthKey(value: string | null | undefined, fallback?: Date): string {
  if (value) return String(value).slice(0, 7);
  const d = fallback ?? new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Cache userId from session (local, no network call) instead of getUser() (network)
let _cachedUserId: string | null = null;

async function getUserId(): Promise<string> {
  if (_cachedUserId) return _cachedUserId;
  // getSession() reads from localStorage — instant, no network
  const { data } = await supabase.auth.getSession();
  if (!data.session?.user) throw new Error('Not authenticated');
  _cachedUserId = data.session.user.id;
  return _cachedUserId;
}

// Clear cache on auth state change
supabase.auth.onAuthStateChange((_event, session) => {
  _cachedUserId = session?.user?.id ?? null;
});

function normalizePlanTier(t: string): string {
  if (!t) return '';
  if (['Basic', 'basic'].includes(t)) return '基础版';
  if (['Pro', 'pro', 'Professional', 'professional'].includes(t)) return '专业版';
  if (['Enterprise', 'enterprise'].includes(t)) return '企业版';
  return t;
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

// ── Tax calc helper ───────────────────────────────────────────────
function calcTax(amount: number, mode: string, rate: number): number {
  if (mode === 'none' || !rate) return 0;
  if (mode === 'exclusive') return Math.round(amount * rate / 100 * 100) / 100;
  if (mode === 'inclusive') return Math.round(amount * rate / (100 + rate) * 100) / 100;
  return 0;
}

// ── Subscription sync → writes real finance_transactions ──────────
async function syncClientSubscriptionLedger(userId: string) {
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, plan_tier, mrr, status, joined_at, subscription_start_date, paused_at, resumed_at, cancelled_at, mrr_effective_from, tax_mode, tax_rate')
    .eq('user_id', userId)
    .eq('soft_deleted', false)
    .gt('mrr', 0);

  // Collect all months that SHOULD have subscription income
  const now = new Date();
  const cm = currentMonth();
  const shouldExist: Map<string, any> = new Map(); // key: "${clientId}-${month}"

  for (const client of (clients || [])) {
    const joined = client.joined_at ? new Date(String(client.joined_at).replace(' ', 'T')) : now;
    const safeJoined = Number.isNaN(joined.getTime()) ? now : joined;
    const startM = monthKey(client.subscription_start_date, safeJoined);
    const effectiveM = monthKey(client.mrr_effective_from || client.subscription_start_date, safeJoined);
    const pausedM = client.paused_at ? monthKey(client.paused_at) : null;
    const resumedM = client.resumed_at ? monthKey(client.resumed_at) : null;
    const cancelledM = client.cancelled_at ? monthKey(client.cancelled_at) : null;

    let [year, month] = startM.split('-').map(Number);
    while (`${year}-${String(month).padStart(2, '0')}` <= cm) {
      const lm = `${year}-${String(month).padStart(2, '0')}`;
      let shouldBill = lm >= effectiveM;
      if (pausedM && lm >= pausedM) shouldBill = false;
      if (resumedM && lm >= resumedM) shouldBill = true;
      if (cancelledM && lm >= cancelledM) shouldBill = false;
      if (client.status !== 'Active' && !pausedM && !cancelledM) shouldBill = false;

      if (shouldBill) {
        const amt = Number(client.mrr || 0);
        const tm = client.tax_mode || 'none';
        const tr = Number(client.tax_rate || 0);
        shouldExist.set(`${client.id}-${lm}`, {
          user_id: userId,
          type: 'income',
          source: 'subscription',
          source_id: client.id,
          amount: amt,
          category: '订阅收入',
          description: `${client.name || '未命名客户'} · ${client.plan_tier || '订阅'} · ${lm}`,
          date: `${lm}-01`,
          status: '已完成',
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
    .select('id, source_id, date')
    .eq('user_id', userId)
    .eq('source', 'subscription')
    .eq('soft_deleted', false);

  const existingMap = new Map<string, number>();
  for (const row of (existing || [])) {
    const m = String(row.date || '').substring(0, 7);
    existingMap.set(`${row.source_id}-${m}`, row.id);
  }

  // Upsert: insert missing, update changed, soft-delete removed
  const toInsert: any[] = [];
  const toUpdate: { id: number; data: any }[] = [];

  for (const [key, row] of shouldExist) {
    const existId = existingMap.get(key);
    if (existId) {
      // Already exists — update amount/description/tax in case client changed
      toUpdate.push({ id: existId, data: { amount: row.amount, description: row.description, tax_mode: row.tax_mode, tax_rate: row.tax_rate, tax_amount: row.tax_amount, client_name: row.client_name } });
      existingMap.delete(key);
    } else {
      toInsert.push(row);
    }
  }

  // Remaining in existingMap are rows that should no longer exist → soft delete
  const toDelete = [...existingMap.values()];

  // Execute
  if (toInsert.length > 0) {
    for (let i = 0; i < toInsert.length; i += 500) {
      await supabase.from('finance_transactions').insert(toInsert.slice(i, i + 500));
    }
  }
  for (const u of toUpdate) {
    await supabase.from('finance_transactions').update(u.data).eq('id', u.id);
  }
  if (toDelete.length > 0) {
    await supabase.from('finance_transactions').update({ soft_deleted: true }).in('id', toDelete);
  }
}

// ── Main route handler ────────────────────────────────────────────

export async function handleSupabaseRequest(
  method: string,
  path: string,
  body: any,
): Promise<{ status: number; data: any }> {
  const ok = (data: any) => ({ status: 200, data });
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
      .select('*')
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
        name: name || '', industry: industry || '', needs: needs || '',
        website: website || '', column: column || 'new',
        aiDraft: aiDraft || '', source: source || '',
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
      const { name, industry, needs, website, column, aiDraft, source } = body;
      const { error: e } = await supabase
        .from('leads')
        .update({
          name: name || '', industry: industry || '', needs: needs || '',
          website: website || '', column: column || 'new',
          aiDraft: aiDraft || '', source: source || '',
        })
        .eq('id', id);
      if (e) return err(500, e.message);
      await logActivity(userId, 'lead', 'updated', `更新线索：${name || '未命名线索'}`, '', id);
      return ok({ success: true });
    }
    if (method === 'DELETE') {
      const { data: prev } = await supabase.from('leads').select('name').eq('id', id).single();
      await supabase.from('leads').update({ soft_deleted: true }).eq('id', id);
      await logActivity(userId, 'lead', 'deleted', `删除线索：${prev?.name || '未命名线索'}`, '', id);
      return ok({ success: true });
    }
  }

  const convertMatch = path.match(/^\/api\/leads\/(\d+)\/convert$/);
  if (convertMatch && method === 'POST') {
    const id = Number(convertMatch[1]);
    const { data: lead } = await supabase.from('leads').select('*').eq('id', id).single();
    if (!lead) return err(404, 'Lead not found');
    const { plan_tier, status, mrr, subscription_start_date, mrr_effective_from } = body || {};
    const np = normalizePlanTier(plan_tier || '');
    const today = todayDateKey();
    const { data: newClient, error: e } = await supabase
      .from('clients')
      .insert({
        user_id: userId,
        name: lead.name || '', industry: lead.industry || '',
        plan_tier: np, status: status || 'Active', brand_context: lead.needs || '',
        mrr: Number(mrr || 0),
        subscription_start_date: subscription_start_date || today,
        paused_at: '', resumed_at: '', cancelled_at: '',
        mrr_effective_from: mrr_effective_from || subscription_start_date || today,
      })
      .select('id')
      .single();
    if (e) return err(500, e.message);
    await supabase.from('leads').update({ column: 'won' }).eq('id', id);
    syncClientSubscriptionLedger(userId).catch(() => {});
    await logActivity(userId, 'lead', 'converted', `线索转客户：${lead.name || '未命名线索'}`, np ? `方案：${np}` : '', id);
    await logActivity(userId, 'client', 'created', `新增客户：${lead.name || '未命名客户'}`, np ? `来自线索转化 · 方案：${np}` : '来自线索转化', newClient!.id);
    return ok({ success: true, clientId: newClient!.id });
  }

  // ── CLIENTS ────────────────────────────────────────────────────
  if (path === '/api/clients' && method === 'GET') {
    const currentYear = new Date().getFullYear();
    const { data: clients } = await supabase
      .from('clients')
      .select('*')
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
      .eq('soft_deleted', false);
    const rows = (clients || []).map((client) => {
      const cl = (revRows || []).filter((r) => Number(r.client_id) === Number(client.id));
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
            subscription_start_date, paused_at, resumed_at, cancelled_at, mrr_effective_from,
            company_name, contact_name, contact_email, contact_phone, billing_type, project_fee, project_end_date, tax_mode, tax_rate, drive_folder_url } = body;
    const np = normalizePlanTier(plan_tier || '');
    const { data, error: e } = await supabase
      .from('clients')
      .insert({
        user_id: userId,
        name: name || '', industry: industry || '', plan_tier: np, status: status || 'Active',
        brand_context: brand_context || '', mrr: mrr || 0,
        subscription_start_date: subscription_start_date || '', paused_at: paused_at || '',
        resumed_at: resumed_at || '', cancelled_at: cancelled_at || '',
        mrr_effective_from: mrr_effective_from || subscription_start_date || '',
        company_name: company_name || '', contact_name: contact_name || '',
        contact_email: contact_email || '', contact_phone: contact_phone || '',
        billing_type: billing_type || 'subscription', project_fee: project_fee || 0,
        project_end_date: project_end_date || '',
        tax_mode: tax_mode || 'none', tax_rate: tax_rate || 0,
        drive_folder_url: drive_folder_url || '',
      })
      .select('id')
      .single();
    if (e) return err(500, e.message);
    syncClientSubscriptionLedger(userId).catch(() => {});
    await logActivity(userId, 'client', 'created', `新增客户：${name || '未命名客户'}`, np ? `方案：${np}` : '', data!.id);
    return ok({ id: data!.id });
  }

  const clientMatch = path.match(/^\/api\/clients\/(\d+)$/);
  if (clientMatch) {
    const id = Number(clientMatch[1]);
    if (method === 'PUT') {
      const { name, industry, plan_tier, status, brand_context, mrr,
              subscription_start_date, paused_at, resumed_at, cancelled_at, mrr_effective_from,
              company_name, contact_name, contact_email, contact_phone, billing_type, project_fee, project_end_date, tax_mode, tax_rate, drive_folder_url } = body;
      const np = normalizePlanTier(plan_tier || '');
      const { error: e } = await supabase
        .from('clients')
        .update({
          name: name || '', industry: industry || '', plan_tier: np, status: status || 'Active',
          brand_context: brand_context || '', mrr: mrr || 0,
          subscription_start_date: subscription_start_date || '', paused_at: paused_at || '',
          resumed_at: resumed_at || '', cancelled_at: cancelled_at || '',
          mrr_effective_from: mrr_effective_from || subscription_start_date || '',
          company_name: company_name || '', contact_name: contact_name || '',
          contact_email: contact_email || '', contact_phone: contact_phone || '',
          billing_type: billing_type || 'subscription', project_fee: project_fee || 0,
          project_end_date: project_end_date || '',
          tax_mode: tax_mode || 'none', tax_rate: tax_rate || 0,
          drive_folder_url: drive_folder_url || '',
        })
        .eq('id', id);
      if (e) return err(500, e.message);
      syncClientSubscriptionLedger(userId).catch(() => {});
      await logActivity(userId, 'client', 'updated', `更新客户：${name || '未命名客户'}`, '客户信息已更新', id);
      return ok({ success: true });
    }
    if (method === 'DELETE') {
      const { data: prev } = await supabase.from('clients').select('name').eq('id', id).single();
      await supabase.from('clients').update({ soft_deleted: true }).eq('id', id);
      syncClientSubscriptionLedger(userId).catch(() => {});
      await logActivity(userId, 'client', 'deleted', `删除客户：${prev?.name || '未命名客户'}`, '', id);
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
        .select('*')
        .eq('user_id', userId)
        .eq('client_id', clientId)
        .eq('soft_deleted', false)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (e) return err(500, e.message);
      // Mark overdue milestones
      const rows = (data || []).map((m: any) => ({
        ...m,
        status: m.status === 'pending' && m.due_date && m.due_date < today ? 'overdue' : m.status,
      }));
      return ok(rows);
    }
    if (method === 'POST') {
      const { label, amount, percentage, due_date, payment_method, invoice_number, note, sort_order } = body;
      const { data, error: e } = await supabase
        .from('payment_milestones')
        .insert({
          user_id: userId,
          client_id: clientId,
          label: label || '', amount: amount || 0, percentage: percentage || 0,
          due_date: due_date || '', payment_method: payment_method || '',
          invoice_number: invoice_number || '', note: note || '',
          sort_order: sort_order ?? 0, status: 'pending',
        })
        .select('id')
        .single();
      if (e) return err(500, e.message);
      // Get client info for finance transaction
      const { data: client } = await supabase.from('clients').select('name, company_name, tax_mode, tax_rate').eq('id', clientId).single();
      const cName = client?.company_name || client?.name || '';
      const txAmt = Number(amount || 0);
      const tm = client?.tax_mode || 'none';
      const tr = Number(client?.tax_rate || 0);
      // Auto-create receivable finance transaction
      if (txAmt > 0) {
        const { data: tx } = await supabase.from('finance_transactions').insert({
          user_id: userId, type: 'income', source: 'milestone', source_id: data!.id,
          amount: txAmt, category: '项目收入',
          description: `${cName} · ${label || '项目付款'}`,
          date: due_date || '', status: '待收款 (应收)',
          client_id: clientId, client_name: cName,
          tax_mode: tm, tax_rate: tr, tax_amount: calcTax(txAmt, tm, tr),
        }).select('id').single();
        // Link milestone to finance transaction
        if (tx) await supabase.from('payment_milestones').update({ finance_tx_id: tx.id }).eq('id', data!.id);
      }
      await logActivity(userId, 'milestone', 'created',
        `新增付款节点：${cName} · ${label || ''}`,
        amount ? `$${Number(amount).toLocaleString()}` : '', data!.id);
      return ok({ id: data!.id });
    }
  }

  const milestoneMatch = path.match(/^\/api\/milestones\/(\d+)$/);
  if (milestoneMatch) {
    const id = Number(milestoneMatch[1]);
    if (method === 'PUT') {
      const { label, amount, percentage, due_date, payment_method, status, invoice_number, note, sort_order } = body;
      const { error: e } = await supabase
        .from('payment_milestones')
        .update({
          label: label || '', amount: amount || 0, percentage: percentage || 0,
          due_date: due_date || '', payment_method: payment_method || '',
          status: status || 'pending', invoice_number: invoice_number || '',
          note: note || '', sort_order: sort_order ?? 0,
        })
        .eq('id', id);
      if (e) return err(500, e.message);
      return ok({ success: true });
    }
    if (method === 'DELETE') {
      const { data: prev } = await supabase.from('payment_milestones').select('label, client_id, finance_tx_id').eq('id', id).single();
      await supabase.from('payment_milestones').update({ soft_deleted: true }).eq('id', id);
      // Also soft-delete linked finance transaction if exists
      if (prev?.finance_tx_id) {
        await supabase.from('finance_transactions').update({ soft_deleted: true }).eq('id', Number(prev.finance_tx_id));
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

    const { data: milestone } = await supabase.from('payment_milestones').select('*').eq('id', id).single();
    if (!milestone) return err(404, 'Milestone not found');
    const { data: client } = await supabase.from('clients').select('name, company_name, tax_mode, tax_rate').eq('id', milestone.client_id).single();
    const clientName = client?.company_name || client?.name || '';

    // If milestone already has a linked finance transaction, UPDATE it
    if (milestone.finance_tx_id) {
      await supabase.from('finance_transactions').update({
        status: '已完成', date: actualDate,
      }).eq('id', Number(milestone.finance_tx_id));
    } else {
      // Create new transaction (for milestones created before the refactor)
      const txAmount = Number(milestone.amount || 0);
      const tm = client?.tax_mode || 'none';
      const tr = Number(client?.tax_rate || 0);
      const { data: tx } = await supabase.from('finance_transactions').insert({
        user_id: userId, type: 'income', source: 'milestone', source_id: id,
        amount: txAmount, category: '项目收入',
        description: `${clientName} · ${milestone.label || '项目付款'}`,
        date: actualDate, status: '已完成',
        client_id: milestone.client_id, client_name: clientName,
        tax_mode: tm, tax_rate: tr, tax_amount: calcTax(txAmount, tm, tr),
      }).select('id').single();
      if (tx) await supabase.from('payment_milestones').update({ finance_tx_id: tx.id }).eq('id', id);
    }

    // Update milestone status
    await supabase.from('payment_milestones').update({
      status: 'paid', paid_date: actualDate,
      payment_method: payment_method || milestone.payment_method || '',
    }).eq('id', id);

    await logActivity(userId, 'milestone', 'paid',
      `确认收款：${clientName} · ${milestone.label || '项目付款'}`,
      `$${Number(milestone.amount || 0).toLocaleString()} · ${payment_method || ''}`, id);

    return ok({ success: true, financeId: milestone.finance_tx_id });
  }

  // ── TASKS ──────────────────────────────────────────────────────
  if (path === '/api/tasks' && method === 'GET') {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('soft_deleted', false)
      .order('created_at', { ascending: false });
    return ok(data || []);
  }

  if (path === '/api/tasks' && method === 'POST') {
    const { title, client, priority, due, column, originalRequest, aiBreakdown, aiMjPrompts, aiStory } = body;
    const { data, error: e } = await supabase
      .from('tasks')
      .insert({
        user_id: userId,
        title: title || '', client: client || '', priority: priority || 'Medium',
        due: due || '', column: column || 'todo',
        originalRequest: originalRequest || '', aiBreakdown: aiBreakdown || '',
        aiMjPrompts: aiMjPrompts || '', aiStory: aiStory || '',
      })
      .select('id')
      .single();
    if (e) return err(500, e.message);
    await logActivity(userId, 'task', 'created', `新增任务：${title || '未命名任务'}`, client ? `客户：${client}` : '', data!.id);
    return ok({ id: data!.id });
  }

  const taskMatch = path.match(/^\/api\/tasks\/(\d+)$/);
  if (taskMatch) {
    const id = Number(taskMatch[1]);
    if (method === 'PUT') {
      const { title, client, priority, due, column, originalRequest, aiBreakdown, aiMjPrompts, aiStory } = body;
      const { error: e } = await supabase
        .from('tasks')
        .update({
          title: title || '', client: client || '', priority: priority || 'Medium',
          due: due || '', column: column || 'todo',
          originalRequest: originalRequest || '', aiBreakdown: aiBreakdown || '',
          aiMjPrompts: aiMjPrompts || '', aiStory: aiStory || '',
        })
        .eq('id', id);
      if (e) return err(500, e.message);
      await logActivity(userId, 'task', 'updated', `更新任务：${title || '未命名任务'}`, '', id);
      return ok({ success: true });
    }
    if (method === 'DELETE') {
      const { data: prev } = await supabase.from('tasks').select('title').eq('id', id).single();
      await supabase.from('tasks').update({ soft_deleted: true }).eq('id', id);
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
      .select('*')
      .eq('user_id', userId)
      .eq('soft_deleted', false);
    const rows = (plans || []).map((p) => {
      const al = aliases[p.name as string] || [p.name];
      const clients = al.reduce((s, a) => s + (countMap.get(a) || 0), 0);
      let features: any;
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
    if (e) return err(500, e.message);
    await logActivity(userId, 'plan', 'created', `新增方案：${name || '未命名方案'}`, price ? `价格：$${price}/月` : '', data!.id);
    return ok({ id: data!.id });
  }

  const planMatch = path.match(/^\/api\/plans\/(\d+)$/);
  if (planMatch) {
    const id = Number(planMatch[1]);
    if (method === 'PUT') {
      const { name, price, deliverySpeed, features, clients } = body;
      const { error: e } = await supabase
        .from('plans')
        .update({
          name: name || '', price: price || 0, deliverySpeed: deliverySpeed || '',
          features: JSON.stringify(features || []), clients: clients || 0,
        })
        .eq('id', id);
      if (e) return err(500, e.message);
      await logActivity(userId, 'plan', 'updated', `更新方案：${name || '未命名方案'}`, '', id);
      return ok({ success: true });
    }
    if (method === 'DELETE') {
      const { data: prev } = await supabase.from('plans').select('name').eq('id', id).single();
      await supabase.from('plans').update({ soft_deleted: true }).eq('id', id);
      await logActivity(userId, 'plan', 'deleted', `删除方案：${prev?.name || '未命名方案'}`, '', id);
      return ok({ success: true });
    }
  }

  // ── FINANCE ────────────────────────────────────────────────────
  if (path === '/api/finance' && method === 'GET') {
    // Single table query — no more virtual rows!
    const { data, error: e } = await supabase
      .from('finance_transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('soft_deleted', false)
      .order('date', { ascending: false });
    if (e) return err(500, e.message);
    return ok(data || []);
  }

  if (path === '/api/finance/report' && method === 'GET') {
    // Trigger a GET /api/finance internally
    const { data: allRows } = await handleSupabaseRequest('GET', '/api/finance', null);
    const transactions = allRows || [];
    const completedIncome = transactions.filter((t: any) => t.type === 'income' && (t.status || '已完成') === '已完成').reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
    const completedExpense = transactions.filter((t: any) => t.type === 'expense' && (t.status || '已完成') === '已完成').reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
    const receivables = transactions.filter((t: any) => String(t.status || '').includes('应收')).reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
    const payables = transactions.filter((t: any) => String(t.status || '').includes('应付')).reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
    const totalTax = transactions.filter((t: any) => (t.status || '已完成') === '已完成' && Number(t.tax_amount || 0) > 0).reduce((s: number, t: any) => s + Number(t.tax_amount || 0), 0);
    const rows = transactions.slice(0, 50).map((t: any) => { const taxInfo = Number(t.tax_amount || 0) > 0 ? ` (税$${Number(t.tax_amount).toLocaleString()})` : ''; return `<tr><td>${t.date || ''}</td><td>${t.description || ''}</td><td>${t.category || ''}</td><td>${t.type === 'income' ? '+' : '-'}$${Number(t.amount || 0).toLocaleString()}${taxInfo}</td><td>${t.status || '已完成'}</td></tr>`; }).join('');
    const html = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"/><title>一人CEO - 财务月度报表</title><style>body{font-family:-apple-system,sans-serif;padding:32px;color:#18181b}h1{font-size:28px;margin:0 0 8px}p{color:#71717a;margin:0 0 24px}.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:24px}.card{border:1px solid #e4e4e7;border-radius:16px;padding:16px}.label{font-size:12px;color:#71717a;margin-bottom:8px}.value{font-size:24px;font-weight:700}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px 12px;border-bottom:1px solid #e4e4e7;font-size:12px}th{background:#f4f4f5;color:#52525b}</style></head><body><h1>财务月度报表</h1><p>一人CEO · 导出时间 ${new Date().toLocaleString('zh-CN')}</p><div class="grid"><div class="card"><div class="label">已完成收入</div><div class="value">$${completedIncome.toLocaleString()}</div></div><div class="card"><div class="label">已完成支出</div><div class="value">$${completedExpense.toLocaleString()}</div></div><div class="card"><div class="label">净利润</div><div class="value">$${(completedIncome - completedExpense).toLocaleString()}</div></div><div class="card"><div class="label">应收 / 应付</div><div class="value">$${receivables.toLocaleString()} / $${payables.toLocaleString()}</div></div><div class="card"><div class="label">税费合计</div><div class="value">$${totalTax.toLocaleString()}</div></div></div><table><thead><tr><th>日期</th><th>描述</th><th>分类</th><th>金额</th><th>状态</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
    return { status: 200, data: html };
  }

  if (path === '/api/finance' && method === 'POST') {
    const { type, amount, category, description, date, status, tax_mode, tax_rate, tax_amount, client_id, client_name } = body;
    const { data, error: e } = await supabase
      .from('finance_transactions')
      .insert({
        user_id: userId,
        type: type || 'income', amount: amount || 0, category: category || '',
        description: description || '', date: date || '', status: status || '已完成',
        tax_mode: tax_mode || 'none', tax_rate: tax_rate || 0, tax_amount: tax_amount || 0,
        client_id: client_id || null, client_name: client_name || '',
      })
      .select('id')
      .single();
    if (e) return err(500, e.message);
    await logActivity(userId, 'finance', 'created', `新增交易：${description || '未命名交易'}`,
      `${type === 'income' ? '+' : '-'}$${Number(amount || 0).toLocaleString()} · ${category || '未分类'}`, data!.id);
    return ok({ id: data!.id });
  }

  const financeMatch = path.match(/^\/api\/finance\/(\d+)$/);
  if (financeMatch) {
    const id = Number(financeMatch[1]);
    // Check source — only manual transactions can be edited/deleted
    const { data: txRow } = await supabase.from('finance_transactions').select('source, description').eq('id', id).single();
    if (!txRow) return err(404, 'Transaction not found');
    const src = txRow.source || 'manual';
    if (src === 'subscription') return err(400, '订阅流水由客户状态自动生成，请在客户管理中编辑');
    if (src === 'milestone') return err(400, '此交易由里程碑自动生成，请前往签约客户中修改');
    if (src === 'project_fee') return err(400, '项目总费待收款，请在客户管理中编辑');

    if (method === 'PUT') {
      const { type, amount, category, description, date, status, tax_mode, tax_rate, tax_amount, client_id, client_name } = body;
      const { error: e } = await supabase
        .from('finance_transactions')
        .update({
          type: type || 'income', amount: amount || 0, category: category || '',
          description: description || '', date: date || '', status: status || '已完成',
          tax_mode: tax_mode || 'none', tax_rate: tax_rate || 0, tax_amount: tax_amount || 0,
          client_id: client_id || null, client_name: client_name || '',
        })
        .eq('id', id);
      if (e) return err(500, e.message);
      await logActivity(userId, 'finance', 'updated', `更新交易：${description || '未命名交易'}`, '', id);
      return ok({ success: true });
    }
    if (method === 'DELETE') {
      await supabase.from('finance_transactions').update({ soft_deleted: true }).eq('id', id);
      await logActivity(userId, 'finance', 'deleted', `删除交易：${txRow.description || '未命名交易'}`, '', id);
      return ok({ success: true });
    }
  }

  // ── CONTENT DRAFTS ─────────────────────────────────────────────
  if (path === '/api/content-drafts' && method === 'GET') {
    const { data } = await supabase
      .from('content_drafts')
      .select('*')
      .eq('user_id', userId)
      .eq('soft_deleted', false)
      .order('updated_at', { ascending: false })
      .limit(20);
    return ok(data || []);
  }

  if (path === '/api/content-drafts' && method === 'POST') {
    const { id, topic, platform, language, content } = body;
    if (id) {
      await supabase
        .from('content_drafts')
        .update({ topic: topic || '', platform: platform || '', language: language || 'zh', content: content || '' })
        .eq('id', Number(id));
      await logActivity(userId, 'content', 'updated', `更新草稿：${topic || '未命名草稿'}`, platform ? `平台：${platform}` : '', id);
      return ok({ id, success: true });
    }
    const { data, error: e } = await supabase
      .from('content_drafts')
      .insert({
        user_id: userId,
        topic: topic || '', platform: platform || '', language: language || 'zh', content: content || '',
      })
      .select('id')
      .single();
    if (e) return err(500, e.message);
    await logActivity(userId, 'content', 'created', `保存草稿：${topic || '未命名草稿'}`, platform ? `平台：${platform}` : '', data!.id);
    return ok({ id: data!.id, success: true });
  }

  const contentMatch = path.match(/^\/api\/content-drafts\/(\d+)$/);
  if (contentMatch && method === 'DELETE') {
    const id = Number(contentMatch[1]);
    const { data: prev } = await supabase.from('content_drafts').select('topic').eq('id', id).single();
    await supabase.from('content_drafts').update({ soft_deleted: true }).eq('id', id);
    await logActivity(userId, 'content', 'deleted', `删除草稿：${prev?.topic || '未命名草稿'}`, '', id);
    return ok({ success: true });
  }

  // ── TODAY FOCUS ────────────────────────────────────────────────
  if (path === '/api/today-focus/state' && method === 'POST') {
    const { focusKey, status } = body || {};
    if (!focusKey) return err(400, 'focusKey is required');
    const norm = status === 'completed' ? 'completed' : 'pending';
    const focusDate = todayDateKey();
    await supabase
      .from('today_focus_state')
      .upsert(
        { user_id: userId, focus_date: focusDate, focus_key: String(focusKey), status: norm },
        { onConflict: 'user_id,focus_date,focus_key' },
      );
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
    if (e) return err(500, e.message);
    const focusKey = `manual-${data!.id}`;
    await supabase
      .from('today_focus_state')
      .upsert(
        { user_id: userId, focus_date: focusDate, focus_key: focusKey, status: 'pending' },
        { onConflict: 'user_id,focus_date,focus_key' },
      );
    await logActivity(userId, 'today_focus', 'manual_created', `记录今日事件：${String(title).trim()}`, type ? `类型：${type}` : '', data!.id);
    return ok({ success: true, id: data!.id, focusKey });
  }

  const manualMatch = path.match(/^\/api\/today-focus\/manual\/(\d+)$/);
  if (manualMatch) {
    const id = Number(manualMatch[1]);
    if (method === 'PUT') {
      const { type, title, note } = body || {};
      if (!title || !String(title).trim()) return err(400, 'title is required');
      const { error: e } = await supabase
        .from('today_focus_manual')
        .update({ type: type || '系统', title: String(title).trim(), note: String(note || '').trim() })
        .eq('id', id);
      if (e) return err(500, e.message);
      await logActivity(userId, 'today_focus', 'manual_updated', `更新今日事件：${String(title).trim()}`, '', id);
      return ok({ success: true, id });
    }
    if (method === 'DELETE') {
      const { data: prev } = await supabase.from('today_focus_manual').select('title').eq('id', id).single();
      if (!prev) return err(404, 'manual event not found');
      await supabase.from('today_focus_manual').update({ soft_deleted: true }).eq('id', id);
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

    const [
      { data: activeClients },
      { data: taskData },
      { data: leadData },
      { data: ledgerSeries },
      { data: recentActivityRows },
      { data: focusStates },
      { data: receivablesData },
      { data: bestLeadArr },
      { data: urgentTaskArr },
      { data: overdueMsArr },
      { data: manualFocusRows },
    ] = await Promise.all([
      supabase.from('clients').select('id, mrr').eq('user_id', userId).eq('status', 'Active').eq('soft_deleted', false),
      supabase.from('tasks').select('id').eq('user_id', userId).neq('column', 'done').eq('soft_deleted', false),
      supabase.from('leads').select('id').eq('user_id', userId).eq('soft_deleted', false),
      supabase.from('finance_transactions').select('date, amount').eq('user_id', userId).eq('type', 'income').eq('status', '已完成').eq('soft_deleted', false),
      supabase.from('activity_log').select('title, detail, created_at, entity_type, action').eq('user_id', userId).order('created_at', { ascending: false }).limit(8),
      supabase.from('today_focus_state').select('focus_key, status').eq('user_id', userId).eq('focus_date', focusDate),
      supabase.from('finance_transactions').select('id, description, status').eq('user_id', userId).eq('soft_deleted', false).like('status', '%应收%'),
      supabase.from('leads').select('id, name, industry, needs, column').eq('user_id', userId).eq('soft_deleted', false).in('column', ['proposal', 'contacted', 'new']).order('column', { ascending: true }).limit(1),
      supabase.from('tasks').select('id, title, client, priority, due, column').eq('user_id', userId).eq('soft_deleted', false).neq('column', 'done').order('priority', { ascending: true }).limit(1),
      supabase.from('payment_milestones').select('id, label, amount, due_date, client_id, clients(name)').eq('user_id', userId).eq('status', 'pending').eq('soft_deleted', false).not('due_date', 'is', null).lt('due_date', todayDateKey()).order('due_date', { ascending: true }).limit(1),
      supabase.from('today_focus_manual').select('id, type, title, note').eq('user_id', userId).eq('focus_date', focusDate).eq('soft_deleted', false).order('id', { ascending: false }),
    ]);

    const clientsCount = activeClients?.length || 0;
    const mrr = (activeClients || []).reduce((s, r) => s + Number(r.mrr || 0), 0);
    const activeTasks = taskData?.length || 0;
    const leadsCount = leadData?.length || 0;

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

    const recentActivity = (recentActivityRows || []).map((r) => ({
      activity: r.title, detail: r.detail, time: r.created_at, type: r.entity_type, action: r.action,
    }));

    const focusStateMap: Record<string, string> = {};
    for (const r of (focusStates || [])) {
      focusStateMap[String(r.focus_key)] = String(r.status || 'pending');
    }

    const receivables = receivablesData || [];
    const bestLead = bestLeadArr?.[0] || null;
    const urgentTask = urgentTaskArr?.[0] || null;
    const overdueMs = overdueMsArr?.[0] as any;

    const systemTask = overdueMs
      ? { key: `system-overdue-ms-${overdueMs.id}`, type: '系统', title: `催收逾期款：${overdueMs.clients?.name || '客户'} — ${overdueMs.label} $${Number(overdueMs.amount||0).toLocaleString()}`, reason: `该笔款项已于 ${overdueMs.due_date} 到期，需要尽快催收。`, actionHint: '去客户面板确认收款并标记已付' }
      : receivables[0]
      ? { key: `system-receivable-${receivables[0].id || 'r'}`, type: '系统', title: `处理应收：${receivables[0].description || '未命名账款'}`, reason: '有待收款项时，先收钱比继续堆工作更重要。', actionHint: '去财务管理跟进回款' }
      : bestLead
        ? { key: `system-lead-${bestLead.id || 'fallback'}`, type: '系统', title: `补齐线索信息：${bestLead.name || '未命名线索'}`, reason: '把高潜在线索信息补完整，后续跟进效率更高。', actionHint: '完善需求、来源和下一步动作' }
        : { key: 'system-content-asset', type: '系统', title: '整理一条内容资产', reason: '没有财务阻塞时，优先沉淀长期可复用资产。', actionHint: '去内容工坊保存一条可复用内容' };

    const autoFocus = [
      bestLead
        ? { key: `revenue-lead-${bestLead.id || 'fallback'}`, type: '收入', title: `推进线索：${bestLead.name || '未命名线索'}`, reason: bestLead.column === 'proposal' ? '它已经接近成交，今天推进最有机会带来收入。' : '这是当前最值得跟进的销售机会。', actionHint: bestLead.column === 'proposal' ? '发提案跟进 / 促成确认' : '发送开发信或安排跟进' }
        : { key: 'revenue-fallback', type: '收入', title: '跟进一位潜在客户', reason: '今天至少推进一件直接指向收入的动作。', actionHint: '去销售看板处理最高意向线索' },
      urgentTask
        ? { key: `delivery-task-${urgentTask.id || 'fallback'}`, type: '交付', title: `推进任务：${urgentTask.title || '未命名任务'}`, reason: urgentTask.priority === 'High' ? '高优先级任务最容易影响客户满意度和交付节奏。' : '先推进当前最接近交付的任务。', actionHint: urgentTask.client ? `关联客户：${urgentTask.client}` : '打开任务卡继续执行' }
        : { key: 'delivery-fallback', type: '交付', title: '完成一个关键交付', reason: '每天至少推进一件真实交付，避免系统只转不产出。', actionHint: '去任务看板推进进行中任务' },
      systemTask,
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

    const todayFocus = autoFocus.map((item: any) => ({ ...item, status: focusStateMap[item.key] || 'pending' }));

    return ok({ clientsCount, mrr, activeTasks, leadsCount, mrrSeries, recentActivity, ytdRevenue, todayFocus, manualTodayEvents });
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
      await supabase
        .from('app_settings')
        .upsert(
          { user_id: userId, key, value: String(value ?? '') },
          { onConflict: 'user_id,key' },
        );
    }
    return ok({ success: true });
  }

  // ── SERVER INFO (stub) ─────────────────────────────────────────
  if (path === '/api/server-info' && method === 'GET') {
    return ok({ name: '一人CEO Cloud', cloud: true });
  }

  return err(404, `No handler for ${method} ${path}`);
}
