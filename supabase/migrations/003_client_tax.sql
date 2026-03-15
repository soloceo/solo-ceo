-- ══════════════════════════════════════════════════════════════════════
-- 003: Add tax settings to clients table
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE clients ADD COLUMN IF NOT EXISTS tax_mode TEXT DEFAULT 'none';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS tax_rate DOUBLE PRECISION DEFAULT 0;
