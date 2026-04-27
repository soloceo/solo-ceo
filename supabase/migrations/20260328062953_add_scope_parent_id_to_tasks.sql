
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'work';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_id BIGINT REFERENCES tasks(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_tasks_scope ON tasks (user_id, scope, soft_deleted);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks (parent_id) WHERE parent_id IS NOT NULL;
;
