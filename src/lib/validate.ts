/**
 * Input validation helpers used by API layers.
 * Non-breaking: str() truncates with a dev warning, enumVal() falls back with a dev warning.
 */

const isDev = import.meta.env.DEV;

/** Truncate string to maxLen, return empty string for nullish values */
export function str(val: unknown, maxLen: number): string {
  if (val == null) return '';
  const s = String(val);
  if (isDev && s.length > maxLen) {
    console.warn(`[validate] str truncated: "${s.slice(0, 40)}…" (${s.length} → ${maxLen})`);
  }
  return s.slice(0, maxLen);
}

/** Return val if it's in the allowed list, otherwise return fallback */
export function enumVal<T extends string>(val: unknown, allowed: readonly T[], fallback: T): T {
  if (allowed.includes(val as T)) return val as T;
  if (isDev && val != null) {
    console.warn(`[validate] enumVal fallback: "${String(val)}" not in [${allowed.join(', ')}], using "${fallback}"`);
  }
  return fallback;
}
