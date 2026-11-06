'use client';
// Moved from the design's pool-screens.tsx PoolChart: your stake in USDC over time (with no stake: what $1,000 staked at
// launch is worth), or what stakers earned; the live timeframe pills. The chart draws numbers; the headline is the hovered
// drawn value, or by default the last point's own bigint. The two charts (recharts, about 134 KB gzip) load only when the
// pool page draws them, behind a placeholder of their own height, so the home page and the pool's first paint never wait.
import * as React from 'react';
import dynamic from 'next/dynamic';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Skeleton, { SkeletonText } from '@/components/ui/skeleton';
import { dayText } from '@/lib/copy/format';
import { formatBps, formatUsd } from '@/lib/money';
import { cn } from '@/lib/cn';
import { tw } from '@/lib/motion';
import { SlidingPill } from './parts';
import { combine, earningsSeries, launchGainBps, launchSeries, launchWorth, stakeSeries, usePoolHistory, useMyHistory, type MyStake, type Timeframe } from '../data';

const chartSpace = (height: number) => function ChartSpace() {
  return <Skeleton className="w-full rounded-2xl" style={{ height }} />;
};
const StakeSpace = chartSpace(300);
const EarningsSpace = chartSpace(360);
const SharePriceChart = dynamic(() => import('@/components/design/SharePriceChart'), { ssr: false, loading: StakeSpace });
const VolumeChart = dynamic(() => import('@/components/ui/volume-chart').then((m) => m.VolumeChart), { ssr: false, loading: EarningsSpace });

const TFS: Timeframe[] = ['1D', '1W', '1M', '1Y'];
const drawn = (v: number) => formatUsd(BigInt(Math.round(v * 1e6)));

const LAUNCH = 'what $1,000 staked at launch is worth';

/** The chart while the pool page loads. With no wallet its words are known, and they wrap on phones. */
export function ChartLoading({ wallet }: { wallet: boolean }) {
  return (
    <div className="flex w-full flex-col gap-y-4">
      <p className="text-2xl font-semibold text-white md:text-3xl">
        <SkeletonText className="inline-flex w-28 md:w-36" />
        {wallet ? <SkeletonText className="ml-2 inline-flex w-16 text-sm font-medium" /> : <span className="ml-2 text-sm font-medium text-secondary">{LAUNCH}</span>}
        <SkeletonText className={cn('ml-2 inline-flex text-sm font-medium', wallet ? 'w-32' : 'w-12')} />
      </p>
      <div className="flex w-full flex-col justify-between gap-y-8">
        <StakeSpace />
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-10 w-[114px] rounded-xl" />
          <div className="flex items-center gap-2.5">{TFS.map((t) => <Skeleton key={t} className="h-8 w-8" />)}</div>
        </div>
      </div>
    </div>
  );
}

export function PoolChart({ stakes, nowSec }: { stakes: MyStake[]; nowSec: number }) {
  const [metric, setMetric] = React.useState<'stake' | 'earnings'>('stake');
  const [tf, setTf] = React.useState<Timeframe>('1M');
  const [hover, setHover] = React.useState<number | null>(null);
  const mine = combine(stakes);
  const has = mine.has;
  const owners = stakes.filter((s) => s.shares > 0n).map((s) => s.owner);
  const poolHistory = usePoolHistory(tf);
  const history = poolHistory.data;
  const myHistory = useMyHistory(tf, has ? owners : []);
  const histories = myHistory.flatMap((q) => (q.data ? [q.data] : []));
  // the history this chart draws has not answered yet (an error ends the wait: the words alone, as for a new pool)
  const waiting = metric === 'stake' && has ? myHistory.some((q) => q.isLoading) : poolHistory.isLoading;

  // the series drawn, and the last point as its own bigint (the default headline)
  let series: { date: string; value: number }[] = [];
  let last: bigint | null = null;
  if (metric === 'earnings') {
    series = history ? earningsSeries(history, tf) : [];
    last = history?.points.at(-1) ? BigInt(history.points.at(-1)!.earned) : null;
  } else if (has) {
    series = stakeSeries(histories, tf);
    const lastT = Math.max(...histories.flatMap((h) => h.points.map((p) => p.t)), 0);
    last = histories.length ? histories.reduce((a, h) => a + BigInt(h.points.find((p) => p.t === lastT)?.valueUsdc ?? '0'), 0n) : null;
  } else if (history) {
    // a new pool has no share price yet (null before the first stake): no line and no number, never a crash
    series = launchSeries(history, tf);
    last = launchWorth(history);
  }
  React.useEffect(() => setHover(null), [tf, metric, has]);
  const onHover = (v: number) => setHover(v === series.at(-1)?.value ? null : v);
  // no number yet (a new pool before its first stake): the words alone, never a made up $0.00
  const headline = hover !== null ? drawn(hover) : last !== null ? formatUsd(last) : null;
  const gain = history ? launchGainBps(history) : null;
  const green = metric !== 'stake' ? null
    : has ? (mine.earned !== null && mine.since !== null ? `${mine.earned >= 0n ? '+' : ''}${formatUsd(mine.earned)} since ${dayText(mine.since * 1000, nowSec * 1000)}` : null)
      : gain !== null ? `+${formatBps(gain)}` : null;

  return (
    <div className="flex w-full flex-col gap-y-4">
      <p className="text-2xl font-semibold text-white md:text-3xl">
        {waiting ? <SkeletonText className="inline-flex w-28 md:w-36" /> : headline}
        <span className={cn('text-sm font-medium text-secondary', (waiting || headline !== null) && 'ml-2')}>{metric === 'earnings' ? 'earned by stakers' : has ? 'your stake' : LAUNCH}</span>
        {green ? <span className="ml-2 text-sm font-medium text-success">{green}</span> : waiting && metric === 'stake' && !has && <SkeletonText className="ml-2 inline-flex w-12 text-sm font-medium" />}
      </p>
      <div className="flex w-full flex-col justify-between gap-y-8">
        {metric === 'stake' ? (
          waiting ? <StakeSpace /> : <SharePriceChart data={series} onHover={onHover} height={300} format={drawn} pad={0.6} />
        ) : waiting ? (
          <EarningsSpace />
        ) : (
          <VolumeChart chartData={series.map((p) => ({ ...p, fees: p.value }))} setHovered={onHover as never} />
        )}
        <div className="flex items-center justify-between gap-4">
          <Select value={metric} onValueChange={(v: 'stake' | 'earnings') => setMetric(v)}>
            <SelectTrigger className="max-w-fit gap-x-2 border-line bg-white/[0.06] text-white outline-none ring-0">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent className="max-w-fit gap-x-2 border-line bg-[#1c1c1e] text-white outline-none ring-0">
              <SelectItem value="stake">{has ? 'Your stake' : '$1,000 at launch'}</SelectItem>
              <SelectItem value="earnings">Pool earnings</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2.5">
            {TFS.map((t) => (
              <span
                key={t}
                onClick={() => setTf(t)}
                className={cn(
                  'relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-center text-xs',
                  tw.quick,
                  tw.pressIcon,
                  t === tf ? 'font-medium text-white' : 'bg-white/[0.06] text-secondary hover:bg-white/10',
                )}
              >
                {/* the pill slides to the timeframe picked (motion part 2) */}
                {t === tf && <SlidingPill id="pool-timeframe" />}
                <span className="relative">{t}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
