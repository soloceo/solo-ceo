/**
 * Minimal client reference used by pages that display a client picker or link
 * (Finance, Work). `ClientList.ClientRow` is the full schema — this is the
 * "just enough to render a name + id" projection.
 */
export interface ClientItem {
  id: number;
  name: string;
  company_name?: string;
  [key: string]: unknown;
}
