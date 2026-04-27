
-- Fix auth_rls_initplan warnings on ai_agents, ai_conversations, client_projects.
-- Replaces auth.uid() with (select auth.uid()) so Postgres evaluates it once
-- per query plan instead of once per row.

-- ── ai_agents: drop 4 per-op, recreate ──────────────────────────────
DROP POLICY IF EXISTS "select_own_ai_agents" ON ai_agents;
DROP POLICY IF EXISTS "insert_own_ai_agents" ON ai_agents;
DROP POLICY IF EXISTS "update_own_ai_agents" ON ai_agents;
DROP POLICY IF EXISTS "delete_own_ai_agents" ON ai_agents;

CREATE POLICY "select_own_ai_agents" ON ai_agents
  FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "insert_own_ai_agents" ON ai_agents
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "update_own_ai_agents" ON ai_agents
  FOR UPDATE USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "delete_own_ai_agents" ON ai_agents
  FOR DELETE USING ((select auth.uid()) = user_id);

-- ── ai_conversations: drop 4 per-op, recreate ───────────────────────
DROP POLICY IF EXISTS "select_own_ai_conversations" ON ai_conversations;
DROP POLICY IF EXISTS "insert_own_ai_conversations" ON ai_conversations;
DROP POLICY IF EXISTS "update_own_ai_conversations" ON ai_conversations;
DROP POLICY IF EXISTS "delete_own_ai_conversations" ON ai_conversations;

CREATE POLICY "select_own_ai_conversations" ON ai_conversations
  FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "insert_own_ai_conversations" ON ai_conversations
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "update_own_ai_conversations" ON ai_conversations
  FOR UPDATE USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "delete_own_ai_conversations" ON ai_conversations
  FOR DELETE USING ((select auth.uid()) = user_id);

-- ── client_projects: single FOR ALL, recreate with subselect ────────
DROP POLICY IF EXISTS "users_own_data_client_projects" ON client_projects;

CREATE POLICY "users_own_data_client_projects" ON client_projects
  FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
;
