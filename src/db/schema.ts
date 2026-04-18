import { Database } from "sql.js";
import { run, get, all } from "./index";

export function initSchema(db: Database) {
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
    // Parity with supabase schema — GET handlers select these columns explicitly
    `ALTER TABLE clients ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE clients ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE leads ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`,
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
