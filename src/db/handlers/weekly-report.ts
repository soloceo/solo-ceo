import { get, all } from '../index';
import { dateToKey } from '../../lib/date-utils';
import {
  type DbRow, type HandlerCtx, type HandlerResult,
  ok, getFinanceRows,
} from './_shared';

export async function weeklyReportHandler({ db, path, method }: HandlerCtx): Promise<HandlerResult | null> {
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

    const tasksCompleted = Number(get(db, `SELECT COUNT(*) as c FROM tasks WHERE "column"='done' AND soft_deleted=0 AND updated_at >= ? AND updated_at <= ?`, [`${weekStart}T00:00:00`, `${weekEnd}T23:59:59`])?.c || 0);
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

  return null;
}
