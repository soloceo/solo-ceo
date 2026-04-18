/**
 * Single source of truth for the `FinanceTransaction` shape used across
 * `FinancePage`, `useClientTransactions`, and `ClientList`.
 *
 * Historically there were two copies that disagreed on whether `client_id`
 * could be `null` (FinancePage) or was strictly `number | undefined`
 * (useClientTransactions). Under `strict`, passing rows between the two
 * silently lost the `null` case and caused runtime bugs. Keep this widened
 * to `number | null | undefined` — the Supabase schema lets the column go
 * null when a client is deleted.
 */
export interface FinanceTransaction {
  id: number;
  type: "income" | "expense";
  source?: string;
  source_id?: number;
  amount: number;
  category: string;
  description: string;
  desc?: string;
  date: string;
  status: string;
  client_id?: number | null;
  client_name?: string;
  tax_mode: "none" | "exclusive" | "inclusive";
  tax_rate: number;
  tax_amount: number;
  [key: string]: unknown;
}
