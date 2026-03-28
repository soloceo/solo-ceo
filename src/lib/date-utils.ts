/**
 * Shared date utilities used by both offline (api.ts) and online (supabase-api.ts) layers.
 */

export function todayDateKey(): string {
  return new Date().toISOString().split('T')[0];
}

export function monthKey(value: string | null | undefined, fallback?: Date): string {
  if (value) return String(value).slice(0, 7);
  const d = fallback ?? new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function currentMonth(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}
