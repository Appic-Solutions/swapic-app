import { describe, expect, it } from 'vitest';
import { maxIcp, maxNative, nativeReserve } from './index';

describe('max', () => {
  it('keeps two ledger fees on ICP (approve and pull)', () => {
    expect(maxIcp(640_120_000n, 10_000n)).toBe(640_100_000n);
    expect(maxIcp(15_000n, 10_000n)).toBe(0n);
  });
  it('keeps the network reserve on a native coin', () => {
    expect(nativeReserve(2_000_000_000n)).toBe(960_000_000_000_000n);
    expect(maxNative(10n ** 18n, 960_000_000_000_000n)).toBe(999_040_000_000_000_000n);
    expect(maxNative(1n, 2n)).toBe(0n);
  });
});
