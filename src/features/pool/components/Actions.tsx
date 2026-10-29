// Moved from the design's pool-screens.tsx Actions: Stake and Withdraw, each off when it cannot run. They change the pool
// panel in place (PoolFlow); they fade a little on hover and sink when pressed (motion part 2).
import * as React from 'react';
import { ArrowDownIcon, PlusIcon } from '@/components/icons';
import { cn } from '@/lib/cn';
import { tw } from '@/lib/motion';

const btn = cn('flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg bg-primary-buttons p-2.5 text-white hover:opacity-85', tw.quick, tw.press);
const off = 'cursor-not-allowed opacity-50 hover:opacity-50 active:scale-100';

export function Actions({ canStake, canWithdraw, onStake, onWithdraw }: { canStake: boolean; canWithdraw: boolean; onStake: () => void; onWithdraw: () => void }) {
  return (
    <div className="flex items-center justify-center gap-3 text-sm font-medium md:gap-4">
      <a role="link" aria-disabled={!canStake || undefined} onClick={canStake ? onStake : undefined} className={cn(btn, !canStake && off)}><PlusIcon width={20} height={20} />Stake</a>
      <a role="link" aria-disabled={!canWithdraw || undefined} onClick={canWithdraw ? onWithdraw : undefined} className={cn(btn, !canWithdraw && off)}><ArrowDownIcon width={20} height={20} />Withdraw</a>
    </div>
  );
}
