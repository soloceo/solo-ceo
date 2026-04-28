-- Enforce tenant-scoped references for child records.
-- Single-column foreign keys prove the parent id exists, but not that it belongs
-- to the same user. These composite keys make new cross-user references fail.

ALTER TABLE clients
  ADD CONSTRAINT clients_user_id_id_unique UNIQUE (user_id, id);

ALTER TABLE client_projects
  ADD CONSTRAINT client_projects_user_id_id_unique UNIQUE (user_id, id);

ALTER TABLE finance_transactions
  ADD CONSTRAINT finance_transactions_user_id_id_unique UNIQUE (user_id, id);

ALTER TABLE tasks
  ADD CONSTRAINT tasks_user_id_id_unique UNIQUE (user_id, id);

ALTER TABLE ai_agents
  ADD CONSTRAINT ai_agents_user_id_id_unique UNIQUE (user_id, id);

CREATE INDEX IF NOT EXISTS idx_client_projects_user_client_id
  ON client_projects (user_id, client_id);

CREATE INDEX IF NOT EXISTS idx_payment_milestones_user_client_id
  ON payment_milestones (user_id, client_id);

CREATE INDEX IF NOT EXISTS idx_payment_milestones_user_project_id
  ON payment_milestones (user_id, project_id)
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_milestones_user_finance_tx_id
  ON payment_milestones (user_id, finance_tx_id)
  WHERE finance_tx_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_finance_transactions_user_client_id
  ON finance_transactions (user_id, client_id)
  WHERE client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_finance_transactions_user_project_id
  ON finance_transactions (user_id, project_id)
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_user_client_id
  ON tasks (user_id, client_id)
  WHERE client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_user_parent_id
  ON tasks (user_id, parent_id)
  WHERE parent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_agent_id
  ON ai_conversations (user_id, agent_id)
  WHERE agent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_client_subscription_ledger_user_client_id
  ON client_subscription_ledger (user_id, client_id);

ALTER TABLE client_projects
  ADD CONSTRAINT client_projects_user_client_fk
  FOREIGN KEY (user_id, client_id)
  REFERENCES clients (user_id, id)
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE payment_milestones
  ADD CONSTRAINT payment_milestones_user_client_fk
  FOREIGN KEY (user_id, client_id)
  REFERENCES clients (user_id, id)
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE payment_milestones
  ADD CONSTRAINT payment_milestones_user_project_fk
  FOREIGN KEY (user_id, project_id)
  REFERENCES client_projects (user_id, id)
  DEFERRABLE INITIALLY DEFERRED
  NOT VALID;

ALTER TABLE payment_milestones
  ADD CONSTRAINT payment_milestones_user_finance_tx_fk
  FOREIGN KEY (user_id, finance_tx_id)
  REFERENCES finance_transactions (user_id, id)
  DEFERRABLE INITIALLY DEFERRED
  NOT VALID;

ALTER TABLE finance_transactions
  ADD CONSTRAINT finance_transactions_user_client_fk
  FOREIGN KEY (user_id, client_id)
  REFERENCES clients (user_id, id)
  DEFERRABLE INITIALLY DEFERRED
  NOT VALID;

ALTER TABLE finance_transactions
  ADD CONSTRAINT finance_transactions_user_project_fk
  FOREIGN KEY (user_id, project_id)
  REFERENCES client_projects (user_id, id)
  DEFERRABLE INITIALLY DEFERRED
  NOT VALID;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_user_client_fk
  FOREIGN KEY (user_id, client_id)
  REFERENCES clients (user_id, id)
  DEFERRABLE INITIALLY DEFERRED
  NOT VALID;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_user_parent_fk
  FOREIGN KEY (user_id, parent_id)
  REFERENCES tasks (user_id, id)
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE ai_conversations
  ADD CONSTRAINT ai_conversations_user_agent_fk
  FOREIGN KEY (user_id, agent_id)
  REFERENCES ai_agents (user_id, id)
  DEFERRABLE INITIALLY DEFERRED
  NOT VALID;

ALTER TABLE client_subscription_ledger
  ADD CONSTRAINT client_subscription_ledger_user_client_fk
  FOREIGN KEY (user_id, client_id)
  REFERENCES clients (user_id, id)
  ON DELETE CASCADE
  NOT VALID;
