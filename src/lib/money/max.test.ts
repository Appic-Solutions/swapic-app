import { describe, expect, it } from 'vitest';
import { maxIcp, maxNative, nativeReserve, usdcGasReserve } from './index';

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
  it('keeps the reserve in USDC where the gas is USDC (Arc), rounded up to the token\'s 6 decimals', () => {
    // 400,000 gas at 25 gwei, plus 20%: 0.012 of the coin, 12,000 micro USDC
    expect(usdcGasReserve(nativeReserve(25_000_000_000n))).toBe(12_000n);
    expect(usdcGasReserve(1n)).toBe(1n);
    expect(usdcGasReserve(0n)).toBe(0n);
    expect(maxNative(5_000_000n, usdcGasReserve(nativeReserve(25_000_000_000n)))).toBe(4_988_000n);
  });
});
