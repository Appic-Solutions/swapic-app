// Moved from the design's orders-ui.tsx (sha 61b00a56d513): mock data became props (types.tsx).
import * as React from 'react';
import { cn } from '@/lib/cn';
import type { OrderStatus } from './types';

const PILL: Record<OrderStatus, [string, string]> = {
  delivered: ['Delivered', 'bg-[#12B76A33] text-[#12b76a]'],
  pending: ['In progress', 'bg-blue-600/35 text-white'],
  queued: ['Queued', 'bg-blue-600/35 text-white'],
  refunded: ['Refunded', 'bg-yellow-500/20 text-yellow-500'],
  failed: ['Failed', 'bg-[#FF0000]/35 text-[#FF0000]'],
};

export function StatusPill({ status }: { status: OrderStatus }) {
  const [label, tone] = PILL[status];
  const live = status === 'pending' || status === 'queued';
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-x-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold', tone)}>
      {live && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
        </span>
      )}
      {label}
    </span>
  );
}
