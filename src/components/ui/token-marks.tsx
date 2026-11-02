'use client';
// The token marks, as the approved calm design draws them (design-sync verified-tokens.tsx): the blue tick with what it
// means on hover or tap, one soft pill after the symbol ("Fake", "Unverified"), and a small badge on the logo's corner.
import * as React from 'react';
import { VerifiedIcon } from '@/components/icons';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';
import type { TokenMark } from '@/lib/token-marks';

export function VerifiedTick({ symbol, chainName, size = 16 }: { symbol: string; chainName: string; size?: number }) {
  const [open, setOpen] = React.useState(false);
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <span role="img" aria-label="Verified token" onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }} className="inline-flex shrink-0 cursor-help text-blue-500">
            <VerifiedIcon width={size} height={size} />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[230px] text-center text-[13px] leading-snug motion-reduce:animate-none">
          <span className="font-semibold">Verified.</span> {symbol} on {chainName} is on Swapic&apos;s own list of trusted tokens.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function FlagPill({ mark }: { mark: 'fake' | 'unverified' }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center rounded-full px-2 py-[1px] text-[11px] font-semibold leading-4 tracking-wide', mark === 'fake' ? 'bg-red-400/10 text-red-300' : 'bg-amber-300/10 text-amber-200')}>
      {mark === 'fake' ? 'Fake' : 'Unverified'}
    </span>
  );
}

export function LogoBadge({ mark }: { mark: 'fake' | 'unverified' }) {
  return (
    <span aria-hidden className={cn('absolute -bottom-0.5 -right-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full text-[11px] font-bold text-black ring-2 ring-[#141414]', mark === 'fake' ? 'bg-red-300' : 'bg-amber-200')}>
      {mark === 'fake' ? '!' : '?'}
    </span>
  );
}

/** The mark after a symbol: the tick, a pill, or nothing. */
export function MarkAfterSymbol({ mark, symbol, chainName, size }: { mark: TokenMark; symbol: string; chainName: string; size?: number }) {
  if (mark === 'verified') return <VerifiedTick symbol={symbol} chainName={chainName} size={size} />;
  if (mark === 'fake' || mark === 'unverified') return <FlagPill mark={mark} />;
  return null;
}
