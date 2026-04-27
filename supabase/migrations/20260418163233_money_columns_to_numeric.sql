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

COMMIT;;
