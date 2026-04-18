/**
 * Renders the HTML export for `/api/finance/report`.
 *
 * Used by both the offline (sql.js) handler at `src/db/handlers/finance.ts` and
 * the online (Supabase) path at `src/db/supabase-api.ts`. The two callers only
 * differ in how they gather the numbers — delegate the markup to one place so
 * a CSS tweak doesn't have to be mirrored twice (and can't drift undetected).
 */

export interface FinanceReportRow {
  date?: string;
  description?: string;
  category?: string;
  type?: string;
  amount?: number | string;
  tax_amount?: number | string;
  status?: string;
}

export interface FinanceReportInput {
  completedIncome: number;
  completedExpense: number;
  receivables: number;
  payables: number;
  totalTax: number;
  rows: FinanceReportRow[];
  /** Max rows to include in the table. Defaults to 50 to stay printable. */
  rowLimit?: number;
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const fmt = (n: number | string | undefined): string =>
  Number(n || 0).toLocaleString();

function renderRow(t: FinanceReportRow): string {
  const taxVal = Number(t.tax_amount || 0);
  const taxInfo = taxVal > 0 ? ` (税$${taxVal.toLocaleString()})` : '';
  const sign = t.type === 'income' ? '+' : '-';
  return `<tr>`
    + `<td>${esc(String(t.date || ''))}</td>`
    + `<td>${esc(String(t.description || ''))}</td>`
    + `<td>${esc(String(t.category || ''))}</td>`
    + `<td>${sign}$${fmt(t.amount)}${taxInfo}</td>`
    + `<td>${esc(String(t.status || '已完成'))}</td>`
    + `</tr>`;
}

export function renderFinanceReport(input: FinanceReportInput): string {
  const { completedIncome, completedExpense, receivables, payables, totalTax, rows, rowLimit = 50 } = input;
  const tableRows = rows.slice(0, rowLimit).map(renderRow).join('');
  const now = new Date().toLocaleString('zh-CN');
  const net = completedIncome - completedExpense;

  const styles = 'body{font-family:-apple-system,sans-serif;padding:32px;color:#18181b}'
    + 'h1{font-size:28px;margin:0 0 8px}'
    + 'p{color:#71717a;margin:0 0 24px}'
    + '.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:24px}'
    + '.card{border:1px solid #e4e4e7;border-radius:16px;padding:16px}'
    + '.label{font-size:12px;color:#71717a;margin-bottom:8px}'
    + '.value{font-size:24px;font-weight:700}'
    + 'table{width:100%;border-collapse:collapse}'
    + 'th,td{text-align:left;padding:10px 12px;border-bottom:1px solid #e4e4e7;font-size:12px}'
    + 'th{background:#f4f4f5;color:#52525b}';

  return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"/>`
    + `<title>一人CEO - 财务月度报表</title>`
    + `<style>${styles}</style></head>`
    + `<body>`
    + `<h1>财务月度报表</h1>`
    + `<p>一人CEO · 导出时间 ${now}</p>`
    + `<div class="grid">`
      + `<div class="card"><div class="label">已完成收入</div><div class="value">$${completedIncome.toLocaleString()}</div></div>`
      + `<div class="card"><div class="label">已完成支出</div><div class="value">$${completedExpense.toLocaleString()}</div></div>`
      + `<div class="card"><div class="label">净利润</div><div class="value">$${net.toLocaleString()}</div></div>`
      + `<div class="card"><div class="label">应收 / 应付</div><div class="value">$${receivables.toLocaleString()} / $${payables.toLocaleString()}</div></div>`
      + `<div class="card"><div class="label">税费合计</div><div class="value">$${totalTax.toLocaleString()}</div></div>`
    + `</div>`
    + `<table>`
      + `<thead><tr><th>日期</th><th>描述</th><th>分类</th><th>金额</th><th>状态</th></tr></thead>`
      + `<tbody>${tableRows}</tbody>`
    + `</table>`
    + `</body></html>`;
}
