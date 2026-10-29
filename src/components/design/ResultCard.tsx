// Moved from the design's pool-screens.tsx (sha cd8202efaf03): display strings come from the caller.
import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import Skeleton from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { Rows } from './Rows';
import { SWAPIC_LOGO } from './swapic-logo';

export const ShareAvatar = ({ className = 'h-12 w-12' }: { className?: string }) => (
  <Avatar src={SWAPIC_LOGO} className={cn('bg-[#0B0B0B] p-2 ring-1 ring-white/20', className)} />
);

/** `fly`: a card with the same data-fly name in the leaving view flies into this one (an in place change, motion part 2). */
export function ResultCard({ label, big, small, rows, loading, avatar, fly }: { label: string; big: string; small: string; rows: [string, string, string?][]; loading?: boolean; avatar?: React.ReactNode; fly?: string }) {
  return (
    <Card data-fly={fly} data-fly-fit={fly ? 'width' : undefined} className="cursor-auto flex-col items-start justify-between gap-3 hover:bg-[#000000]/0 lg:flex-1">
      <div className="flex w-full flex-col gap-3">
      <p className="text-sm font-semibold">{label}</p>
      <div className="flex w-full items-center gap-4">
        {avatar ?? <ShareAvatar className="h-12 w-12" />}
        {loading ? (
          <div className="flex flex-col gap-y-2"><Skeleton className="h-6 w-36" /><Skeleton className="h-4 w-48" /></div>
        ) : (
          <div>
            <p>{big}</p>
            <p className="text-sm font-normal text-[#898989]">{small}</p>
          </div>
        )}
      </div>
      </div>
      {loading ? (
        <div className="w-full space-y-2 border-t border-gray-700 pt-3">
          {[0, 1, 2, 3].map((i) => <div key={i} className="flex justify-between"><Skeleton className="h-4 w-28" /><Skeleton className="h-4 w-16" /></div>)}
        </div>
      ) : (
        <Rows rows={rows} />
      )}
    </Card>
  );
}
