'use client';
// The pool page: moved from the design's pool-screens.tsx PoolPanel (the live Explore pool detail layout: chart left, cards
// right), wired to GET /v2/pool, both wallets' accounts and the pool's activity. All in USDC: no shares, no internals.
// Motion (approved 2026-10-29, part 2): one view of the Pool's in place panel (PoolFlow): its two columns fade in, the
// skeleton fades out to it; Stake and Withdraw change the panel in place and the stake card flies into their card.
import * as React from 'react';
import { motion } from 'motion/react';
import { PanelBox } from '@/components/motion/parts';
import { Avatar } from '@/components/ui/avatar';
import ExploreSkeleton from '@/components/ui/explore-skeleton';
import { Note } from '@/components/design/Note';
import { ShareAvatar } from '@/components/design/ResultCard';
import { statCard } from '@/components/design/stat-card';
import { ClockIcon } from '@/components/icons';
import { formatBps } from '@/lib/money';
import { fade } from '@/lib/motion';
import { activityRows, combine, tiles, useMyStakes, usePool, usePoolActivity } from '../data';
import { POOL_PAUSED } from '../flows';
import { USDC_LOGO } from '../usdc';
import { Actions } from './Actions';
import { Activity } from './Activity';
import { PoolChart } from './PoolChart';
import { PositionCard } from './PositionCard';
import { Tiles } from './Tiles';

const statLabel = 'text-sm font-medium text-[#898989]';
const statValue = 'font-bold text-white md:text-lg';

const Pill = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-[6px] bg-white/10 px-1.5 py-px text-xs leading-5 text-white/60">{children}</div>
);

/** The live Explore skeleton's two columns, until the pool and the stakes have answered once (it fades out to the page). */
export function PoolLoading() {
  return (
    <PanelBox className="gap-y-6 md:max-h-[789px] md:w-full md:max-w-[1204px] md:flex-row md:gap-x-16">
      <motion.div variants={fade} className="flex w-full flex-col gap-y-6 md:flex-row md:gap-x-16"><ExploreSkeleton /></motion.div>
    </PanelBox>
  );
}

export function PoolPanel({ onStake, onWithdraw, freshPayout }: { onStake: () => void; onWithdraw: () => void; freshPayout?: number | null }) {
  const pool = usePool();
  const { stakes } = useMyStakes();
  const activity = usePoolActivity().data;
  const nowSec = Math.floor(Date.now() / 1000);
  if (!pool.data) return null;
  const p = pool.data;
  const paused = !p.open;
  const mine = combine(stakes);
  const t = tiles(p);
  const apy = t.apy === 'Not yet' ? null : t.apy;
  const apy30 = p.stats?.apy30dBps === null || p.stats?.apy30dBps === undefined ? null : formatBps(p.stats.apy30dBps);
  return (
    <PanelBox className="gap-y-6 md:max-h-[740px] md:w-full md:max-w-[1204px] md:flex-row md:items-start md:gap-x-16 md:overflow-y-hidden">
      <motion.div variants={fade} className="flex w-full flex-col gap-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-x-3 text-2xl font-bold text-white md:text-3xl">
            <div className="flex items-center">
              <Avatar src={USDC_LOGO} className="h-8 w-8 md:h-12 md:w-12" />
              <ShareAvatar className="-ml-3 h-8 w-8 md:-ml-4 md:h-12 md:w-12" />
            </div>
            Swapic Pool
          </div>
          <div className="flex items-center gap-x-1">
            <Pill>USDC</Pill>
            <Pill>{paused ? 'Paused' : 'Withdraw anytime'}</Pill>
          </div>
        </div>
        <Tiles pool={p} />
        <PoolChart stakes={stakes} nowSec={nowSec} />
      </motion.div>
      <motion.div variants={fade} className="flex w-full flex-col gap-y-6 md:max-h-[676px] md:max-w-[400px] md:overflow-y-auto md:pr-2">
        <PositionCard mine={mine} apy={apy} nowSec={nowSec} freshPayout={freshPayout} />
        <Actions canStake={!paused} canWithdraw={mine.has && !paused} onStake={onStake} onWithdraw={onWithdraw} />
        {paused && (
          <Note tone="yellow" icon={<ClockIcon width={18} height={18} />}>{POOL_PAUSED}</Note>
        )}
        <div className="flex flex-col gap-y-2">
          <p className="text-xl font-bold text-white md:text-2xl">How it works</p>
          <div className={statCard}>
            {apy && (
              <div>
                <p className={statLabel}>APY</p>
                <p className={statValue}>{apy} <span className="text-sm font-medium text-[#898989]">{apy30 ? `7 days · ${apy30} 30 days` : '7 days'}</span></p>
              </div>
            )}
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
        <Activity rows={activity ? activityRows(activity.items, nowSec) : []} />
      </motion.div>
    </PanelBox>
  );
}
