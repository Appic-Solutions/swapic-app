'use client';
// The quote timer: moved from the design's quote-timer.tsx option B "Countdown label" (Jeff's pick 2026-10-31), class
// for class. A small label on the picked route card says when the price updates next ("Updates in 12s") and counts the
// seconds down; the number fades as it changes (T.hover); while a fresh price loads it reads "Updating price" with the
// app's spinner. It is drawn every frame from when the price on screen was fetched (startedAt), so it follows the real
// refresh and keeps no clock of its own. Reduce motion: the seconds still count, only the fades remain.
import * as React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import Spinner from '@/components/ui/spinner';
import { T } from '@/lib/motion';

/** The price updates this often (the quote's refetch, Swap and Review swap). Quotes stay valid 45 s. */
export const QUOTE_CYCLE_MS = 20_000;
/** Longer than the big change (350 ms). */
const FETCH_LABEL_DELAY_MS = 500;

/** "Updates in 12s": whole seconds until the next price, from when the one on screen was fetched; never below 1 (at zero
 *  a fresh price is loading and the label says so instead). */
export function secondsLeft(startedAt: number, now: number, cycleMs = QUOTE_CYCLE_MS): number {
  const p = Math.min(Math.max((now - startedAt) / cycleMs, 0), 1);
  return Math.max(1, Math.ceil((1 - p) * (cycleMs / 1000)));
}

/** Redraws its component four times a second: the number on screen changes once a second. */
function useTick() {
  const [, tick] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, []);
  return Date.now();
}

export interface CountdownLabelProps {
  /** When the price on screen was fetched (ms since the epoch, as react-query's dataUpdatedAt). */
  startedAt: number;
  /** A fresh price is loading. */
  fetching?: boolean;
  cycleMs?: number;
}

export function CountdownLabel({ startedAt, fetching, cycleMs = QUOTE_CYCLE_MS }: CountdownLabelProps) {
  const now = useTick();
  const secs = secondsLeft(startedAt, now, cycleMs);
  // Review swap asks a fresh quote as it opens: the label changes only if that takes longer than the view's change, so a
  // quick answer never flashes it
  const [showFetching, setShowFetching] = React.useState(false);
  React.useEffect(() => {
    if (!fetching) { setShowFetching(false); return; }
    const t = setTimeout(() => setShowFetching(true), FETCH_LABEL_DELAY_MS);
    return () => clearTimeout(t);
  }, [fetching]);
  return (
    <span data-testid="quote-timer" className="inline-flex h-7 items-center gap-x-1.5 whitespace-nowrap rounded-full bg-white/10 px-3 text-xs font-medium text-secondary">
      {showFetching ? (
        <>
          <span className="w-3"><Spinner width={16} height={16} className="fill-white text-faint" /></span>
          Updating price
        </>
      ) : (
        <>
          Updates in
          <span className="relative inline-flex min-w-[2.2em] justify-end tabular-nums text-white">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span key={secs} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={T.hover}>
                {secs}s
              </motion.span>
            </AnimatePresence>
          </span>
        </>
      )}
    </span>
  );
}
