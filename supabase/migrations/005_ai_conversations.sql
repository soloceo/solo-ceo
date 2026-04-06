-- Migration 005: AI Conversations table for persistent chat storage
-- Stores conversation history per user with agent associations.

CREATE TABLE IF NOT EXISTS ai_conversations (
  id              TEXT PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL DEFAULT '',
  agent_id        INTEGER,
  agent_ids       JSONB DEFAULT '[]',
  messages        JSONB DEFAULT '[]',
  soft_deleted    BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user
  ON ai_conversations (user_id) WHERE soft_deleted = false;

-- RLS policies (per-operation, matching project convention)
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_ai_conversations" ON ai_conversations
  FOR SELECT USING (auth.uid() = user_id AND soft_deleted = false);

CREATE POLICY "insert_own_ai_conversations" ON ai_conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_ai_conversations" ON ai_conversations
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_ai_conversations" ON ai_conversations
  FOR DELETE USING (auth.uid() = user_id);

-- Auto-update updated_at
CREATE TRIGGER trg_updated_at_ai_conversations
  BEFORE UPDATE ON ai_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE ai_conversations;
