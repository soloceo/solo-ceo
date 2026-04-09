import { describe, it, expect } from 'vitest';
import { fmtDate } from './format';

describe('fmtDate', () => {
  it('returns em dash for empty string', () => {
    expect(fmtDate('', 'zh')).toBe('—');
  });

  it('returns original string for invalid date', () => {
    expect(fmtDate('not-a-date', 'en')).toBe('not-a-date');
  });

  it('formats valid date in Chinese locale', () => {
    const result = fmtDate('2026-03-26', 'zh');
    // zh-CN short month format: "3月26日"
    expect(result).toContain('26');
    expect(result).toContain('3');
  });

  it('formats valid date in English locale', () => {
    const result = fmtDate('2026-03-26', 'en');
    // en-US short month format: "Mar 26"
    expect(result).toContain('26');
    expect(result).toMatch(/mar/i);
  });
});

