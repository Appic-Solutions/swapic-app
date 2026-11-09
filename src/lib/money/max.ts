/** Max on a native coin: the balance less the gas reserve, never below zero. */
export function maxNative(balance: bigint, reserveWei: bigint): bigint {
  return balance > reserveWei ? balance - reserveWei : 0n;
}

/** Max on an ICP token: the balance less two ledger fees (the approve and the pull, spec section 11). */
export function maxIcp(balance: bigint, ledgerFee: bigint): bigint {
  const keep = 2n * ledgerFee;
  return balance > keep ? balance - keep : 0n;
}

/** A gas reserve in 18-decimal coin units as micro USDC, rounded up: on a chain that pays its gas in USDC (Arc) the
 *  USDC token keeps the reserve back, at the token's 6 decimals. */
export function usdcGasReserve(reserveWei: bigint): bigint {
  const unit = 10n ** 12n;
  return (reserveWei + unit - 1n) / unit;
}

/** The gas a swap may cost: 400,000 gas at the chain's max fee, plus 20%. */
export function nativeReserve(maxFeePerGas: bigint, gasUnits = 400_000n): bigint {
  return (maxFeePerGas * gasUnits * 12n) / 10n;
}
