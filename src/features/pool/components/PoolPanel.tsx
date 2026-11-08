'use client';
// The pool page: moved from the design's pool-screens.tsx PoolPanel (the live Explore pool detail layout: chart left, cards
// right), wired to GET /v2/pool, both wallets' accounts and the pool's activity. All in USDC: no shares, no internals.
// Motion (approved 2026-10-29, part 2): one view of the Pool's in place panel (PoolFlow): its two columns fade in; the
// skeleton is this page's exact shape, so it turns into the page where it stands; Stake and Withdraw change the panel in
// place and the stake card flies into their card.
import * as React from 'react';
import { cn } from '@/lib/cn';
import { useScrollFade } from '@/components/ui/use-scroll-fade';
import { motion } from 'motion/react';
import { PanelBox } from '@/components/motion/parts';
import { Avatar } from '@/components/ui/avatar';
import Skeleton, { SkeletonText } from '@/components/ui/skeleton';
import { Note } from '@/components/design/Note';
import { ShareAvatar } from '@/components/design/ResultCard';
import { statCard } from '@/components/design/stat-card';
import { ClockIcon } from '@/components/icons';
import { formatBps } from '@/lib/money';
import { fade } from '@/lib/motion';
import { useWallets } from '@/lib/wallets/store';
import { activityRows, combine, tiles, useMyStakes, usePool, usePoolActivity } from '../data';
import { POOL_PAUSED } from '../flows';
import { USDC_LOGO } from '../usdc';
import { Actions } from './Actions';
import { Activity } from './Activity';
import { ChartLoading, PoolChart } from './PoolChart';
import { PositionCard, PositionLoading } from './PositionCard';
import { Tiles, TilesLoading } from './Tiles';

const statLabel = 'text-sm font-medium text-secondary';
const statValue = 'font-semibold text-white md:text-lg';

const Pill = ({ children }: { children: React.ReactNode }) => (
  <div className="whitespace-nowrap rounded-full bg-white/[0.06] px-2.5 py-0.5 text-xs leading-5 text-secondary">{children}</div>
);

/** The pool page on a short window (a laptop at 125%): exactly the window less the page frame (globals.css). */
export const POOL_FIT = 'lg:short:h-[calc(100dvh-var(--frame-top)-var(--frame-bottom))]';
const PANEL = `gap-y-6 md:w-full md:max-w-[1204px] lg:max-h-[740px] lg:flex-row lg:items-start lg:gap-x-16 lg:overflow-y-hidden md:short:gap-y-4 md:short:p-6 md:tiny:p-5 ${POOL_FIT}`;
// short windows: the left column is the panel's height (the chart takes what is left), the right one scrolls inside it
const LEFT = 'flex w-full flex-col gap-y-6 md:short:gap-y-4 md:tiny:gap-y-3 lg:short:h-full lg:short:min-h-0';
const RIGHT = 'no-scrollbar flex w-full flex-col gap-y-6 lg:max-h-[676px] lg:max-w-[400px] lg:overflow-y-auto md:short:gap-y-4 lg:short:max-h-full';

const Title = ({ status }: { status: React.ReactNode }) => (
  <div className="flex flex-wrap items-center justify-between gap-3">
    <div className="flex items-center gap-x-3 whitespace-nowrap text-2xl font-semibold text-white md:text-3xl md:short:text-2xl">
      <div className="flex items-center">
        <Avatar src={USDC_LOGO} className="h-8 w-8 md:h-12 md:w-12 md:short:h-10 md:short:w-10 md:tiny:h-8 md:tiny:w-8" />
        <ShareAvatar className="-ml-3 h-8 w-8 md:-ml-4 md:h-12 md:w-12 md:short:h-10 md:short:w-10 md:tiny:h-8 md:tiny:w-8" />
      </div>
      Swapic Pool
    </div>
    <div className="flex items-center gap-x-1">
      <Pill>USDC</Pill>
      {status}
    </div>
  </div>
);

const HowItWorks = ({ apy, paused }: { apy: React.ReactNode; paused: boolean }) => (
  <div className="flex flex-col gap-y-2">
    <p className="text-xl font-semibold text-white md:text-2xl">How it works</p>
    <div className={statCard}>
      {apy}
      <div>
        <p className={statLabel}>How you earn</p>
        <p className="text-sm text-white">Swaps that use the pool pay a small fee, and all of it goes to stakers. Your stake grows as those fees come in.</p>
      </div>
      <div>
        <p className={statLabel}>Withdraw</p>
        <p className="text-sm text-white">{paused ? 'In USDC, with no exit fee, once the pool runs again.' : 'Anytime, in USDC, with no exit fee.'} A stake from an EVM wallet pays out on EVM chains, one from ICP on ICP.</p>
      </div>
    </div>
  </div>
);

/** The pool page, part for part, until the pool and the stakes have answered once: what never changes shows as it is, the numbers wait. */
// the one grey line kept (Jeff 2026-11-08: no hints anywhere else): what the pool page lets one do
const POOL_HINT = 'Stake USDC from any chain, or withdraw anytime.';
const POOL_LINE = 'mt-2 text-center text-xs font-normal text-secondary';

export function PoolLoading() {
  const edge = useScrollFade<HTMLDivElement>();
  const wallet = useWallets((s) => !!s.evm || !!s.icp);
  return (
    <PanelBox className={PANEL}>
      <motion.div variants={fade} className={LEFT}>
        <Title status={<Skeleton className="whitespace-nowrap px-2.5 py-0.5 text-xs leading-5 text-transparent">Withdraw anytime</Skeleton>} />
        <TilesLoading />
        <ChartLoading wallet={wallet} />
      </motion.div>
      <motion.div variants={fade} ref={edge.ref} className={cn(RIGHT, edge.fade)}>
        {/* no wallet in the store: the empty card's shape, but never its words (a wallet may still be reconnecting) */}
        {wallet ? <PositionLoading /> : <PositionCard mine={combine([])} apy={null} nowSec={0} loading />}
        <div>
          <div className="flex items-center justify-center gap-3 md:gap-4">
            <Skeleton className="h-12 flex-1 rounded-xl" />
            <Skeleton className="h-12 flex-1 rounded-xl" />
          </div>
          <p className={POOL_LINE}>{POOL_HINT}</p>
        </div>
        <HowItWorks paused={false} apy={<div><p className={statLabel}>APY</p><SkeletonText className={cn(statValue, 'w-44')} /></div>} />
        <Activity rows={[]} loading />
      </motion.div>
    </PanelBox>
  );
}

export function PoolPanel({ onStake, onWithdraw, freshPayout }: { onStake: () => void; onWithdraw: () => void; freshPayout?: number | null }) {
  const edge = useScrollFade<HTMLDivElement>();
  const pool = usePool();
  const { stakes } = useMyStakes();
  const activity = usePoolActivity();
  const nowSec = Math.floor(Date.now() / 1000);
  if (!pool.data) return null;
  const p = pool.data;
  const paused = !p.open;
  const mine = combine(stakes);
  const t = tiles(p);
  const apy = t.apy === 'Not yet' ? null : t.apy;
  const apy30 = p.stats?.apy30dBps === null || p.stats?.apy30dBps === undefined ? null : formatBps(p.stats.apy30dBps);
  return (
    <PanelBox className={PANEL}>
      <motion.div variants={fade} className={LEFT}>
        <Title status={<Pill>{paused ? 'Paused' : 'Withdraw anytime'}</Pill>} />
        <Tiles pool={p} />
        <PoolChart stakes={stakes} nowSec={nowSec} />
      </motion.div>
      <motion.div variants={fade} ref={edge.ref} className={cn(RIGHT, edge.fade)}>
        <PositionCard mine={mine} apy={apy} nowSec={nowSec} freshPayout={freshPayout} />
        <div>
          <Actions canStake={!paused} canWithdraw={mine.has && !paused} onStake={onStake} onWithdraw={onWithdraw} />
          {/* the grey line under the buttons (none while the pool is paused: its note says why) */}
          {!paused && <p className={POOL_LINE}>{POOL_HINT}</p>}
        </div>
        {paused && (
          <Note tone="yellow" icon={<ClockIcon width={16} height={16} />}>{POOL_PAUSED}</Note>
        )}
        <HowItWorks
          paused={paused}
          apy={apy && (
            <div>
              <p className={statLabel}>APY</p>
              <p className={statValue}>{apy} <span className="text-sm font-medium text-secondary">{apy30 ? `7 days · ${apy30} 30 days` : '7 days'}</span></p>
            </div>
          )}
        />
        <Activity rows={activity.data ? activityRows(activity.data.items, nowSec) : []} loading={activity.isLoading} />
      </motion.div>
    </PanelBox>
  );
}
