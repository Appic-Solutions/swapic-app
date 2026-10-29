import { describe, expect, it } from 'vitest';
import { ceilDiv, maxSharesFor, percentOf, planIcpWithdraw, sharePrice, sharesToBurn, valueOfShares, minusBps } from './index';

// The contract's own example pool (5.3) and account (5.5).
const A = 8_420_550_000n;
const S = 8_346_065_000_000_000_000_000n;

describe('pool math', () => {
  it('prices a whole share as the quoter does (pool.rs:96-99)', () => {
    expect(sharePrice(A, S)).toBe(1_008_924n);
    expect(sharePrice(0n, 0n)).toBeNull();
  });
  it('values shares by the canister rule shares * A / S, floored', () => {
    expect(valueOfShares(1_182_254_000_000_000_000_000n, A, S)).toBe(1_192_805_102n);
  });
  it('burns ceil(usdc * S / A), as withdraw_evm and withdraw_icp do (can.did)', () => {
    expect(sharesToBurn(600_000_000n, A, S)).toBe(594_692_626_966_172_043_394n);
    expect(ceilDiv(10n, 3n)).toBe(4n);
    expect(ceilDiv(9n, 3n)).toBe(3n);
  });
  it('lets at most 0.5% more burn, as the withdraw quote does (engine/withdraw/mod.rs:92-103)', () => {
    expect(maxSharesFor(600_000_000n, A, S)).toBe(597_666_090_101_002_903_611n);
  });
  it('plans an ICP withdrawal: all of it, or the amount capped at the owned shares', () => {
    const account = { shares: 1_182_254_000_000_000_000_000n, valueUsdc: 1_192_805_102n };
    expect(planIcpWithdraw(1_192_805_102n, account, A, S)).toEqual({ usdc: 1_192_805_102n, maxShares: account.shares, all: true });
    expect(planIcpWithdraw(600_000_000n, account, A, S)).toEqual({ usdc: 600_000_000n, maxShares: 597_666_090_101_002_903_611n, all: false });
    const small = { shares: 595_000_000_000_000_000_000n, valueUsdc: 600_300_000n };
    expect(planIcpWithdraw(600_000_000n, small, A, S).maxShares).toBe(small.shares);
  });
  it('splits 25/50/75/Max and takes basis points, floored', () => {
    expect(percentOf(1_192_805_102n, 25)).toBe(298_201_275n);
    expect(percentOf(1_192_805_102n, 100)).toBe(1_192_805_102n);
    expect(minusBps(10_000n, 50)).toBe(9_950n);
  });
});
