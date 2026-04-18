/**
 * Shared helper for normalizing `clients.subscription_timeline`.
 *
 * The ledger sync assumes the column holds a JSON array of `{ type, date }` events.
 * If the column ever stores non-JSON text or a non-array value, JSON.parse fallback
 * to `[]` elsewhere will silently soft-delete every existing subscription ledger row
 * for that client. Both the offline (sql.js) and online (Supabase) write paths must
 * run incoming values through this sanitizer before persisting.
 */
export function sanitizeSubscriptionTimeline(val: unknown): string {
  let parsed: unknown = val;
  if (typeof val === 'string') {
    try { parsed = JSON.parse(val); } catch { return '[]'; }
  }
  if (!Array.isArray(parsed)) return '[]';
  const cleaned = parsed
    .filter((e): e is { type: unknown; date: unknown } => !!e && typeof e === 'object')
    .map((e) => ({
      type: String((e as { type: unknown }).type || ''),
      date: String((e as { date: unknown }).date || ''),
    }))
    .filter((e) => e.date);
  return JSON.stringify(cleaned);
}
