import type { PoolAnswer, ScannerStats } from '@/lib/api';
import { formatBps, formatUnits, formatUsdWhole } from '@/lib/money';

/** "12 s", "4 min": the median from milliseconds (whole seconds under two minutes). */
export function medianText(ms: number): string {
  const s = Math.round(ms / 1000);
  return s < 120 ? `${s} s` : `${Math.round(s / 60)} min`;
}

export function homeStats(s: ScannerStats | undefined) {
  if (!s) return null;
  return {
    swaps: formatUnits(BigInt(s.swaps), 0),
    median: s.medianMs === null ? 'none yet' : medianText(s.medianMs),
    delivered: s.deliveredBps === null ? 'none yet' : formatBps(s.deliveredBps),
  };
}

export function earnNumbers(p: PoolAnswer | undefined) {
  if (!p) return null;
  const apy = p.stats?.apy7dBps;
  return { apy: apy === null || apy === undefined ? null : formatBps(apy), staked: formatUsdWhole(BigInt(p.totalAssets)) };
}
