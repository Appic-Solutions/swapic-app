import type { ScannerStats } from '@/lib/api';
import { dollarsToMicro, formatUnits, formatUsdWhole } from '@/lib/money';
import { medianText, sinceStart } from '@/features/home/stats';

/** A percent with one decimal, rounded half up (99.61% reads 99.6%, 0.39% reads 0.4%), as the design shows. */
const pct = (bps: number) => `${Math.floor((bps + 5) / 10) / 10}%`;

/** Every tile counts since the start, where the watcher answers it. */
export function scannerTiles(s: ScannerStats): [string, string, string][] {
  const n = sinceStart(s);
  const ended = n.delivered + n.refunded + n.failed;
  return [
    ['Swaps, all time', formatUnits(BigInt(n.swaps), 0), 'since launch'],
    ['Volume, all time', formatUsdWhole(dollarsToMicro(s.volumeUsdAll ?? s.volumeUsd)), 'all chains'],
    ['Median time', n.medianMs === null ? 'none yet' : medianText(n.medianMs), 'signature to delivery'],
    ['Delivered', n.deliveredBps === null ? 'none yet' : pct(n.deliveredBps), ended ? `${pct(10_000 - (n.deliveredBps ?? 10_000))} refunded as USDC` : 'none ended yet'],
  ];
}
