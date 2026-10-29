import { describe, expect, it } from 'vitest';
import { legacyTarget } from './legacy';

describe('legacyTarget', () => {
  it('sends old routes to the matching tab', () => {
    expect(legacyTarget('/swap')).toBe('/');
    expect(legacyTarget('/bridge/')).toBe('/');
    expect(legacyTarget('/positions')).toBe('/pool');
    expect(legacyTarget('/explore')).toBe('/pool');
    expect(legacyTarget('/transactions-history/bridge')).toBe('/history');
    expect(legacyTarget('/advanced')).toBe('/');
    expect(legacyTarget('/auto-invest')).toBe('/');
  });
  it('leaves the new routes alone and sends any other path home', () => {
    for (const p of ['/', '/pool', '/pool/stake', '/pool/withdraw', '/history', '/scanner']) expect(legacyTarget(p)).toBeNull();
    expect(legacyTarget('/does-not-exist')).toBe('/');
  });
});
