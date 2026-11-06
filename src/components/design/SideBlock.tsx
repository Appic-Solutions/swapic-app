// Moved from the design's scanner-screens.tsx (sha 8c1770a93ada).
import * as React from 'react';
import { cn } from '@/lib/cn';
import { TokenAvatar } from '@/components/orders/TokenAvatar';
import { sideSize } from '@/components/ui/amount-size';
import type { SideView } from '@/components/orders/types';

/** `badge`: the token's mark after the amount (the tick, or a flag pill). */
export function SideBlock({ label, side, amount, tone, badge }: { label: string; side: SideView; amount: string; tone?: string; badge?: React.ReactNode }) {
  return (
    <div className="flex w-full items-center gap-4">
      <TokenAvatar side={side} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-secondary">{label}</p>
        <p className="flex min-w-0 items-center gap-x-1.5"><span className={cn('min-w-0 [overflow-wrap:anywhere]', sideSize(amount), tone)}>{amount}</span>{badge}</p>
        <p className="text-sm font-normal text-secondary">{[side.usdText, side.chain].filter(Boolean).join(' · ')}</p>
      </div>
    </div>
  );
}
