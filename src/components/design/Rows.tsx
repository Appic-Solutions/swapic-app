// Moved from the design's pool-screens.tsx (sha cd8202efaf03): display strings come from the caller.
import * as React from 'react';
import { SkeletonText } from '@/components/ui/skeleton';

// Detail rows inside a "You get" / "You receive" card (the live Option Details look). loading: the labels stay, the values wait.
export function Rows({ rows, loading }: { rows: [string, string, string?][]; loading?: boolean }) {
  return (
    <div className="w-full space-y-2 border-t border-line pt-3">
      {rows.map(([k, v, tone]) => (
        <div key={k} className="flex justify-between gap-3 text-sm">
          <span className="text-secondary">{k}</span>
          {loading ? <SkeletonText className="w-20" /> : <span className={tone === 'green' ? 'text-success' : ''}>{v}</span>}
        </div>
      ))}
    </div>
  );
}
