import { describe, it, expect } from 'vitest';
import { calcTaxAmount } from './tax';

describe('calcTaxAmount', () => {
  it('returns 0 for mode "none"', () => {
    expect(calcTaxAmount(1000, 'none', 13)).toBe(0);
  });

  it('returns 0 when rate is 0', () => {
    expect(calcTaxAmount(1000, 'exclusive', 0)).toBe(0);
  });

  it('returns 0 for unknown mode', () => {
    expect(calcTaxAmount(1000, 'bogus', 13)).toBe(0);
  });

  describe('exclusive (tax added on top)', () => {
    it('calculates 13% on $1000', () => {
      expect(calcTaxAmount(1000, 'exclusive', 13)).toBe(130);
    });

    it('calculates 6% on $500', () => {
      expect(calcTaxAmount(500, 'exclusive', 6)).toBe(30);
    });

    it('rounds to 2 decimal places', () => {
      // 333 * 7 / 100 = 23.31
      expect(calcTaxAmount(333, 'exclusive', 7)).toBe(23.31);
    });

    it('handles fractional rates', () => {
      // 1000 * 6.5 / 100 = 65
      expect(calcTaxAmount(1000, 'exclusive', 6.5)).toBe(65);
    });
  });

  describe('inclusive (tax extracted from total)', () => {
    it('calculates 13% on $1000 inclusive', () => {
      // 1000 * 13 / 113 = 115.04...
      expect(calcTaxAmount(1000, 'inclusive', 13)).toBe(115.04);
    });

    it('calculates 6% on $500 inclusive', () => {
      // 500 * 6 / 106 = 28.30...
      expect(calcTaxAmount(500, 'inclusive', 6)).toBe(28.3);
    });

    it('rounds to 2 decimal places', () => {
      // 333 * 7 / 107 = 21.785... → 21.79
      expect(calcTaxAmount(333, 'inclusive', 7)).toBe(21.79);
    });
  });

  describe('edge cases', () => {
    it('handles 0 amount', () => {
      expect(calcTaxAmount(0, 'exclusive', 13)).toBe(0);
    });

    it('handles very small amounts', () => {
      // 1 * 3 / 100 = 0.03
      expect(calcTaxAmount(1, 'exclusive', 3)).toBe(0.03);
    });

    it('handles 100% rate exclusive', () => {
      expect(calcTaxAmount(100, 'exclusive', 100)).toBe(100);
    });

    it('handles 100% rate inclusive', () => {
      // 100 * 100 / 200 = 50
      expect(calcTaxAmount(100, 'inclusive', 100)).toBe(50);
    });
  });
});
