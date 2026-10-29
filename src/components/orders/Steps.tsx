// Moved from the design's orders-ui.tsx (sha 61b00a56d513): mock data became props (types.tsx).
import * as React from 'react';
import Spinner from '@/components/ui/spinner';
import { CheckIcon, CloseIcon, LinkIcon } from '@/components/icons';
import { cn } from '@/lib/cn';
import type { StepView } from './types';

// The live step list (check, spinner, cross), with time, duration and tx link.
export function Steps({ steps, gap = 'gap-y-4', line = 'after:h-[16px]', numbered }: { steps: StepView[]; gap?: string; line?: string; numbered?: boolean }) {
  return (
    <div className={cn('flex flex-col', gap)}>
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center justify-between gap-x-4 text-sm font-semibold text-[#898989]">
          <div className="flex min-w-0 items-center gap-x-4 md:gap-x-5">
            <div
              className={cn(
                'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors duration-500',
                s.state === 'wait' ? 'bg-blue-600/35' : s.state === 'done' ? 'bg-[#12B76A33] text-[#12b76a]' : s.state === 'fail' ? 'bg-[#FF0000]/35 text-[#FF0000]' : 'bg-white/10',
                i < steps.length - 1 && cn('after:absolute after:top-full after:w-[2px]', line, s.state === 'done' ? 'after:bg-[#12B76A33]' : 'after:bg-white/10'),
              )}
            >
              {s.state === 'wait' ? <Spinner /> : s.state === 'done' ? <CheckIcon /> : s.state === 'fail' ? <CloseIcon /> : numbered ? <span className="text-sm font-semibold text-white/70">{i + 1}</span> : null}
            </div>
            <div className="min-w-0">
              <p className={cn('break-words', s.state === 'todo' && !numbered ? 'text-[#898989]' : s.state === 'fail' ? 'text-[#FF6B6B]' : 'text-white')}>{s.label}</p>
              {s.sub && <p className="truncate text-xs font-normal text-[#898989]">{s.sub}</p>}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end text-xs font-normal">
            {s.at && <span className="text-white/80">{s.at}{s.took && <span className="ml-1 text-[#898989]">+{s.took}</span>}</span>}
            {s.tx && (
              <a href={s.tx.href} target="_blank" rel="noopener noreferrer" className="flex cursor-pointer items-center gap-x-1 font-mono text-[#898989] transition-colors hover:text-white">
                {s.tx.text}<LinkIcon width={12} height={12} />
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
