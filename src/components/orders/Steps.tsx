'use client';
// Moved from the design's orders-ui.tsx (sha 61b00a56d513): mock data became props (types.tsx).
// Motion (approved 2026-10-29, Swap only for now): animated, a step that is done draws its check in and fills the line to
// the next step; the waiting step lights up; labels and times fade in as they change (rows keep their place, keyed by
// position). Not animated, the list is the static one.
import * as React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import Spinner from '@/components/ui/spinner';
import { CheckIcon, CloseIcon, ExternalLinkIcon } from '@/components/icons';
import { DrawCheck } from '@/components/motion/parts';
import { cn } from '@/lib/cn';
import { DUR, T, tw, useMounted } from '@/lib/motion';
import type { StepView } from './types';

// The line under a step circle, as a real element (the animated list fills it).
const LINE_H: Record<string, string> = { 'after:h-[16px]': 'h-[16px]', 'after:h-[24px]': 'h-[24px]' };

// The live step list (check, spinner, cross), with time, duration and tx link.
export function Steps({ steps, gap = 'gap-y-4', line = 'after:h-[16px]', numbered, animated }: { steps: StepView[]; gap?: string; line?: string; numbered?: boolean; animated?: boolean }) {
  if (animated) return <LiveSteps steps={steps} gap={gap} line={line} numbered={numbered} />;
  return (
    <div className={cn('flex flex-col', gap)}>
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center justify-between gap-x-4 text-sm font-medium text-secondary">
          <div className="flex min-w-0 items-center gap-x-4 md:gap-x-5">
            <div
              className={cn(
                'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors duration-500',
                s.state === 'wait' ? 'bg-blue-500/15' : s.state === 'done' ? 'bg-success/15 text-success' : s.state === 'fail' ? 'bg-fail/15 text-fail' : 'bg-white/10',
                i < steps.length - 1 && cn('after:absolute after:top-full after:w-[2px]', line, s.state === 'done' ? 'after:bg-success/15' : 'after:bg-white/10'),
              )}
            >
              {s.state === 'wait' ? <Spinner /> : s.state === 'done' ? <CheckIcon /> : s.state === 'fail' ? <CloseIcon /> : numbered ? <span className="text-sm font-medium text-secondary">{i + 1}</span> : null}
            </div>
            <div className="min-w-0">
              <p className={cn('break-words', s.state === 'todo' && !numbered ? 'text-secondary' : s.state === 'fail' ? 'text-fail' : 'text-white')}>{s.label}</p>
              {s.sub && <p className="truncate text-xs font-normal text-secondary">{s.sub}</p>}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end text-xs font-normal">
            {s.at && <span className="text-white">{s.at}{s.took && <span className="ml-1 text-secondary">+{s.took}</span>}</span>}
            {s.tx && (
              <a href={s.tx.href} target="_blank" rel="noopener noreferrer" className="flex cursor-pointer items-center gap-x-1 font-mono text-secondary transition-colors hover:text-white">
                {s.tx.text}<ExternalLinkIcon width={16} height={16} />
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function LiveSteps({ steps, gap, line, numbered }: { steps: StepView[]; gap: string; line: string; numbered?: boolean }) {
  // What shows on the first render is already there: only changes animate.
  const mounted = useMounted();
  const appear = mounted ? { opacity: 0 } : false;
  return (
    <div className={cn('flex flex-col', gap)}>
      {steps.map((s, i) => {
        const done = s.state === 'done';
        return (
          <div key={i} data-step-state={s.state} className="relative flex items-center justify-between gap-x-4 text-sm font-medium text-secondary">
            {/* The waiting step lights up. */}
            <AnimatePresence initial={false}>
              {s.state === 'wait' && (
                <motion.div
                  className="pointer-events-none absolute -inset-x-3 -inset-y-1.5 rounded-xl bg-blue-600/10"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: T.enter }}
                  exit={{ opacity: 0, transition: T.exit }}
                />
              )}
            </AnimatePresence>
            <div className="relative flex min-w-0 items-center gap-x-4 md:gap-x-5">
              <div
                className={cn(
                  'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors',
                  tw.panel,
                  s.state === 'wait' ? 'bg-blue-500/15' : done ? 'bg-success/15 text-success' : s.state === 'fail' ? 'bg-fail/15 text-fail' : 'bg-white/10',
                )}
              >
                <motion.span key={s.state} className="flex items-center justify-center" initial={appear} animate={{ opacity: 1 }} transition={T.enter}>
                  {s.state === 'wait' ? <Spinner /> : done ? <DrawCheck still={!mounted} /> : s.state === 'fail' ? <CloseIcon /> : numbered ? <span className="text-sm font-medium text-secondary">{i + 1}</span> : null}
                </motion.span>
                {/* The line to the next step: the grey part shrinks down as the green part fills from the top. */}
                {i < steps.length - 1 && (
                  <span className={cn('absolute top-full w-[2px]', LINE_H[line] ?? 'h-[16px]')}>
                    <motion.span className="absolute inset-0 origin-bottom bg-white/10" initial={false} animate={{ scaleY: done ? 0 : 1 }} transition={{ ...T.draw, delay: done ? DUR.draw * 0.5 : 0 }} />
                    <motion.span className="absolute inset-0 origin-top bg-success/15" initial={false} animate={{ scaleY: done ? 1 : 0 }} transition={{ ...T.draw, delay: done ? DUR.draw * 0.5 : 0 }} />
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <motion.p key={s.label} className={cn('break-words', s.state === 'todo' && !numbered ? 'text-secondary' : s.state === 'fail' ? 'text-fail' : 'text-white')} initial={appear} animate={{ opacity: 1 }} transition={T.enter}>
                  {s.label}
                </motion.p>
                {s.sub && <motion.p key={s.sub} className="truncate text-xs font-normal text-secondary" initial={appear} animate={{ opacity: 1 }} transition={T.enter}>{s.sub}</motion.p>}
              </div>
            </div>
            <div className="relative flex shrink-0 flex-col items-end text-xs font-normal">
              {s.at && (
                <motion.span key={s.at} className="text-white" initial={appear} animate={{ opacity: 1 }} transition={T.enter}>
                  {s.at}{s.took && <span className="ml-1 text-secondary">+{s.took}</span>}
                </motion.span>
              )}
              {s.tx && (
                <motion.a key={s.tx.text} href={s.tx.href} target="_blank" rel="noopener noreferrer" className="flex cursor-pointer items-center gap-x-1 font-mono text-secondary transition-colors hover:text-white" initial={appear} animate={{ opacity: 1 }} transition={T.enter}>
                  {s.tx.text}<ExternalLinkIcon width={16} height={16} />
                </motion.a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
