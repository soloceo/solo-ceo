-- ══════════════════════════════════════════════════════════════════════
-- 001: Split RLS policies per operation + cross-table validation
-- 日期: 2026-03-31
--
-- 原策略: 单一 FOR ALL 策略
-- 新策略: 每表 4 条 (SELECT / INSERT / UPDATE / DELETE) 独立策略
-- 额外: payment_milestones 验证 client_id 归属当前用户
-- ══════════════════════════════════════════════════════════════════════

-- ┌─────────────────────────────────────────────────────────────────────┐
-- │  1. 删除旧的 FOR ALL 策略                                           │
-- └─────────────────────────────────────────────────────────────────────┘

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
  END LOOP;
END $$;


-- ┌─────────────────────────────────────────────────────────────────────┐
-- │  2. 创建 per-operation 策略 (标准表)                                 │
-- └─────────────────────────────────────────────────────────────────────┘

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'leads', 'clients', 'tasks', 'plans', 'finance_transactions',
      'content_drafts', 'activity_log', 'client_subscription_ledger',
      'today_focus_state', 'today_focus_manual', 'app_settings'
    ])
  LOOP
    -- SELECT: 只能读自己的数据
    EXECUTE format(
      'CREATE POLICY "select_own_%1$s" ON %1$I FOR SELECT USING (auth.uid() = user_id)',
      tbl
    );
    -- INSERT: 只能插入自己的数据
    EXECUTE format(
      'CREATE POLICY "insert_own_%1$s" ON %1$I FOR INSERT WITH CHECK (auth.uid() = user_id)',
      tbl
    );
    -- UPDATE: 只能更新自己的数据
    EXECUTE format(
      'CREATE POLICY "update_own_%1$s" ON %1$I FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)',
      tbl
    );
    -- DELETE: 只能删除自己的数据
    EXECUTE format(
      'CREATE POLICY "delete_own_%1$s" ON %1$I FOR DELETE USING (auth.uid() = user_id)',
      tbl
    );
  END LOOP;
END $$;


-- ┌─────────────────────────────────────────────────────────────────────┐
-- │  3. payment_milestones — 额外验证 client 归属                       │
-- └─────────────────────────────────────────────────────────────────────┘

-- SELECT: 只读自己的
CREATE POLICY "select_own_payment_milestones" ON payment_milestones
  FOR SELECT USING (auth.uid() = user_id);

-- INSERT: user_id 匹配 + client_id 必须属于当前用户
CREATE POLICY "insert_own_payment_milestones" ON payment_milestones
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = client_id AND c.user_id = auth.uid()
    )
  );

-- UPDATE: user_id 匹配 + client_id 必须属于当前用户
CREATE POLICY "update_own_payment_milestones" ON payment_milestones
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = client_id AND c.user_id = auth.uid()
    )
  );

-- DELETE: 只删除自己的
CREATE POLICY "delete_own_payment_milestones" ON payment_milestones
  FOR DELETE USING (auth.uid() = user_id);
