'use client';
// Moved from the design's history-screens.tsx Filters: the segmented filter in the live history TabsList look.
import * as React from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/cn';
import { T, tw } from '@/lib/motion';
import type { Filter } from './data';

const FILTERS: Filter[] = ['All', 'Swaps', 'Pool'];

export function Filters({ value, onChange, counts }: { value: Filter; onChange: (f: Filter) => void; counts?: Record<Filter, number> }) {
  return (
    <div className="mx-auto flex w-full max-w-fit items-center gap-1 rounded-full border border-line bg-[#141416] p-1">
      {FILTERS.map((f) => (
        <button
          key={f}
          onClick={() => onChange(f)}
          className={cn(
            'relative flex h-8 items-center gap-x-1.5 rounded-full px-4 text-sm font-medium',
            tw.quick,
            tw.press,
            f === value ? 'text-white' : 'text-secondary hover:text-white',
          )}
        >
          {/* The picked pill: one element that slides to the filter picked (motion row 52). */}
          {f === value && (
            <motion.span layoutId="history-filter" className="absolute inset-0 rounded-full bg-white/10" style={{ borderRadius: 9999 }} transition={T.big} />
          )}
          <span className="relative">{f}</span>
          {counts && <span className={cn('relative text-xs', f === value ? 'text-secondary' : 'text-faint')}>{counts[f]}</span>}
        </button>
      ))}
    </div>
  );
}
