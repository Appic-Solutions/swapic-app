// Moved from the design's scanner-screens.tsx (sha 8c1770a93ada).
import * as React from 'react';
import { cn } from '@/lib/cn';
import { TokenAvatar } from '@/components/orders/TokenAvatar';
import type { SideView } from '@/components/orders/types';

export function SideBlock({ label, side, amount, tone }: { label: string; side: SideView; amount: string; tone?: string }) {
  return (
    <div className="flex w-full items-center gap-4">
      <TokenAvatar side={side} />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#898989]">{label}</p>
        <p className={cn('truncate', tone)}>{amount}</p>
        <p className="text-sm font-normal text-[#898989]">{[side.usdText, side.chain].filter(Boolean).join(' · ')}</p>
      </div>
    </div>
  );
}
