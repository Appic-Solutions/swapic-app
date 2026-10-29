// Moved from the design's history-screens.tsx Filters: the segmented filter in the live history TabsList look.
import * as React from 'react';
import { cn } from '@/lib/cn';
import type { Filter } from './data';

const FILTERS: Filter[] = ['All', 'Swaps', 'Pool'];

export function Filters({ value, onChange, counts }: { value: Filter; onChange: (f: Filter) => void; counts: Record<Filter, number> }) {
  return (
    <div className="mx-auto flex w-full max-w-fit items-center gap-1 rounded-full bg-box-background p-1.5 ring-[5px] ring-box-border">
      {FILTERS.map((f) => (
        <button
          key={f}
          onClick={() => onChange(f)}
          className={cn(
            'flex h-9 items-center gap-x-1.5 rounded-full px-4 text-sm font-semibold transition-all duration-200 active:scale-95',
            f === value ? 'bg-[linear-gradient(81.4deg,_#EFEFEF_-15.41%,_#A5A5A5_113.98%)] text-black' : 'text-white/70 hover:text-white',
          )}
        >
          {f}
          <span className={cn('text-xs', f === value ? 'text-black/60' : 'text-white/40')}>{counts[f]}</span>
        </button>
      ))}
    </div>
  );
}
