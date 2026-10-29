'use client';
// Moved from the design's pool-screens.tsx PoolChart: your stake in USDC over time (with no stake: what $1,000 staked at
// launch is worth), or what stakers earned; the live timeframe pills. The chart draws numbers; the headline is the hovered
// drawn value, or by default the last point's own bigint.
import * as React from 'react';
import SharePriceChart from '@/components/design/SharePriceChart';
import { VolumeChart } from '@/components/ui/volume-chart';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { dayText } from '@/lib/copy/format';
import { formatBps, formatUsd } from '@/lib/money';
import { cn } from '@/lib/cn';
import { tw } from '@/lib/motion';
import { SlidingPill } from './parts';
import { combine, earningsSeries, launchGainBps, launchSeries, stakeSeries, usePoolHistory, useMyHistory, type MyStake, type Timeframe } from '../data';

const TFS: Timeframe[] = ['1D', '1W', '1M', '1Y'];
const drawn = (v: number) => formatUsd(BigInt(Math.round(v * 1e6)));

export function PoolChart({ stakes, nowSec }: { stakes: MyStake[]; nowSec: number }) {
  const [metric, setMetric] = React.useState<'stake' | 'earnings'>('stake');
  const [tf, setTf] = React.useState<Timeframe>('1M');
  const [hover, setHover] = React.useState<number | null>(null);
  const mine = combine(stakes);
  const has = mine.has;
  const owners = stakes.filter((s) => s.shares > 0n).map((s) => s.owner);
  const history = usePoolHistory(tf).data;
  const myHistory = useMyHistory(tf, has ? owners : []);
  const histories = myHistory.flatMap((q) => (q.data ? [q.data] : []));

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
    series = launchSeries(history, tf);
    const first = history.points[0] ? BigInt(history.points[0].sharePrice) : 0n;
    const end = history.points.at(-1);
    last = first > 0n && end ? (1_000_000_000n * BigInt(end.sharePrice)) / first : null;
  }
  React.useEffect(() => setHover(null), [tf, metric, has]);
  const onHover = (v: number) => setHover(v === series.at(-1)?.value ? null : v);
  const headline = hover !== null ? drawn(hover) : last !== null ? formatUsd(last) : '$0.00';
  const gain = history ? launchGainBps(history) : null;
  const green = metric !== 'stake' ? null
    : has ? (mine.earned !== null && mine.since !== null ? `${mine.earned >= 0n ? '+' : ''}${formatUsd(mine.earned)} since ${dayText(mine.since * 1000, nowSec * 1000)}` : null)
      : gain !== null ? `+${formatBps(gain)}` : null;

  return (
    <div className="flex w-full flex-col gap-y-4">
      <p className="text-2xl font-semibold text-white md:text-3xl">
        {headline}
        <span className="ml-2 text-sm font-medium text-[#898989]">{metric === 'earnings' ? 'earned by stakers' : has ? 'your stake' : 'what $1,000 staked at launch is worth'}</span>
        {green && <span className="ml-2 text-sm font-medium text-[#12b76a]">{green}</span>}
      </p>
      <div className="flex w-full flex-col justify-between gap-y-8">
        {metric === 'stake' ? (
          <SharePriceChart data={series} onHover={onHover} height={300} format={drawn} pad={0.6} />
        ) : (
          <VolumeChart chartData={series.map((p) => ({ ...p, fees: p.value }))} setHovered={onHover as never} />
        )}
        <div className="flex items-center justify-between gap-4">
          <Select value={metric} onValueChange={(v: 'stake' | 'earnings') => setMetric(v)}>
            <SelectTrigger className="max-w-fit gap-x-2 border-none bg-[#565656] text-[#E3E3E3] outline-none ring-0">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent className="max-w-fit gap-x-2 border-none bg-[#565656] text-[#E3E3E3] outline-none ring-0">
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
                  t === tf ? 'font-semibold text-[#0A0A0B]' : 'bg-[#565656] text-white/70 hover:bg-[#6a6a6a]',
                )}
              >
                {/* the light pill slides to the timeframe picked (motion part 2) */}
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
