-- 012_money_columns_to_numeric.sql
--
-- Convert every money / amount column from DOUBLE PRECISION (IEEE-754
-- floating point) to NUMERIC (exact decimal). Floating point math
-- drifts in the last digit when summing many rows — a solo-CEO app
-- does ledger reconciliation off these values, so even a 0.001 drift
-- eventually produces "off by one cent" rows in finance reports.
--
-- Amounts:       NUMERIC(14, 2)  — up to 999,999,999,999.99
-- Percentages:   NUMERIC(7, 4)   — up to 999.9999 (covers tax rates
--                                  like 13.0000 and milestone
--                                  percentages like 100.0000)
--
-- USING x::numeric preserves the existing value, rounding any
-- floating-point residue to the declared scale. Safe to run multiple
-- times: re-running against already-NUMERIC columns is a no-op.

BEGIN;

ALTER TABLE clients
  ALTER COLUMN mrr          TYPE NUMERIC(14, 2) USING mrr::numeric,
  ALTER COLUMN project_fee  TYPE NUMERIC(14, 2) USING project_fee::numeric,
  ALTER COLUMN tax_rate     TYPE NUMERIC(7, 4)  USING tax_rate::numeric;

ALTER TABLE plans
  ALTER COLUMN price        TYPE NUMERIC(14, 2) USING price::numeric;

ALTER TABLE finance_transactions
  ALTER COLUMN amount       TYPE NUMERIC(14, 2) USING amount::numeric,
  ALTER COLUMN tax_rate     TYPE NUMERIC(7, 4)  USING tax_rate::numeric,
  ALTER COLUMN tax_amount   TYPE NUMERIC(14, 2) USING tax_amount::numeric;

ALTER TABLE payment_milestones
  ALTER COLUMN amount       TYPE NUMERIC(14, 2) USING amount::numeric,
  ALTER COLUMN percentage   TYPE NUMERIC(7, 4)  USING percentage::numeric;

ALTER TABLE client_projects
  ALTER COLUMN project_fee  TYPE NUMERIC(14, 2) USING project_fee::numeric,
  ALTER COLUMN tax_rate     TYPE NUMERIC(7, 4)  USING tax_rate::numeric;

ALTER TABLE client_subscription_ledger
  ALTER COLUMN amount       TYPE NUMERIC(14, 2) USING amount::numeric;

COMMIT;
