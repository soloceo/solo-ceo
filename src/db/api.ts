/**
 * Browser-side API handlers — mirrors every Express route in server.ts
 * using sql.js instead of better-sqlite3.
 */
import { Database } from 'sql.js';
import { getDb, saveDb, all, get, run, exec } from './index';
import { todayDateKey, dateToKey, monthKey, currentMonth } from '../lib/date-utils';
import { str, enumVal } from '../lib/validate';

// ── Input validation constants (must match supabase-api.ts) ────────────────
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

// ── Type definitions ────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- sql.js rows have dynamic columns
type DbRow = Record<string, any>;

// ── helpers ────────────────────────────────────────────────────────────────

function safeJsonParse<T>(val: unknown, fallback: T): T {
  if (typeof val !== 'string') return fallback;
  try { return JSON.parse(val) as T; } catch { return fallback; }
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
     FROM clients WHERE COALESCE(mrr, 0) > 0 AND soft_deleted=0`
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
          tax_mode: tm, tax_rate: tr, tax_amount: calcTaxOffline(amt, tm, tr),
        });
      }
      month += 1;
      if (month > 12) { month = 1; year += 1; }
    }
  }

  // Fetch existing subscription transactions
  const existing = all(db, `SELECT id, source_id, date, status FROM finance_transactions WHERE source='subscription' AND soft_deleted=0`);
  const existingMap = new Map<string, { id: number; status: string }>();
  for (const row of existing) {
    const m = String(row.date || '').substring(0, 7);
    existingMap.set(`${row.source_id}-${m}`, { id: row.id as number, status: String(row.status || '') });
  }

  // Upsert
  for (const [key, row] of shouldExist) {
    const exist = existingMap.get(key);
    if (exist) {
      // Preserve "已完成" only for past/today billing — future dates can't be paid yet
      const isFutureBilling = row.date > todayDateKey();
      const preservedStatus = (!isFutureBilling && exist.status === '已完成') ? '已完成' : row.status;
      run(db, `UPDATE finance_transactions SET amount=?, description=?, date=?, status=?, tax_mode=?, tax_rate=?, tax_amount=?, client_name=?, soft_deleted=0 WHERE id=?`,
        [row.amount, row.description, row.date, preservedStatus, row.tax_mode, row.tax_rate, row.tax_amount, row.client_name, exist.id]);
      existingMap.delete(key);
    } else {
      run(db, `INSERT INTO finance_transactions (type, source, source_id, amount, category, description, date, status, client_id, client_name, tax_mode, tax_rate, tax_amount) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [row.type, row.source, row.source_id, row.amount, row.category, row.description, row.date, row.status, row.client_id, row.client_name, row.tax_mode, row.tax_rate, row.tax_amount]);
    }
  }

  // Soft-delete removed
  for (const entry of existingMap.values()) {
    run(db, `UPDATE finance_transactions SET soft_deleted=1 WHERE id=?`, [entry.id]);
  }
}

function getRecentSubscriptionEvents(db: Database): DbRow[] {
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
      "column" TEXT DEFAULT 'todo',
      originalRequest TEXT,
      aiBreakdown TEXT,
      aiMjPrompts TEXT,
      aiStory TEXT,
      scope TEXT DEFAULT 'work',
      parent_id INTEGER,
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
    `ALTER TABLE tasks ADD COLUMN client_id INTEGER`,
    // soft_deleted columns for offline/online consistency
    `ALTER TABLE leads ADD COLUMN soft_deleted INTEGER DEFAULT 0`,
    `ALTER TABLE clients ADD COLUMN soft_deleted INTEGER DEFAULT 0`,
    `ALTER TABLE tasks ADD COLUMN soft_deleted INTEGER DEFAULT 0`,
    `ALTER TABLE plans ADD COLUMN soft_deleted INTEGER DEFAULT 0`,
    `ALTER TABLE finance_transactions ADD COLUMN soft_deleted INTEGER DEFAULT 0`,
    `ALTER TABLE content_drafts ADD COLUMN soft_deleted INTEGER DEFAULT 0`,
    `ALTER TABLE today_focus_manual ADD COLUMN soft_deleted INTEGER DEFAULT 0`,
    `ALTER TABLE payment_milestones ADD COLUMN soft_deleted INTEGER DEFAULT 0`,
    // Migration 003: Multi-project per client
    `CREATE TABLE IF NOT EXISTS client_projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      project_fee REAL DEFAULT 0,
      project_start_date TEXT DEFAULT '',
      project_end_date TEXT DEFAULT '',
      status TEXT DEFAULT 'active',
      tax_mode TEXT DEFAULT 'none',
      tax_rate REAL DEFAULT 0,
      note TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      soft_deleted INTEGER DEFAULT 0
    )`,
    `ALTER TABLE payment_milestones ADD COLUMN project_id INTEGER`,
    `ALTER TABLE finance_transactions ADD COLUMN project_id INTEGER`,
    // Migration 004: AI Agents
    `CREATE TABLE IF NOT EXISTS ai_agents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL DEFAULT '',
      avatar TEXT DEFAULT '',
      role TEXT DEFAULT '',
      personality TEXT DEFAULT '',
      rules TEXT DEFAULT '',
      tools TEXT DEFAULT '[]',
      conversation_starters TEXT DEFAULT '[]',
      template_id TEXT DEFAULT '',
      is_default INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      soft_deleted INTEGER DEFAULT 0
    )`,
    // Migration 005: AI Conversations
    `CREATE TABLE IF NOT EXISTS ai_conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      agent_id INTEGER,
      agent_ids TEXT DEFAULT '[]',
      messages TEXT DEFAULT '[]',
      soft_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    // app_settings KV store
    `CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL,
      value TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(key)
    )`,
  ];
  for (const m of migrations) {
    try { db.run(m); } catch { /* already exists */ }
  }

  // Auto-migrate existing project clients → client_projects
  try {
    const projClients = all(db, `SELECT id, name, company_name, project_fee, subscription_start_date, project_end_date, status, tax_mode, tax_rate FROM clients WHERE billing_type='project' AND (soft_deleted IS NULL OR soft_deleted=0)`);
    for (const c of projClients) {
      const exists = get(db, `SELECT id FROM client_projects WHERE client_id=?`, [c.id]);
      if (!exists) {
        const projName = c.company_name || c.name || 'Project 1';
        const st = c.status === 'Active' ? 'active' : c.status === 'Completed' ? 'completed' : c.status === 'Cancelled' ? 'cancelled' : 'active';
        run(db, `INSERT INTO client_projects (client_id, name, project_fee, project_start_date, project_end_date, status, tax_mode, tax_rate) VALUES (?,?,?,?,?,?,?,?)`,
          [c.id, projName, c.project_fee || 0, c.subscription_start_date || '', c.project_end_date || '', st, c.tax_mode || 'none', c.tax_rate || 0]);
      }
    }
    // Backfill project_id on milestones
    const orphanMs = all(db, `SELECT pm.id, pm.client_id FROM payment_milestones pm WHERE pm.project_id IS NULL`);
    for (const m of orphanMs) {
      const cp = get(db, `SELECT id FROM client_projects WHERE client_id=? AND (soft_deleted IS NULL OR soft_deleted=0) ORDER BY created_at ASC LIMIT 1`, [m.client_id]);
      if (cp) run(db, `UPDATE payment_milestones SET project_id=? WHERE id=?`, [cp.id, m.id]);
    }
    // Backfill project_id on finance transactions
    const orphanTx = all(db, `SELECT ft.id, ft.client_id FROM finance_transactions ft WHERE ft.project_id IS NULL AND ft.source IN ('milestone','project_fee')`);
    for (const t of orphanTx) {
      const cp = get(db, `SELECT id FROM client_projects WHERE client_id=? AND (soft_deleted IS NULL OR soft_deleted=0) ORDER BY created_at ASC LIMIT 1`, [t.client_id]);
      if (cp) run(db, `UPDATE finance_transactions SET project_id=? WHERE id=?`, [cp.id, t.id]);
    }
  } catch (e) { console.warn('[initSchema] project migration', e); }
}

function seedData(db: Database) {
  const countLeads = get(db, 'SELECT COUNT(*) as c FROM leads')?.c ?? 0;
  if (Number(countLeads) > 0) return; // Only seed once — if any data exists, skip all

  // ── Date helpers ──
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
  const today = fmt(now);
  const yesterday = fmt(addDays(now, -1));
  const twoDaysAgo = fmt(addDays(now, -2));
  const threeDaysAgo = fmt(addDays(now, -3));
  const fiveDaysAgo = fmt(addDays(now, -5));
  const tomorrow = fmt(addDays(now, 1));
  const dayAfterTomorrow = fmt(addDays(now, 2));
  const nextWeek = fmt(addDays(now, 7));
  const tenDaysLater = fmt(addDays(now, 10));
  const twoWeeksLater = fmt(addDays(now, 14));
  const m = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const lastMonth = now.getMonth() === 0
    ? `${now.getFullYear() - 1}-12`
    : `${now.getFullYear()}-${pad(now.getMonth())}`;

  // ═══════════════════════════════════════════════════════════════
  // 人设：李明（Ming），加拿大华人独立品牌设计师，经营一人设计工作室「Ming Design Studio」
  // 主营：品牌视觉设计（Logo / VI / 官网 / 社交媒体素材）
  // 模式：订阅制月费 + 项目制，同时服务 3-5 个北美客户
  // 目标：月收入稳定在 $8,000+，逐步从接单转向标准化产品
  // ═══════════════════════════════════════════════════════════════

  // ── Monthly revenue goal ──
  db.run(`INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)`, ['MONTHLY_REVENUE_GOAL', '8000']);

  // ── Leads (6 — realistic North American pipeline) ──
  db.run(`INSERT INTO leads (name, industry, needs, website, column, aiDraft, source) VALUES (?,?,?,?,?,?,?)`,
    ['Greenfield Coffee', '餐饮连锁', '品牌升级：新Logo + VI手册 + 门店空间视觉', 'greenfieldcoffee.ca', 'new', '', 'Instagram DM']);
  db.run(`INSERT INTO leads (name, industry, needs, website, column, aiDraft, source) VALUES (?,?,?,?,?,?,?)`,
    ['Bright Path Academy', '在线教育', '官网改版 + 课程详情页模板设计', 'brightpathacademy.com', 'contacted', '', '朋友介绍']);
  db.run(`INSERT INTO leads (name, industry, needs, website, column, aiDraft, source) VALUES (?,?,?,?,?,?,?)`,
    ['OceanBlu Tech', 'SaaS', 'Logo设计 + 品牌手册 + 产品官网', 'oceanblu.io', 'proposal', '', 'LinkedIn']);
  db.run(`INSERT INTO leads (name, industry, needs, website, column, aiDraft, source) VALUES (?,?,?,?,?,?,?)`,
    ['Timber & Co', '家居家具', '产品画册 + 电商详情页', 'timberandco.ca', 'won', '', '老客户转介绍']);
  db.run(`INSERT INTO leads (name, industry, needs, website, column, aiDraft, source) VALUES (?,?,?,?,?,?,?)`,
    ['Harvest Organics', '农业食品', '品牌包装设计 + 电商主图', '', 'new', '', 'Google搜索']);
  db.run(`INSERT INTO leads (name, industry, needs, website, column, aiDraft, source) VALUES (?,?,?,?,?,?,?)`,
    ['Apex Realty Group', '房地产', '楼盘宣传单页', '', 'lost', '', 'Networking活动']);

  // ── Clients (4 — subscription + project, interconnected with tasks/finance) ──
  // Subscription start dates — 2 months ago so ledger sync generates current + last month
  const twoMonthsAgo = (() => {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 2);
    return fmt(d);
  })();
  const sixWeeksAgo = (() => {
    const d = new Date(now);
    d.setDate(d.getDate() - 42);
    return fmt(d);
  })();
  // id=1
  db.run(`INSERT INTO clients (name, industry, plan_tier, status, brand_context, mrr, payment_method, billing_type, subscription_start_date, subscription_timeline) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    ['Nova Media', '数字媒体', 'Enterprise', 'Active', 'Trendy, youthful, high visual impact', 2500, 'auto', 'subscription', twoMonthsAgo, JSON.stringify([{ type: 'start', date: twoMonthsAgo }])]);
  // id=2
  db.run(`INSERT INTO clients (name, industry, plan_tier, status, brand_context, mrr, payment_method, billing_type, subscription_start_date, subscription_timeline) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    ['Atlas Architecture', '建筑设计', 'Professional', 'Active', 'Minimal, premium, monochrome palette', 1500, 'manual', 'subscription', sixWeeksAgo, JSON.stringify([{ type: 'start', date: sixWeeksAgo }])]);
  // id=3
  db.run(`INSERT INTO clients (name, industry, plan_tier, status, brand_context, mrr, payment_method, billing_type, project_fee) VALUES (?,?,?,?,?,?,?,?,?)`,
    ['Limelight Studios', '摄影工作室', '', 'Active', 'Fresh, natural, artistic aesthetic', 0, 'manual', 'project', 4800]);
  // id=4 — won from lead "Timber & Co", recently onboarded
  db.run(`INSERT INTO clients (name, industry, plan_tier, status, brand_context, mrr, payment_method, billing_type, project_fee) VALUES (?,?,?,?,?,?,?,?,?)`,
    ['Timber & Co', '家居家具', '', 'Active', 'Natural, handcrafted, warm aesthetic', 0, 'manual', 'project', 6000]);

  // ── Tasks — work scope (8 — cover all kanban columns, tied to real clients) ──
  db.run(`INSERT INTO tasks (title, client, priority, due, column, scope) VALUES (?,?,?,?,?,?)`,
    ['设计Nova Media 4月社交媒体套图', 'Nova Media', 'High', today, 'inProgress', 'work']);
  db.run(`INSERT INTO tasks (title, client, priority, due, column, scope) VALUES (?,?,?,?,?,?)`,
    ['更新Atlas Architecture品牌指南V2.0', 'Atlas Architecture', 'High', yesterday, 'inProgress', 'work']);
  db.run(`INSERT INTO tasks (title, client, priority, due, column, scope) VALUES (?,?,?,?,?,?)`,
    ['交付Limelight Studios官网设计终稿', 'Limelight Studios', 'High', today, 'review', 'work']);
  db.run(`INSERT INTO tasks (title, client, priority, due, column, scope) VALUES (?,?,?,?,?,?)`,
    ['制作OceanBlu Tech Logo提案（3套方案）', '', 'Medium', dayAfterTomorrow, 'todo', 'work']);
  db.run(`INSERT INTO tasks (title, client, priority, due, column, scope) VALUES (?,?,?,?,?,?)`,
    ['设计Nova Media短视频封面模板', 'Nova Media', 'Medium', nextWeek, 'todo', 'work']);
  db.run(`INSERT INTO tasks (title, client, priority, due, column, scope) VALUES (?,?,?,?,?,?)`,
    ['Timber & Co产品画册排版', 'Timber & Co', 'Medium', tenDaysLater, 'todo', 'work']);
  db.run(`INSERT INTO tasks (title, client, priority, due, column, scope) VALUES (?,?,?,?,?,?)`,
    ['制作Atlas Architecture季度汇报PPT', 'Atlas Architecture', 'Low', twoWeeksLater, 'todo', 'work']);
  db.run(`INSERT INTO tasks (title, client, priority, due, column, scope) VALUES (?,?,?,?,?,?)`,
    ['归档Nova Media 3月交付物', 'Nova Media', 'Low', '', 'done', 'work']);

  // ── Tasks — personal scope (4) ──
  db.run(`INSERT INTO tasks (title, priority, due, column, scope) VALUES (?,?,?,?,?)`,
    ['预约牙医复查', 'High', twoDaysAgo, 'todo', 'personal']);
  db.run(`INSERT INTO tasks (title, priority, due, column, scope) VALUES (?,?,?,?,?)`,
    ['整理本季度发票发给会计', 'Medium', tomorrow, 'todo', 'personal']);
  db.run(`INSERT INTO tasks (title, priority, due, column, scope) VALUES (?,?,?,?,?)`,
    ['续费域名和云服务器', 'Medium', nextWeek, 'todo', 'personal']);
  db.run(`INSERT INTO tasks (title, priority, due, column, scope) VALUES (?,?,?,?,?)`,
    ['读完《Positioning》笔记整理', 'Low', '', 'inProgress', 'personal']);

  // ── Tasks — work-memo scope (5 — quick notes, some with deadlines) ──
  db.run(`INSERT INTO tasks (title, due, column, scope) VALUES (?,?,?,?)`,
    ['给OceanBlu Tech发报价单，下午前发出', today, 'todo', 'work-memo']);
  db.run(`INSERT INTO tasks (title, due, column, scope) VALUES (?,?,?,?)`,
    ['和Limelight Studios确认首页定稿细节', yesterday, 'todo', 'work-memo']);
  db.run(`INSERT INTO tasks (title, due, column, scope) VALUES (?,?,?,?)`,
    ['联系Timber & Co确认画册尺寸和纸张', tomorrow, 'todo', 'work-memo']);
  db.run(`INSERT INTO tasks (title, due, column, scope) VALUES (?,?,?,?)`,
    ['研究Framer做作品集网站的可行性', '', 'todo', 'work-memo']);
  db.run(`INSERT INTO tasks (title, due, column, scope) VALUES (?,?,?,?)`,
    ['整理近半年作品集案例，选10个代表作', '', 'todo', 'work-memo']);

  // ── Plans (3 tiers — design subscription service, USD pricing) ──
  db.run(`INSERT INTO plans (name, price, deliverySpeed, features, clients) VALUES (?,?,?,?,?)`,
    ['Starter', 499, '48小时内', JSON.stringify(['每月1个活跃设计请求', '无限次修改', '源文件交付']), 6]);
  db.run(`INSERT INTO plans (name, price, deliverySpeed, features, clients) VALUES (?,?,?,?,?)`,
    ['Professional', 1500, '24-48小时', JSON.stringify(['每月2个活跃设计请求', '无限次修改', '全套品牌视觉系统', '专属Slack沟通频道']), 4]);
  db.run(`INSERT INTO plans (name, price, deliverySpeed, features, clients) VALUES (?,?,?,?,?)`,
    ['Enterprise', 2500, '24小时内优先', JSON.stringify(['每月3个活跃设计请求', '无限次修改', '定制插画与动效', '专属设计经理']), 2]);

  // ── Finance Transactions — income sources tied to actual clients ──
  // NOTE: Subscription income is NOT seeded here — syncClientSubscriptionLedger()
  // auto-generates subscription transactions from client MRR + timeline data.
  // Project milestone income (tied to Limelight Studios)
  db.run(`INSERT INTO finance_transactions (type, amount, category, description, date, status, source) VALUES (?,?,?,?,?,?,?)`,
    ['income', 1920, '项目收入', 'Limelight Studios官网设计 · 首付款40%', `${lastMonth}-18`, '已完成', 'milestone']);
  db.run(`INSERT INTO finance_transactions (type, amount, category, description, date, status, source) VALUES (?,?,?,?,?,?,?)`,
    ['income', 2880, '项目收入', 'Limelight Studios官网设计 · 尾款60%', nextWeek, '待收款 (应收)', 'milestone']);
  // Manual income (consultancy from won lead)
  db.run(`INSERT INTO finance_transactions (type, amount, category, description, date, status, source) VALUES (?,?,?,?,?,?,?)`,
    ['income', 800, '咨询收入', 'Timber & Co品牌诊断咨询', threeDaysAgo, '已完成', 'manual']);
  // Project fee (Timber & Co new project deposit)
  db.run(`INSERT INTO finance_transactions (type, amount, category, description, date, status, source) VALUES (?,?,?,?,?,?,?)`,
    ['income', 2400, '项目收入', 'Timber & Co产品画册 · 首付款40%', fiveDaysAgo, '已完成', 'milestone']);
  // Expenses (realistic North American freelancer costs in USD)
  db.run(`INSERT INTO finance_transactions (type, amount, category, description, date) VALUES (?,?,?,?,?)`,
    ['expense', 15, '软件订阅', 'Figma Professional 月费', `${m}-02`]);
  db.run(`INSERT INTO finance_transactions (type, amount, category, description, date) VALUES (?,?,?,?,?)`,
    ['expense', 55, '软件订阅', 'Adobe CC 全家桶', `${m}-03`]);
  db.run(`INSERT INTO finance_transactions (type, amount, category, description, date) VALUES (?,?,?,?,?)`,
    ['expense', 45, '办公支出', '打印 + 快递费', yesterday]);
  db.run(`INSERT INTO finance_transactions (type, amount, category, description, date) VALUES (?,?,?,?,?)`,
    ['expense', 32, '软件订阅', 'Notion + 域名续费', threeDaysAgo]);

  // ── Payment Milestones (2 projects with milestone tracking) ──
  // Limelight Studios project — 1 paid + 1 pending
  db.run(`INSERT INTO payment_milestones (client_id, label, amount, percentage, due_date, status, sort_order) VALUES (?,?,?,?,?,?,?)`,
    [3, '首付款 40%', 1920, 40, `${lastMonth}-18`, 'paid', 1]);
  db.run(`INSERT INTO payment_milestones (client_id, label, amount, percentage, due_date, status, sort_order) VALUES (?,?,?,?,?,?,?)`,
    [3, '尾款 60%', 2880, 60, nextWeek, 'pending', 2]);
  // Timber & Co project — deposit paid, final pending
  db.run(`INSERT INTO payment_milestones (client_id, label, amount, percentage, due_date, status, sort_order) VALUES (?,?,?,?,?,?,?)`,
    [4, '首付款 40%', 2400, 40, fiveDaysAgo, 'paid', 1]);
  db.run(`INSERT INTO payment_milestones (client_id, label, amount, percentage, due_date, status, sort_order) VALUES (?,?,?,?,?,?,?)`,
    [4, '尾款 60%', 3600, 60, twoWeeksLater, 'pending', 2]);

  // ── Client Subscription Ledger (MRR history — 2 months) ──
  db.run(`INSERT OR IGNORE INTO client_subscription_ledger (client_id, client_name, plan_tier, amount, ledger_month) VALUES (?,?,?,?,?)`,
    [1, 'Nova Media', 'Enterprise', 2500, lastMonth]);
  db.run(`INSERT OR IGNORE INTO client_subscription_ledger (client_id, client_name, plan_tier, amount, ledger_month) VALUES (?,?,?,?,?)`,
    [2, 'Atlas Architecture', 'Professional', 1500, lastMonth]);
  db.run(`INSERT OR IGNORE INTO client_subscription_ledger (client_id, client_name, plan_tier, amount, ledger_month) VALUES (?,?,?,?,?)`,
    [1, 'Nova Media', 'Enterprise', 2500, m]);
  db.run(`INSERT OR IGNORE INTO client_subscription_ledger (client_id, client_name, plan_tier, amount, ledger_month) VALUES (?,?,?,?,?)`,
    [2, 'Atlas Architecture', 'Professional', 1500, m]);

  // ── Activity Log (tell a story of recent work) ──
  const mins = (n: number) => new Date(now.getTime() - n * 60000).toISOString();
  db.run(`INSERT INTO activity_log (entity_type, action, title, detail, created_at) VALUES (?,?,?,?,?)`,
    ['task', 'completed', '完成任务：归档Nova Media 3月交付物', '', mins(30)]);
  db.run(`INSERT INTO activity_log (entity_type, action, title, detail, created_at) VALUES (?,?,?,?,?)`,
    ['lead', 'updated', '线索推进：OceanBlu Tech', '阶段变更：contacted → proposal', mins(90)]);
  db.run(`INSERT INTO activity_log (entity_type, action, title, detail, created_at) VALUES (?,?,?,?,?)`,
    ['finance', 'created', '收到付款：Timber & Co产品画册首付款 $2,400', '', mins(180)]);
  db.run(`INSERT INTO activity_log (entity_type, action, title, detail, created_at) VALUES (?,?,?,?,?)`,
    ['client', 'created', '新增客户：Timber & Co', '项目制 · 产品画册 $6,000', mins(300)]);
  db.run(`INSERT INTO activity_log (entity_type, action, title, detail, created_at) VALUES (?,?,?,?,?)`,
    ['finance', 'created', '收到付款：Timber & Co品牌诊断咨询 $800', '', mins(600)]);
  db.run(`INSERT INTO activity_log (entity_type, action, title, detail, created_at) VALUES (?,?,?,?,?)`,
    ['lead', 'created', '新增线索：Harvest Organics', '来源：Google搜索', mins(1440)]);
  db.run(`INSERT INTO activity_log (entity_type, action, title, detail, created_at) VALUES (?,?,?,?,?)`,
    ['lead', 'created', '新增线索：Greenfield Coffee', '来源：Instagram DM', mins(2880)]);
}

// ── Bulk sync helpers ──────────────────────────────────────────────────────

const SYNC_TABLES = [
  'leads', 'clients', 'tasks', 'plans',
  'finance_transactions', 'content_drafts',
  'today_focus_state', 'today_focus_manual',
  'payment_milestones', 'client_projects',
  'ai_agents', 'ai_conversations',
] as const;

export async function exportAllData(): Promise<Record<string, any>> {
  const db = await getDb();
  const snapshot: Record<string, any> = {};
  for (const t of SYNC_TABLES) snapshot[t] = all(db, `SELECT * FROM ${t}`);
  // Include recent activity log for reference
  snapshot['activity_log'] = all(db, 'SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 500');
  // Include settings (profile fields) — read from Zustand persisted storage
  try {
    const stored = JSON.parse(localStorage.getItem('solo-ceo-settings') || '{}');
    const state = stored?.state || {};
    const FIELD_MAP: Record<string, string> = {
      operatorName: 'OPERATOR_NAME', operatorAvatar: 'OPERATOR_AVATAR',
      businessName: 'BUSINESS_NAME', businessDescription: 'BUSINESS_DESCRIPTION',
      businessTitle: 'BUSINESS_TITLE', businessEmail: 'BUSINESS_EMAIL',
      businessPhone: 'BUSINESS_PHONE', businessWebsite: 'BUSINESS_WEBSITE',
      businessLocation: 'BUSINESS_LOCATION',
    };
    const s: Record<string, string> = {};
    for (const [local, remote] of Object.entries(FIELD_MAP)) s[remote] = state[local] || '';
    snapshot['settings'] = s;
  } catch {
    snapshot['settings'] = {};
  }
  return snapshot;
}

export async function importAllData(data: Record<string, unknown>): Promise<void> {
  const db = await getDb();
  try {
    db.run('BEGIN TRANSACTION');
    for (const table of SYNC_TABLES) {
      const rows: DbRow[] = (data[table] as DbRow[]) ?? [];
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
    db.run('COMMIT');
  } catch (e) {
    db.run('ROLLBACK');
    throw e;
  }
  // Restore settings (profile fields) — write to Zustand persisted storage
  const settings = data.settings as Record<string, string> | undefined;
  if (settings && typeof settings === 'object' && !Array.isArray(settings)) {
    try {
      const stored = JSON.parse(localStorage.getItem('solo-ceo-settings') || '{}');
      const state = stored?.state || {};
      const REVERSE_MAP: Record<string, string> = {
        OPERATOR_NAME: 'operatorName', OPERATOR_AVATAR: 'operatorAvatar',
        BUSINESS_NAME: 'businessName', BUSINESS_DESCRIPTION: 'businessDescription',
        BUSINESS_TITLE: 'businessTitle', BUSINESS_EMAIL: 'businessEmail',
        BUSINESS_PHONE: 'businessPhone', BUSINESS_WEBSITE: 'businessWebsite',
        BUSINESS_LOCATION: 'businessLocation',
      };
      for (const [remote, local] of Object.entries(REVERSE_MAP)) {
        if (settings[remote]) state[local] = settings[remote];
      }
      stored.state = state;
      localStorage.setItem('solo-ceo-settings', JSON.stringify(stored));
    } catch (e) { console.warn('[api] restoreSettings', e); }
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

function getFinanceRows(db: Database): DbRow[] {
  // Single table query — matches online supabase-api.ts behavior
  return all(db, 'SELECT * FROM finance_transactions WHERE soft_deleted=0 ORDER BY date DESC, id DESC');
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function handleApiRequest(
  method: string,
  path: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- request body is dynamically typed JSON
  body: Record<string, any>
): Promise<{ status: number; data: unknown }> {
  const db = await getDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- response data varies by endpoint
  const ok = (data: any) => ({ status: 200, data });
  const err = (status: number, msg: string) => ({ status, data: { error: msg } });

  let dirty = false; // track if we need to saveDb()

  // ── LEADS ──────────────────────────────────────────────────────────────
  if (path === '/api/leads' && method === 'GET') {
    return ok(all(db, 'SELECT * FROM leads WHERE soft_deleted=0 ORDER BY created_at DESC'));
  }

  if (path === '/api/leads' && method === 'POST') {
    const { name, industry, needs, website, column, aiDraft, source } = body;
    const res = run(db, `INSERT INTO leads (name, industry, needs, website, column, aiDraft, source)
      VALUES (?,?,?,?,?,?,?)`,
      [str(name, 255), str(industry, 100), str(needs, 2000), str(website, 2048), enumVal(column, VALID_LEAD_COLUMNS, 'new'), str(aiDraft, 5000), str(source, 100)]);
    logActivity(db, 'lead', 'created', `新增线索：${name||'未命名线索'}`, source ? `来源：${source}` : '', res.lastInsertRowid);
    dirty = true;
    await saveDb();
    return ok({ id: res.lastInsertRowid });
  }

  const leadMatch = path.match(/^\/api\/leads\/(\d+)$/);
  if (leadMatch) {
    const id = leadMatch[1];
    if (method === 'PUT') {
      const prev = get(db, 'SELECT name, column FROM leads WHERE id=?', [id]) as DbRow;
      const sets: string[] = [];
      const vals: unknown[] = [];
      if (body.name !== undefined) { sets.push('name=?'); vals.push(str(body.name, 255)); }
      if (body.industry !== undefined) { sets.push('industry=?'); vals.push(str(body.industry, 100)); }
      if (body.needs !== undefined) { sets.push('needs=?'); vals.push(str(body.needs, 2000)); }
      if (body.website !== undefined) { sets.push('website=?'); vals.push(str(body.website, 2048)); }
      if (body.column !== undefined) { sets.push('"column"=?'); vals.push(enumVal(body.column, VALID_LEAD_COLUMNS, 'new')); }
      if (body.aiDraft !== undefined) { sets.push('aiDraft=?'); vals.push(str(body.aiDraft, 5000)); }
      if (body.source !== undefined) { sets.push('source=?'); vals.push(str(body.source, 100)); }
      if (sets.length > 0) {
        vals.push(id);
        run(db, `UPDATE leads SET ${sets.join(',')} WHERE id=?`, vals);
      }
      const detail = prev?.column && body.column !== undefined && prev.column !== body.column
        ? `阶段：${prev.column} → ${body.column}` : '线索信息已更新';
      logActivity(db, 'lead', 'updated', `更新线索：${body.name||prev?.name||'未命名线索'}`, detail, id);
      dirty = true;
    } else if (method === 'DELETE') {
      const prev = get(db, 'SELECT name FROM leads WHERE id=?', [id]) as DbRow;
      run(db, 'UPDATE leads SET soft_deleted=1 WHERE id=?', [id]);
      logActivity(db, 'lead', 'deleted', `删除线索：${prev?.name||'未命名线索'}`, '', id);
      dirty = true;
    }
    if (dirty) await saveDb();
    return ok({ success: true });
  }

  const convertMatch = path.match(/^\/api\/leads\/(\d+)\/convert$/);
  if (convertMatch && method === 'POST') {
    const id = convertMatch[1];
    const lead = get(db, 'SELECT * FROM leads WHERE id=?', [id]) as DbRow;
    if (!lead) return err(404, 'Lead not found');
    const { plan_tier, status, mrr, subscription_start_date, mrr_effective_from, billing_type, project_fee } = body || {};
    const np = normalizePlanTier(plan_tier || '');
    const bt = enumVal(billing_type, VALID_BILLING_TYPES, 'subscription');
    const today = todayDateKey();
    const res = run(db, `INSERT INTO clients (name, industry, plan_tier, status, brand_context, mrr,
        subscription_start_date, paused_at, resumed_at, cancelled_at, mrr_effective_from,
        billing_type, project_fee, subscription_timeline)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [lead.name||'', lead.industry||'', np, enumVal(status, VALID_CLIENT_STATUSES, 'Active'), lead.needs||'',
       bt === 'subscription' ? Number(mrr||0) : 0, subscription_start_date||today, '', '', '',
       mrr_effective_from||subscription_start_date||today,
       bt, bt === 'project' ? Number(project_fee||0) : 0,
       JSON.stringify([{ type: 'start', date: subscription_start_date || today }])]);
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
    const clients = all(db, 'SELECT * FROM clients WHERE soft_deleted=0 ORDER BY joined_at DESC');
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
            subscription_start_date, paused_at, resumed_at, cancelled_at, mrr_effective_from, subscription_timeline,
            company_name, contact_name, contact_email, contact_phone, billing_type, project_fee, project_end_date, tax_mode, tax_rate, drive_folder_url, payment_method } = body;
    const np = normalizePlanTier(plan_tier||'');
    const bt = enumVal(billing_type, VALID_BILLING_TYPES, 'subscription');
    const res = run(db, `INSERT INTO clients (name, industry, plan_tier, status, brand_context, mrr,
        subscription_start_date, paused_at, resumed_at, cancelled_at, mrr_effective_from, subscription_timeline,
        company_name, contact_name, contact_email, contact_phone, billing_type, project_fee, project_end_date, tax_mode, tax_rate, drive_folder_url, payment_method)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [str(name, 255), str(industry, 100), np, enumVal(status, VALID_CLIENT_STATUSES, 'Active'), str(brand_context, 2000), mrr||0,
       str(subscription_start_date, 10), str(paused_at, 10), str(resumed_at, 10), str(cancelled_at, 10),
       str(mrr_effective_from, 10) || str(subscription_start_date, 10),
       subscription_timeline || JSON.stringify(subscription_start_date ? [{ type: 'start', date: subscription_start_date }] : []),
       str(company_name, 255), str(contact_name, 255), str(contact_email, 320), str(contact_phone, 30), bt, project_fee||0, str(project_end_date, 10),
       enumVal(tax_mode, VALID_TAX_MODES, 'none'), tax_rate||0, str(drive_folder_url, 2048), enumVal(payment_method, VALID_PAYMENT_METHODS, 'auto')]);
    syncClientSubscriptionLedger(db);
    logActivity(db, 'client', 'created', `新增客户：${name||'未命名客户'}`, np ? `方案：${np}` : '', res.lastInsertRowid);
    await saveDb();
    return ok({ id: res.lastInsertRowid });
  }

  const clientMatch = path.match(/^\/api\/clients\/(\d+)$/);
  if (clientMatch) {
    const id = clientMatch[1];
    if (method === 'PUT') {
      const prev = get(db, `SELECT name, status, plan_tier, mrr, subscription_start_date,
        paused_at, resumed_at, cancelled_at, mrr_effective_from FROM clients WHERE id=?`, [id]) as DbRow;
      const sets: string[] = [];
      const vals: unknown[] = [];
      if (body.name !== undefined) { sets.push('name=?'); vals.push(str(body.name, 255)); }
      if (body.industry !== undefined) { sets.push('industry=?'); vals.push(str(body.industry, 100)); }
      if (body.brand_context !== undefined) { sets.push('brand_context=?'); vals.push(str(body.brand_context, 2000)); }
      if (body.subscription_start_date !== undefined) { sets.push('subscription_start_date=?'); vals.push(str(body.subscription_start_date, 10)); }
      if (body.paused_at !== undefined) { sets.push('paused_at=?'); vals.push(str(body.paused_at, 10)); }
      if (body.resumed_at !== undefined) { sets.push('resumed_at=?'); vals.push(str(body.resumed_at, 10)); }
      if (body.cancelled_at !== undefined) { sets.push('cancelled_at=?'); vals.push(str(body.cancelled_at, 10)); }
      if (body.mrr_effective_from !== undefined) { sets.push('mrr_effective_from=?'); vals.push(str(body.mrr_effective_from, 10) || str(body.subscription_start_date, 10)); }
      if (body.subscription_timeline !== undefined) { sets.push('subscription_timeline=?'); vals.push(body.subscription_timeline || '[]'); }
      if (body.company_name !== undefined) { sets.push('company_name=?'); vals.push(str(body.company_name, 255)); }
      if (body.contact_name !== undefined) { sets.push('contact_name=?'); vals.push(str(body.contact_name, 255)); }
      if (body.contact_email !== undefined) { sets.push('contact_email=?'); vals.push(str(body.contact_email, 320)); }
      if (body.contact_phone !== undefined) { sets.push('contact_phone=?'); vals.push(str(body.contact_phone, 30)); }
      if (body.project_end_date !== undefined) { sets.push('project_end_date=?'); vals.push(str(body.project_end_date, 10)); }
      if (body.plan_tier !== undefined) { sets.push('plan_tier=?'); vals.push(normalizePlanTier(body.plan_tier||'')); }
      if (body.status !== undefined) { sets.push('status=?'); vals.push(enumVal(body.status, VALID_CLIENT_STATUSES, 'Active')); }
      if (body.mrr !== undefined) { sets.push('mrr=?'); vals.push(body.mrr); }
      if (body.billing_type !== undefined) { sets.push('billing_type=?'); vals.push(enumVal(body.billing_type, VALID_BILLING_TYPES, 'subscription')); }
      if (body.project_fee !== undefined) { sets.push('project_fee=?'); vals.push(body.project_fee); }
      if (body.tax_mode !== undefined) { sets.push('tax_mode=?'); vals.push(enumVal(body.tax_mode, VALID_TAX_MODES, 'none')); }
      if (body.tax_rate !== undefined) { sets.push('tax_rate=?'); vals.push(body.tax_rate); }
      if (body.drive_folder_url !== undefined) { sets.push('drive_folder_url=?'); vals.push(str(body.drive_folder_url, 2048)); }
      if (body.payment_method !== undefined) { sets.push('payment_method=?'); vals.push(enumVal(body.payment_method, VALID_PAYMENT_METHODS, 'auto')); }
      if (sets.length > 0) {
        vals.push(id);
        run(db, `UPDATE clients SET ${sets.join(',')} WHERE id=?`, vals);
      }
      syncClientSubscriptionLedger(db);
      const displayName = body.name ?? prev?.name ?? '未命名客户';
      logActivity(db, 'client', 'updated', `更新客户：${displayName}`, '客户信息已更新', id);
      if (body.mrr !== undefined && Number(prev?.mrr||0) !== Number(body.mrr||0))
        logActivity(db, 'finance', 'subscription_changed', `订阅金额调整：${displayName}`,
          `MRR：$${Number(prev?.mrr||0).toLocaleString()} → $${Number(body.mrr||0).toLocaleString()}`, id);
      if (body.paused_at !== undefined && (prev?.paused_at||'') !== (body.paused_at||'') && (body.paused_at||''))
        logActivity(db, 'finance', 'subscription_paused', `订阅暂停：${displayName}`, `暂停日期：${body.paused_at}`, id);
      if (body.resumed_at !== undefined && (prev?.resumed_at||'') !== (body.resumed_at||'') && (body.resumed_at||''))
        logActivity(db, 'finance', 'subscription_resumed', `订阅恢复：${displayName}`, `恢复日期：${body.resumed_at}`, id);
      if (body.cancelled_at !== undefined && (prev?.cancelled_at||'') !== (body.cancelled_at||'') && (body.cancelled_at||''))
        logActivity(db, 'finance', 'subscription_cancelled', `订阅结束：${displayName}`, `结束日期：${body.cancelled_at}`, id);
      await saveDb();
      return ok({ success: true });
    }
    if (method === 'DELETE') {
      const prev = get(db, 'SELECT name, company_name FROM clients WHERE id=?', [id]) as DbRow;

      // Fix Bug 1: Clean up related records before deleting the client
      const clientCompanyName = prev?.company_name || prev?.name || '';

      // Unlink tasks by client_id (reliable), fallback to name match for legacy data
      run(db, "UPDATE tasks SET client='', client_id=NULL WHERE client_id=?", [id]);
      run(db, "UPDATE tasks SET client='' WHERE client=? AND client_id IS NULL", [clientCompanyName]);

      // Unlink finance transactions - set client_id to null but preserve client_name for display
      const clientName = prev?.company_name || prev?.name || '';
      run(db, "UPDATE finance_transactions SET client_id=NULL, client_name=? WHERE client_id=?", [clientName, id]);

      // Delete payment milestones and projects
      run(db, 'UPDATE payment_milestones SET soft_deleted=1 WHERE client_id=?', [id]);
      run(db, 'UPDATE client_projects SET soft_deleted=1 WHERE client_id=?', [id]);

      // Delete the client
      run(db, 'UPDATE clients SET soft_deleted=1 WHERE id=?', [id]);
      syncClientSubscriptionLedger(db);
      logActivity(db, 'client', 'deleted', `删除客户：${prev?.name||'未命名客户'}`, '', id);
      await saveDb();
      return ok({ success: true });
    }
  }

  // ── CLIENT PROJECTS ─────────────────────────────────────────────────────
  const projectListMatch = path.match(/^\/api\/clients\/(\d+)\/projects$/);
  if (projectListMatch) {
    const clientId = projectListMatch[1];
    if (method === 'GET') {
      const rows = all(db, `SELECT * FROM client_projects WHERE client_id=? AND (soft_deleted IS NULL OR soft_deleted=0) ORDER BY sort_order ASC, created_at DESC`, [clientId]);
      return ok(rows);
    }
    if (method === 'POST') {
      const res = run(db, `INSERT INTO client_projects (client_id, name, project_fee, project_start_date, project_end_date, status, tax_mode, tax_rate, note) VALUES (?,?,?,?,?,?,?,?,?)`,
        [clientId, str(body.name, 255) || 'New Project', body.project_fee || 0, str(body.project_start_date, 10), str(body.project_end_date, 10), 'active', enumVal(body.tax_mode, VALID_TAX_MODES, 'none'), body.tax_rate || 0, str(body.note, 2000)]);
      logActivity(db, 'project', 'created', `New project: ${body.name || 'New Project'}`, '', res.lastInsertRowid);
      await saveDb();
      return ok({ id: res.lastInsertRowid });
    }
  }

  const projectMatch = path.match(/^\/api\/projects\/(\d+)$/);
  if (projectMatch) {
    const id = projectMatch[1];
    if (method === 'PUT') {
      const sets: string[] = [];
      const vals: unknown[] = [];
      if (body.name !== undefined) { sets.push('name=?'); vals.push(str(body.name, 255)); }
      if (body.project_fee !== undefined) { sets.push('project_fee=?'); vals.push(body.project_fee || 0); }
      if (body.project_start_date !== undefined) { sets.push('project_start_date=?'); vals.push(str(body.project_start_date, 10)); }
      if (body.project_end_date !== undefined) { sets.push('project_end_date=?'); vals.push(str(body.project_end_date, 10)); }
      if (body.status !== undefined) { sets.push('status=?'); vals.push(enumVal(body.status, VALID_PROJECT_STATUSES, 'active')); }
      if (body.tax_mode !== undefined) { sets.push('tax_mode=?'); vals.push(enumVal(body.tax_mode, VALID_TAX_MODES, 'none')); }
      if (body.tax_rate !== undefined) { sets.push('tax_rate=?'); vals.push(body.tax_rate || 0); }
      if (body.note !== undefined) { sets.push('note=?'); vals.push(str(body.note, 2000)); }
      if (body.sort_order !== undefined) { sets.push('sort_order=?'); vals.push(body.sort_order); }
      if (sets.length > 0) { vals.push(id); run(db, `UPDATE client_projects SET ${sets.join(',')} WHERE id=?`, vals); }
      await saveDb();
      return ok({ success: true });
    }
    if (method === 'DELETE') {
      run(db, 'UPDATE payment_milestones SET soft_deleted=1 WHERE project_id=?', [id]);
      run(db, 'UPDATE client_projects SET soft_deleted=1 WHERE id=?', [id]);
      await saveDb();
      return ok({ success: true });
    }
  }

  // ── PAYMENT MILESTONES ──────────────────────────────────────────────────
  const milestoneListMatch = path.match(/^\/api\/clients\/(\d+)\/milestones$/);
  if (milestoneListMatch) {
    const clientId = milestoneListMatch[1];
    if (method === 'GET') {
      const today = todayDateKey();
      const rows = all(db, 'SELECT * FROM payment_milestones WHERE client_id=? AND soft_deleted=0 ORDER BY sort_order ASC, created_at ASC', [clientId]);
      const result = rows.map((m) => ({
        ...m,
        status: m.status === 'pending' && m.due_date && String(m.due_date) < today ? 'overdue' : m.status,
      }));
      return ok(result);
    }
    if (method === 'POST') {
      const { label, amount, percentage, due_date, payment_method, invoice_number, note, sort_order, project_id } = body;
      const res = run(db,
        `INSERT INTO payment_milestones (client_id, label, amount, percentage, due_date, payment_method, invoice_number, note, sort_order, status, project_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [clientId, str(label, 255), amount||0, percentage||0, str(due_date, 10), str(payment_method, 50), str(invoice_number, 100), str(note, 1000), sort_order??0, 'pending', project_id||null]);
      const msId = res.lastInsertRowid;
      const client = get(db, 'SELECT name FROM clients WHERE id=?', [clientId]) as DbRow;
      const cName = (client?.name as string) || '';
      const txAmt = Number(amount || 0);
      if (txAmt > 0) {
        const txRes = run(db,
          `INSERT INTO finance_transactions (type, amount, category, description, date, status, source, source_id, client_id, client_name)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
          ['income', txAmt, '项目收入', `${cName} · ${label || '项目付款'}`, due_date || todayDateKey(), '待收款 (应收)', 'milestone', msId, clientId, cName]);
        const txId = txRes.lastInsertRowid;
        if (txId) run(db, `UPDATE payment_milestones SET finance_tx_id=? WHERE id=?`, [txId, msId]);
      }
      logActivity(db, 'milestone', 'created', `新增付款节点：${cName} · ${label||''}`,
        amount ? `$${Number(amount).toLocaleString()}` : '', msId);
      await saveDb();
      return ok({ id: msId });
    }
  }

  const milestoneMatch = path.match(/^\/api\/milestones\/(\d+)$/);
  if (milestoneMatch) {
    const id = milestoneMatch[1];
    if (method === 'PUT') {
      const sets: string[] = [];
      const vals: unknown[] = [];
      if (body.label !== undefined) { sets.push('label=?'); vals.push(str(body.label, 255)); }
      if (body.due_date !== undefined) { sets.push('due_date=?'); vals.push(str(body.due_date, 10)); }
      if (body.paid_date !== undefined) { sets.push('paid_date=?'); vals.push(str(body.paid_date, 16)); }
      if (body.payment_method !== undefined) { sets.push('payment_method=?'); vals.push(str(body.payment_method, 50)); }
      if (body.status !== undefined) { sets.push('status=?'); vals.push(enumVal(body.status, VALID_MS_STATUSES, 'pending')); }
      if (body.invoice_number !== undefined) { sets.push('invoice_number=?'); vals.push(str(body.invoice_number, 100)); }
      if (body.note !== undefined) { sets.push('note=?'); vals.push(str(body.note, 1000)); }
      if (body.project_id !== undefined) { sets.push('project_id=?'); vals.push(body.project_id); }
      const numFields = ['amount','percentage','sort_order'];
      for (const f of numFields) { if (body[f] !== undefined) { sets.push(`${f}=?`); vals.push(body[f]); } }
      if (sets.length > 0) {
        sets.push('updated_at=CURRENT_TIMESTAMP');
        vals.push(id);
        run(db, `UPDATE payment_milestones SET ${sets.join(',')} WHERE id=?`, vals);
      }
      // Cascade paid_date / amount changes to linked finance transaction
      if (body.paid_date !== undefined || body.amount !== undefined) {
        const msRow = get(db, 'SELECT finance_tx_id FROM payment_milestones WHERE id=?', [id]) as DbRow;
        if (msRow?.finance_tx_id) {
          const updates: string[] = [];
          const uVals: unknown[] = [];
          if (body.paid_date !== undefined) { updates.push('date=?'); uVals.push(body.paid_date); }
          if (body.amount !== undefined) {
            const newAmt = Number(body.amount) || 0;
            updates.push('amount=?'); uVals.push(newAmt);
            const ftx = get(db, 'SELECT tax_mode, tax_rate FROM finance_transactions WHERE id=?', [msRow.finance_tx_id]) as DbRow;
            if (ftx) {
              const tm = String(ftx.tax_mode || 'none');
              const tr = Number(ftx.tax_rate || 0);
              updates.push('tax_amount=?'); uVals.push(calcTaxOffline(newAmt, tm, tr));
            }
          }
          if (updates.length > 0) {
            uVals.push(msRow.finance_tx_id);
            run(db, `UPDATE finance_transactions SET ${updates.join(',')} WHERE id=?`, uVals);
          }
        }
      }
      await saveDb();
      return ok({ success: true });
    }
    if (method === 'DELETE') {
      const prev = get(db, 'SELECT label, finance_tx_id FROM payment_milestones WHERE id=?', [id]) as DbRow;
      run(db, 'UPDATE payment_milestones SET soft_deleted=1 WHERE id=?', [id]);
      if (prev?.finance_tx_id) {
        run(db, 'UPDATE finance_transactions SET soft_deleted=1 WHERE id=?', [prev.finance_tx_id]);
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
    const actualDate = paid_date || todayDateKey();
    const milestone = get(db, 'SELECT * FROM payment_milestones WHERE id=?', [id]) as DbRow;
    if (!milestone) return err(404, 'Milestone not found');

    // Fix Bug 2: Check idempotency - if milestone is already marked as paid, return early
    if (milestone.status === 'paid') {
      return ok({ success: true, financeId: milestone.finance_tx_id, alreadyPaid: true });
    }

    const client = get(db, 'SELECT name, tax_mode, tax_rate FROM clients WHERE id=?', [milestone.client_id]) as DbRow;
    const clientName = client?.name || '';
    let txTaxMode = client?.tax_mode || 'none';
    let txTaxRate = Number(client?.tax_rate || 0);
    // Prefer project-level tax settings if milestone belongs to a project
    if (milestone.project_id) {
      const proj = get(db, 'SELECT tax_mode, tax_rate FROM client_projects WHERE id=?', [milestone.project_id]) as DbRow;
      if (proj) { txTaxMode = proj.tax_mode || txTaxMode; txTaxRate = Number(proj.tax_rate || 0) || txTaxRate; }
    }
    const txAmount = Number(milestone.amount||0);
    const txTaxAmount = txTaxMode === 'exclusive' ? Math.round((txAmount * txTaxRate) / 100 * 100) / 100
                      : txTaxMode === 'inclusive' ? Math.round((txAmount * txTaxRate) / (100 + txTaxRate) * 100) / 100
                      : 0;

    // Create finance transaction (source='milestone' to prevent manual edit/delete)
    const txRes = run(db,
      `INSERT INTO finance_transactions (type, amount, category, description, date, status, source, source_id, client_id, client_name, tax_mode, tax_rate, tax_amount)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ['income', txAmount, '项目收入',
       `${clientName} · ${milestone.label||'项目付款'}`, actualDate, '已完成',
       'milestone', milestone.id, milestone.client_id, clientName, txTaxMode, txTaxRate, txTaxAmount]);

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

  const undoPaidMatch = path.match(/^\/api\/milestones\/(\d+)\/undo-paid$/);
  if (undoPaidMatch && method === 'POST') {
    const id = undoPaidMatch[1];
    const milestone = get(db, 'SELECT * FROM payment_milestones WHERE id=?', [id]) as DbRow;
    if (!milestone) return err(404, 'Milestone not found');
    // Idempotency: already pending, nothing to undo
    if (milestone.status === 'pending') return ok({ success: true, alreadyPending: true });
    // Soft-delete linked finance transaction
    if (milestone.finance_tx_id) {
      run(db, 'UPDATE finance_transactions SET soft_deleted=1 WHERE id=?', [milestone.finance_tx_id]);
    }
    // Reset milestone to pending
    run(db, `UPDATE payment_milestones SET status='pending', paid_date='', payment_method='', finance_tx_id=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=?`, [id]);
    const client = get(db, 'SELECT name, company_name FROM clients WHERE id=?', [milestone.client_id]) as DbRow;
    logActivity(db, 'milestone', 'undo_paid',
      `撤销收款：${client?.company_name || client?.name || ''} · ${milestone.label || ''}`,
      `$${Number(milestone.amount || 0).toLocaleString()}`, id);
    await saveDb();
    return ok({ success: true });
  }

  // ── TASKS ──────────────────────────────────────────────────────────────
  if (path === '/api/tasks' && method === 'GET') {
    return ok(all(db, 'SELECT * FROM tasks WHERE soft_deleted=0 ORDER BY created_at DESC'));
  }

  if (path === '/api/tasks' && method === 'POST') {
    const { title, client, client_id, priority, due, column, originalRequest, aiBreakdown, aiMjPrompts, aiStory, scope, parent_id } = body;
    const res = run(db, `INSERT INTO tasks (title, client, client_id, priority, due, "column", originalRequest, aiBreakdown, aiMjPrompts, aiStory, scope, parent_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [str(title, 500), str(client, 255), client_id||null, enumVal(priority, VALID_TASK_PRIORITIES, 'Medium'),
       str(due, 16), enumVal(column, VALID_TASK_COLUMNS, 'todo'),
       str(originalRequest, 5000), str(aiBreakdown, 10000), str(aiMjPrompts, 5000), str(aiStory, 5000),
       enumVal(scope, VALID_TASK_SCOPES, 'work'), parent_id||null]);
    logActivity(db, 'task', 'created', `新增任务：${title||'未命名任务'}`, client ? `客户：${client}` : '', res.lastInsertRowid);
    await saveDb();
    return ok({ id: res.lastInsertRowid });
  }

  const taskMatch = path.match(/^\/api\/tasks\/(\d+)$/);
  if (taskMatch) {
    const id = taskMatch[1];
    if (method === 'PUT') {
      const prev = get(db, 'SELECT title, "column" FROM tasks WHERE id=?', [id]) as DbRow;
      const sets: string[] = [];
      const vals: unknown[] = [];
      if (body.title !== undefined) { sets.push('title=?'); vals.push(str(body.title, 500)); }
      if (body.client !== undefined) { sets.push('client=?'); vals.push(str(body.client, 255)); }
      if (body.priority !== undefined) { sets.push('priority=?'); vals.push(enumVal(body.priority, VALID_TASK_PRIORITIES, 'Medium')); }
      if (body.due !== undefined) { sets.push('due=?'); vals.push(str(body.due, 16)); }
      if (body.originalRequest !== undefined) { sets.push('originalRequest=?'); vals.push(str(body.originalRequest, 5000)); }
      if (body.aiBreakdown !== undefined) { sets.push('aiBreakdown=?'); vals.push(str(body.aiBreakdown, 10000)); }
      if (body.aiMjPrompts !== undefined) { sets.push('aiMjPrompts=?'); vals.push(str(body.aiMjPrompts, 5000)); }
      if (body.aiStory !== undefined) { sets.push('aiStory=?'); vals.push(str(body.aiStory, 5000)); }
      if (body.scope !== undefined) { sets.push('scope=?'); vals.push(enumVal(body.scope, VALID_TASK_SCOPES, 'work')); }
      if (body.column !== undefined) { sets.push('"column"=?'); vals.push(enumVal(body.column, VALID_TASK_COLUMNS, 'todo')); }
      if (body.client_id !== undefined) { sets.push('client_id=?'); vals.push(body.client_id || null); }
      if (body.parent_id !== undefined) { sets.push('parent_id=?'); vals.push(body.parent_id || null); }
      if (sets.length > 0) {
        vals.push(id);
        run(db, `UPDATE tasks SET ${sets.join(',')} WHERE id=?`, vals);
      }
      const detail = body.column !== undefined && prev?.column && prev.column !== body.column
        ? `kanban:${prev.column}→${body.column}` : 'content-updated';
      logActivity(db, 'task', 'updated', `更新任务：${body.title||prev?.title||'未命名任务'}`, detail, id);
      await saveDb();
      return ok({ success: true });
    }
    if (method === 'DELETE') {
      const prev = get(db, 'SELECT title FROM tasks WHERE id=?', [id]) as DbRow;
      run(db, `UPDATE tasks SET soft_deleted=1, updated_at=CURRENT_TIMESTAMP WHERE parent_id=?`, [id]);
      run(db, 'UPDATE tasks SET soft_deleted=1 WHERE id=?', [id]);
      logActivity(db, 'task', 'deleted', `删除任务：${prev?.title||'未命名任务'}`, '', id);
      await saveDb();
      return ok({ success: true });
    }
  }

  // ── PLANS ──────────────────────────────────────────────────────────────
  if (path === '/api/plans' && method === 'GET') {
    const planClientCounts = all(db,
      `SELECT plan_tier, COUNT(*) as count FROM clients WHERE status='Active' AND soft_deleted=0 GROUP BY plan_tier`);
    const countMap = new Map<string, number>();
    for (const r of planClientCounts) countMap.set(r.plan_tier||'', Number(r.count||0));

    const aliases: Record<string, string[]> = {
      '基础版': ['基础版','Basic','basic'],
      '专业版': ['专业版','Pro','pro','Professional','professional'],
      '企业版': ['企业版','Enterprise','enterprise'],
    };
    const plans = all(db, 'SELECT * FROM plans WHERE soft_deleted=0').map((p) => {
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
      const prev = get(db, 'SELECT name FROM plans WHERE id=?', [id]) as DbRow;
      const sets: string[] = [];
      const vals: unknown[] = [];
      if (body.name !== undefined) { sets.push('name=?'); vals.push(body.name); }
      if (body.price !== undefined) { sets.push('price=?'); vals.push(body.price); }
      if (body.deliverySpeed !== undefined) { sets.push('deliverySpeed=?'); vals.push(body.deliverySpeed); }
      if (body.features !== undefined) { sets.push('features=?'); vals.push(JSON.stringify(body.features)); }
      if (body.clients !== undefined) { sets.push('clients=?'); vals.push(body.clients); }
      if (sets.length > 0) {
        vals.push(id);
        run(db, `UPDATE plans SET ${sets.join(',')} WHERE id=?`, vals);
      }
      const displayName = body.name ?? prev?.name ?? '未命名方案';
      logActivity(db, 'plan', 'updated', `更新方案：${displayName}`, body.price ? `价格：$${body.price}/月` : '方案信息已更新', id);
      await saveDb();
      return ok({ success: true });
    }
    if (method === 'DELETE') {
      const prev = get(db, 'SELECT name FROM plans WHERE id=?', [id]) as DbRow;
      run(db, 'UPDATE plans SET soft_deleted=1 WHERE id=?', [id]);
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
    const completedIncome = transactions.filter((t: DbRow) => t.type === 'income' && (t.status||'已完成') === '已完成').reduce((s,t) => s + Number(t.amount||0), 0);
    const completedExpense = transactions.filter((t: DbRow) => t.type === 'expense' && (t.status||'已完成') === '已完成').reduce((s,t) => s + Number(t.amount||0), 0);
    const receivables = transactions.filter((t: DbRow) => String(t.status||'').includes('应收')).reduce((s,t) => s + Number(t.amount||0), 0);
    const payables = transactions.filter((t: DbRow) => String(t.status||'').includes('应付')).reduce((s,t) => s + Number(t.amount||0), 0);
    const totalTax = transactions.filter((t: DbRow) => (t.status||'已完成') === '已完成' && Number(t.tax_amount||0) > 0).reduce((s,t) => s + Number(t.tax_amount||0), 0);
    const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const rows = transactions.slice(0,50).map((t: DbRow) => { const taxInfo = Number(t.tax_amount||0) > 0 ? ` (税$${Number(t.tax_amount).toLocaleString()})` : ''; return `<tr><td>${esc(t.date||'')}</td><td>${esc(t.description||'')}</td><td>${esc(t.category||'')}</td><td>${t.type==='income'?'+':'-'}$${Number(t.amount||0).toLocaleString()}${taxInfo}</td><td>${esc(t.status||'已完成')}</td></tr>`; }).join('');
    const html = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"/><title>一人CEO - 财务月度报表</title><style>body{font-family:-apple-system,sans-serif;padding:32px;color:#18181b}h1{font-size:28px;margin:0 0 8px}p{color:#71717a;margin:0 0 24px}.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:24px}.card{border:1px solid #e4e4e7;border-radius:16px;padding:16px}.label{font-size:12px;color:#71717a;margin-bottom:8px}.value{font-size:24px;font-weight:700}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px 12px;border-bottom:1px solid #e4e4e7;font-size:12px}th{background:#f4f4f5;color:#52525b}</style></head><body><h1>财务月度报表</h1><p>一人CEO · 导出时间 ${new Date().toLocaleString('zh-CN')}</p><div class="grid"><div class="card"><div class="label">已完成收入</div><div class="value">$${completedIncome.toLocaleString()}</div></div><div class="card"><div class="label">已完成支出</div><div class="value">$${completedExpense.toLocaleString()}</div></div><div class="card"><div class="label">净利润</div><div class="value">$${(completedIncome-completedExpense).toLocaleString()}</div></div><div class="card"><div class="label">应收 / 应付</div><div class="value">$${receivables.toLocaleString()} / $${payables.toLocaleString()}</div></div><div class="card"><div class="label">税费合计</div><div class="value">$${totalTax.toLocaleString()}</div></div></div><table><thead><tr><th>日期</th><th>描述</th><th>分类</th><th>金额</th><th>状态</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
    return { status: 200, data: html };
  }

  if (path === '/api/finance' && method === 'POST') {
    const { type, amount, category, description, date, status, tax_mode, tax_rate, tax_amount, client_id, client_name, source, source_id } = body;
    const res = run(db, `INSERT INTO finance_transactions (type, amount, category, description, date, status, tax_mode, tax_rate, tax_amount, client_id, client_name, source, source_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [enumVal(type, VALID_TX_TYPES, 'income'), amount||0, str(category, 100), str(description, 500), str(date, 10), enumVal(status, VALID_TX_STATUSES, '已完成'), enumVal(tax_mode, VALID_TAX_MODES, 'none'), tax_rate||0, tax_amount||0, client_id||null, str(client_name, 255), source||'manual', source_id||null]);
    logActivity(db, 'finance', 'created', `新增交易：${description||'未命名交易'}`,
      `${type==='income'?'+':'-'}$${Number(amount||0).toLocaleString()} · ${category||'未分类'}`, res.lastInsertRowid);
    await saveDb();
    return ok({ id: res.lastInsertRowid });
  }

  // ── Confirm / Undo receipt for subscription transactions ──
  const confirmReceiptMatch = path.match(/^\/api\/finance\/(\d+)\/confirm-receipt$/);
  if (confirmReceiptMatch && method === 'POST') {
    const id = Number(confirmReceiptMatch[1]);
    const txRow = get(db, 'SELECT source, status, description FROM finance_transactions WHERE id=?', [id]) as DbRow;
    if (!txRow) return err(404, 'Transaction not found');
    if (txRow.source !== 'subscription') return err(400, 'Only subscription transactions can use confirm-receipt');
    if (txRow.status === '已完成') return err(400, 'Already confirmed');
    run(db, `UPDATE finance_transactions SET status='已完成' WHERE id=?`, [id]);
    logActivity(db, 'finance', 'updated', `确认收款：${txRow.description || '未命名交易'}`, '', id);
    await saveDb();
    return ok({ success: true });
  }

  const undoReceiptMatch = path.match(/^\/api\/finance\/(\d+)\/undo-receipt$/);
  if (undoReceiptMatch && method === 'POST') {
    const id = Number(undoReceiptMatch[1]);
    const txRow = get(db, 'SELECT source, status, description FROM finance_transactions WHERE id=?', [id]) as DbRow;
    if (!txRow) return err(404, 'Transaction not found');
    if (txRow.source !== 'subscription') return err(400, 'Only subscription transactions can use undo-receipt');
    if (txRow.status !== '已完成') return err(400, 'Not confirmed yet');
    run(db, `UPDATE finance_transactions SET status='待收款 (应收)' WHERE id=?`, [id]);
    logActivity(db, 'finance', 'updated', `撤销确认：${txRow.description || '未命名交易'}`, '', id);
    await saveDb();
    return ok({ success: true });
  }

  const financeMatch = path.match(/^\/api\/finance\/(\d+)$/);
  if (financeMatch) {
    const id = Number(financeMatch[1]);
    // Check source — only manual transactions can be edited/deleted
    const txRow = get(db, 'SELECT source, description FROM finance_transactions WHERE id=?', [id]) as DbRow;
    if (!txRow) return err(404, 'Transaction not found');
    const src = txRow.source || 'manual';
    if (src === 'subscription') return err(400, '订阅流水由客户状态自动生成，请在客户管理中编辑');
    if (src === 'milestone') return err(400, '此交易由里程碑自动生成，请前往签约客户中修改');
    if (src === 'project_fee') return err(400, '项目总费待收款，请在客户管理中编辑');

    if (method === 'PUT') {
      const sets: string[] = [];
      const vals: unknown[] = [];
      if (body.type !== undefined) { sets.push('type=?'); vals.push(enumVal(body.type, VALID_TX_TYPES, 'income')); }
      if (body.category !== undefined) { sets.push('category=?'); vals.push(str(body.category, 100)); }
      if (body.description !== undefined) { sets.push('description=?'); vals.push(str(body.description, 500)); }
      if (body.date !== undefined) { sets.push('date=?'); vals.push(str(body.date, 10)); }
      if (body.status !== undefined) { sets.push('status=?'); vals.push(enumVal(body.status, VALID_TX_STATUSES, '已完成')); }
      if (body.tax_mode !== undefined) { sets.push('tax_mode=?'); vals.push(enumVal(body.tax_mode, VALID_TAX_MODES, 'none')); }
      if (body.client_name !== undefined) { sets.push('client_name=?'); vals.push(str(body.client_name, 255)); }
      const numFields = ['amount','tax_rate','tax_amount'];
      for (const f of numFields) { if (body[f] !== undefined) { sets.push(`${f}=?`); vals.push(body[f]); } }
      if (body.client_id !== undefined) { sets.push('client_id=?'); vals.push(body.client_id); }
      if (sets.length > 0) {
        vals.push(id);
        run(db, `UPDATE finance_transactions SET ${sets.join(',')} WHERE id=?`, vals);
      }
      logActivity(db, 'finance', 'updated', `更新交易：${body.description||txRow?.description||'未命名交易'}`, '', id);
      await saveDb();
      return ok({ success: true });
    }
    if (method === 'DELETE') {
      run(db, 'UPDATE finance_transactions SET soft_deleted=1 WHERE id=?', [id]);
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
    const prev = get(db, 'SELECT topic FROM content_drafts WHERE id=?', [id]) as DbRow;
    run(db, 'UPDATE content_drafts SET soft_deleted=1 WHERE id=?', [id]);
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
      const prev = get(db, 'SELECT title, type FROM today_focus_manual WHERE id=?', [id]) as DbRow;
      if (!prev) return err(404, 'manual event not found');
      run(db, `UPDATE today_focus_manual SET type=?,title=?,note=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
        [type||'系统', String(title).trim(), String(note||'').trim(), id]);
      logActivity(db, 'today_focus', 'manual_updated', `更新今日事件：${String(title).trim()}`, `类型：${type||prev?.type||'系统'}`, id);
      await saveDb();
      return ok({ success: true, id: Number(id) });
    }
    if (method === 'DELETE') {
      const prev = get(db, 'SELECT title FROM today_focus_manual WHERE id=?', [id]) as DbRow;
      if (!prev) return err(404, 'manual event not found');
      run(db, 'UPDATE today_focus_manual SET soft_deleted=1 WHERE id=?', [id]);
      run(db, `DELETE FROM today_focus_state WHERE focus_date=? AND focus_key=?`, [todayDateKey(), `manual-${id}`]);
      logActivity(db, 'today_focus', 'manual_deleted', `删除今日事件：${prev?.title||'未命名事件'}`, '', id);
      await saveDb();
      return ok({ success: true });
    }
  }

  // ── DASHBOARD ──────────────────────────────────────────────────────────
  if (path === '/api/dashboard' && method === 'GET') {
    syncClientSubscriptionLedger(db);
    const clientsCount = Number(get(db, `SELECT COUNT(*) as c FROM clients WHERE status='Active' AND soft_deleted=0`)?.c || 0);
    // Derive MRR from ledger for current month (accurate with proration), fallback to static field
    const cm = currentMonth();
    const ledgerMrr = get(db, `SELECT SUM(amount) as s FROM client_subscription_ledger WHERE ledger_month=?`, [cm]);
    const mrr = Number(ledgerMrr?.s || 0) || Number(get(db, `SELECT SUM(mrr) as s FROM clients WHERE status='Active' AND soft_deleted=0`)?.s || 0);
    const activeTasks = Number(get(db, `SELECT COUNT(*) as c FROM tasks WHERE "column" != 'done' AND soft_deleted=0`)?.c || 0);
    const workTasks = Number(get(db, `SELECT COUNT(*) as c FROM tasks WHERE "column" != 'done' AND soft_deleted=0 AND (scope IS NULL OR scope != 'personal') AND (priority IS NULL OR priority IN ('High','Medium'))`)?.c || 0);
    const personalTasks = Number(get(db, `SELECT COUNT(*) as c FROM tasks WHERE "column" != 'done' AND soft_deleted=0 AND scope = 'personal'`)?.c || 0);
    const leadsCount = Number(get(db, `SELECT COUNT(*) as c FROM leads WHERE soft_deleted=0`)?.c || 0);

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
      `SELECT COALESCE(SUM(amount), 0) as total FROM finance_transactions WHERE type='income' AND status='已完成' AND soft_deleted=0 AND date LIKE ?`,
      [`${currentMonthStr}%`]);
    const monthlyIncome = Number((monthlyIncomeRow as Record<string, unknown>)?.total || 0);

    const recentActivityRows = all(db,
      `SELECT title as activity, detail, created_at as time, entity_type as type, action
       FROM activity_log ORDER BY datetime(created_at) DESC, id DESC LIMIT 8`);

    const recentActivity = [...recentActivityRows, ...getRecentSubscriptionEvents(db)]
      .sort((a: DbRow, b: DbRow) => String(b.time||b.sortKey||'').localeCompare(String(a.time||a.sortKey||'')))
      .slice(0, 8);

    const allReceivables = getFinanceRows(db).filter((t: DbRow) => String(t.status||'').includes('应收'));
    const bestLead = get(db,
      `SELECT id, name, industry, needs, column FROM leads WHERE soft_deleted=0 AND column IN ('proposal','contacted','new')
       ORDER BY CASE column WHEN 'proposal' THEN 1 WHEN 'contacted' THEN 2 ELSE 3 END, id DESC LIMIT 1`) as DbRow;
    const urgentTask = get(db,
      `SELECT id, title, client, priority, due, column, scope FROM tasks WHERE soft_deleted=0 AND "column" != 'done' AND (scope IS NULL OR (scope != 'personal' AND scope != 'work-memo'))
       ORDER BY CASE WHEN due != '' AND due <= ? THEN 0 ELSE 1 END,
       CASE priority WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END,
       COALESCE(NULLIF(due,''),'9999-12-31') ASC, id DESC LIMIT 1`, [todayDateKey()]) as DbRow;

    // Overdue milestones detection
    const todayKey = todayDateKey();
    const receivables = allReceivables.filter((t: DbRow) =>
      String(t.date||'') <= todayKey && t.source !== 'subscription'
    );
    const overdueMs = get(db,
      `SELECT pm.id, pm.label, pm.amount, pm.due_date, c.name as client_name
       FROM payment_milestones pm
       JOIN clients c ON c.id = pm.client_id
       WHERE pm.status = 'pending' AND pm.due_date != '' AND pm.due_date < ? AND pm.soft_deleted = 0
       ORDER BY pm.due_date ASC LIMIT 1`, [todayKey]) as DbRow;

    const systemTask = overdueMs
      ? { key: `system-overdue-ms-${overdueMs.id}`, type: '系统', title: `催收逾期款：${overdueMs.client_name} — ${overdueMs.label} $${Number(overdueMs.amount||0).toLocaleString()}`, reason: `已于 ${overdueMs.due_date} 到期，尽快催收避免坏账。`, actionHint: '去客户面板确认收款并标记已付', entityType: 'milestone', entityId: Number(overdueMs.id) }
      : receivables[0]
      ? { key: `system-receivable-${receivables[0].id||'r'}`, type: '系统', title: `处理应收：${receivables[0].description||'未命名账款'}`, reason: '有待收款项时，先收钱比继续堆工作更重要。', actionHint: '去财务管理跟进回款' }
      : bestLead
        ? { key: `system-lead-${bestLead.id||'fallback'}`, type: '系统', title: `补齐线索信息：${bestLead.name||'未命名线索'}`, reason: '线索信息越完整，后续跟进转化率越高。', actionHint: '完善需求、来源和下一步动作', entityType: 'lead', entityId: Number(bestLead.id) }
        : { key: 'system-content-asset', type: '系统', title: '整理一条内容资产', reason: '系统 = 维护运转：催收款、对账、整理数据、优化流程。', actionHint: '去内容工坊保存一条可复用内容' };

    // ── Due Today Items — tasks + memos due today or overdue ──
    function daysBetweenLocal(dateStr: string, todayStr: string): number {
      const d1 = new Date(dateStr + 'T00:00:00');
      const d2 = new Date(todayStr + 'T00:00:00');
      return Math.floor((d2.getTime() - d1.getTime()) / 86400000);
    }
    const dueWorkTaskRows = all(db,
      `SELECT id, title, client, priority, due, scope FROM tasks
       WHERE soft_deleted=0 AND "column" != 'done' AND (scope IS NULL OR (scope != 'personal' AND scope != 'work-memo'))
       AND due != '' AND SUBSTR(due, 1, 10) <= ?
       ORDER BY SUBSTR(due, 1, 10) ASC,
       CASE priority WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END
       LIMIT 5`, [todayKey]);
    const dueMemoRows = all(db,
      `SELECT id, title, due, scope FROM tasks
       WHERE soft_deleted=0 AND "column" != 'done' AND scope IN ('work-memo', 'personal')
       AND due != '' AND SUBSTR(due, 1, 10) <= ?
       ORDER BY SUBSTR(due, 1, 10) ASC LIMIT 3`, [todayKey]);
    const dueTodayItems = [
      ...dueWorkTaskRows.map((t: DbRow) => {
        const days = daysBetweenLocal(String(t.due).slice(0, 10), todayKey);
        return {
          key: `due-task-${t.id}`, type: '交付',
          title: String(t.title || '未命名任务'),
          reason: days > 0 ? `已逾期 ${days} 天` : (String(t.due).length > 10 ? `今日 ${String(t.due).slice(11, 16)} 截止` : '今日截止'),
          actionHint: t.client ? `客户：${t.client}` : '点击查看任务详情',
          entityType: 'task', entityId: Number(t.id), dueDate: String(t.due), isOverdue: days > 0, daysOverdue: days,
        };
      }),
      ...dueMemoRows.map((t: DbRow) => {
        const days = daysBetweenLocal(String(t.due).slice(0, 10), todayKey);
        return {
          key: `due-memo-${t.id}`, type: t.scope === 'personal' ? '个人' : '备忘',
          title: String(t.title || '未命名备忘'),
          reason: days > 0 ? `已逾期 ${days} 天` : (String(t.due).length > 10 ? `今日 ${String(t.due).slice(11, 16)}` : '今日截止'),
          actionHint: '点击查看备忘详情',
          entityType: 'memo', entityId: Number(t.id), dueDate: String(t.due), isOverdue: days > 0, daysOverdue: days,
        };
      }),
    ];

    const focusStateMap = getTodayFocusStateMap(db);
    const urgentDueDay = urgentTask?.due ? String(urgentTask.due).slice(0, 10) : '';
    const urgentIsOd = urgentDueDay && urgentDueDay < todayKey;
    const urgentIsDt = urgentDueDay === todayKey;
    const autoFocus = [
      bestLead
        ? { key: `revenue-lead-${bestLead.id||'fallback'}`, type: '收入', title: `推进线索：${bestLead.name||'未命名线索'}`, reason: bestLead.column==='proposal' ? '已进入报价阶段，推一把就能成交。' : '当前最值得跟进的销售机会。', actionHint: bestLead.column==='proposal' ? '发提案跟进 / 促成确认' : '发送开发信或安排跟进', entityType: 'lead', entityId: Number(bestLead.id) }
        : { key: 'revenue-fallback', type: '收入', title: '跟进一位潜在客户', reason: '收入 = 开拓新生意：找客户、谈合作、发报价、签单。', actionHint: 'home.focus.hint.leads' },
      urgentTask
        ? { key: `delivery-task-${urgentTask.id||'fallback'}`, type: '交付', title: `推进任务：${urgentTask.title||'未命名任务'}`, reason: urgentIsOd ? `此任务已逾期（截止 ${urgentDueDay}），需优先处理。` : urgentIsDt ? '此任务今日截止，需尽快完成。' : urgentTask.priority==='High' ? '高优先级任务最容易影响客户满意度和交付节奏。' : '先推进当前最接近交付的任务。', actionHint: urgentTask.client ? `关联客户：${urgentTask.client}` : '打开任务卡继续执行', entityType: 'task', entityId: Number(urgentTask.id), dueDate: urgentTask.due ? String(urgentTask.due) : null, isOverdue: !!urgentIsOd, daysOverdue: urgentIsOd ? daysBetweenLocal(urgentDueDay, todayKey) : 0 }
        : { key: 'delivery-fallback', type: '交付', title: '完成一个关键交付', reason: '交付 = 产出成果：写代码、做设计、完成客户项目。', actionHint: 'home.focus.hint.tasks' },
      systemTask,
    ];

    const manualFocusRows = all(db,
      `SELECT id, type, title, note FROM today_focus_manual WHERE focus_date=? AND soft_deleted=0 ORDER BY id DESC`,
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

    const todayFocus = autoFocus.map((item) => ({ ...item, status: focusStateMap[item.key] || 'pending' }));
    const dueTodayWithStatus = dueTodayItems.map((item) => ({ ...item, status: focusStateMap[item.key] || 'pending' }));

    return ok({ clientsCount, mrr, activeTasks, workTasks, personalTasks, leadsCount, mrrSeries, recentActivity, ytdRevenue, monthlyIncome, todayFocus, dueTodayItems: dueTodayWithStatus, manualTodayEvents });
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
    const weekStart = dateToKey(monday);
    const weekEnd = dateToKey(sunday);

    const txRows = getFinanceRows(db);
    const weekTx = txRows.filter((t: DbRow) => t.date >= weekStart && t.date <= weekEnd && (t.status || '已完成') === '已完成');
    const income = weekTx.filter((t: DbRow) => t.type === 'income').reduce((s: number, t: DbRow) => s + Number(t.amount || 0), 0);
    const expenses = Math.abs(weekTx.filter((t: DbRow) => t.type === 'expense').reduce((s: number, t: DbRow) => s + Number(t.amount || 0), 0));

    const tasksCompleted = Number(get(db, `SELECT COUNT(*) as c FROM tasks WHERE "column"='done' AND soft_deleted=0`)?.c || 0);
    const newClients = Number(get(db, `SELECT COUNT(*) as c FROM clients WHERE soft_deleted=0 AND created_at >= ? AND created_at <= ?`, [`${weekStart}T00:00:00`, `${weekEnd}T23:59:59`])?.c || 0);
    const newLeads = Number(get(db, `SELECT COUNT(*) as c FROM leads WHERE soft_deleted=0 AND created_at >= ? AND created_at <= ?`, [`${weekStart}T00:00:00`, `${weekEnd}T23:59:59`])?.c || 0);

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

  // ── AI AGENTS ─────────────────────────────────────────────────────
  if (path === '/api/agents' && method === 'GET') {
    const rows = all(db, `SELECT * FROM ai_agents WHERE soft_deleted=0 ORDER BY sort_order ASC, created_at ASC`);
    // Parse JSON fields
    return ok(rows.map((r: DbRow) => ({
      ...r,
      is_default: !!r.is_default,
      tools: safeJsonParse(r.tools, []),
      conversation_starters: safeJsonParse(r.conversation_starters, []),
    })));
  }

  if (path === '/api/agents' && method === 'POST') {
    const { name, avatar, role, personality, rules, tools, conversation_starters, template_id, is_default, sort_order } = body;
    if (!name || !String(name).trim()) return err(400, 'name is required');
    const res = run(db,
      `INSERT INTO ai_agents (name, avatar, role, personality, rules, tools, conversation_starters, template_id, is_default, sort_order)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        str(name, 100), str(avatar || '', 10), str(role || '', 2000),
        str(personality || '', 2000), str(rules || '', 2000),
        JSON.stringify(Array.isArray(tools) ? tools : []),
        JSON.stringify(Array.isArray(conversation_starters) ? conversation_starters : []),
        str(template_id || '', 50), is_default ? 1 : 0, Number(sort_order) || 0,
      ]);
    logActivity(db, 'ai_agent', 'created', `创建 Agent：${String(name).trim()}`, '', res.lastInsertRowid);
    dirty = true;
    await saveDb();
    return ok({ id: res.lastInsertRowid, success: true });
  }

  const agentMatch = path.match(/^\/api\/agents\/(\d+)$/);
  if (agentMatch && method === 'PUT') {
    const id = agentMatch[1];
    const patch: string[] = [];
    const vals: unknown[] = [];
    if (body.name !== undefined) { patch.push('name=?'); vals.push(str(body.name, 100)); }
    if (body.avatar !== undefined) { patch.push('avatar=?'); vals.push(str(body.avatar, 10)); }
    if (body.role !== undefined) { patch.push('role=?'); vals.push(str(body.role, 2000)); }
    if (body.personality !== undefined) { patch.push('personality=?'); vals.push(str(body.personality, 2000)); }
    if (body.rules !== undefined) { patch.push('rules=?'); vals.push(str(body.rules, 2000)); }
    if (body.tools !== undefined) { patch.push('tools=?'); vals.push(JSON.stringify(Array.isArray(body.tools) ? body.tools : [])); }
    if (body.conversation_starters !== undefined) { patch.push('conversation_starters=?'); vals.push(JSON.stringify(Array.isArray(body.conversation_starters) ? body.conversation_starters : [])); }
    if (body.template_id !== undefined) { patch.push('template_id=?'); vals.push(str(body.template_id, 50)); }
    if (body.is_default !== undefined) { patch.push('is_default=?'); vals.push(body.is_default ? 1 : 0); }
    if (body.sort_order !== undefined) { patch.push('sort_order=?'); vals.push(Number(body.sort_order) || 0); }
    if (patch.length === 0) return ok({ success: true });
    patch.push('updated_at=CURRENT_TIMESTAMP');
    vals.push(id);
    run(db, `UPDATE ai_agents SET ${patch.join(',')} WHERE id=?`, vals);
    logActivity(db, 'ai_agent', 'updated', `更新 Agent：${body.name || ''}`, '', id);
    dirty = true;
    await saveDb();
    return ok({ success: true });
  }

  if (agentMatch && method === 'DELETE') {
    const id = agentMatch[1];
    const prev = get(db, 'SELECT name FROM ai_agents WHERE id=?', [id]) as DbRow;
    run(db, 'UPDATE ai_agents SET soft_deleted=1, updated_at=CURRENT_TIMESTAMP WHERE id=?', [id]);
    logActivity(db, 'ai_agent', 'deleted', `删除 Agent：${prev?.name || ''}`, '', id);
    dirty = true;
    await saveDb();
    return ok({ success: true });
  }

  // ── AI CONVERSATIONS ──────────────────────────────────────────────
  if (path === '/api/conversations' && method === 'GET') {
    const rows = all(db, `SELECT * FROM ai_conversations WHERE soft_deleted=0 ORDER BY updated_at DESC`);
    return ok(rows.map((r: DbRow) => ({
      ...r,
      agent_ids: safeJsonParse(r.agent_ids, []),
      messages: safeJsonParse(r.messages, []),
    })));
  }

  if (path === '/api/conversations' && method === 'POST') {
    const { id, title, agent_id, agent_ids, messages } = body;
    if (!id) return err(400, 'id is required');
    run(db,
      `INSERT OR IGNORE INTO ai_conversations (id, title, agent_id, agent_ids, messages)
       VALUES (?,?,?,?,?)`,
      [
        String(id),
        str(title || '', 200),
        agent_id != null ? Number(agent_id) : null,
        JSON.stringify(Array.isArray(agent_ids) ? agent_ids : []),
        JSON.stringify(Array.isArray(messages) ? messages : []),
      ]);
    dirty = true;
    await saveDb();
    return ok({ id, success: true });
  }

  const convMatch = path.match(/^\/api\/conversations\/(.+)$/);
  if (convMatch && method === 'PUT') {
    const id = convMatch[1];
    const patch: string[] = [];
    const vals: unknown[] = [];
    if (body.title !== undefined) { patch.push('title=?'); vals.push(str(body.title, 200)); }
    if (body.agent_id !== undefined) { patch.push('agent_id=?'); vals.push(body.agent_id != null ? Number(body.agent_id) : null); }
    if (body.agent_ids !== undefined) { patch.push('agent_ids=?'); vals.push(JSON.stringify(Array.isArray(body.agent_ids) ? body.agent_ids : [])); }
    if (body.messages !== undefined) {
      const msgs = Array.isArray(body.messages) ? body.messages.slice(-100) : [];
      const sanitized = msgs.map((m: Record<string, unknown>) => ({
        role: m.role, content: String(m.content || '').slice(0, 50_000),
        ...(m.agentId != null ? { agentId: m.agentId } : {}),
        ...(m.timestamp ? { timestamp: m.timestamp } : {}),
      }));
      patch.push('messages=?'); vals.push(JSON.stringify(sanitized));
    }
    if (patch.length === 0) return ok({ success: true });
    patch.push('updated_at=CURRENT_TIMESTAMP');
    vals.push(id);
    run(db, `UPDATE ai_conversations SET ${patch.join(',')} WHERE id=?`, vals);
    dirty = true;
    await saveDb();
    return ok({ success: true });
  }

  if (convMatch && method === 'DELETE') {
    const id = convMatch[1];
    run(db, 'UPDATE ai_conversations SET soft_deleted=1, updated_at=CURRENT_TIMESTAMP WHERE id=?', [id]);
    dirty = true;
    await saveDb();
    return ok({ success: true });
  }

  // ── SETTINGS ────────────────────────────────────────────────────────
  if (path === '/api/settings' && method === 'GET') {
    const rows = all(db, 'SELECT key, value FROM app_settings');
    const settings: Record<string, string> = {};
    for (const r of rows) settings[r.key as string] = r.value as string;
    return ok(settings);
  }

  if (path === '/api/settings' && method === 'POST') {
    const entries = Object.entries(body || {});
    for (const [key, value] of entries) {
      run(db, `INSERT INTO app_settings (key, value, updated_at)
               VALUES (?, ?, CURRENT_TIMESTAMP)
               ON CONFLICT(key)
               DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
        [key, String(value ?? '')]);
    }
    dirty = true;
    await saveDb();
    return ok({ success: true });
  }

  // ── SERVER TIME (local clock) ────────────────────────────────────
  if (path === '/api/server-info' && method === 'GET') {
    return ok({ name: '一人CEO Local', cloud: false });
  }

  if (path === '/api/server-time' && method === 'GET') {
    return ok({ unixMs: Date.now() });
  }

  return err(404, `No handler for ${method} ${path}`);
}
