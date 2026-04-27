
-- Optimize RLS policies: use (select auth.uid()) instead of auth.uid()
-- This makes auth.uid() evaluate once per query instead of once per row

DO $$
DECLARE
  tbl text;
  pol text;
BEGIN
  FOR tbl, pol IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND qual = '(auth.uid() = user_id)'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', pol, tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id)',
      pol, tbl
    );
  END LOOP;
END $$;
;
