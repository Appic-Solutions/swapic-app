'use client';
import { useQueries, useQuery } from '@tanstack/react-query';
import { getAccount, getAccountHistory, getPool, getPoolActivity, getPoolHistory, type AccountHistory, type PoolActivityItem, type PoolAnswer, type PoolHistory, type PoolRange, type WaitingPayout } from '@/lib/api';
import { formatBps, formatUsd, formatUsdWhole, parseSigned } from '@/lib/money';
import { tokenAmountText } from '@/lib/copy/format';
import { chainLogo, chainName } from '@/lib/explorer';
import { useWallets } from '@/lib/wallets/store';

export type Timeframe = '1D' | '1W' | '1M' | '1Y';
/** The design's pills to the contract's ranges (5.2); 1Y shows the whole history (the pool is younger than a year). */
export const RANGE: Record<Timeframe, PoolRange> = { '1D': '1d', '1W': '7d', '1M': '30d', '1Y': 'all' };

export function tiles(p: PoolAnswer) {
  const s = p.stats ?? null;
  return {
    apy: s?.apy7dBps === null || s?.apy7dBps === undefined ? 'Not yet' : formatBps(s.apy7dBps),
    apySub: s?.apy30dBps === null || s?.apy30dBps === undefined ? null : `${formatBps(s.apy30dBps)} over 30 days`,
    staked: formatUsdWhole(BigInt(p.totalAssets)),
    earned24h: s ? formatUsd(BigInt(s.earned24h)) : '$0.00',
  };
}

export interface MyStake { kind: 'evm' | 'icp'; owner: string; shares: bigint; valueUsdc: bigint; earned: bigint | null; since: number | null; waiting: WaitingPayout[] }

export function combine(stakes: MyStake[]) {
  const live = stakes.filter((s) => s.shares > 0n || s.waiting.length > 0);
  const valueUsdc = live.reduce((a, s) => a + s.valueUsdc, 0n);
  const earned = live.some((s) => s.earned === null) ? null : live.reduce((a, s) => a + (s.earned ?? 0n), 0n);
  const sinces = live.map((s) => s.since).filter((x): x is number => x !== null);
  return {
    valueUsdc, earned, since: sinces.length ? Math.min(...sinces) : null,
    waiting: live.flatMap((s) => s.waiting.map((w) => ({ payoutId: w.payoutId, usdc: BigInt(w.usdc), etaAt: w.etaAt, status: w.status }))),
    has: live.some((s) => s.shares > 0n),
  };
}

/** Contract 5.5: `queued` waits in line (minutes from `etaAt`, none when null or the backend's log is stale), `refunding` is
 *  being undone (its shares come back), every other word is on its way. */
export function waitingLine(w: { usdc: bigint; etaAt: number | null; status: string }, nowSec: number): string {
  const what = `Withdrawal of ${formatUsd(w.usdc)}`;
  if (w.status === 'refunding') return `${what} coming back to your stake. You can try again later.`;
  if (w.status !== 'queued') return `${what} on its way`;
  return w.etaAt === null ? `${what} in line` : `${what} in line, about ${Math.max(1, Math.round((w.etaAt - nowSec) / 60))} min`;
}

const dollars = (micro: bigint) => Number(micro) / 1e6; // drawing only
function label(t: number, tf: Timeframe): string {
  const d = new Date(t * 1000);
  if (tf === '1D') return `${String(d.getHours()).padStart(2, '0')}:00`;
  if (tf === '1W') return d.toLocaleString('en-US', { weekday: 'short' });
  if (tf === '1M') return `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })}`;
  return d.toLocaleString('en-US', { month: 'short' });
}

export function stakeSeries(hs: AccountHistory[], tf: Timeframe) {
  const by = new Map<number, bigint>();
  for (const h of hs) for (const p of h.points) by.set(p.t, (by.get(p.t) ?? 0n) + BigInt(p.valueUsdc));
  return [...by.entries()].sort(([a], [b]) => a - b).map(([t, v]) => ({ date: label(t, tf), value: dollars(v) }));
}

export function launchSeries(h: PoolHistory, tf: Timeframe) {
  const first = h.points[0] ? BigInt(h.points[0].sharePrice) : 0n;
  if (first === 0n) return [];
  return h.points.map((p) => ({ date: label(p.t, tf), value: dollars((1_000_000_000n * BigInt(p.sharePrice)) / first) }));
}

export function launchGainBps(h: PoolHistory): number | null {
  const a = h.points[0], b = h.points[h.points.length - 1];
  if (!a || !b || BigInt(a.sharePrice) === 0n) return null;
  return Number(((BigInt(b.sharePrice) - BigInt(a.sharePrice)) * 10_000n) / BigInt(a.sharePrice));
}

export function earningsSeries(h: PoolHistory, tf: Timeframe) {
  return h.points.map((p) => ({ date: label(p.t, tf), value: dollars(BigInt(p.earned)), fees: dollars(BigInt(p.earned)) }));
}

function ago(at: number, now: number): string {
  const s = Math.max(now - at, 0);
  if (s < 60) return `${s} s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86_400)} days ago`;
}

export function activityRows(items: PoolActivityItem[], nowSec: number) {
  return items.map((i) => {
    const usdc = BigInt(i.usdc);
    if (i.kind === 'swap') {
      const from = i.from ? `${i.from.symbol} on ${chainName(i.from.chain)}` : 'A swap';
      return { id: i.id, kind: 'premium' as const, title: 'Earned from a swap', sub: `${from} to ${i.to?.symbol ?? ''} · ${ago(i.at, nowSec)}`, amount: `+${formatUsd(BigInt(i.earned ?? '0'))}`, chainLogo: null };
    }
    const where = i.chain ? chainName(i.chain) : '';
    return i.kind === 'stake'
      ? { id: i.id, kind: 'stake' as const, title: `Staked ${tokenAmountText(usdc, 6, 'USDC')} USDC`, sub: `from ${where} · ${ago(i.at, nowSec)}`, amount: `+${formatUsd(usdc)}`, chainLogo: i.chain ? chainLogo(i.chain) : null }
      : { id: i.id, kind: 'withdraw' as const, title: `Withdrew ${tokenAmountText(usdc, 6, 'USDC')} USDC`, sub: `to ${where} · ${ago(i.at, nowSec)}`, amount: `-${formatUsd(usdc)}`, chainLogo: i.chain ? chainLogo(i.chain) : null };
  });
}

const visible = () => typeof document === 'undefined' || document.visibilityState === 'visible';
/** Pool numbers every 60 s while visible (spec 7, my call). */
export const usePool = () => useQuery({ queryKey: ['pool'], queryFn: getPool, refetchInterval: () => (visible() ? 60_000 : false) });
export const usePoolHistory = (tf: Timeframe) => useQuery({ queryKey: ['pool-history', RANGE[tf]], queryFn: () => getPoolHistory(RANGE[tf]), staleTime: 300_000 });
export const usePoolActivity = () => useQuery({ queryKey: ['pool-activity'], queryFn: () => getPoolActivity(), refetchInterval: () => (visible() ? 60_000 : false) });

/** One account per connected wallet (contract section 2): the EVM address; the ICP principal's default account. */
export function useMyStakes() {
  const evm = useWallets((s) => s.evm);
  const icp = useWallets((s) => s.icp);
  const owners = [...(evm ? [{ kind: 'evm' as const, owner: evm.address }] : []), ...(icp ? [{ kind: 'icp' as const, owner: icp.principal }] : [])];
  const qs = useQueries({
    queries: owners.map((o) => ({ queryKey: ['account', o.owner], queryFn: () => getAccount(o.owner), refetchInterval: () => (visible() ? 60_000 : false) })),
  });
  const stakes: MyStake[] = qs.flatMap((q, k) => (q.data ? [{
    kind: owners[k]!.kind, owner: owners[k]!.owner, shares: BigInt(q.data.shares), valueUsdc: BigInt(q.data.valueUsdc),
    earned: q.data.earned === undefined || q.data.earned === null ? null : parseSigned(q.data.earned),
    since: q.data.since ?? null, waiting: q.data.waiting ?? [],
  }] : []));
  // known: every connected wallet's account has answered (or failed) at least once; with no wallet, nothing is known yet
  return { stakes, loading: qs.some((q) => q.isLoading), known: owners.length > 0 && qs.every((q) => q.isSuccess || q.isError) };
}

export function useMyHistory(tf: Timeframe, owners: string[]) {
  return useQueries({ queries: owners.map((o) => ({ queryKey: ['account-history', o, RANGE[tf]], queryFn: () => getAccountHistory(o, RANGE[tf]), staleTime: 300_000 })) });
}
