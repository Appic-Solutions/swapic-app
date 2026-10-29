/** Max on a native coin: the balance less the gas reserve, never below zero. */
export function maxNative(balance: bigint, reserveWei: bigint): bigint {
  return balance > reserveWei ? balance - reserveWei : 0n;
}

/** Max on an ICP token: the balance less two ledger fees (the approve and the pull, spec section 11). */
export function maxIcp(balance: bigint, ledgerFee: bigint): bigint {
  const keep = 2n * ledgerFee;
  return balance > keep ? balance - keep : 0n;
}

/** The gas a swap may cost: 400,000 gas at the chain's max fee, plus 20%. */
export function nativeReserve(maxFeePerGas: bigint, gasUnits = 400_000n): bigint {
  return (maxFeePerGas * gasUnits * 12n) / 10n;
}
