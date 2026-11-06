'use client';
// Moved from the design's pool-screens.tsx PositionCard: Your stake, both wallets' stakes added into one (contract 5.5),
// each waiting withdrawal on its own line; the empty card invites a first stake.
// Motion (approved 2026-10-29, part 2): back from a signed withdrawal, that withdrawal's waiting line (freshPayout, its
// payout id) opens calmly once the page has settled, whenever the account shows it.
import * as React from 'react';
import { motion } from 'motion/react';
import { SkeletonText } from '@/components/ui/skeleton';
import Spinner from '@/components/ui/spinner';
import { cn } from '@/lib/cn';
import { DUR, openHeight, tw, useReducedMotion } from '@/lib/motion';
import { statCard } from '@/components/design/stat-card';
import { dayText } from '@/lib/copy/format';
import { formatUsd } from '@/lib/money';
import { combine, waitingLine } from '../data';
import { StakeAvatar } from './parts';

const statLabel = 'text-sm font-medium text-secondary';

/** Your stake while the accounts load: the shape of a stake, the usual answer for a connected wallet. */
export function PositionLoading() {
  return (
    <div className="flex flex-col gap-y-2">
      <p className="text-xl font-semibold text-white md:text-2xl">Your stake</p>
      <div className={statCard}>
        <div className="flex items-center gap-x-3">
          <StakeAvatar className="h-10 w-10" />
          <div>
            <SkeletonText className="w-24 font-semibold md:text-lg" />
            <SkeletonText className="w-36 text-xs" />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <SkeletonText className="w-36 text-sm font-medium" />
          <SkeletonText className="w-16 font-semibold" />
        </div>
      </div>
    </div>
  );
}

export function PositionCard({ mine, apy, nowSec, freshPayout, loading }: { mine: ReturnType<typeof combine>; apy: string | null; nowSec: number; freshPayout?: number | null; loading?: boolean }) {
  const shown = mine.has || mine.waiting.length > 0;
  const reduced = useReducedMotion();
  return (
    <div className="flex flex-col gap-y-2">
      <p className="text-xl font-semibold text-white md:text-2xl">Your stake</p>
      <div className={statCard}>
        {shown ? (
          <>
            <div className="flex items-center gap-x-3">
              <StakeAvatar className="h-10 w-10" />
              <div>
                <p className="font-semibold text-white md:text-lg">{formatUsd(mine.valueUsdc)}</p>
                <p className="text-xs text-secondary">{apy ? `USDC, earning ${apy} APY` : 'USDC'}</p>
              </div>
            </div>
            {mine.earned !== null && mine.since !== null && (
              <div className="flex items-center justify-between">
                <p className={statLabel}>Earned since {dayText(mine.since * 1000, nowSec * 1000)}</p>
                <p className="font-semibold text-success">{mine.earned >= 0n ? `+${formatUsd(mine.earned)}` : formatUsd(mine.earned)}</p>
              </div>
            )}
            {mine.waiting.map((w) => (w.payoutId === freshPayout ? (
              // just signed: the line opens calmly once the page has settled
              <motion.div
                key={w.payoutId}
                className="-mt-3 overflow-hidden"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1, transition: { ...openHeight(true, reduced), delay: DUR.big + DUR.lead } }}
              >
                <div className="mt-3 flex items-center gap-x-3 rounded-2xl bg-blue-500/10 p-3 text-sm text-white ring-1 ring-inset ring-blue-400/20">
                  <div className="w-6 shrink-0"><Spinner /></div>
                  <p>{waitingLine(w, nowSec)}</p>
                </div>
              </motion.div>
            ) : (
              <div key={w.payoutId} className="flex animate-slide-in-from-top items-center gap-x-3 rounded-2xl bg-blue-500/10 p-3 text-sm text-white ring-1 ring-inset ring-blue-400/20">
                <div className="w-6 shrink-0"><Spinner /></div>
                <p>{waitingLine(w, nowSec)}</p>
              </div>
            )))}
          </>
        ) : (
          <div className="flex flex-col items-center gap-y-2 py-2 text-center">
            <StakeAvatar className="h-12 w-12" />
            {loading ? <SkeletonText className="w-24 font-semibold" /> : <p className="font-semibold text-white">No stake yet</p>}
            <p className="text-sm text-secondary">Stake USDC from any chain. It earns from every swap that uses the pool, and you can withdraw anytime.</p>
          </div>
        )}
      </div>
    </div>
  );
}
