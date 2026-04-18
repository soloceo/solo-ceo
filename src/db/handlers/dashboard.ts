import { get, all } from '../index';
import { todayDateKey, currentMonth } from '../../lib/date-utils';
import {
  type DbRow, type HandlerCtx, type HandlerResult,
  ok, syncClientSubscriptionLedger, getRecentSubscriptionEvents, getTodayFocusStateMap, getFinanceRows,
} from './_shared';

export async function dashboardHandler({ db, path, method }: HandlerCtx): Promise<HandlerResult | null> {
  // ── DASHBOARD ──────────────────────────────────────────────────────────
  if (path === '/api/dashboard' && method === 'GET') {
    syncClientSubscriptionLedger(db);
    const clientsCount = Number(get(db, `SELECT COUNT(*) as c FROM clients WHERE status='Active' AND soft_deleted=0`)?.c || 0);
    // Derive MRR from ledger for current month (accurate with proration), fallback to static field
    const cm = currentMonth();
    const ledgerMrr = get(db, `SELECT SUM(amount) as s FROM client_subscription_ledger WHERE ledger_month=?`, [cm]);
    const mrr = Number(ledgerMrr?.s || 0) || Number(get(db, `SELECT SUM(mrr) as s FROM clients WHERE status='Active' AND soft_deleted=0`)?.s || 0);
    const activeTasks = Number(get(db, `SELECT COUNT(*) as c FROM tasks WHERE "column" != 'done' AND soft_deleted=0`)?.c || 0);
    const todoCount = Number(get(db, `SELECT COUNT(*) as c FROM tasks WHERE "column"='todo' AND soft_deleted=0`)?.c || 0);
    const inProgressCount = Number(get(db, `SELECT COUNT(*) as c FROM tasks WHERE "column"='inProgress' AND soft_deleted=0`)?.c || 0);
    const workTasks = Number(get(db, `SELECT COUNT(*) as c FROM tasks WHERE "column" != 'done' AND soft_deleted=0 AND (scope IS NULL OR scope != 'personal')`)?.c || 0);
    const personalTasks = Number(get(db, `SELECT COUNT(*) as c FROM tasks WHERE "column" != 'done' AND soft_deleted=0 AND scope = 'personal' AND parent_id IS NULL`)?.c || 0);
    const leadsCount = Number(get(db, `SELECT COUNT(*) as c FROM leads WHERE soft_deleted=0`)?.c || 0);
    const leadsNew = Number(get(db, `SELECT COUNT(*) as c FROM leads WHERE soft_deleted=0 AND "column"='new'`)?.c || 0);
    const leadsContacted = Number(get(db, `SELECT COUNT(*) as c FROM leads WHERE soft_deleted=0 AND "column"='contacted'`)?.c || 0);
    const leadsProposal = Number(get(db, `SELECT COUNT(*) as c FROM leads WHERE soft_deleted=0 AND "column"='proposal'`)?.c || 0);

    // Use finance_transactions for mrrSeries (same source as online handler)
    const completedIncomeRows = all(db,
      `SELECT date, amount FROM finance_transactions WHERE type='income' AND status='已完成' AND soft_deleted=0`);
    const currentYear = new Date().getFullYear();
    const monthTotals = new Map<string, number>();
    for (const r of completedIncomeRows) {
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
    const todayIncomeVal = completedIncomeRows
      .filter((r: DbRow) => String(r.date || '').startsWith(todayDateKey()))
      .reduce((s: number, r: DbRow) => s + Number(r.amount || 0), 0);
    const todayIncome = todayIncomeVal;

    // Current month's income from finance_transactions
    const currentMonthStr = `${currentYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const monthlyIncome = completedIncomeRows
      .filter((r: DbRow) => String(r.date || '').startsWith(currentMonthStr))
      .reduce((s: number, r: DbRow) => s + Number(r.amount || 0), 0);

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

    return ok({ clientsCount, mrr, activeTasks, todoCount, inProgressCount, leadsCount, leadsNew, leadsContacted, leadsProposal, mrrSeries, recentActivity, ytdRevenue, todayIncome, monthlyIncome, todayFocus, dueTodayItems: dueTodayWithStatus, manualTodayEvents, workTasks, personalTasks });
  }

  return null;
}
