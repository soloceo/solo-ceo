/**
 * Browser-side API handlers — mirrors every Express route in server.ts
 * using sql.js instead of better-sqlite3.
 */
import { Database } from 'sql.js';
import { getDb, saveDb, all, get, run, exec } from './index';

// ── helpers ────────────────────────────────────────────────────────────────

function todayDateKey() {
  return new Date().toISOString().split('T')[0];
}

function logActivity(
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

function monthKey(value: string | null | undefined, fallback?: Date): string {
  if (value) return String(value).slice(0, 7);
  const d = fallback ?? new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function currentMonth() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}

function calcTaxOffline(amount: number, mode: string, rate: number): number {
  if (mode === 'none' || !rate) return 0;
  if (mode === 'exclusive') return Math.round(amount * rate / 100 * 100) / 100;
  if (mode === 'inclusive') return Math.round(amount * rate / (100 + rate) * 100) / 100;
  return 0;
}

function syncClientSubscriptionLedger(db: Database) {
  const clients = all(
    db,
    `SELECT id, name, plan_tier, mrr, status, joined_at,
            subscription_start_date, paused_at, resumed_at,
            cancelled_at, mrr_effective_from, subscription_timeline,
            tax_mode, tax_rate, payment_method
     FROM clients WHERE COALESCE(mrr, 0) > 0`
  );

  const now = new Date();
  const cm = currentMonth();

  // Collect what SHOULD exist
  const shouldExist = new Map<string, any>();

  for (const client of clients) {
    const joined = client.joined_at ? new Date(String(client.joined_at).replace(' ', 'T')) : now;
    const safeJoined = Number.isNaN(joined.getTime()) ? now : joined;

    // Parse timeline — prefer new timeline, fallback to legacy fields
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
        shouldExist.set(`${client.id}-${lm}`, {
          type: 'income', source: 'subscription', source_id: client.id,
          amount: amt, category: '订阅收入',
          description: `${client.name || '未命名客户'} · ${client.plan_tier || '订阅'} · ${lm}`,
          date: lm === startM ? startDate : `${lm}-${startDate.split('-')[2] || '01'}`,
          status: client.payment_method === 'manual' ? '待收款 (应收)' : '已完成',
          client_id: client.id, client_name: client.name || '未命名客户',
          tax_mode: tm, tax_rate: tr, tax_amount: calcTaxOffline(amt, tm, tr),
        });
      }
      month += 1;
      if (month > 12) { month = 1; year += 1; }
    }
  }

  // Fetch existing subscription transactions
  const existing = all(db, `SELECT id, source_id, date FROM finance_transactions WHERE source='subscription'`);
  const existingMap = new Map<string, number>();
  for (const row of existing) {
    const m = String(row.date || '').substring(0, 7);
    existingMap.set(`${row.source_id}-${m}`, row.id as number);
  }

  // Upsert
  for (const [key, row] of shouldExist) {
    const existId = existingMap.get(key);
    if (existId) {
      run(db, `UPDATE finance_transactions SET amount=?, description=?, date=?, status=?, tax_mode=?, tax_rate=?, tax_amount=?, client_name=? WHERE id=?`,
        [row.amount, row.description, row.date, row.status, row.tax_mode, row.tax_rate, row.tax_amount, row.client_name, existId]);
      existingMap.delete(key);
    } else {
      run(db, `INSERT INTO finance_transactions (type, source, source_id, amount, category, description, date, status, client_id, client_name, tax_mode, tax_rate, tax_amount) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [row.type, row.source, row.source_id, row.amount, row.category, row.description, row.date, row.status, row.client_id, row.client_name, row.tax_mode, row.tax_rate, row.tax_amount]);
    }
  }

  // Soft-delete removed
  for (const id of existingMap.values()) {
    run(db, `DELETE FROM finance_transactions WHERE id=?`, [id]);
  }
}

function getRecentSubscriptionEvents(db: Database): any[] {
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

function getTodayFocusStateMap(
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

function upsertTodayFocusState(
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

function normalizePlanTier(t: string): string {
  if (!t) return '';
  if (['Basic', 'basic'].includes(t)) return '基础版';
  if (['Pro', 'pro', 'Professional', 'professional'].includes(t)) return '专业版';
  if (['Enterprise', 'enterprise'].includes(t)) return '企业版';
  return t;
}

function initSchema(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      industry TEXT,
      needs TEXT,
      website TEXT,
      column TEXT DEFAULT 'new',
      aiDraft TEXT,
      source TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      industry TEXT,
      plan_tier TEXT,
      status TEXT DEFAULT 'Active',
      brand_context TEXT,
      mrr REAL,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      client TEXT,
      priority TEXT,
      due TEXT,
      column TEXT DEFAULT 'todo',
      originalRequest TEXT,
      aiBreakdown TEXT,
      aiMjPrompts TEXT,
      aiStory TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL,
      deliverySpeed TEXT,
      features TEXT,
      clients INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS finance_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT,
      amount REAL,
      category TEXT,
      description TEXT,
      date TEXT,
      status TEXT DEFAULT '已完成',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS content_drafts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic TEXT,
      platform TEXT,
      language TEXT,
      content TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      action TEXT NOT NULL,
      title TEXT NOT NULL,
      detail TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS client_subscription_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      client_name TEXT NOT NULL,
      plan_tier TEXT,
      amount REAL NOT NULL,
      ledger_month TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(client_id, ledger_month)
    );
    CREATE TABLE IF NOT EXISTS today_focus_state (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      focus_date TEXT NOT NULL,
      focus_key TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(focus_date, focus_key)
    );
    CREATE TABLE IF NOT EXISTS today_focus_manual (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      focus_date TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT '系统',
      title TEXT NOT NULL,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migrations
  const migrations = [
    `ALTER TABLE finance_transactions ADD COLUMN status TEXT DEFAULT '已完成'`,
    `ALTER TABLE clients ADD COLUMN subscription_start_date TEXT`,
    `ALTER TABLE clients ADD COLUMN paused_at TEXT`,
    `ALTER TABLE clients ADD COLUMN resumed_at TEXT`,
    `ALTER TABLE clients ADD COLUMN cancelled_at TEXT`,
    `ALTER TABLE clients ADD COLUMN mrr_effective_from TEXT`,
    `ALTER TABLE leads ADD COLUMN source TEXT`,
    `ALTER TABLE clients ADD COLUMN company_name TEXT`,
    `ALTER TABLE clients ADD COLUMN contact_name TEXT`,
    `ALTER TABLE clients ADD COLUMN contact_email TEXT`,
    `ALTER TABLE clients ADD COLUMN contact_phone TEXT`,
    `ALTER TABLE clients ADD COLUMN billing_type TEXT DEFAULT 'subscription'`,
    `ALTER TABLE clients ADD COLUMN project_fee REAL`,
    `ALTER TABLE clients ADD COLUMN project_end_date TEXT`,
    `ALTER TABLE clients ADD COLUMN tax_mode TEXT DEFAULT 'none'`,
    `ALTER TABLE clients ADD COLUMN tax_rate REAL DEFAULT 0`,
    `ALTER TABLE finance_transactions ADD COLUMN tax_mode TEXT DEFAULT 'none'`,
    `ALTER TABLE finance_transactions ADD COLUMN tax_rate REAL DEFAULT 0`,
    `ALTER TABLE finance_transactions ADD COLUMN tax_amount REAL DEFAULT 0`,
    `ALTER TABLE finance_transactions ADD COLUMN client_id INTEGER`,
    `ALTER TABLE finance_transactions ADD COLUMN client_name TEXT`,
    `ALTER TABLE finance_transactions ADD COLUMN source TEXT DEFAULT 'manual'`,
    `ALTER TABLE finance_transactions ADD COLUMN source_id INTEGER`,
    `ALTER TABLE clients ADD COLUMN payment_method TEXT DEFAULT 'auto'`,
    `CREATE TABLE IF NOT EXISTS payment_milestones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      amount REAL NOT NULL DEFAULT 0,
      percentage REAL DEFAULT 0,
      due_date TEXT DEFAULT '',
      paid_date TEXT DEFAULT '',
      payment_method TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      invoice_number TEXT DEFAULT '',
      note TEXT DEFAULT '',
      finance_tx_id INTEGER,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `ALTER TABLE clients ADD COLUMN drive_folder_url TEXT DEFAULT ''`,
    `ALTER TABLE clients ADD COLUMN subscription_timeline TEXT DEFAULT '[]'`,
  ];
  for (const m of migrations) {
    try { db.run(m); } catch { /* already exists */ }
  }
}

function seedData(db: Database) {
  const countLeads = get(db, 'SELECT COUNT(*) as c FROM leads')?.c ?? 0;
  if (Number(countLeads) === 0) {
    db.run(`INSERT INTO leads (name, industry, needs, website, column, aiDraft) VALUES (?,?,?,?,?,?)`,
      ['EcoLife 环保家居', '家居生活', '品牌重塑, 包装设计', 'ecolife.example.com', 'new', '']);
    db.run(`INSERT INTO leads (name, industry, needs, website, column, aiDraft) VALUES (?,?,?,?,?,?)`,
      ['FinTech 创新', '金融科技', '官网设计, UI/UX', '', 'contacted', '']);
  }

  const countClients = get(db, 'SELECT COUNT(*) as c FROM clients')?.c ?? 0;
  if (Number(countClients) === 0) {
    db.run(`INSERT INTO clients (name, industry, plan_tier, status, brand_context, mrr) VALUES (?,?,?,?,?,?)`,
      ['GlobalNet', '科技', '企业版', 'Active', '科技感、全球化、蓝色调', 4500]);
    db.run(`INSERT INTO clients (name, industry, plan_tier, status, brand_context, mrr) VALUES (?,?,?,?,?,?)`,
      ['Acme Corp', '制造', '专业版', 'Active', '稳重、可靠、工业风', 2500]);
  }

  const countTasks = get(db, 'SELECT COUNT(*) as c FROM tasks')?.c ?? 0;
  if (Number(countTasks) === 0) {
    db.run(`INSERT INTO tasks (title, client, priority, due, column, originalRequest, aiBreakdown, aiMjPrompts, aiStory) VALUES (?,?,?,?,?,?,?,?,?)`,
      ['GlobalNet 品牌指南', 'GlobalNet', 'High', 'Tomorrow', 'todo', '需要一套完整的品牌指南', '', '', '']);
    db.run(`INSERT INTO tasks (title, client, priority, due, column, originalRequest, aiBreakdown, aiMjPrompts, aiStory) VALUES (?,?,?,?,?,?,?,?,?)`,
      ['TechFlow 网站设计', 'TechFlow', 'High', 'Today', 'inProgress', '重构官网首页', '', '', '']);
  }

  const countPlans = get(db, 'SELECT COUNT(*) as c FROM plans')?.c ?? 0;
  if (Number(countPlans) === 0) {
    db.run(`INSERT INTO plans (name, price, deliverySpeed, features, clients) VALUES (?,?,?,?,?)`,
      ['基础版', 1000, '平均 48 小时', JSON.stringify(['每月 1 个活跃设计请求', '无限次修改', '基础品牌资产设计']), 5]);
    db.run(`INSERT INTO plans (name, price, deliverySpeed, features, clients) VALUES (?,?,?,?,?)`,
      ['专业版', 2500, '平均 24-48 小时', JSON.stringify(['每月 2 个活跃设计请求', '无限次修改', '全套品牌视觉系统']), 8]);
    db.run(`INSERT INTO plans (name, price, deliverySpeed, features, clients) VALUES (?,?,?,?,?)`,
      ['企业版', 4500, '优先 24 小时', JSON.stringify(['每月 3 个活跃设计请求', '无限次修改', '定制插画与动效']), 2]);
  }

  const countFinance = get(db, 'SELECT COUNT(*) as c FROM finance_transactions')?.c ?? 0;
  if (Number(countFinance) === 0) {
    const today = new Date();
    const m = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    db.run(`INSERT INTO finance_transactions (type, amount, category, description, date) VALUES (?,?,?,?,?)`,
      ['income', 2500, '订阅收入', 'Acme Corp 专业版订阅', `${m}-01`]);
    db.run(`INSERT INTO finance_transactions (type, amount, category, description, date) VALUES (?,?,?,?,?)`,
      ['income', 4500, '订阅收入', 'GlobalNet 企业版订阅', `${m}-05`]);
    db.run(`INSERT INTO finance_transactions (type, amount, category, description, date) VALUES (?,?,?,?,?)`,
      ['expense', 120, '软件订阅', 'Figma & Adobe CC', `${m}-02`]);
  }
}

// ── Bulk sync helpers ──────────────────────────────────────────────────────

const SYNC_TABLES = [
  'leads', 'clients', 'tasks', 'plans',
  'finance_transactions', 'content_drafts',
  'today_focus_state', 'today_focus_manual',
  'payment_milestones',
] as const;

export async function exportAllData(): Promise<Record<string, any>> {
  const db = await getDb();
  const snapshot: Record<string, any> = {};
  for (const t of SYNC_TABLES) snapshot[t] = all(db, `SELECT * FROM ${t}`);
  // Include recent activity log for reference
  snapshot['activity_log'] = all(db, 'SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 500');
  // Include settings (avatar, name, etc.) — read from Zustand persisted storage
  try {
    const stored = JSON.parse(localStorage.getItem('solo-ceo-settings') || '{}');
    const state = stored?.state || {};
    snapshot['settings'] = {
      OPERATOR_NAME: state.operatorName || '',
      OPERATOR_AVATAR: state.operatorAvatar || '',
    };
  } catch {
    snapshot['settings'] = { OPERATOR_NAME: '', OPERATOR_AVATAR: '' };
  }
  return snapshot;
}

export async function importAllData(data: Record<string, any>): Promise<void> {
  const db = await getDb();
  for (const table of SYNC_TABLES) {
    const rows: any[] = data[table] ?? [];
    db.run(`DELETE FROM ${table}`);
    for (const row of rows) {
      const keys = Object.keys(row);
      if (!keys.length) continue;
      const cols = keys.join(', ');
      const vals = keys.map(() => '?').join(', ');
      db.run(
        `INSERT OR REPLACE INTO ${table} (${cols}) VALUES (${vals})`,
        Object.values(row)
      );
    }
  }
  // Restore settings (avatar, name) — write to Zustand persisted storage
  if (data.settings && typeof data.settings === 'object' && !Array.isArray(data.settings)) {
    try {
      const stored = JSON.parse(localStorage.getItem('solo-ceo-settings') || '{}');
      const state = stored?.state || {};
      if (data.settings.OPERATOR_NAME) state.operatorName = data.settings.OPERATOR_NAME;
      if (data.settings.OPERATOR_AVATAR) state.operatorAvatar = data.settings.OPERATOR_AVATAR;
      stored.state = state;
      localStorage.setItem('solo-ceo-settings', JSON.stringify(stored));
    } catch {}
    window.dispatchEvent(new Event('operator-name-updated'));
    window.dispatchEvent(new Event('operator-avatar-updated'));
  }
  await saveDb();
}

// ── Public init ────────────────────────────────────────────────────────────

export async function initDb(): Promise<void> {
  const db = await getDb();
  initSchema(db);
  seedData(db);
  await saveDb();
}

// ── Finance helpers ────────────────────────────────────────────────────────

function getFinanceRows(db: Database): any[] {
  // Single table query — matches online supabase-api.ts behavior
  return all(db, 'SELECT * FROM finance_transactions ORDER BY date DESC, id DESC');
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function handleApiRequest(
  method: string,
  path: string,
  body: any
): Promise<{ status: number; data: any }> {
  const db = await getDb();
  const ok = (data: any) => ({ status: 200, data });
  const err = (status: number, msg: string) => ({ status, data: { error: msg } });

  let dirty = false; // track if we need to saveDb()

  // ── LEADS ──────────────────────────────────────────────────────────────
  if (path === '/api/leads' && method === 'GET') {
    return ok(all(db, 'SELECT * FROM leads ORDER BY created_at DESC'));
  }

  if (path === '/api/leads' && method === 'POST') {
    const { name, industry, needs, website, column, aiDraft, source } = body;
    const res = run(db, `INSERT INTO leads (name, industry, needs, website, column, aiDraft, source)
      VALUES (?,?,?,?,?,?,?)`,
      [name||'', industry||'', needs||'', website||'', column||'new', aiDraft||'', source||'']);
    logActivity(db, 'lead', 'created', `新增线索：${name||'未命名线索'}`, source ? `来源：${source}` : '', res.lastInsertRowid);
    dirty = true;
    await saveDb();
    return ok({ id: res.lastInsertRowid });
  }

  const leadMatch = path.match(/^\/api\/leads\/(\d+)$/);
  if (leadMatch) {
    const id = leadMatch[1];
    if (method === 'PUT') {
      const { name, industry, needs, website, column, aiDraft, source } = body;
      const prev = get(db, 'SELECT name, column FROM leads WHERE id=?', [id]) as any;
      run(db, `UPDATE leads SET name=?,industry=?,needs=?,website=?,column=?,aiDraft=?,source=? WHERE id=?`,
        [name||'', industry||'', needs||'', website||'', column||'new', aiDraft||'', source||'', id]);
      const detail = prev?.column && prev.column !== (column||'new')
        ? `阶段：${prev.column} → ${column||'new'}` : '线索信息已更新';
      logActivity(db, 'lead', 'updated', `更新线索：${name||prev?.name||'未命名线索'}`, detail, id);
      dirty = true;
    } else if (method === 'DELETE') {
      const prev = get(db, 'SELECT name FROM leads WHERE id=?', [id]) as any;
      run(db, 'DELETE FROM leads WHERE id=?', [id]);
      logActivity(db, 'lead', 'deleted', `删除线索：${prev?.name||'未命名线索'}`, '', id);
      dirty = true;
    }
    if (dirty) await saveDb();
    return ok({ success: true });
  }

  const convertMatch = path.match(/^\/api\/leads\/(\d+)\/convert$/);
  if (convertMatch && method === 'POST') {
    const id = convertMatch[1];
    const lead = get(db, 'SELECT * FROM leads WHERE id=?', [id]) as any;
    if (!lead) return err(404, 'Lead not found');
    const { plan_tier, status, mrr, subscription_start_date, mrr_effective_from } = body || {};
    const np = normalizePlanTier(plan_tier || '');
    const today = new Date().toISOString().split('T')[0];
    const res = run(db, `INSERT INTO clients (name, industry, plan_tier, status, brand_context, mrr,
        subscription_start_date, paused_at, resumed_at, cancelled_at, mrr_effective_from)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [lead.name||'', lead.industry||'', np, status||'Active', lead.needs||'',
       Number(mrr||0), subscription_start_date||today, '', '', '',
       mrr_effective_from||subscription_start_date||today]);
    run(db, `UPDATE leads SET column='won' WHERE id=?`, [id]);
    syncClientSubscriptionLedger(db);
    logActivity(db, 'lead', 'converted', `线索转客户：${lead.name||'未命名线索'}`, np ? `方案：${np}` : '已转为客户', id);
    logActivity(db, 'client', 'created', `新增客户：${lead.name||'未命名客户'}`, np ? `来自线索转化 · 方案：${np}` : '来自线索转化', res.lastInsertRowid);
    await saveDb();
    return ok({ success: true, clientId: res.lastInsertRowid });
  }

  // ── CLIENTS ────────────────────────────────────────────────────────────
  if (path === '/api/clients' && method === 'GET') {
    syncClientSubscriptionLedger(db);
    const currentYear = new Date().getFullYear();
    const clients = all(db, 'SELECT * FROM clients ORDER BY joined_at DESC');
    const ledger = all(db, 'SELECT client_id, amount, ledger_month FROM client_subscription_ledger');
    const rows = clients.map((client) => {
      const cl = ledger.filter((r) => Number(r.client_id) === Number(client.id));
      const lifetimeRevenue = cl.reduce((s, r) => s + Number(r.amount || 0), 0);
      const ytdRevenue = cl
        .filter((r) => String(r.ledger_month || '').startsWith(`${currentYear}-`))
        .reduce((s, r) => s + Number(r.amount || 0), 0);
      return { ...client, lifetimeRevenue, ytdRevenue };
    });
    return ok(rows);
  }

  if (path === '/api/clients' && method === 'POST') {
    const { name, industry, plan_tier, status, brand_context, mrr,
            subscription_start_date, paused_at, resumed_at, cancelled_at, mrr_effective_from,
            company_name, contact_name, contact_email, contact_phone, billing_type, project_fee, project_end_date, tax_mode, tax_rate } = body;
    const np = normalizePlanTier(plan_tier||'');
    const res = run(db, `INSERT INTO clients (name, industry, plan_tier, status, brand_context, mrr,
        subscription_start_date, paused_at, resumed_at, cancelled_at, mrr_effective_from,
        company_name, contact_name, contact_email, contact_phone, billing_type, project_fee, project_end_date, tax_mode, tax_rate)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [name||'', industry||'', np, status||'Active', brand_context||'', mrr||0,
       subscription_start_date||'', paused_at||'', resumed_at||'', cancelled_at||'',
       mrr_effective_from||subscription_start_date||'',
       company_name||'', contact_name||'', contact_email||'', contact_phone||'', billing_type||'subscription', project_fee||0, project_end_date||'',
       tax_mode||'none', tax_rate||0]);
    syncClientSubscriptionLedger(db);
    logActivity(db, 'client', 'created', `新增客户：${name||'未命名客户'}`, np ? `方案：${np}` : '', res.lastInsertRowid);
    await saveDb();
    return ok({ id: res.lastInsertRowid });
  }

  const clientMatch = path.match(/^\/api\/clients\/(\d+)$/);
  if (clientMatch) {
    const id = clientMatch[1];
    if (method === 'PUT') {
      const { name, industry, plan_tier, status, brand_context, mrr,
              subscription_start_date, paused_at, resumed_at, cancelled_at, mrr_effective_from,
              company_name, contact_name, contact_email, contact_phone, billing_type, project_fee, project_end_date, tax_mode, tax_rate } = body;
      const prev = get(db, `SELECT name, status, plan_tier, mrr, subscription_start_date,
        paused_at, resumed_at, cancelled_at, mrr_effective_from FROM clients WHERE id=?`, [id]) as any;
      const np = normalizePlanTier(plan_tier||'');
      run(db, `UPDATE clients SET name=?,industry=?,plan_tier=?,status=?,brand_context=?,mrr=?,
        subscription_start_date=?,paused_at=?,resumed_at=?,cancelled_at=?,mrr_effective_from=?,
        company_name=?,contact_name=?,contact_email=?,contact_phone=?,billing_type=?,project_fee=?,project_end_date=?,tax_mode=?,tax_rate=? WHERE id=?`,
        [name||'', industry||'', np, status||'Active', brand_context||'', mrr||0,
         subscription_start_date||'', paused_at||'', resumed_at||'', cancelled_at||'',
         mrr_effective_from||subscription_start_date||'',
         company_name||'', contact_name||'', contact_email||'', contact_phone||'', billing_type||'subscription', project_fee||0, project_end_date||'',
         tax_mode||'none', tax_rate||0, id]);
      syncClientSubscriptionLedger(db);
      logActivity(db, 'client', 'updated', `更新客户：${name||prev?.name||'未命名客户'}`, '客户信息已更新', id);
      if (Number(prev?.mrr||0) !== Number(mrr||0))
        logActivity(db, 'finance', 'subscription_changed', `订阅金额调整：${name||prev?.name||'未命名客户'}`,
          `MRR：$${Number(prev?.mrr||0).toLocaleString()} → $${Number(mrr||0).toLocaleString()}`, id);
      if ((prev?.paused_at||'') !== (paused_at||'') && (paused_at||''))
        logActivity(db, 'finance', 'subscription_paused', `订阅暂停：${name||prev?.name||'未命名客户'}`, `暂停日期：${paused_at}`, id);
      if ((prev?.resumed_at||'') !== (resumed_at||'') && (resumed_at||''))
        logActivity(db, 'finance', 'subscription_resumed', `订阅恢复：${name||prev?.name||'未命名客户'}`, `恢复日期：${resumed_at}`, id);
      if ((prev?.cancelled_at||'') !== (cancelled_at||'') && (cancelled_at||''))
        logActivity(db, 'finance', 'subscription_cancelled', `订阅结束：${name||prev?.name||'未命名客户'}`, `结束日期：${cancelled_at}`, id);
      await saveDb();
      return ok({ success: true });
    }
    if (method === 'DELETE') {
      const prev = get(db, 'SELECT name FROM clients WHERE id=?', [id]) as any;
      run(db, 'DELETE FROM clients WHERE id=?', [id]);
      syncClientSubscriptionLedger(db);
      logActivity(db, 'client', 'deleted', `删除客户：${prev?.name||'未命名客户'}`, '', id);
      await saveDb();
      return ok({ success: true });
    }
  }

  // ── PAYMENT MILESTONES ──────────────────────────────────────────────────
  const milestoneListMatch = path.match(/^\/api\/clients\/(\d+)\/milestones$/);
  if (milestoneListMatch) {
    const clientId = milestoneListMatch[1];
    if (method === 'GET') {
      const today = new Date().toISOString().split('T')[0];
      const rows = all(db, 'SELECT * FROM payment_milestones WHERE client_id=? ORDER BY sort_order ASC, created_at ASC', [clientId]);
      const result = rows.map((m) => ({
        ...m,
        status: m.status === 'pending' && m.due_date && String(m.due_date) < today ? 'overdue' : m.status,
      }));
      return ok(result);
    }
    if (method === 'POST') {
      const { label, amount, percentage, due_date, payment_method, invoice_number, note, sort_order } = body;
      const res = run(db,
        `INSERT INTO payment_milestones (client_id, label, amount, percentage, due_date, payment_method, invoice_number, note, sort_order, status)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [clientId, label||'', amount||0, percentage||0, due_date||'', payment_method||'', invoice_number||'', note||'', sort_order??0, 'pending']);
      const client = get(db, 'SELECT name FROM clients WHERE id=?', [clientId]) as any;
      logActivity(db, 'milestone', 'created', `新增付款节点：${client?.name||''} · ${label||''}`,
        amount ? `$${Number(amount).toLocaleString()}` : '', res.lastInsertRowid);
      await saveDb();
      return ok({ id: res.lastInsertRowid });
    }
  }

  const milestoneMatch = path.match(/^\/api\/milestones\/(\d+)$/);
  if (milestoneMatch) {
    const id = milestoneMatch[1];
    if (method === 'PUT') {
      const { label, amount, percentage, due_date, payment_method, status, invoice_number, note, sort_order } = body;
      run(db,
        `UPDATE payment_milestones SET label=?,amount=?,percentage=?,due_date=?,payment_method=?,status=?,invoice_number=?,note=?,sort_order=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
        [label||'', amount||0, percentage||0, due_date||'', payment_method||'', status||'pending', invoice_number||'', note||'', sort_order??0, id]);
      await saveDb();
      return ok({ success: true });
    }
    if (method === 'DELETE') {
      const prev = get(db, 'SELECT label, finance_tx_id FROM payment_milestones WHERE id=?', [id]) as any;
      run(db, 'DELETE FROM payment_milestones WHERE id=?', [id]);
      if (prev?.finance_tx_id) {
        run(db, 'DELETE FROM finance_transactions WHERE id=?', [prev.finance_tx_id]);
      }
      logActivity(db, 'milestone', 'deleted', `删除付款节点：${prev?.label||''}`, '', id);
      await saveDb();
      return ok({ success: true });
    }
  }

  const markPaidMatch = path.match(/^\/api\/milestones\/(\d+)\/mark-paid$/);
  if (markPaidMatch && method === 'POST') {
    const id = markPaidMatch[1];
    const { payment_method, paid_date } = body || {};
    const actualDate = paid_date || new Date().toISOString().split('T')[0];
    const milestone = get(db, 'SELECT * FROM payment_milestones WHERE id=?', [id]) as any;
    if (!milestone) return err(404, 'Milestone not found');
    const client = get(db, 'SELECT name, tax_mode, tax_rate FROM clients WHERE id=?', [milestone.client_id]) as any;
    const clientName = client?.name || '';
    const txTaxMode = client?.tax_mode || 'none';
    const txTaxRate = Number(client?.tax_rate || 0);
    const txAmount = Number(milestone.amount||0);
    const txTaxAmount = txTaxMode === 'exclusive' ? Math.round((txAmount * txTaxRate) / 100 * 100) / 100
                      : txTaxMode === 'inclusive' ? Math.round((txAmount * txTaxRate) / (100 + txTaxRate) * 100) / 100
                      : 0;

    // Create finance transaction
    const txRes = run(db,
      `INSERT INTO finance_transactions (type, amount, category, description, date, status, client_id, client_name, tax_mode, tax_rate, tax_amount)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      ['income', txAmount, '项目收入',
       `${clientName} · ${milestone.label||'项目付款'}`, actualDate, '已完成',
       milestone.client_id, clientName, txTaxMode, txTaxRate, txTaxAmount]);

    // Update milestone
    run(db,
      `UPDATE payment_milestones SET status='paid', paid_date=?, payment_method=?, finance_tx_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [actualDate, payment_method || milestone.payment_method || '', txRes.lastInsertRowid, id]);

    logActivity(db, 'milestone', 'paid',
      `确认收款：${clientName} · ${milestone.label||'项目付款'}`,
      `$${Number(milestone.amount||0).toLocaleString()} · ${payment_method||''}`, id);
    await saveDb();
    return ok({ success: true, financeId: txRes.lastInsertRowid });
  }

  // ── TASKS ──────────────────────────────────────────────────────────────
  if (path === '/api/tasks' && method === 'GET') {
    return ok(all(db, 'SELECT * FROM tasks ORDER BY created_at DESC'));
  }

  if (path === '/api/tasks' && method === 'POST') {
    const { title, client, priority, due, column, originalRequest, aiBreakdown, aiMjPrompts, aiStory } = body;
    const res = run(db, `INSERT INTO tasks (title, client, priority, due, column, originalRequest, aiBreakdown, aiMjPrompts, aiStory)
      VALUES (?,?,?,?,?,?,?,?,?)`,
      [title||'', client||'', priority||'Medium', due||'', column||'todo',
       originalRequest||'', aiBreakdown||'', aiMjPrompts||'', aiStory||'']);
    logActivity(db, 'task', 'created', `新增任务：${title||'未命名任务'}`, client ? `客户：${client}` : '', res.lastInsertRowid);
    await saveDb();
    return ok({ id: res.lastInsertRowid });
  }

  const taskMatch = path.match(/^\/api\/tasks\/(\d+)$/);
  if (taskMatch) {
    const id = taskMatch[1];
    if (method === 'PUT') {
      const { title, client, priority, due, column, originalRequest, aiBreakdown, aiMjPrompts, aiStory } = body;
      const prev = get(db, 'SELECT title, column FROM tasks WHERE id=?', [id]) as any;
      run(db, `UPDATE tasks SET title=?,client=?,priority=?,due=?,column=?,
        originalRequest=?,aiBreakdown=?,aiMjPrompts=?,aiStory=? WHERE id=?`,
        [title||'', client||'', priority||'Medium', due||'', column||'todo',
         originalRequest||'', aiBreakdown||'', aiMjPrompts||'', aiStory||'', id]);
      const detail = prev?.column && prev.column !== (column||'todo')
        ? `看板：${prev.column} → ${column||'todo'}` : '任务内容已更新';
      logActivity(db, 'task', 'updated', `更新任务：${title||prev?.title||'未命名任务'}`, detail, id);
      await saveDb();
      return ok({ success: true });
    }
    if (method === 'DELETE') {
      const prev = get(db, 'SELECT title FROM tasks WHERE id=?', [id]) as any;
      run(db, 'DELETE FROM tasks WHERE id=?', [id]);
      logActivity(db, 'task', 'deleted', `删除任务：${prev?.title||'未命名任务'}`, '', id);
      await saveDb();
      return ok({ success: true });
    }
  }

  // ── PLANS ──────────────────────────────────────────────────────────────
  if (path === '/api/plans' && method === 'GET') {
    const planClientCounts = all(db,
      `SELECT plan_tier, COUNT(*) as count FROM clients WHERE status='Active' GROUP BY plan_tier`);
    const countMap = new Map<string, number>();
    for (const r of planClientCounts) countMap.set(r.plan_tier||'', Number(r.count||0));

    const aliases: Record<string, string[]> = {
      '基础版': ['基础版','Basic','basic'],
      '专业版': ['专业版','Pro','pro','Professional','professional'],
      '企业版': ['企业版','Enterprise','enterprise'],
    };
    const plans = all(db, 'SELECT * FROM plans').map((p) => {
      const al = aliases[p.name as string] || [p.name];
      const clients = al.reduce((s, a) => s + (countMap.get(a) || 0), 0);
      return { ...p, features: JSON.parse(p.features as string), clients };
    });
    return ok(plans);
  }

  if (path === '/api/plans' && method === 'POST') {
    const { name, price, deliverySpeed, features, clients } = body;
    const res = run(db, `INSERT INTO plans (name, price, deliverySpeed, features, clients) VALUES (?,?,?,?,?)`,
      [name||'', price||0, deliverySpeed||'', JSON.stringify(features||[]), clients||0]);
    logActivity(db, 'plan', 'created', `新增方案：${name||'未命名方案'}`, price ? `价格：$${price}/月` : '', res.lastInsertRowid);
    await saveDb();
    return ok({ id: res.lastInsertRowid });
  }

  const planMatch = path.match(/^\/api\/plans\/(\d+)$/);
  if (planMatch) {
    const id = planMatch[1];
    if (method === 'PUT') {
      const { name, price, deliverySpeed, features, clients } = body;
      run(db, `UPDATE plans SET name=?,price=?,deliverySpeed=?,features=?,clients=? WHERE id=?`,
        [name||'', price||0, deliverySpeed||'', JSON.stringify(features||[]), clients||0, id]);
      logActivity(db, 'plan', 'updated', `更新方案：${name||'未命名方案'}`, price ? `价格：$${price}/月` : '方案信息已更新', id);
      await saveDb();
      return ok({ success: true });
    }
    if (method === 'DELETE') {
      const prev = get(db, 'SELECT name FROM plans WHERE id=?', [id]) as any;
      run(db, 'DELETE FROM plans WHERE id=?', [id]);
      logActivity(db, 'plan', 'deleted', `删除方案：${prev?.name||'未命名方案'}`, '', id);
      await saveDb();
      return ok({ success: true });
    }
  }

  // ── FINANCE ────────────────────────────────────────────────────────────
  if (path === '/api/finance' && method === 'GET') {
    return ok(getFinanceRows(db));
  }

  if (path === '/api/finance/report' && method === 'GET') {
    const transactions = getFinanceRows(db);
    const completedIncome = transactions.filter((t: any) => t.type === 'income' && (t.status||'已完成') === '已完成').reduce((s,t) => s + Number(t.amount||0), 0);
    const completedExpense = transactions.filter((t: any) => t.type === 'expense' && (t.status||'已完成') === '已完成').reduce((s,t) => s + Number(t.amount||0), 0);
    const receivables = transactions.filter((t: any) => String(t.status||'').includes('应收')).reduce((s,t) => s + Number(t.amount||0), 0);
    const payables = transactions.filter((t: any) => String(t.status||'').includes('应付')).reduce((s,t) => s + Number(t.amount||0), 0);
    const totalTax = transactions.filter((t: any) => (t.status||'已完成') === '已完成' && Number(t.tax_amount||0) > 0).reduce((s,t) => s + Number(t.tax_amount||0), 0);
    const rows = transactions.slice(0,50).map((t: any) => { const taxInfo = Number(t.tax_amount||0) > 0 ? ` (税$${Number(t.tax_amount).toLocaleString()})` : ''; return `<tr><td>${t.date||''}</td><td>${t.description||''}</td><td>${t.category||''}</td><td>${t.type==='income'?'+':'-'}$${Number(t.amount||0).toLocaleString()}${taxInfo}</td><td>${t.status||'已完成'}</td></tr>`; }).join('');
    const html = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"/><title>一人CEO - 财务月度报表</title><style>body{font-family:-apple-system,sans-serif;padding:32px;color:#18181b}h1{font-size:28px;margin:0 0 8px}p{color:#71717a;margin:0 0 24px}.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:24px}.card{border:1px solid #e4e4e7;border-radius:16px;padding:16px}.label{font-size:12px;color:#71717a;margin-bottom:8px}.value{font-size:24px;font-weight:700}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px 12px;border-bottom:1px solid #e4e4e7;font-size:12px}th{background:#f4f4f5;color:#52525b}</style></head><body><h1>财务月度报表</h1><p>一人CEO · 导出时间 ${new Date().toLocaleString('zh-CN')}</p><div class="grid"><div class="card"><div class="label">已完成收入</div><div class="value">$${completedIncome.toLocaleString()}</div></div><div class="card"><div class="label">已完成支出</div><div class="value">$${completedExpense.toLocaleString()}</div></div><div class="card"><div class="label">净利润</div><div class="value">$${(completedIncome-completedExpense).toLocaleString()}</div></div><div class="card"><div class="label">应收 / 应付</div><div class="value">$${receivables.toLocaleString()} / $${payables.toLocaleString()}</div></div><div class="card"><div class="label">税费合计</div><div class="value">$${totalTax.toLocaleString()}</div></div></div><table><thead><tr><th>日期</th><th>描述</th><th>分类</th><th>金额</th><th>状态</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
    return { status: 200, data: html };
  }

  if (path === '/api/finance' && method === 'POST') {
    const { type, amount, category, description, date, status, tax_mode, tax_rate, tax_amount, client_id, client_name, source, source_id } = body;
    const res = run(db, `INSERT INTO finance_transactions (type, amount, category, description, date, status, tax_mode, tax_rate, tax_amount, client_id, client_name, source, source_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [type||'income', amount||0, category||'', description||'', date||'', status||'已完成', tax_mode||'none', tax_rate||0, tax_amount||0, client_id||null, client_name||'', source||'manual', source_id||null]);
    logActivity(db, 'finance', 'created', `新增交易：${description||'未命名交易'}`,
      `${type==='income'?'+':'-'}$${Number(amount||0).toLocaleString()} · ${category||'未分类'}`, res.lastInsertRowid);
    await saveDb();
    return ok({ id: res.lastInsertRowid });
  }

  const financeMatch = path.match(/^\/api\/finance\/(\d+)$/);
  if (financeMatch) {
    const id = Number(financeMatch[1]);
    // Check source — only manual transactions can be edited/deleted
    const txRow = get(db, 'SELECT source, description FROM finance_transactions WHERE id=?', [id]) as any;
    if (!txRow) return err(404, 'Transaction not found');
    const src = txRow.source || 'manual';
    if (src === 'subscription') return err(400, '订阅流水由客户状态自动生成，请在客户管理中编辑');
    if (src === 'milestone') return err(400, '此交易由里程碑自动生成，请前往签约客户中修改');
    if (src === 'project_fee') return err(400, '项目总费待收款，请在客户管理中编辑');

    if (method === 'PUT') {
      const { type, amount, category, description, date, status, tax_mode, tax_rate, tax_amount, client_id, client_name } = body;
      run(db, `UPDATE finance_transactions SET type=?,amount=?,category=?,description=?,date=?,status=?,tax_mode=?,tax_rate=?,tax_amount=?,client_id=?,client_name=? WHERE id=?`,
        [type||'income', amount||0, category||'', description||'', date||'', status||'已完成', tax_mode||'none', tax_rate||0, tax_amount||0, client_id||null, client_name||'', id]);
      logActivity(db, 'finance', 'updated', `更新交易：${description||'未命名交易'}`, '', id);
      await saveDb();
      return ok({ success: true });
    }
    if (method === 'DELETE') {
      run(db, 'DELETE FROM finance_transactions WHERE id=?', [id]);
      logActivity(db, 'finance', 'deleted', `删除交易：${txRow.description||'未命名交易'}`, '', id);
      await saveDb();
      return ok({ success: true });
    }
  }

  // ── CONTENT DRAFTS ─────────────────────────────────────────────────────
  if (path === '/api/content-drafts' && method === 'GET') {
    return ok(all(db, 'SELECT * FROM content_drafts ORDER BY updated_at DESC, id DESC LIMIT 20'));
  }

  if (path === '/api/content-drafts' && method === 'POST') {
    const { id, topic, platform, language, content } = body;
    if (id) {
      run(db, `UPDATE content_drafts SET topic=?,platform=?,language=?,content=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
        [topic||'', platform||'', language||'zh', content||'', id]);
      logActivity(db, 'content', 'updated', `更新草稿：${topic||'未命名草稿'}`, platform ? `平台：${platform}` : '', id);
      await saveDb();
      return ok({ id, success: true });
    }
    const res = run(db, `INSERT INTO content_drafts (topic, platform, language, content) VALUES (?,?,?,?)`,
      [topic||'', platform||'', language||'zh', content||'']);
    logActivity(db, 'content', 'created', `保存草稿：${topic||'未命名草稿'}`, platform ? `平台：${platform}` : '', res.lastInsertRowid);
    await saveDb();
    return ok({ id: res.lastInsertRowid, success: true });
  }

  const contentMatch = path.match(/^\/api\/content-drafts\/(\d+)$/);
  if (contentMatch && method === 'DELETE') {
    const id = contentMatch[1];
    const prev = get(db, 'SELECT topic FROM content_drafts WHERE id=?', [id]) as any;
    run(db, 'DELETE FROM content_drafts WHERE id=?', [id]);
    logActivity(db, 'content', 'deleted', `删除草稿：${prev?.topic||'未命名草稿'}`, '', id);
    await saveDb();
    return ok({ success: true });
  }

  // ── TODAY FOCUS ────────────────────────────────────────────────────────
  if (path === '/api/today-focus/state' && method === 'POST') {
    const { focusKey, status } = body || {};
    if (!focusKey) return err(400, 'focusKey is required');
    const norm = status === 'completed' ? 'completed' : 'pending';
    upsertTodayFocusState(db, String(focusKey), norm);
    await saveDb();
    return ok({ success: true, focusKey: String(focusKey), status: norm });
  }

  if (path === '/api/today-focus/manual' && method === 'POST') {
    const { type, title, note } = body || {};
    if (!title || !String(title).trim()) return err(400, 'title is required');
    const focusDate = todayDateKey();
    const res = run(db, `INSERT INTO today_focus_manual (focus_date, type, title, note, updated_at)
      VALUES (?,?,?,?,CURRENT_TIMESTAMP)`,
      [focusDate, type||'系统', String(title).trim(), String(note||'').trim()]);
    const focusKey = `manual-${res.lastInsertRowid}`;
    upsertTodayFocusState(db, focusKey, 'pending', focusDate);
    logActivity(db, 'today_focus', 'manual_created', `记录今日事件：${String(title).trim()}`, type ? `类型：${type}` : '', res.lastInsertRowid);
    await saveDb();
    return ok({ success: true, id: res.lastInsertRowid, focusKey });
  }

  const manualMatch = path.match(/^\/api\/today-focus\/manual\/(\d+)$/);
  if (manualMatch) {
    const id = manualMatch[1];
    if (method === 'PUT') {
      const { type, title, note } = body || {};
      if (!title || !String(title).trim()) return err(400, 'title is required');
      const prev = get(db, 'SELECT title, type FROM today_focus_manual WHERE id=?', [id]) as any;
      if (!prev) return err(404, 'manual event not found');
      run(db, `UPDATE today_focus_manual SET type=?,title=?,note=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
        [type||'系统', String(title).trim(), String(note||'').trim(), id]);
      logActivity(db, 'today_focus', 'manual_updated', `更新今日事件：${String(title).trim()}`, `类型：${type||prev?.type||'系统'}`, id);
      await saveDb();
      return ok({ success: true, id: Number(id) });
    }
    if (method === 'DELETE') {
      const prev = get(db, 'SELECT title FROM today_focus_manual WHERE id=?', [id]) as any;
      if (!prev) return err(404, 'manual event not found');
      run(db, 'DELETE FROM today_focus_manual WHERE id=?', [id]);
      run(db, `DELETE FROM today_focus_state WHERE focus_date=? AND focus_key=?`, [todayDateKey(), `manual-${id}`]);
      logActivity(db, 'today_focus', 'manual_deleted', `删除今日事件：${prev?.title||'未命名事件'}`, '', id);
      await saveDb();
      return ok({ success: true });
    }
  }

  // ── DASHBOARD ──────────────────────────────────────────────────────────
  if (path === '/api/dashboard' && method === 'GET') {
    syncClientSubscriptionLedger(db);
    const clientsCount = Number(get(db, `SELECT COUNT(*) as c FROM clients WHERE status='Active'`)?.c || 0);
    const mrr = Number(get(db, `SELECT SUM(mrr) as s FROM clients WHERE status='Active'`)?.s || 0);
    const activeTasks = Number(get(db, `SELECT COUNT(*) as c FROM tasks WHERE column != 'done'`)?.c || 0);
    const leadsCount = Number(get(db, `SELECT COUNT(*) as c FROM leads`)?.c || 0);

    const ledgerSeries = all(db,
      `SELECT ledger_month, SUM(amount) as total FROM client_subscription_ledger GROUP BY ledger_month ORDER BY ledger_month ASC`);
    const currentYear = new Date().getFullYear();
    const mrrSeries = ledgerSeries.slice(-12).map((r) => {
      const [year, month] = String(r.ledger_month).split('-');
      return { name: `${year.slice(2)}-${month}`, mrr: Number(r.total||0) };
    });
    const ytdRevenue = ledgerSeries
      .filter((r) => String(r.ledger_month).startsWith(`${currentYear}-`))
      .reduce((s, r) => s + Number(r.total||0), 0);

    // Current month's income from finance_transactions
    const currentMonthStr = `${currentYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const monthlyIncomeRow = get(db,
      `SELECT COALESCE(SUM(amount), 0) as total FROM finance_transactions WHERE type='income' AND status='已完成' AND date LIKE ?`,
      [`${currentMonthStr}%`]);
    const monthlyIncome = Number((monthlyIncomeRow as any)?.total || 0);

    const recentActivityRows = all(db,
      `SELECT title as activity, detail, created_at as time, entity_type as type, action
       FROM activity_log ORDER BY datetime(created_at) DESC, id DESC LIMIT 8`);

    const recentActivity = [...recentActivityRows, ...getRecentSubscriptionEvents(db)]
      .sort((a: any, b: any) => String(b.time||b.sortKey||'').localeCompare(String(a.time||a.sortKey||'')))
      .slice(0, 8);

    const receivables = getFinanceRows(db).filter((t: any) => String(t.status||'').includes('应收'));
    const bestLead = get(db,
      `SELECT id, name, industry, needs, column FROM leads WHERE column IN ('proposal','contacted','new')
       ORDER BY CASE column WHEN 'proposal' THEN 1 WHEN 'contacted' THEN 2 ELSE 3 END, id DESC LIMIT 1`) as any;
    const urgentTask = get(db,
      `SELECT id, title, client, priority, due, column FROM tasks WHERE column != 'done'
       ORDER BY CASE priority WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END,
       COALESCE(NULLIF(due,''),'9999-12-31') ASC, id DESC LIMIT 1`) as any;

    // Overdue milestones detection
    const todayKey = todayDateKey();
    const overdueMs = get(db,
      `SELECT pm.id, pm.label, pm.amount, pm.due_date, c.name as client_name
       FROM payment_milestones pm
       JOIN clients c ON c.id = pm.client_id
       WHERE pm.status = 'pending' AND pm.due_date != '' AND pm.due_date < ? AND pm.soft_deleted = 0
       ORDER BY pm.due_date ASC LIMIT 1`, [todayKey]) as any;

    const systemTask = overdueMs
      ? { key: `system-overdue-ms-${overdueMs.id}`, type: '系统', title: `催收逾期款：${overdueMs.client_name} — ${overdueMs.label} $${Number(overdueMs.amount||0).toLocaleString()}`, reason: `该笔款项已于 ${overdueMs.due_date} 到期，需要尽快催收。`, actionHint: '去客户面板确认收款并标记已付' }
      : receivables[0]
      ? { key: `system-receivable-${receivables[0].id||'r'}`, type: '系统', title: `处理应收：${receivables[0].description||'未命名账款'}`, reason: '有待收款项时，先收钱比继续堆工作更重要。', actionHint: '去财务管理跟进回款' }
      : bestLead
        ? { key: `system-lead-${bestLead.id||'fallback'}`, type: '系统', title: `补齐线索信息：${bestLead.name||'未命名线索'}`, reason: '把高潜在线索信息补完整，后续跟进效率更高。', actionHint: '完善需求、来源和下一步动作' }
        : { key: 'system-content-asset', type: '系统', title: '整理一条内容资产', reason: '没有财务阻塞时，优先沉淀长期可复用资产。', actionHint: '去内容工坊保存一条可复用内容' };

    const focusStateMap = getTodayFocusStateMap(db);
    const autoFocus = [
      bestLead
        ? { key: `revenue-lead-${bestLead.id||'fallback'}`, type: '收入', title: `推进线索：${bestLead.name||'未命名线索'}`, reason: bestLead.column==='proposal' ? '它已经接近成交，今天推进最有机会带来收入。' : '这是当前最值得跟进的销售机会。', actionHint: bestLead.column==='proposal' ? '发提案跟进 / 促成确认' : '发送开发信或安排跟进' }
        : { key: 'revenue-fallback', type: '收入', title: '跟进一位潜在客户', reason: '今天至少推进一件直接指向收入的动作。', actionHint: '去销售看板处理最高意向线索' },
      urgentTask
        ? { key: `delivery-task-${urgentTask.id||'fallback'}`, type: '交付', title: `推进任务：${urgentTask.title||'未命名任务'}`, reason: urgentTask.priority==='High' ? '高优先级任务最容易影响客户满意度和交付节奏。' : '先推进当前最接近交付的任务。', actionHint: urgentTask.client ? `关联客户：${urgentTask.client}` : '打开任务卡继续执行' }
        : { key: 'delivery-fallback', type: '交付', title: '完成一个关键交付', reason: '每天至少推进一件真实交付，避免系统只转不产出。', actionHint: '去任务看板推进进行中任务' },
      systemTask,
    ];

    const manualFocusRows = all(db,
      `SELECT id, type, title, note FROM today_focus_manual WHERE focus_date=? ORDER BY id DESC`,
      [todayDateKey()]);
    const manualTodayEvents = manualFocusRows.map((row) => ({
      key: `manual-${row.id}`,
      type: row.type||'系统',
      title: row.title||'未命名事件',
      reason: row.note ? row.note : '手动记录的今日事件。',
      actionHint: '可作为今天的手动推进事项保存与追踪',
      isManual: true,
      status: focusStateMap[`manual-${row.id}`] || 'pending',
    }));

    const todayFocus = autoFocus.map((item: any) => ({ ...item, status: focusStateMap[item.key] || 'pending' }));

    return ok({ clientsCount, mrr, activeTasks, leadsCount, mrrSeries, recentActivity, ytdRevenue, monthlyIncome, todayFocus, manualTodayEvents });
  }

  // ── WEEKLY REPORT ──────────────────────────────────────────────
  if (path === '/api/weekly-report' && method === 'GET') {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const weekStart = monday.toISOString().split('T')[0];
    const weekEnd = sunday.toISOString().split('T')[0];

    const txRows = getFinanceRows(db);
    const weekTx = txRows.filter((t: any) => t.date >= weekStart && t.date <= weekEnd && (t.status || '已完成') === '已完成');
    const income = weekTx.filter((t: any) => t.type === 'income').reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
    const expenses = Math.abs(weekTx.filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + Number(t.amount || 0), 0));

    const tasksCompleted = Number(get(db, `SELECT COUNT(*) as c FROM tasks WHERE column='done'`)?.c || 0);
    const newClients = Number(get(db, `SELECT COUNT(*) as c FROM clients WHERE created_at >= ? AND created_at <= ?`, [`${weekStart}T00:00:00`, `${weekEnd}T23:59:59`])?.c || 0);
    const newLeads = Number(get(db, `SELECT COUNT(*) as c FROM leads WHERE created_at >= ? AND created_at <= ?`, [`${weekStart}T00:00:00`, `${weekEnd}T23:59:59`])?.c || 0);

    const activities = all(db,
      `SELECT title, detail, created_at as time, entity_type as type, action
       FROM activity_log WHERE created_at >= ? AND created_at <= ?
       ORDER BY datetime(created_at) DESC LIMIT 20`,
      [`${weekStart}T00:00:00`, `${weekEnd}T23:59:59`]);

    return ok({
      weekStart,
      weekEnd,
      income,
      expenses,
      netIncome: income - expenses,
      tasksCompleted,
      newClients,
      newLeads,
      activities,
    });
  }

  return err(404, `No handler for ${method} ${path}`);
}
