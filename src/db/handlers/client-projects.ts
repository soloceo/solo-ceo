import { run, all, saveDb } from '../index';
import { str, enumVal } from '../../lib/validate';
import {
  VALID_TAX_MODES, VALID_PROJECT_STATUSES,
  type DbRow, type HandlerCtx, type HandlerResult,
  ok, logActivity,
} from './_shared';

export async function clientProjectsHandler({ db, path, method, body }: HandlerCtx): Promise<HandlerResult | null> {
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
      // Soft-delete finance transactions linked to project milestones (before milestones are soft-deleted)
      const projMs = all(db, 'SELECT finance_tx_id FROM payment_milestones WHERE project_id=? AND soft_deleted=0', [id]);
      const projTxIds = projMs.map((m: DbRow) => m.finance_tx_id).filter(Boolean);
      for (const txId of projTxIds) {
        run(db, 'UPDATE finance_transactions SET soft_deleted=1, updated_at=CURRENT_TIMESTAMP WHERE id=?', [txId]);
      }

      run(db, 'UPDATE payment_milestones SET soft_deleted=1 WHERE project_id=?', [id]);
      run(db, 'UPDATE client_projects SET soft_deleted=1 WHERE id=?', [id]);
      await saveDb();
      return ok({ success: true });
    }
  }

  return null;
}
