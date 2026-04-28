/**
 * Smoke tests for the domain handler modules.
 *
 * These tests bypass `getDb()` (browser-only: needs document.baseURI / IndexedDB)
 * and run directly against a fresh in-memory sql.js database. They are not
 * exhaustive — they verify the refactor kept the router wiring intact and that
 * each handler returns the expected shape on a representative happy path.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import initSqlJs, { Database } from 'sql.js';
import { initSchema } from '../schema';

import { leadsHandler } from './leads';
import { clientsHandler } from './clients';
import { tasksHandler } from './tasks';
import { plansHandler } from './plans';
import { financeHandler } from './finance';
import { contentDraftsHandler } from './content-drafts';
import { todayFocusHandler } from './today-focus';
import { agentsHandler } from './agents';
import { conversationsHandler } from './conversations';
import { settingsHandler } from './settings';
import { serverHandler } from './server';
import { dashboardHandler } from './dashboard';
import type { HandlerCtx } from './_shared';

async function freshDb(): Promise<Database> {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  initSchema(db);
  return db;
}

function ctx(
  db: Database,
  method: string,
  path: string,
  body: Record<string, unknown> = {},
): HandlerCtx {
  return { db, method, path, body: body as HandlerCtx['body'] };
}

describe('handler smoke tests', () => {
  let db: Database;
  beforeEach(async () => { db = await freshDb(); });

  describe('leadsHandler', () => {
    it('returns null for unrelated paths', async () => {
      expect(await leadsHandler(ctx(db, 'GET', '/api/clients'))).toBeNull();
    });

    it('GET /api/leads returns empty list on fresh db', async () => {
      const res = await leadsHandler(ctx(db, 'GET', '/api/leads'));
      expect(res?.status).toBe(200);
      expect(Array.isArray(res?.data)).toBe(true);
      expect((res?.data as unknown[]).length).toBe(0);
    });

    it('POST → GET → PUT → DELETE round-trip', async () => {
      const created = await leadsHandler(ctx(db, 'POST', '/api/leads', {
        name: 'Acme', industry: 'SaaS', needs: 'logo', column: 'new',
      }));
      expect(created?.status).toBe(200);
      const id = (created?.data as { id: number }).id;
      expect(id).toBeGreaterThan(0);

      const listed = await leadsHandler(ctx(db, 'GET', '/api/leads'));
      expect((listed?.data as unknown[]).length).toBe(1);

      const updated = await leadsHandler(ctx(db, 'PUT', `/api/leads/${id}`, { column: 'contacted' }));
      expect(updated?.status).toBe(200);

      const deleted = await leadsHandler(ctx(db, 'DELETE', `/api/leads/${id}`));
      expect(deleted?.status).toBe(200);

      const finalList = await leadsHandler(ctx(db, 'GET', '/api/leads'));
      expect((finalList?.data as unknown[]).length).toBe(0);
    });

    it('convert on missing lead → 404', async () => {
      const res = await leadsHandler(ctx(db, 'POST', '/api/leads/99999/convert', {}));
      expect(res?.status).toBe(404);
    });
  });

  describe('clientsHandler', () => {
    it('GET /api/clients returns empty list', async () => {
      const res = await clientsHandler(ctx(db, 'GET', '/api/clients'));
      expect(res?.status).toBe(200);
      expect(Array.isArray(res?.data)).toBe(true);
    });

    it('POST creates a client', async () => {
      const res = await clientsHandler(ctx(db, 'POST', '/api/clients', {
        name: 'Test Co', plan_tier: 'Pro', mrr: 500, billing_type: 'subscription', status: 'Active',
      }));
      expect(res?.status).toBe(200);
      expect((res?.data as { id: number }).id).toBeGreaterThan(0);
    });
  });

  describe('tasksHandler', () => {
    it('POST → GET round-trip', async () => {
      const created = await tasksHandler(ctx(db, 'POST', '/api/tasks', {
        title: 'Write tests', priority: 'High', column: 'todo', scope: 'work',
      }));
      expect(created?.status).toBe(200);

      const listed = await tasksHandler(ctx(db, 'GET', '/api/tasks'));
      expect((listed?.data as unknown[]).length).toBe(1);
    });
  });

  describe('plansHandler', () => {
    it('GET returns list', async () => {
      const res = await plansHandler(ctx(db, 'GET', '/api/plans'));
      expect(res?.status).toBe(200);
      expect(Array.isArray(res?.data)).toBe(true);
    });

    it('POST → PUT → DELETE round-trip', async () => {
      const created = await plansHandler(ctx(db, 'POST', '/api/plans', {
        name: 'Silver', price: 100,
      }));
      const id = (created?.data as { id: number }).id;

      const updated = await plansHandler(ctx(db, 'PUT', `/api/plans/${id}`, { price: 150 }));
      expect(updated?.status).toBe(200);

      const deleted = await plansHandler(ctx(db, 'DELETE', `/api/plans/${id}`));
      expect(deleted?.status).toBe(200);
    });
  });

  describe('financeHandler', () => {
    it('GET /api/finance returns list', async () => {
      const res = await financeHandler(ctx(db, 'GET', '/api/finance'));
      expect(res?.status).toBe(200);
      expect(Array.isArray(res?.data)).toBe(true);
    });

    it('POST creates a transaction', async () => {
      const res = await financeHandler(ctx(db, 'POST', '/api/finance', {
        type: 'expense', amount: 20, category: '餐饮', description: 'lunch',
        date: '2026-04-18', status: '已完成',
      }));
      expect(res?.status).toBe(200);
      expect((res?.data as { id: number }).id).toBeGreaterThan(0);
    });

    it('POST forces manual source for user-created transactions', async () => {
      const res = await financeHandler(ctx(db, 'POST', '/api/finance', {
        type: 'income', amount: 50, category: '收入', description: 'spoof',
        date: '2026-04-18', status: '已完成', source: 'subscription', source_id: 999,
      }));
      const id = (res?.data as { id: number }).id;
      const row = db.exec(`SELECT source, source_id FROM finance_transactions WHERE id=${id}`)[0].values[0];
      expect(row[0]).toBe('manual');
      expect(row[1]).toBeNull();
    });
  });

  describe('contentDraftsHandler', () => {
    it('POST → DELETE round-trip', async () => {
      const created = await contentDraftsHandler(ctx(db, 'POST', '/api/content-drafts', {
        title: 'Draft', content: 'Hello', platform: 'Twitter',
      }));
      expect(created?.status).toBe(200);
      const id = (created?.data as { id: number }).id;

      const deleted = await contentDraftsHandler(ctx(db, 'DELETE', `/api/content-drafts/${id}`));
      expect(deleted?.status).toBe(200);
    });
  });

  describe('todayFocusHandler', () => {
    it('POST /api/today-focus/state upserts', async () => {
      const res = await todayFocusHandler(ctx(db, 'POST', '/api/today-focus/state', {
        focusKey: 'task:1', status: 'completed',
      }));
      expect(res?.status).toBe(200);
    });

    it('POST /manual coerces non-string type + caps long strings', async () => {
      // type as number, title overlong, note as null — must not throw and must persist safely
      const longTitle = 'T'.repeat(1000);
      const res = await todayFocusHandler(ctx(db, 'POST', '/api/today-focus/manual', {
        type: 42, title: longTitle, note: null,
      }));
      expect(res?.status).toBe(200);
      const id = (res?.data as { id: number }).id;
      const row = db.exec(`SELECT type, title, note FROM today_focus_manual WHERE id=${id}`)[0].values[0];
      expect(row[0]).toBe('42');            // number coerced to string
      expect((row[1] as string).length).toBe(500); // title capped at 500
      expect(row[2]).toBe('');              // null note → ''
    });

    it('PUT /manual rejects unbounded/malformed type + caps strings', async () => {
      const created = await todayFocusHandler(ctx(db, 'POST', '/api/today-focus/manual', {
        type: '系统', title: 'orig',
      }));
      const id = (created?.data as { id: number }).id;

      const longType = 'X'.repeat(200);
      const put = await todayFocusHandler(ctx(db, 'PUT', `/api/today-focus/manual/${id}`, {
        type: longType,
        title: { toString: () => 'obj-title' }, // non-string title
      }));
      expect(put?.status).toBe(200);

      const row = db.exec(`SELECT type, title FROM today_focus_manual WHERE id=${id}`)[0].values[0];
      expect((row[0] as string).length).toBe(50);   // type capped
      expect(row[1]).toBe('obj-title');              // coerced via toString
    });

    it('POST /manual still requires title', async () => {
      const res = await todayFocusHandler(ctx(db, 'POST', '/api/today-focus/manual', {
        title: '   ', // whitespace-only
      }));
      expect(res?.status).toBe(400);
    });
  });

  describe('agentsHandler', () => {
    it('GET returns list', async () => {
      const res = await agentsHandler(ctx(db, 'GET', '/api/agents'));
      expect(res?.status).toBe(200);
      expect(Array.isArray(res?.data)).toBe(true);
    });

    it('POST creates an agent', async () => {
      const res = await agentsHandler(ctx(db, 'POST', '/api/agents', {
        name: 'Helper', avatar: '🤖', role: 'assist', personality: 'friendly',
      }));
      expect(res?.status).toBe(200);
    });
  });

  describe('conversationsHandler', () => {
    it('GET returns list', async () => {
      const res = await conversationsHandler(ctx(db, 'GET', '/api/conversations'));
      expect(res?.status).toBe(200);
    });

    it('rejects conversations that reference missing agents', async () => {
      const res = await conversationsHandler(ctx(db, 'POST', '/api/conversations', {
        id: 'conv-1',
        title: 'Bad agent',
        agent_id: 999,
        agent_ids: [999],
        messages: [],
      }));
      expect(res?.status).toBe(404);
    });

    it('accepts conversations that reference owned local agents', async () => {
      const agent = await agentsHandler(ctx(db, 'POST', '/api/agents', {
        name: 'Helper', role: 'assist',
      }));
      const agentId = (agent?.data as { id: number }).id;

      const res = await conversationsHandler(ctx(db, 'POST', '/api/conversations', {
        id: 'conv-2',
        title: 'Good agent',
        agent_id: agentId,
        agent_ids: [agentId],
        messages: [],
      }));
      expect(res?.status).toBe(200);
    });
  });

  describe('settingsHandler', () => {
    it('GET returns settings object', async () => {
      const res = await settingsHandler(ctx(db, 'GET', '/api/settings'));
      expect(res?.status).toBe(200);
      expect(typeof res?.data).toBe('object');
    });

    it('POST writes settings', async () => {
      const res = await settingsHandler(ctx(db, 'POST', '/api/settings', {
        OPERATOR_NAME: 'Andy',
      }));
      expect(res?.status).toBe(200);

      const read = await settingsHandler(ctx(db, 'GET', '/api/settings'));
      expect((read?.data as Record<string, string>).OPERATOR_NAME).toBe('Andy');
    });

    it('POST does not persist cloud AI provider keys', async () => {
      const res = await settingsHandler(ctx(db, 'POST', '/api/settings', {
        gemini_api_key: 'secret',
      }));
      expect(res?.status).toBe(200);

      const read = await settingsHandler(ctx(db, 'GET', '/api/settings'));
      expect((read?.data as Record<string, string>).gemini_api_key).toBe('');
    });
  });

  describe('serverHandler', () => {
    it('GET /api/server-info', async () => {
      const res = await serverHandler(ctx(db, 'GET', '/api/server-info'));
      expect(res?.status).toBe(200);
      expect((res?.data as { cloud: boolean }).cloud).toBe(false);
    });

    it('GET /api/server-time returns unix ms', async () => {
      const res = await serverHandler(ctx(db, 'GET', '/api/server-time'));
      expect(res?.status).toBe(200);
      expect(typeof (res?.data as { unixMs: number }).unixMs).toBe('number');
    });
  });

  describe('dashboardHandler', () => {
    it('GET /api/dashboard returns a dashboard snapshot on fresh db', async () => {
      const res = await dashboardHandler(ctx(db, 'GET', '/api/dashboard'));
      expect(res?.status).toBe(200);
      expect(typeof res?.data).toBe('object');
    });
  });
});
