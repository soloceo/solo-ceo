-- ══════════════════════════════════════════════════════════════════════
-- 001: Optimize RLS policies — single FOR ALL + auth.uid() subselect
-- 远程应用时间: 2026-03-28 04:11:18
--
-- Supabase 官方最佳实践：
--   auth.uid() 在 RLS 策略里被每行重复求值，用 (SELECT auth.uid())
--   包一层就只在 query plan 里求一次，大幅提升扫表性能。
--   参考: https://supabase.com/docs/guides/database/postgres/row-level-security
-- ══════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'leads', 'clients', 'tasks', 'plans', 'finance_transactions',
      'content_drafts', 'activity_log', 'client_subscription_ledger',
      'today_focus_state', 'today_focus_manual', 'app_settings',
      'payment_milestones'
    ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "users_own_data_%1$s" ON %1$I', tbl);
    EXECUTE format(
      'CREATE POLICY "users_own_data_%1$s" ON %1$I
         FOR ALL
         USING ((SELECT auth.uid()) = user_id)
         WITH CHECK ((SELECT auth.uid()) = user_id)',
      tbl
    );
  END LOOP;
END $$;
