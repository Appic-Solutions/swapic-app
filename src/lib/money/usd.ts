import { parseDecimal } from './units';

const PRICE_SCALE = 18;

/** Micro dollars an amount is worth at `priceUsd` (dollars a whole token), floored; null without a price. */
export function usdMicro(amount: bigint, decimals: number, priceUsd: string | null): bigint | null {
  if (priceUsd === null) return null;
  const price = parseDecimal(priceUsd, PRICE_SCALE);
  return (amount * price) / 10n ** BigInt(decimals + PRICE_SCALE - 6);
}

const group = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** `$1,234.56`, floored to the cent. */
export function formatUsd(micro: bigint): string {
  const neg = micro < 0n;
  const cents = (neg ? -micro : micro) / 10_000n;
  return `${neg ? '-' : ''}$${group((cents / 100n).toString())}.${(cents % 100n).toString().padStart(2, '0')}`;
}

/** `$8,420`, floored to the dollar. */
export function formatUsdWhole(micro: bigint): string {
  const neg = micro < 0n;
  return `${neg ? '-' : ''}$${group(((neg ? -micro : micro) / 1_000_000n).toString())}`;
}

/** The contract's dollar strings (`volumeUsd`: "412880.12") as micro dollars. */
export function dollarsToMicro(text: string): bigint {
  return parseDecimal(text, 6);
}

/** Basis points as a percent with one decimal: 420 is 4.2%. Whole basis points only (contract 1.2); BigInt(4.5) throws. */
export function formatBps(bps: number): string {
  const b = BigInt(bps);
  return `${b / 100n}.${(b % 100n) / 10n}%`;
}
