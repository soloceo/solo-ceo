import { describe, it, expect } from 'vitest';
import { str, enumVal } from './validate';

describe('str', () => {
  it('returns empty string for null', () => {
    expect(str(null, 100)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(str(undefined, 100)).toBe('');
  });

  it('converts number to string', () => {
    expect(str(42, 100)).toBe('42');
  });

  it('truncates to maxLen', () => {
    expect(str('hello world', 5)).toBe('hello');
  });

  it('returns full string when shorter than maxLen', () => {
    expect(str('hi', 10)).toBe('hi');
  });

  it('returns empty string for maxLen 0', () => {
    expect(str('anything', 0)).toBe('');
  });

  it('handles boolean values', () => {
    expect(str(true, 10)).toBe('true');
    expect(str(false, 10)).toBe('false');
  });
});

describe('enumVal', () => {
  const MODES = ['none', 'exclusive', 'inclusive'] as const;

  it('returns val when it is in the allowed list', () => {
    expect(enumVal('exclusive', MODES, 'none')).toBe('exclusive');
  });

  it('returns fallback for unknown value', () => {
    expect(enumVal('bogus', MODES, 'none')).toBe('none');
  });

  it('returns fallback for null', () => {
    expect(enumVal(null, MODES, 'none')).toBe('none');
  });

  it('returns fallback for undefined', () => {
    expect(enumVal(undefined, MODES, 'none')).toBe('none');
  });

  it('returns fallback for number', () => {
    expect(enumVal(42, MODES, 'inclusive')).toBe('inclusive');
  });
});
