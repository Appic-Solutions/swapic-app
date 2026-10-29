// Moved from the design's orders-ui.tsx (sha 61b00a56d513): mock data became props (types.tsx).
import * as React from 'react';
import Skeleton from '@/components/ui/skeleton';

/** Skeleton of a History row while the orders load. */
export function OrderRowSkeleton() {
  return (
    <div className="flex w-full flex-col gap-y-4 rounded-2xl bg-input-fields bg-cover p-5 md:rounded-[36px] md:p-6">
      <div className="flex items-center justify-between"><Skeleton className="h-4 w-28" /><Skeleton className="h-4 w-20" /></div>
      <div className="flex items-center gap-x-2">
        <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
        <Skeleton className="h-1 flex-1" />
        <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
        <Skeleton className="h-1 flex-1" />
        <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-y-1.5"><Skeleton className="h-3 w-24" /><Skeleton className="h-6 w-20" /></div>
        <div className="flex flex-col items-end gap-y-1.5"><Skeleton className="h-3 w-24" /><Skeleton className="h-6 w-20" /></div>
      </div>
      <div className="flex items-center justify-between"><Skeleton className="h-6 w-28 rounded-full" /><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-12" /></div>
    </div>
  );
}
