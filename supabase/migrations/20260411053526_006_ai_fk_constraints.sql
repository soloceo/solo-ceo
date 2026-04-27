ALTER TABLE ai_conversations
  ADD CONSTRAINT fk_ai_conversations_agent_id
  FOREIGN KEY (agent_id)
  REFERENCES ai_agents(id)
  ON DELETE SET NULL;;
