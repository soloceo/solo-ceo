import { describe, it, expect } from 'vitest';
import { fmtDate, formatMoney, getCurrencySymbol } from './format';

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

describe('formatMoney', () => {
  it('shows $ for USD', () => {
    expect(formatMoney(1234, 'USD', 'en')).toContain('$');
    expect(formatMoney(1234, 'USD', 'en')).toContain('1,234');
  });

  it('shows ¥ for CNY', () => {
    const out = formatMoney(500, 'CNY', 'zh');
    expect(out).toContain('¥');
    expect(out).toContain('500');
  });

  it('shows € for EUR', () => {
    expect(formatMoney(99, 'EUR', 'en')).toContain('€');
  });

  it('handles negative amounts', () => {
    const out = formatMoney(-42, 'USD', 'en');
    expect(out).toContain('42');
    expect(out).toMatch(/^-/);
  });

  it('prefixes + when showSign is set and amount is positive', () => {
    const out = formatMoney(20, 'USD', 'en', { showSign: true });
    expect(out).toMatch(/^\+/);
  });

  it('omits decimals for whole numbers, shows 2 for fractional', () => {
    expect(formatMoney(100, 'USD', 'en')).not.toContain('.');
    expect(formatMoney(100.5, 'USD', 'en')).toContain('.50');
  });

  it('coerces null / NaN / strings safely', () => {
    expect(formatMoney(null, 'USD', 'en')).toContain('0');
    expect(formatMoney(undefined, 'USD', 'en')).toContain('0');
    expect(formatMoney('not-a-number', 'USD', 'en')).toContain('0');
    expect(formatMoney('123.45', 'USD', 'en')).toContain('123.45');
  });

  it('absolute: true draws the number magnitude only', () => {
    expect(formatMoney(-42, 'USD', 'en', { absolute: true })).not.toMatch(/^-/);
  });

  it('falls back to symbol table for unknown currency codes', () => {
    const out = formatMoney(5, 'ZZZ', 'en');
    expect(out).toContain('5');
  });
});

describe('getCurrencySymbol', () => {
  it('returns $ for USD', () => {
    expect(getCurrencySymbol('USD', 'en')).toBe('$');
  });

  it('returns ¥ for CNY', () => {
    expect(getCurrencySymbol('CNY', 'zh')).toBe('¥');
  });

  it('returns € for EUR', () => {
    expect(getCurrencySymbol('EUR', 'en')).toBe('€');
  });

  it('falls back to the code itself for unknown currencies', () => {
    expect(getCurrencySymbol('XXYZ', 'en')).toBe('XXYZ');
  });

  it('defaults to USD when currency arg is empty', () => {
    expect(getCurrencySymbol('', 'en')).toBe('$');
  });
});

