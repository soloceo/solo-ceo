-- ══════════════════════════════════════════════════════════════════════
-- 010: Optimize RLS on ai_agents / ai_conversations / client_projects
-- 远程应用时间: 2026-04-14 03:45:29
--
-- 把 004 / 005 / 003 里的 auth.uid() = user_id 全部替换成
-- (SELECT auth.uid()) = user_id，避免 Postgres 每行重新求值。
-- 参考: https://supabase.com/docs/guides/database/postgres/row-level-security
-- ══════════════════════════════════════════════════════════════════════

-- ── ai_agents (4 个 per-operation 策略) ──
DROP POLICY IF EXISTS "select_own_ai_agents" ON ai_agents;
DROP POLICY IF EXISTS "insert_own_ai_agents" ON ai_agents;
DROP POLICY IF EXISTS "update_own_ai_agents" ON ai_agents;
DROP POLICY IF EXISTS "delete_own_ai_agents" ON ai_agents;

CREATE POLICY "select_own_ai_agents" ON ai_agents
  FOR SELECT USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "insert_own_ai_agents" ON ai_agents
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "update_own_ai_agents" ON ai_agents
  FOR UPDATE USING ((SELECT auth.uid()) = user_id)
           WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "delete_own_ai_agents" ON ai_agents
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- ── ai_conversations (4 个 per-operation 策略) ──
DROP POLICY IF EXISTS "select_own_ai_conversations" ON ai_conversations;
DROP POLICY IF EXISTS "insert_own_ai_conversations" ON ai_conversations;
DROP POLICY IF EXISTS "update_own_ai_conversations" ON ai_conversations;
DROP POLICY IF EXISTS "delete_own_ai_conversations" ON ai_conversations;

CREATE POLICY "select_own_ai_conversations" ON ai_conversations
  FOR SELECT USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "insert_own_ai_conversations" ON ai_conversations
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "update_own_ai_conversations" ON ai_conversations
  FOR UPDATE USING ((SELECT auth.uid()) = user_id)
           WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "delete_own_ai_conversations" ON ai_conversations
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- ── client_projects (单个 FOR ALL 策略，对齐 001 风格) ──
DROP POLICY IF EXISTS "users_own_data_client_projects" ON client_projects;

CREATE POLICY "users_own_data_client_projects" ON client_projects
  FOR ALL USING ((SELECT auth.uid()) = user_id)
          WITH CHECK ((SELECT auth.uid()) = user_id);
