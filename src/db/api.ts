/**
 * Browser-side API handlers — mirrors every Express route in server.ts
 * using sql.js instead of better-sqlite3.
 */
import { getDb, saveDb, all } from './index';
import { initSchema } from "./schema";
import { seedData } from "./seed";
import { PROFILE_SYNC_KEYS } from "../store/useSettingsStore";
import { leadsHandler } from "./handlers/leads";
import { clientsHandler } from "./handlers/clients";
import { clientProjectsHandler } from "./handlers/client-projects";
import { milestonesHandler } from "./handlers/milestones";
import { tasksHandler } from "./handlers/tasks";
import { plansHandler } from "./handlers/plans";
import { financeHandler } from "./handlers/finance";
import { contentDraftsHandler } from "./handlers/content-drafts";
import { todayFocusHandler } from "./handlers/today-focus";
import { dashboardHandler } from "./handlers/dashboard";
import { weeklyReportHandler } from "./handlers/weekly-report";
import { agentsHandler } from "./handlers/agents";
import { conversationsHandler } from "./handlers/conversations";
import { settingsHandler } from "./handlers/settings";
import { serverHandler } from "./handlers/server";


// ── Bulk sync helpers ──────────────────────────────────────────────────────

const SYNC_TABLES = [
  'leads', 'clients', 'tasks', 'plans',
  'finance_transactions', 'content_drafts',
  'today_focus_state', 'today_focus_manual',
  'payment_milestones', 'client_projects',
  'ai_agents', 'ai_conversations',
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- snapshot contains dynamic table rows
export async function exportAllData(): Promise<Record<string, any>> {
  const db = await getDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- snapshot contains dynamic table rows
  const snapshot: Record<string, any> = {};
  for (const t of SYNC_TABLES) snapshot[t] = all(db, `SELECT * FROM ${t}`);
  // Include recent activity log for reference
  snapshot['activity_log'] = all(db, 'SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 500');
  // Include settings (profile fields) — mapping is owned by useSettingsStore so
  // adding a new ProfileFields key automatically flows into the backup snapshot.
  try {
    const stored = JSON.parse(localStorage.getItem('solo-ceo-settings') || '{}');
    const state = stored?.state || {};
    const s: Record<string, string> = {};
    for (const [local, remote] of Object.entries(PROFILE_SYNC_KEYS)) {
      s[remote] = state[local] || '';
    }
    snapshot['settings'] = s;
  } catch {
    snapshot['settings'] = {};
  }
  return snapshot;
}


// ── Public init ────────────────────────────────────────────────────────────

export async function initDb(): Promise<void> {
  const db = await getDb();
  initSchema(db);
  seedData(db);
  await saveDb();
}


// ── Route handler ──────────────────────────────────────────────────────────

export async function handleApiRequest(
  method: string,
  path: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- request body is dynamically typed JSON
  body: Record<string, any>
): Promise<{ status: number; data: unknown }> {
  const db = await getDb();
  const ctx = { db, method, path, body };

  // dispatch chain
  const result =
    (await leadsHandler(ctx)) ||
    (await clientsHandler(ctx)) ||
    (await clientProjectsHandler(ctx)) ||
    (await milestonesHandler(ctx)) ||
    (await tasksHandler(ctx)) ||
    (await plansHandler(ctx)) ||
    (await financeHandler(ctx)) ||
    (await contentDraftsHandler(ctx)) ||
    (await todayFocusHandler(ctx)) ||
    (await dashboardHandler(ctx)) ||
    (await weeklyReportHandler(ctx)) ||
    (await agentsHandler(ctx)) ||
    (await conversationsHandler(ctx)) ||
    (await settingsHandler(ctx)) ||
    (await serverHandler(ctx));

  if (result) return result;
  return { status: 404, data: { error: `No handler for ${method} ${path}` } };
}
