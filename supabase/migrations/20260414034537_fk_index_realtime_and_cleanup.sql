
-- 1. Covering index for ai_conversations.agent_id FK
CREATE INDEX IF NOT EXISTS idx_ai_conversations_agent_id
  ON ai_conversations (agent_id)
  WHERE agent_id IS NOT NULL;

-- 2. Drop 2 unused indexes flagged by advisor
DROP INDEX IF EXISTS idx_finance_user_source;
DROP INDEX IF EXISTS idx_finance_user_type_status;

-- 3. Add content_drafts to realtime publication (app subscribes to it)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE content_drafts;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;
;
