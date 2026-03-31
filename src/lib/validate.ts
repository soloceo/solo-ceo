/**
 * Input validation helpers used by API layers.
 * Designed to be non-breaking: str() silently truncates, enumVal() falls back.
 */

/** Truncate string to maxLen, return empty string for nullish values */
export function str(val: unknown, maxLen: number): string {
  if (val == null) return '';
  return String(val).slice(0, maxLen);
}

/** Return val if it's in the allowed list, otherwise return fallback */
export function enumVal<T extends string>(val: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(val as T) ? (val as T) : fallback;
}
