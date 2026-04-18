import { describe, it, expect } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('merges simple class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    const show = false as boolean;
    expect(cn('base', show && 'hidden', 'visible')).toBe('base visible');
  });

  it('deduplicates Tailwind classes (last wins)', () => {
    const result = cn('p-4', 'p-2');
    expect(result).toBe('p-2');
  });

  it('handles undefined and null', () => {
    expect(cn('a', undefined, null, 'b')).toBe('a b');
  });

  it('returns empty string for no args', () => {
    expect(cn()).toBe('');
  });

  it('merges conflicting Tailwind utilities', () => {
    const result = cn('text-red-500', 'text-blue-500');
    expect(result).toBe('text-blue-500');
  });
});
