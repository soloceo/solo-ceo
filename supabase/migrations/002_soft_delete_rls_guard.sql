-- ══════════════════════════════════════════════════════════════════════
-- 002: Add soft_deleted guard to SELECT policies
-- 日期: 2026-03-31
--
-- 防止开发者忘记在查询中手动过滤 soft_deleted = false。
-- 仅影响 SELECT (UPDATE/DELETE 仍可操作已软删的行以便恢复)。
-- ══════════════════════════════════════════════════════════════════════

-- Tables that have soft_deleted column
-- (activity_log, client_subscription_ledger, today_focus_state, app_settings do NOT have it)

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'leads', 'clients', 'tasks', 'plans', 'finance_transactions',
      'content_drafts', 'today_focus_manual'
    ])
  LOOP
    -- Drop the basic select policy from migration 001
    EXECUTE format('DROP POLICY IF EXISTS "select_own_%1$s" ON %1$I', tbl);
    -- Recreate with soft_deleted guard
    EXECUTE format(
      'CREATE POLICY "select_own_%1$s" ON %1$I FOR SELECT USING (auth.uid() = user_id AND soft_deleted = false)',
      tbl
    );
  END LOOP;
END $$;

-- payment_milestones (handled separately due to custom policies in 001)
DROP POLICY IF EXISTS "select_own_payment_milestones" ON payment_milestones;
CREATE POLICY "select_own_payment_milestones" ON payment_milestones
  FOR SELECT USING (auth.uid() = user_id AND soft_deleted = false);
