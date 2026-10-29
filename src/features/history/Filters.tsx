'use client';
// Moved from the design's history-screens.tsx Filters: the segmented filter in the live history TabsList look.
import * as React from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/cn';
import { T, tw } from '@/lib/motion';
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
            'relative flex h-9 items-center gap-x-1.5 rounded-full px-4 text-sm font-semibold',
            tw.quick,
            tw.press,
            f === value ? 'text-black' : 'text-white/70 hover:text-white',
          )}
        >
          {/* The light pill: one element that slides to the filter picked (motion row 52). */}
          {f === value && (
            <motion.span layoutId="history-filter" className="absolute inset-0 rounded-full bg-[linear-gradient(81.4deg,_#EFEFEF_-15.41%,_#A5A5A5_113.98%)]" style={{ borderRadius: 9999 }} transition={T.big} />
          )}
          <span className="relative">{f}</span>
          <span className={cn('relative text-xs', f === value ? 'text-black/60' : 'text-white/40')}>{counts[f]}</span>
        </button>
      ))}
    </div>
  );
}
