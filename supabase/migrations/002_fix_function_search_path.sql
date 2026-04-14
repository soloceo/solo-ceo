-- ══════════════════════════════════════════════════════════════════════
-- 002: Pin function search_path (Supabase security advisor fix)
-- 远程应用时间: 2026-03-28 04:11:37
--
-- Advisor: function_search_path_mutable
--   没设 search_path 的 SECURITY INVOKER / DEFINER 函数可能被
--   恶意 schema 劫持解析。固定到 public 即可消除警告。
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
