import { describe, it, expect } from 'vitest';
import { dateToKey, monthKey } from './date-utils';

describe('dateToKey', () => {
  it('formats a date as YYYY-MM-DD in given timezone', () => {
    // 2026-06-15 00:00 UTC
    const d = new Date('2026-06-15T00:00:00Z');
    expect(dateToKey(d, 'UTC')).toBe('2026-06-15');
  });

  it('respects timezone offset', () => {
    // 2026-01-01 02:00 UTC = 2026-01-01 11:00 Asia/Shanghai
    const d = new Date('2026-01-01T02:00:00Z');
    expect(dateToKey(d, 'Asia/Shanghai')).toBe('2026-01-01');
  });

  it('handles date rollover across timezone', () => {
    // 2026-03-31 23:00 UTC = 2026-04-01 07:00 Asia/Shanghai
    const d = new Date('2026-03-31T23:00:00Z');
    expect(dateToKey(d, 'Asia/Shanghai')).toBe('2026-04-01');
    expect(dateToKey(d, 'UTC')).toBe('2026-03-31');
  });

  it('zero-pads month and day', () => {
    const d = new Date('2026-01-05T12:00:00Z');
    expect(dateToKey(d, 'UTC')).toBe('2026-01-05');
  });
});

describe('monthKey', () => {
  it('extracts YYYY-MM from a date string', () => {
    expect(monthKey('2026-03-15')).toBe('2026-03');
  });

  it('extracts YYYY-MM from a full ISO string', () => {
    expect(monthKey('2026-12-31T23:59:59Z')).toBe('2026-12');
  });

  it('uses fallback date when value is null', () => {
    const fallback = new Date('2026-06-15T00:00:00Z');
    // dateToKey with default tz, but the month should be 2026-06
    const result = monthKey(null, fallback);
    expect(result).toMatch(/^2026-06/);
  });

  it('uses fallback date when value is undefined', () => {
    const fallback = new Date('2025-01-01T12:00:00Z');
    const result = monthKey(undefined, fallback);
    expect(result).toMatch(/^2025-01/);
  });

  it('uses fallback date when value is empty string', () => {
    const fallback = new Date('2026-09-20T00:00:00Z');
    const result = monthKey('', fallback);
    expect(result).toMatch(/^2026-09/);
  });
});
