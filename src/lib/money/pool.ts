/** Pool formulas, exactly the backend's. Shares have 18 decimals, USDC 6. */
export const SHARE_UNIT = 10n ** 18n;

export function ceilDiv(a: bigint, b: bigint): bigint {
  if (b <= 0n) throw new RangeError('divide by zero');
  return a === 0n ? 0n : (a - 1n) / b + 1n;
}

/** Micro USDC a whole share is worth (services/quoter/src/api/pool.rs:96-99); null before any stake. */
export function sharePrice(totalAssets: bigint, totalShares: bigint): bigint | null {
  return totalShares === 0n ? null : (totalAssets * SHARE_UNIT) / totalShares;
}

/** What shares are worth now, floored. */
export function valueOfShares(shares: bigint, totalAssets: bigint, totalShares: bigint): bigint {
  return totalShares === 0n ? 0n : (shares * totalAssets) / totalShares;
}

/** Shares a withdrawal of `usdc` burns: ceil(usdc * S / A) (can.did, withdraw_evm and withdraw_icp). */
export function sharesToBurn(usdc: bigint, totalAssets: bigint, totalShares: bigint): bigint {
  return ceilDiv(usdc * totalShares, totalAssets);
}

/** The most a withdrawal lets burn: the burn plus 0.5%, rounded up (quoter engine/withdraw/mod.rs:92-103). */
export function maxSharesFor(usdc: bigint, totalAssets: bigint, totalShares: bigint): bigint {
  const burn = sharesToBurn(usdc, totalAssets, totalShares);
  return burn + ceilDiv(burn * 5n, 1000n);
}

export interface Holding { shares: bigint; valueUsdc: bigint }
export interface IcpWithdrawPlan { usdc: bigint; maxShares: bigint; all: boolean }

/** withdraw_icp's numbers: all of it (usdc = value, every share), or the amount with the quoter's 0.5% room, capped at what is owned. */
export function planIcpWithdraw(wanted: bigint, h: Holding, totalAssets: bigint, totalShares: bigint): IcpWithdrawPlan {
  if (wanted <= 0n) throw new RangeError('nothing to withdraw');
  if (wanted >= h.valueUsdc) return { usdc: h.valueUsdc, maxShares: h.shares, all: true };
  const most = maxSharesFor(wanted, totalAssets, totalShares);
  return { usdc: wanted, maxShares: most < h.shares ? most : h.shares, all: false };
}

export function percentOf(total: bigint, pct: 25 | 50 | 75 | 100): bigint {
  return (total * BigInt(pct)) / 100n;
}

export function minusBps(x: bigint, bps: number): bigint {
  return (x * (10_000n - BigInt(bps))) / 10_000n;
}
