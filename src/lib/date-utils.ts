/**
 * Shared date utilities used by both offline (api.ts) and online (supabase-api.ts) layers.
 *
 * All "today" calculations respect the user's configured timezone so that
 * e.g. 2026-03-29 23:00 in Asia/Shanghai is still "today" (not "tomorrow").
 */
import { useSettingsStore } from '../store/useSettingsStore';

/** Get the configured timezone (safe to call outside React) */
function tz(): string {
  try {
    return useSettingsStore.getState().timezone || 'America/Toronto';
  } catch {
    return typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : 'America/Toronto';
  }
}

/**
 * Format a Date to YYYY-MM-DD in the user's timezone.
 * This replaces the old `new Date().toISOString().split('T')[0]` pattern
 * which incorrectly used UTC.
 */
export function dateToKey(d: Date, timezone?: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone || tz(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const y = parts.find(p => p.type === 'year')!.value;
  const m = parts.find(p => p.type === 'month')!.value;
  const dd = parts.find(p => p.type === 'day')!.value;
  return `${y}-${m}-${dd}`;
}

/** Today's date key (YYYY-MM-DD) in the user's timezone */
export function todayDateKey(): string {
  return dateToKey(new Date());
}

export function monthKey(value: string | null | undefined, fallback?: Date): string {
  if (value) return String(value).slice(0, 7);
  return dateToKey(fallback ?? new Date()).slice(0, 7);
}

export function currentMonth(): string {
  return dateToKey(new Date()).slice(0, 7);
}
