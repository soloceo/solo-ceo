-- ══════════════════════════════════════════════════════════════════════
-- 008: tasks — 新增 scope / parent_id / client_id
-- 远程应用时间:
--   - scope, parent_id : 2026-03-28 06:29:53 (add_scope_parent_id_to_tasks)
--   - client_id        : 2026-03-29 04:35:10 (add_tasks_client_id)
--
-- 语义：
--   scope     : 'work' | 'personal' —— 区分业务任务 vs 个人事项
--   parent_id : 自引用，用于任务拆分 / 子任务
--   client_id : 关联客户，替代原有 TEXT client 字段的结构化版本
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS scope     TEXT    DEFAULT 'work';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_id BIGINT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS client_id BIGINT;

-- 对齐远程的索引定义（名字和列必须严格一致，否则 advisor 误报）
CREATE INDEX IF NOT EXISTS idx_tasks_scope
  ON tasks (user_id, scope, soft_deleted);

CREATE INDEX IF NOT EXISTS idx_tasks_parent
  ON tasks (parent_id)
  WHERE parent_id IS NOT NULL;
