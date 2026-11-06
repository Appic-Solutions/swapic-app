// Moved from the design's pool-screens.tsx Activity: stakes, withdrawals and what stakers earned from swaps (contract 5.4);
// each row opens the order in the Scanner.
import * as React from 'react';
import Link from 'next/link';
import { Avatar } from '@/components/ui/avatar';
import Skeleton, { SkeletonText } from '@/components/ui/skeleton';
import { statCard } from '@/components/design/stat-card';
import { EarnIcon } from '@/components/icons';
import { cn } from '@/lib/cn';
import { tw } from '@/lib/motion';
import { activityRows } from '../data';
import { USDC_LOGO } from '../usdc';

/** A row while the activity loads. */
const RowSkeleton = () => (
  <div className="-mx-3 -my-1.5 flex items-center justify-between gap-3 px-3 py-1.5">
    <div className="flex min-w-0 items-center gap-x-3">
      <Skeleton className="h-9 w-9 shrink-0" />
      <div className="min-w-0">
        <SkeletonText className="w-32 text-sm" />
        <SkeletonText className="w-24 text-xs" />
      </div>
    </div>
    <SkeletonText className="w-14 shrink-0 text-sm" />
  </div>
);

export function Activity({ rows, loading }: { rows: ReturnType<typeof activityRows>; loading?: boolean }) {
  return (
    <div className="flex flex-col gap-y-2">
      <p className="text-xl font-semibold text-white md:text-2xl">Activity</p>
      <div className={statCard}>
        {loading && [0, 1, 2].map((i) => <RowSkeleton key={i} />)}
        {rows.map((a) => (
          // a row lights up on hover (motion part 2); it opens the order in the Scanner
          <Link key={a.id} href={`/scanner?order=${encodeURIComponent(a.id)}`} className={cn('-mx-3 -my-1.5 flex items-center justify-between gap-3 rounded-xl px-3 py-1.5 hover:bg-white/5', tw.quick)}>
            <div className="flex min-w-0 items-center gap-x-3">
              {a.kind === 'premium' ? (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                  <EarnIcon width={16} height={16} />
                </div>
              ) : (
                <div className="relative shrink-0">
                  <Avatar src={USDC_LOGO} className="h-9 w-9" />
                  {a.chainLogo && <Avatar src={a.chainLogo} className="absolute -bottom-1 -right-1 h-4 w-4" />}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{a.title}</p>
                <p className="text-xs text-secondary">{a.sub}</p>
              </div>
            </div>
            <p className={cn('shrink-0 text-sm font-semibold', a.amount.startsWith('-') ? 'text-secondary' : a.kind === 'premium' ? 'text-success' : 'text-white')}>{a.amount}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
