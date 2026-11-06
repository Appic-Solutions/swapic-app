// Moved from the design's pool-screens.tsx (sha cd8202efaf03): display strings come from the caller.
import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { SkeletonText } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { Rows } from './Rows';
import { SWAPIC_LOGO } from './swapic-logo';

export const ShareAvatar = ({ className = 'h-12 w-12' }: { className?: string }) => (
  <Avatar src={SWAPIC_LOGO} className={cn('bg-[#0B0B0B] p-2 ring-1 ring-white/20', className)} />
);

export function ResultCard({ label, big, small, rows, loading, avatar }: { label: string; big: string; small: string; rows: [string, string, string?][]; loading?: boolean; avatar?: React.ReactNode }) {
  return (
    <Card className="cursor-auto flex-col items-start justify-between gap-3 lg:flex-1">
      <div className="flex w-full flex-col gap-3">
      <p className="text-sm font-semibold">{label}</p>
      <div className="flex w-full items-center gap-4">
        {avatar ?? <ShareAvatar className="h-12 w-12" />}
        {loading ? (
          <div className="min-w-0">
            <SkeletonText className="w-36 max-w-full" />
            <SkeletonText className="w-48 max-w-full text-sm font-normal" />
          </div>
        ) : (
          <div>
            <p>{big}</p>
            <p className="text-sm font-normal text-secondary">{small}</p>
          </div>
        )}
      </div>
      </div>
      <Rows rows={rows} loading={loading} />
    </Card>
  );
}
