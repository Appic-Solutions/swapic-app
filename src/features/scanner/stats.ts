import type { ScannerStats } from '@/lib/api';
import { dollarsToMicro, formatUnits, formatUsdWhole } from '@/lib/money';
import { medianText } from '@/features/home/stats';

/** A percent with one decimal, rounded half up (99.61% reads 99.6%, 0.39% reads 0.4%), as the design shows. */
const pct = (bps: number) => `${Math.floor((bps + 5) / 10) / 10}%`;

export function scannerTiles(s: ScannerStats): [string, string, string][] {
  const change = s.swapsBefore > 0 ? Math.round(((s.swaps - s.swapsBefore) * 100) / s.swapsBefore) : null;
  const ended = s.delivered + s.refunded + s.failed;
  return [
    ['Swaps, 24H', formatUnits(BigInt(s.swaps), 0), change === null ? 'last 24 hours' : `${change >= 0 ? '+' : ''}${change}% vs yesterday`],
    ['Volume, 24H', formatUsdWhole(dollarsToMicro(s.volumeUsd)), 'all chains'],
    ['Median time', s.medianMs === null ? 'none yet' : medianText(s.medianMs), 'signature to delivery'],
    ['Delivered', s.deliveredBps === null ? 'none yet' : pct(s.deliveredBps), ended ? `${pct(10_000 - (s.deliveredBps ?? 10_000))} refunded as USDC` : 'none ended yet'],
  ];
}
