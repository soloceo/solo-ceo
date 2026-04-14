-- ══════════════════════════════════════════════════════════════════════
-- 007: Drop unused indexes (Supabase performance advisor cleanup)
-- 远程应用时间: 2026-03-28 04:11:39
--
-- Advisor 命中 unused_index 的索引，靠 WHERE user_id 的复合索引已经够用。
-- 用 IF EXISTS 保证幂等 —— 全新项目里如果已经不创建就是 no-op。
-- ══════════════════════════════════════════════════════════════════════

DROP INDEX IF EXISTS idx_finance_status;   -- 000 里建的 (status)
DROP INDEX IF EXISTS idx_finance_source;   -- 000 里建的 (user_id, source, source_id, date) 局部索引
DROP INDEX IF EXISTS idx_pm_due;           -- 000 里建的 (due_date)
