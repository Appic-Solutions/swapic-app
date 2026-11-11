import type { PoolAnswer, ScannerStats } from '@/lib/api';
import { formatBps, formatUnits, formatUsdWhole } from '@/lib/money';

/** "12 s", "4 min": the median from milliseconds (whole seconds under two minutes). */
export function medianText(ms: number): string {
  const s = Math.round(ms / 1000);
  return s < 120 ? `${s} sec` : `${Math.round(s / 60)} min`;
}

/** The numbers since the start, where the watcher answers them; the last day's from a watcher before them. */
export function sinceStart(s: ScannerStats) {
  const all = s.medianMsAll !== undefined;
  return {
    swaps: s.swapsAll ?? s.swaps,
    medianMs: all ? (s.medianMsAll ?? null) : s.medianMs,
    deliveredBps: all ? (s.deliveredBpsAll ?? null) : s.deliveredBps,
    delivered: all ? (s.deliveredAll ?? 0) : s.delivered,
    refunded: all ? (s.refundedAll ?? 0) : s.refunded,
    failed: all ? (s.failedAll ?? 0) : s.failed,
  };
}

export function homeStats(s: ScannerStats | undefined) {
  if (!s) return null;
  const n = sinceStart(s);
  return {
    swaps: formatUnits(BigInt(n.swaps), 0),
    median: n.medianMs === null ? 'none yet' : medianText(n.medianMs),
    delivered: n.deliveredBps === null ? 'none yet' : formatBps(n.deliveredBps),
  };
}

export function earnNumbers(p: PoolAnswer | undefined) {
  if (!p) return null;
  const apy = p.stats?.apy7dBps;
  return { apy: apy === null || apy === undefined ? null : formatBps(apy), staked: formatUsdWhole(BigInt(p.totalAssets)) };
}
