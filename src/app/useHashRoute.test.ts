import { describe, it, expect } from 'vitest';
import { parseHashString } from './useHashRoute';

describe('parseHashString', () => {
  it('recognises each valid top-level tab', () => {
    expect(parseHashString('#/home')).toBe('home');
    expect(parseHashString('#/leads')).toBe('leads');
    expect(parseHashString('#/work')).toBe('work');
    expect(parseHashString('#/clients')).toBe('clients');
    expect(parseHashString('#/finance')).toBe('finance');
    expect(parseHashString('#/settings')).toBe('settings');
  });

  it('tolerates trailing segments (for future nested routes)', () => {
    // Deep-link support: only the first segment decides activeTab;
    // anything after is free for later features (e.g. #/clients/42).
    expect(parseHashString('#/clients/42')).toBe('clients');
    expect(parseHashString('#/finance/business')).toBe('finance');
  });

  it('rejects unknown tabs', () => {
    expect(parseHashString('#/unknown')).toBeNull();
    expect(parseHashString('#/admin')).toBeNull();
  });

  it('returns null for empty / malformed hashes', () => {
    expect(parseHashString('')).toBeNull();
    expect(parseHashString('#')).toBeNull();
    expect(parseHashString('#/')).toBeNull();
    expect(parseHashString('home')).toBeNull();  // missing leading #/
    expect(parseHashString('#home')).toBeNull();  // missing /
  });
});
