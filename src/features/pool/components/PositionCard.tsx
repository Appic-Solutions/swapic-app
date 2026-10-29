'use client';
// Moved from the design's pool-screens.tsx PositionCard: Your stake, both wallets' stakes added into one (contract 5.5),
// each waiting withdrawal on its own line; the empty card invites a first stake.
// Motion (approved 2026-10-29, part 2): the card lifts with a brighter edge on hover (it is not clickable: no press); it
// flies into Stake's and Withdraw's card when one opens (data-fly); back from a signed withdrawal, that withdrawal's
// waiting line (freshPayout, its payout id) opens calmly once the page has settled, whenever the account shows it.
import * as React from 'react';
import { motion } from 'motion/react';
import Spinner from '@/components/ui/spinner';
import { cn } from '@/lib/cn';
import { DUR, openHeight, tw, useReducedMotion } from '@/lib/motion';
import { statCard } from '@/components/design/stat-card';
import { dayText } from '@/lib/copy/format';
import { formatUsd } from '@/lib/money';
import { combine, waitingLine } from '../data';
import { STAKE_CARD, StakeAvatar } from './parts';

const statLabel = 'text-sm font-medium text-[#898989]';

export function PositionCard({ mine, apy, nowSec, freshPayout }: { mine: ReturnType<typeof combine>; apy: string | null; nowSec: number; freshPayout?: number | null }) {
  const shown = mine.has || mine.waiting.length > 0;
  const reduced = useReducedMotion();
  return (
    <div className="flex flex-col gap-y-2">
      <p className="text-xl font-bold text-white md:text-2xl">Your stake</p>
      <div data-fly={STAKE_CARD} data-fly-fit="width" className={cn(statCard, tw.quick, tw.lift, tw.edge)}>
        {shown ? (
          <>
            <div className="flex items-center gap-x-3">
              <StakeAvatar className="h-10 w-10" />
              <div>
                <p className="font-bold text-white md:text-lg">{formatUsd(mine.valueUsdc)}</p>
                <p className="text-xs text-[#898989]">{apy ? `USDC, earning ${apy} APY` : 'USDC'}</p>
              </div>
            </div>
            {mine.earned !== null && mine.since !== null && (
              <div className="flex items-center justify-between">
                <p className={statLabel}>Earned since {dayText(mine.since * 1000, nowSec * 1000)}</p>
                <p className="font-bold text-[#12b76a]">{mine.earned >= 0n ? `+${formatUsd(mine.earned)}` : formatUsd(mine.earned)}</p>
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
                <div className="mt-3 flex items-center gap-x-3 rounded-xl bg-blue-600/35 p-3 text-sm text-white">
                  <div className="w-6 shrink-0"><Spinner /></div>
                  <p>{waitingLine(w, nowSec)}</p>
                </div>
              </motion.div>
            ) : (
              <div key={w.payoutId} className="flex animate-slide-in-from-top items-center gap-x-3 rounded-xl bg-blue-600/35 p-3 text-sm text-white">
                <div className="w-6 shrink-0"><Spinner /></div>
                <p>{waitingLine(w, nowSec)}</p>
              </div>
            )))}
          </>
        ) : (
          <div className="flex flex-col items-center gap-y-2 py-2 text-center">
            <StakeAvatar className="h-12 w-12" />
            <p className="font-bold text-white">No stake yet</p>
            <p className="text-sm text-[#898989]">Stake USDC from any chain. It earns from every swap that uses the pool, and you can withdraw anytime.</p>
          </div>
        )}
      </div>
    </div>
  );
}
