// The small row at the end of a list while its next page loads by itself (History, the Scanner).
import * as React from 'react';
import Spinner from '@/components/ui/spinner';
import { cn } from '@/lib/cn';

export function LoadingMore({ className }: { className?: string }) {
  return (
    <div data-testid="loading-more" className={cn('flex h-10 shrink-0 items-center justify-center gap-x-2 text-xs text-secondary', className)}>
      <span className="flex h-4 w-4"><Spinner width={16} height={16} /></span>
      Loading more
    </div>
  );
}
