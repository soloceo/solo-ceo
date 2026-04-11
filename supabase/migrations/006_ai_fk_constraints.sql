-- Migration 006: Add FK constraint on ai_conversations.agent_id → ai_agents.id
-- Uses SET NULL so deleting an agent doesn't cascade-delete conversation history.

ALTER TABLE ai_conversations
  ADD CONSTRAINT fk_ai_conversations_agent_id
  FOREIGN KEY (agent_id)
  REFERENCES ai_agents(id)
  ON DELETE SET NULL;
