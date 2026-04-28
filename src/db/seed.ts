import { Database } from "sql.js";
import { get } from "./index";

/**
 * Detect whether the browser has a persisted Supabase session.
 * If it does, the user has a real cloud account — we must NOT seed demo data,
 * because sync-manager's "cloud returned 0 rows → skip" safety guard means
 * the seed would stick permanently and could leak back up to the cloud via
 * the next edit. Anonymous / "Skip login" users have no session → still seed.
 *
 * Checks both the modern Supabase key shape (`sb-<project-ref>-auth-token`)
 * and the legacy `supabase.auth.token` key. Runs a coarse scan because the
 * project ref is environment-specific.
 */
function hasPersistedSupabaseSession(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if ((k.startsWith('sb-') && k.endsWith('-auth-token')) || k === 'supabase.auth.token') {
        const v = localStorage.getItem(k);
        if (!v) continue;
        try {
          const parsed = JSON.parse(v);
          if (parsed?.access_token || parsed?.currentSession?.access_token) return true;
        } catch { /* malformed — treat as absent */ }
      }
    }
  } catch { /* storage quota / opaque origin — treat as absent */ }
  return false;
}

export function seedData(db: Database) {
  // ── Data-correctness guard ────────────────────────────────────────
  // Cloud-authed user: their canonical data lives on the server. Seeding
  // demo data here would contaminate their local mirror; sync's "0 rows →
  // skip DELETE+INSERT" safety rule means that contamination would stick
  // permanently and leak back to the cloud on the next edit. Anonymous
  // users still get the full seed for the demo experience.
  if (hasPersistedSupabaseSession()) {
    console.info('[seedData] Cloud session detected — skipping demo seed.');
    return;
  }
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
    ['OceanBlu Tech', 'SaaS', 'Logo设计 + 品牌手册 + 产品官网', 'oceanblu.io', 'proposal',
      '【提案初稿 — AI 生成】\n\n主题：OceanBlu Tech 品牌视觉升级方案\n\n核心判断：\nOceanBlu 是做数据可视化 SaaS 的，目标客户是中型 B2B 企业的数据团队。他们当前官网用了深蓝渐变+紫色霓虹的配色，感觉偏消费级产品，和「严肃、可信赖」的数据工具定位有落差。建议整体视觉向「现代专业、极简克制」方向调整。\n\n三个方向：\n1. Nautical Minimal — 保留海洋意向但大幅降饱和，主色改为深海蓝 (#0F3A5F) + 象牙白，辅助色用一抹珊瑚红做强调。Logo 用单色几何浪型，抽象但可识别。\n2. Data-First — 完全去掉海洋隐喻，回到抽象几何。主色炭灰 (#1C1E20) + 电子蓝 (#3B82F6)，Logo 用数据节点连线造型，呼应产品功能。\n3. Trust Blue — 走保守路线，单色深蓝 + 大量留白，Logo 用衬线字标，品牌气质偏金融/咨询公司，适合打大客户市场。\n\n交付范围：\n- Logo 主标 + 变体（含应用在 SaaS Dashboard 的适配版本）\n- 品牌手册 28 页（色彩、字体、间距、版式、图标、数据可视化规范）\n- 产品官网设计 8 页（首页、产品、定价、案例、关于、博客、登录、文档）\n\n时间 & 投入：\n- 方向确认：1 周（3 个概念方向出整体 mood + logo 草稿）\n- 定稿 + 规范手册：3 周\n- 官网设计：4 周（分首页 → 其余页面两批交付）\n- 总工期：8 周，总报价 $12,000 USD（首付 40% / 中期 30% / 尾款 30%）\n\n下一步：建议本周或下周约 30 分钟视频会议对齐方向，我会先把三套概念做成 Figma 可交互 mood board 便于共同决策。',
      'LinkedIn']);
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
  // id=3 — Ontario HST 13% exclusive (invoice shows tax line separately)
  db.run(`INSERT INTO clients (name, industry, plan_tier, status, brand_context, mrr, payment_method, billing_type, project_fee, tax_mode, tax_rate) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    ['Limelight Studios', '摄影工作室', '', 'Active', 'Fresh, natural, artistic aesthetic', 0, 'manual', 'project', 4800, 'exclusive', 13]);
  // id=4 — won from lead "Timber & Co", HST 13% inclusive (tax baked into quoted price)
  db.run(`INSERT INTO clients (name, industry, plan_tier, status, brand_context, mrr, payment_method, billing_type, project_fee, tax_mode, tax_rate) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    ['Timber & Co', '家居家具', '', 'Active', 'Natural, handcrafted, warm aesthetic', 0, 'manual', 'project', 6000, 'inclusive', 13]);

  // id=5 — Paused subscriber (seasonal bistro; paused early this month after 3 full months)
  const threeMonthsAgo = (() => { const d = new Date(now); d.setMonth(d.getMonth() - 3); return fmt(d); })();
  // Pause must fall within current month (not prior) — sync treats the month of a pause event as already paused.
  const pausedThisMonth = fmt(addDays(now, -10));
  db.run(`INSERT INTO clients (name, industry, plan_tier, status, brand_context, mrr, payment_method, billing_type, subscription_start_date, paused_at, subscription_timeline) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    ['Harbor Bistro', '餐饮连锁', 'Professional', 'Paused', 'Nautical, weathered wood, seafood-forward', 1500, 'auto', 'subscription', threeMonthsAgo, pausedThisMonth,
      JSON.stringify([{ type: 'start', date: threeMonthsAgo }, { type: 'pause', date: pausedThisMonth }])]);

  // ── Tasks — work scope (8 — cover all kanban columns, tied to real clients) ──
  // client_id links tasks back to clients.id: Nova Media=1, Atlas=2, Limelight=3, Timber & Co=4.
  // OceanBlu Tech stays unlinked (still a lead in "proposal" column).
  db.run(`INSERT INTO tasks (title, client, client_id, priority, due, column, scope) VALUES (?,?,?,?,?,?,?)`,
    ['设计Nova Media 4月社交媒体套图', 'Nova Media', 1, 'High', today, 'inProgress', 'work']);
  db.run(`INSERT INTO tasks (title, client, client_id, priority, due, column, scope) VALUES (?,?,?,?,?,?,?)`,
    ['更新Atlas Architecture品牌指南V2.0', 'Atlas Architecture', 2, 'High', yesterday, 'inProgress', 'work']);
  db.run(`INSERT INTO tasks (title, client, client_id, priority, due, column, scope) VALUES (?,?,?,?,?,?,?)`,
    ['交付Limelight Studios官网设计终稿', 'Limelight Studios', 3, 'High', today, 'review', 'work']);
  db.run(`INSERT INTO tasks (title, client, priority, due, column, scope) VALUES (?,?,?,?,?,?)`,
    ['制作OceanBlu Tech Logo提案（3套方案）', 'OceanBlu Tech', 'Medium', dayAfterTomorrow, 'todo', 'work']);
  db.run(`INSERT INTO tasks (title, client, client_id, priority, due, column, scope) VALUES (?,?,?,?,?,?,?)`,
    ['设计Nova Media短视频封面模板', 'Nova Media', 1, 'Medium', nextWeek, 'todo', 'work']);
  db.run(`INSERT INTO tasks (title, client, client_id, priority, due, column, scope) VALUES (?,?,?,?,?,?,?)`,
    ['Timber & Co产品画册排版', 'Timber & Co', 4, 'Medium', tenDaysLater, 'todo', 'work']);
  db.run(`INSERT INTO tasks (title, client, client_id, priority, due, column, scope) VALUES (?,?,?,?,?,?,?)`,
    ['制作Atlas Architecture季度汇报PPT', 'Atlas Architecture', 2, 'Low', twoWeeksLater, 'todo', 'work']);
  db.run(`INSERT INTO tasks (title, client, client_id, priority, due, column, scope) VALUES (?,?,?,?,?,?,?)`,
    ['归档Nova Media 3月交付物', 'Nova Media', 1, 'Low', '', 'done', 'work']);

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
  // Project milestone income (tied to Limelight Studios) — client_id=3, HST 13% exclusive
  // finance_transactions IDs 1-4 are these income rows; milestones below back-reference them.
  db.run(`INSERT INTO finance_transactions (type, amount, category, description, date, status, source, client_id, client_name, tax_mode, tax_rate, tax_amount) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    ['income', 1920, '项目收入', 'Limelight Studios官网设计 · 首付款40%', `${lastMonth}-18`, '已完成', 'milestone', 3, 'Limelight Studios', 'exclusive', 13, 249.60]);
  db.run(`INSERT INTO finance_transactions (type, amount, category, description, date, status, source, client_id, client_name, tax_mode, tax_rate, tax_amount) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    ['income', 2880, '项目收入', 'Limelight Studios官网设计 · 尾款60%', nextWeek, '待收款 (应收)', 'milestone', 3, 'Limelight Studios', 'exclusive', 13, 374.40]);
  // Manual income (consultancy from Timber & Co — client_id=4, HST 13% inclusive)
  db.run(`INSERT INTO finance_transactions (type, amount, category, description, date, status, source, client_id, client_name, tax_mode, tax_rate, tax_amount) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    ['income', 800, '咨询收入', 'Timber & Co品牌诊断咨询', threeDaysAgo, '已完成', 'manual', 4, 'Timber & Co', 'inclusive', 13, 92.04]);
  // Project fee (Timber & Co new project deposit — client_id=4, HST 13% inclusive)
  db.run(`INSERT INTO finance_transactions (type, amount, category, description, date, status, source, client_id, client_name, tax_mode, tax_rate, tax_amount) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    ['income', 2400, '项目收入', 'Timber & Co产品画册 · 首付款40%', fiveDaysAgo, '已完成', 'milestone', 4, 'Timber & Co', 'inclusive', 13, 276.11]);
  // Expenses — diverse categories reflecting a real freelance operation
  db.run(`INSERT INTO finance_transactions (type, amount, category, description, date) VALUES (?,?,?,?,?)`,
    ['expense', 15, '软件订阅', 'Figma Professional 月费', `${m}-02`]);
  db.run(`INSERT INTO finance_transactions (type, amount, category, description, date) VALUES (?,?,?,?,?)`,
    ['expense', 55, '软件订阅', 'Adobe CC 全家桶', `${m}-03`]);
  db.run(`INSERT INTO finance_transactions (type, amount, category, description, date) VALUES (?,?,?,?,?)`,
    ['expense', 45, '办公支出', '打印 + 快递费', yesterday]);
  db.run(`INSERT INTO finance_transactions (type, amount, category, description, date) VALUES (?,?,?,?,?)`,
    ['expense', 32, '软件订阅', 'Notion + 域名续费', threeDaysAgo]);
  db.run(`INSERT INTO finance_transactions (type, amount, category, description, date) VALUES (?,?,?,?,?)`,
    ['expense', 280, '房租', '共享办公月费 — The Workhaus', `${m}-01`]);
  db.run(`INSERT INTO finance_transactions (type, amount, category, description, date) VALUES (?,?,?,?,?)`,
    ['expense', 95, '餐饮', '商务午餐 — Nova Media 月度对齐', twoDaysAgo]);
  db.run(`INSERT INTO finance_transactions (type, amount, category, description, date) VALUES (?,?,?,?,?)`,
    ['expense', 42, '交通', 'Uber + 停车 — Atlas 客户现场沟通', yesterday]);
  db.run(`INSERT INTO finance_transactions (type, amount, category, description, date) VALUES (?,?,?,?,?)`,
    ['expense', 400, '外包支出', '摄影外包 — Timber & Co 产品图拍摄', fiveDaysAgo]);

  // ── Payment Milestones (2 projects with milestone tracking) ──
  // finance_tx_id back-references rows created above (IDs 1/2/4 — id=3 is the standalone consultancy).
  // Timber & Co tail (3600) has no matching finance_tx yet since it's future/pending.
  // Limelight Studios project — 1 paid + 1 pending
  db.run(`INSERT INTO payment_milestones (client_id, label, amount, percentage, due_date, status, sort_order, finance_tx_id) VALUES (?,?,?,?,?,?,?,?)`,
    [3, '首付款 40%', 1920, 40, `${lastMonth}-18`, 'paid', 1, 1]);
  db.run(`INSERT INTO payment_milestones (client_id, label, amount, percentage, due_date, status, sort_order, finance_tx_id) VALUES (?,?,?,?,?,?,?,?)`,
    [3, '尾款 60%', 2880, 60, nextWeek, 'pending', 2, 2]);
  // Timber & Co project — deposit paid, final pending
  db.run(`INSERT INTO payment_milestones (client_id, label, amount, percentage, due_date, status, sort_order, finance_tx_id) VALUES (?,?,?,?,?,?,?,?)`,
    [4, '首付款 40%', 2400, 40, fiveDaysAgo, 'paid', 1, 4]);
  db.run(`INSERT INTO payment_milestones (client_id, label, amount, percentage, due_date, status, sort_order) VALUES (?,?,?,?,?,?,?)`,
    [4, '尾款 60%', 3600, 60, twoWeeksLater, 'pending', 2]);

  // ── Client Subscription Ledger (MRR history) ──
  // Nova Media + Atlas — active, 2 months of history (matches start dates above)
  db.run(`INSERT OR IGNORE INTO client_subscription_ledger (client_id, client_name, plan_tier, amount, ledger_month) VALUES (?,?,?,?,?)`,
    [1, 'Nova Media', 'Enterprise', 2500, lastMonth]);
  db.run(`INSERT OR IGNORE INTO client_subscription_ledger (client_id, client_name, plan_tier, amount, ledger_month) VALUES (?,?,?,?,?)`,
    [2, 'Atlas Architecture', 'Professional', 1500, lastMonth]);
  db.run(`INSERT OR IGNORE INTO client_subscription_ledger (client_id, client_name, plan_tier, amount, ledger_month) VALUES (?,?,?,?,?)`,
    [1, 'Nova Media', 'Enterprise', 2500, m]);
  db.run(`INSERT OR IGNORE INTO client_subscription_ledger (client_id, client_name, plan_tier, amount, ledger_month) VALUES (?,?,?,?,?)`,
    [2, 'Atlas Architecture', 'Professional', 1500, m]);
  // Harbor Bistro — 3 months of active billing before pausing (no current-month entry)
  const monthKeyOffset = (n: number) => {
    const d = new Date(now); d.setMonth(d.getMonth() - n);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  };
  db.run(`INSERT OR IGNORE INTO client_subscription_ledger (client_id, client_name, plan_tier, amount, ledger_month) VALUES (?,?,?,?,?)`,
    [5, 'Harbor Bistro', 'Professional', 1500, monthKeyOffset(3)]);
  db.run(`INSERT OR IGNORE INTO client_subscription_ledger (client_id, client_name, plan_tier, amount, ledger_month) VALUES (?,?,?,?,?)`,
    [5, 'Harbor Bistro', 'Professional', 1500, monthKeyOffset(2)]);
  db.run(`INSERT OR IGNORE INTO client_subscription_ledger (client_id, client_name, plan_tier, amount, ledger_month) VALUES (?,?,?,?,?)`,
    [5, 'Harbor Bistro', 'Professional', 1500, lastMonth]);

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
  // 10 days ago: 10 × 24 × 60 = 14400 mins — Harbor Bistro subscription paused
  db.run(`INSERT INTO activity_log (entity_type, action, title, detail, created_at) VALUES (?,?,?,?,?)`,
    ['client', 'updated', '客户订阅暂停：Harbor Bistro', 'Professional · $1,500/mo · 客户申请季节性暂停', mins(14400)]);

  // ── Content Drafts (4 — AI-assisted content for social/email) ──
  db.run(`INSERT INTO content_drafts (topic, platform, language, content) VALUES (?,?,?,?)`,
    ['订阅制设计服务的三个核心优势', 'LinkedIn', 'zh',
      '为什么越来越多的北美SaaS公司选择订阅制设计服务？\n\n1. 可预测的成本结构 — 固定月费，告别按项目询价的反复扯皮\n2. 持续的品牌一致性 — 同一设计师跟进所有素材，风格不漂移\n3. 敏捷响应 — 24-48小时内交付，不再等一周起\n\n如果你正在规划品牌视觉升级，不妨考虑这种模式。欢迎私信交流。']);
  db.run(`INSERT INTO content_drafts (topic, platform, language, content) VALUES (?,?,?,?)`,
    ['OceanBlu Tech Logo 提案跟进邮件', 'Email', 'en',
      'Hi [Name],\n\nFollowing up on the 3-concept logo proposal I sent last week for OceanBlu Tech. Happy to walk through any of the directions in a 20-min call this week — Tue/Wed afternoons work well for me.\n\nAlso attaching two additional color variations for Concept 2 based on your earlier note about wanting something that reads well on both light and dark SaaS dashboards.\n\nLet me know what resonates.\n\nBest,\nMing']);
  db.run(`INSERT INTO content_drafts (topic, platform, language, content) VALUES (?,?,?,?)`,
    ['最近交付的 Limelight Studios 官网案例', 'Instagram', 'zh',
      '刚交付 @limelightstudios 的官网终稿 ✨\n\n关键词：自然光、手作质感、留白。整站只用了 3 种字号和 2 套色板，克制但有层次。\n\n作品集更新中，Link in bio 👀\n\n#brandidentity #webdesign #设计师日常 #独立工作室']);
  db.run(`INSERT INTO content_drafts (topic, platform, language, content) VALUES (?,?,?,?)`,
    ['Greenfield Coffee 首次联络话术', 'Email', 'zh',
      '你好 [姓名]，\n\n在 Instagram 看到你们最近的新店开业，氛围很棒。注意到 VI 延展到门店空间时几处细节还有优化空间（比如外摆菜单的视觉层级、杯套字体与主 Logo 的呼应），想交流一下是否有品牌升级的计划。\n\n我是 Ming，在多伦多经营 Ming Design Studio，主做品牌视觉。做过 3 家本地餐饮品牌的 VI + 门店视觉，可以发你参考案例。\n\n如果有兴趣，这周五下午有空聊 15 分钟吗？\n\n祝好，\nMing']);

  // ── Today Focus Manual (3 events pinned to today — show focus board is active) ──
  db.run(`INSERT INTO today_focus_manual (focus_date, type, title, note) VALUES (?,?,?,?)`,
    [today, '深度工作', '交付 Limelight Studios 官网终稿', '上午 2 小时专注排期，不开会不回消息']);
  db.run(`INSERT INTO today_focus_manual (focus_date, type, title, note) VALUES (?,?,?,?)`,
    [today, '客户沟通', '回访 Atlas Architecture Q1 交付总结', '下午 15:00，视频会议 30 分钟']);
  db.run(`INSERT INTO today_focus_manual (focus_date, type, title, note) VALUES (?,?,?,?)`,
    [today, '业务推进', 'OceanBlu Tech 提案跟进', '发送补充邮件 + 2 个色板变体']);
}
