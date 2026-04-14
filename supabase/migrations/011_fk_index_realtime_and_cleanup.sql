-- ══════════════════════════════════════════════════════════════════════
-- 011: FK 索引补齐 + 冗余索引清理 + realtime 补齐
-- 远程应用时间: 2026-04-14 03:45:37
--
-- Supabase performance advisor 触发点:
--   1. ai_conversations.agent_id 有 FK 但没索引 → 加索引
--   2. idx_finance_user_source / idx_finance_user_type_status 未被使用 → 删
--   3. content_drafts 不在 supabase_realtime publication 里 → 加进去
-- 全部用 IF EXISTS / IF NOT EXISTS / EXCEPTION 保证幂等。
-- ══════════════════════════════════════════════════════════════════════

-- 1. FK 索引: ai_conversations.agent_id → ai_agents.id
CREATE INDEX IF NOT EXISTS idx_ai_conversations_agent_id
  ON ai_conversations (agent_id)
  WHERE agent_id IS NOT NULL;

-- 2. 删掉未被查询计划使用过的冗余索引
DROP INDEX IF EXISTS idx_finance_user_source;
DROP INDEX IF EXISTS idx_finance_user_type_status;

-- 3. 补 realtime (如果已经在发布里会报 duplicate_object，忽略)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE content_drafts;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
