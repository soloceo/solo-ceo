import { describe, it, expect } from 'vitest';
import { sanitizeSubscriptionTimeline } from './subscription-timeline';

describe('sanitizeSubscriptionTimeline', () => {
  it('passes valid JSON array through (roundtrip)', () => {
    const valid = JSON.stringify([
      { type: 'start', date: '2026-01-01' },
      { type: 'pause', date: '2026-03-15' },
    ]);
    expect(sanitizeSubscriptionTimeline(valid)).toBe(valid);
  });

  it('accepts already-parsed array input', () => {
    const arr = [{ type: 'start', date: '2026-01-01' }];
    expect(sanitizeSubscriptionTimeline(arr)).toBe(JSON.stringify(arr));
  });

  it('collapses malformed JSON string to "[]"', () => {
    expect(sanitizeSubscriptionTimeline('{"not":"an array"}')).toBe('[]');
    expect(sanitizeSubscriptionTimeline('not-json')).toBe('[]');
    expect(sanitizeSubscriptionTimeline('""')).toBe('[]');
  });

  it('collapses non-array / non-string to "[]"', () => {
    expect(sanitizeSubscriptionTimeline(null)).toBe('[]');
    expect(sanitizeSubscriptionTimeline(undefined)).toBe('[]');
    expect(sanitizeSubscriptionTimeline(42)).toBe('[]');
    expect(sanitizeSubscriptionTimeline({ foo: 1 })).toBe('[]');
  });

  it('drops entries without a date so ledger sync cannot misinterpret', () => {
    const input = [
      { type: 'start', date: '2026-01-01' },
      { type: 'garbage' },         // no date
      null,                        // not an object
      { date: '2026-02-01' },      // no type (allowed; type coerced to '')
    ];
    const out = JSON.parse(sanitizeSubscriptionTimeline(input));
    expect(out).toEqual([
      { type: 'start', date: '2026-01-01' },
      { type: '', date: '2026-02-01' },
    ]);
  });
});
