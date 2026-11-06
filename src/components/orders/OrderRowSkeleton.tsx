// Moved from the design's orders-ui.tsx (sha 61b00a56d513): mock data became props (types.tsx).
import * as React from 'react';
import Skeleton, { SkeletonText } from '@/components/ui/skeleton';

const Side = ({ end }: { end?: boolean }) => (
  <div className={end ? 'items-end' : undefined}>
    <SkeletonText className="w-24" />
    <SkeletonText className="w-20 text-xl leading-7" />
    <SkeletonText className="w-14" />
  </div>
);

/** A History row while the orders load (OrderRow.tsx, part for part, shut): its top line, the tokens and the status line, the amounts, the footer. */
export function OrderRowSkeleton() {
  return (
    <div className="flex w-full flex-col rounded-3xl border border-line bg-input-fields p-5 md:p-6">
      <div className="flex items-center justify-between gap-x-3 text-sm font-medium">
        <div className="flex min-w-0 items-center gap-x-2">
          <SkeletonText className="w-10" />
          <Skeleton className="h-5 w-20" />
        </div>
        <SkeletonText className="w-24" />
      </div>
      <div className="my-4 flex w-full items-center justify-between">
        <Skeleton className="h-12 w-12 shrink-0" />
        <div className="flex w-full items-center justify-center">
          <div className="flex-1 border-t-[3px] border-white/10" />
          <Skeleton className="h-10 w-10 shrink-0 md:h-11 md:w-11" />
          <div className="flex-1 border-t-[3px] border-white/10" />
        </div>
        <Skeleton className="h-12 w-12 shrink-0" />
      </div>
      <div className="mb-4 flex items-start justify-between gap-x-4 text-xs font-medium *:flex *:flex-1 *:flex-col *:justify-center">
        <Side />
        <div className="items-center self-center max-md:hidden"><SkeletonText className="w-24" /></div>
        <Side end />
      </div>
      <div className="flex items-center justify-between gap-x-3 text-xs">
        <SkeletonText className="w-20" />
        <SkeletonText className="w-24 text-sm" />
        <SkeletonText className="w-12" />
      </div>
    </div>
  );
}
