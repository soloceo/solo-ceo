-- ══════════════════════════════════════════════════════════════════════
-- 009: clients — 新增 subscription_timeline (JSON 文本)
--
-- 存订阅状态变更历史的 JSON 数组: [{date, action, note}, ...]
-- 用 TEXT 而非 JSONB 保持与其它 JSON 字段 (features / agent_ids) 的
-- 读写一致性，前端统一 JSON.parse / stringify。
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS subscription_timeline TEXT DEFAULT '[]';
