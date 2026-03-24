-- Migration: Add source tracking fields to finance_transactions
-- This enables unified single-table finance queries (no more virtual rows)

-- 1. Add source fields
ALTER TABLE finance_transactions ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE finance_transactions ADD COLUMN IF NOT EXISTS source_id BIGINT;

-- 2. Mark existing milestone-linked transactions
UPDATE finance_transactions ft
SET source = 'milestone', source_id = pm.id
FROM payment_milestones pm
WHERE pm.finance_tx_id = ft.id AND ft.source = 'manual';

-- 3. Index for efficient upsert lookups (subscription sync)
CREATE INDEX IF NOT EXISTS idx_finance_source ON finance_transactions (user_id, source, source_id, date)
WHERE soft_deleted = FALSE;
