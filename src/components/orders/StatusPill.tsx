// Moved from the design's orders-ui.tsx (sha 61b00a56d513): mock data became props (types.tsx).
import * as React from 'react';
import { cn } from '@/lib/cn';
import type { OrderStatus } from './types';

const PILL: Record<OrderStatus, [string, string]> = {
  delivered: ['Delivered', 'bg-success/15 text-success'],
  pending: ['In progress', 'bg-blue-500/15 text-blue-300'],
  queued: ['Queued', 'bg-blue-500/15 text-blue-300'],
  refunded: ['Refunded', 'bg-warn/10 text-warn'],
  didntStart: ["Didn't start", 'bg-white/10 text-secondary'],
  onHold: ['On hold', 'bg-warn/10 text-warn'],
};

/** `label`: the same pill in the words of what finished (a stake ends Staked, not Delivered). */
export function StatusPill({ status, label }: { status: OrderStatus; label?: string }) {
  const [word, tone] = PILL[status];
  const live = status === 'pending' || status === 'queued';
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-x-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium', tone)}>
      {live && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-300/80" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-300" />
        </span>
      )}
      {label ?? word}
    </span>
  );
}
