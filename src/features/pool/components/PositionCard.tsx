// Moved from the design's pool-screens.tsx PositionCard: Your stake, both wallets' stakes added into one (contract 5.5),
// each waiting withdrawal on its own line; the empty card invites a first stake.
import * as React from 'react';
import Spinner from '@/components/ui/spinner';
import { statCard } from '@/components/design/stat-card';
import { dayText } from '@/lib/copy/format';
import { formatUsd } from '@/lib/money';
import { combine, waitingLine } from '../data';
import { StakeAvatar } from './parts';

const statLabel = 'text-sm font-medium text-[#898989]';

export function PositionCard({ mine, apy, nowSec }: { mine: ReturnType<typeof combine>; apy: string | null; nowSec: number }) {
  const shown = mine.has || mine.waiting.length > 0;
  return (
    <div className="flex flex-col gap-y-2">
      <p className="text-xl font-bold text-white md:text-2xl">Your stake</p>
      <div className={statCard}>
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
            {mine.waiting.map((w, k) => (
              <div key={k} className="flex animate-slide-in-from-top items-center gap-x-3 rounded-xl bg-blue-600/35 p-3 text-sm text-white">
                <div className="w-6 shrink-0"><Spinner /></div>
                <p>{waitingLine(w, nowSec)}</p>
              </div>
            ))}
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
