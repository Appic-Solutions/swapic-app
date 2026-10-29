// Moved from the design's pool-screens.tsx Actions: Stake and Withdraw, each off when it cannot run.
import * as React from 'react';
import Link from 'next/link';
import { ArrowDownIcon, PlusIcon } from '@/components/icons';
import { cn } from '@/lib/cn';

const btn = 'flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg bg-primary-buttons p-2.5 text-white transition-all duration-200 hover:opacity-85 active:scale-95';
const off = 'cursor-not-allowed opacity-50 hover:opacity-50 active:scale-100';

export function Actions({ canStake, canWithdraw }: { canStake: boolean; canWithdraw: boolean }) {
  return (
    <div className="flex items-center justify-center gap-3 text-sm font-medium md:gap-4">
      {canStake ? <Link href="/pool/stake" className={btn}><PlusIcon width={20} height={20} />Stake</Link> : <a aria-disabled className={cn(btn, off)}><PlusIcon width={20} height={20} />Stake</a>}
      {canWithdraw ? (
        <Link href="/pool/withdraw" className={btn}><ArrowDownIcon width={20} height={20} />Withdraw</Link>
      ) : (
        <a aria-disabled className={cn(btn, off)}><ArrowDownIcon width={20} height={20} />Withdraw</a>
      )}
    </div>
  );
}
