// Moved from the design's pool-screens.tsx Actions: Stake and Withdraw, each off when it cannot run. A plain click changes
// the pool panel in place (PoolFlow); they stay real links (focus, keyboard, open in a new tab). They fade a little on
// hover and sink when pressed (motion part 2).
import * as React from 'react';
import Link from 'next/link';
import { ArrowDownIcon, PlusIcon } from '@/components/icons';
import { cn } from '@/lib/cn';
import { QUIET } from '@/components/ui/styles';
import { tw } from '@/lib/motion';

const btn = cn('flex h-12 flex-1 cursor-pointer items-center justify-center gap-x-2 rounded-xl bg-primary-buttons text-white hover:opacity-85', tw.quick, tw.press);
const quiet = cn(QUIET, 'h-12 flex-1 cursor-pointer');
const off = 'cursor-not-allowed opacity-50 hover:opacity-50 hover:bg-white/[0.06] active:scale-100';

/** A plain left click stays in place; a click with a modifier key opens the link as the browser does. */
const inPlace = (go: () => void) => (e: React.MouseEvent) => {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
  e.preventDefault();
  go();
};

export function Actions({ canStake, canWithdraw, onStake, onWithdraw }: { canStake: boolean; canWithdraw: boolean; onStake: () => void; onWithdraw: () => void }) {
  return (
    <div className="flex items-center justify-center gap-3 text-sm font-medium md:gap-4">
      {canStake ? <Link href="/pool/stake" onClick={inPlace(onStake)} className={btn}><PlusIcon width={20} height={20} />Stake</Link> : <a aria-disabled className={cn(btn, off)}><PlusIcon width={20} height={20} />Stake</a>}
      {canWithdraw ? (
        <Link href="/pool/withdraw" onClick={inPlace(onWithdraw)} className={quiet}><ArrowDownIcon width={20} height={20} />Withdraw</Link>
      ) : (
        <a aria-disabled className={cn(quiet, off)}><ArrowDownIcon width={20} height={20} />Withdraw</a>
      )}
    </div>
  );
}
