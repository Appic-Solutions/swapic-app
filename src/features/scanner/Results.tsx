'use client';
// Moved from the design's scanner-screens.tsx Route and Results: desktop the live Explore table markup, phones stacked cards.
// On desktop the rows scroll inside the panel under a header that stays (no scrollbar, the edge fades), from md the cards
// do the same, on phones the page scrolls; either way the next page loads by itself near the end (onNearEnd).
import * as React from 'react';
import Skeleton, { SkeletonText } from '@/components/ui/skeleton';
import { motion } from 'motion/react';
import { T, pressCard, useMounted } from '@/lib/motion';
import { StatusPill } from '@/components/orders/StatusPill';
import { TokenAvatar } from '@/components/orders/TokenAvatar';
import { ViaPill } from '@/components/orders/ViaPill';
import { LoadingMore } from '@/components/orders/LoadingMore';
import { useScrollFade } from '@/components/ui/use-scroll-fade';
import { short } from '@/lib/copy/format';
import { cn } from '@/lib/cn';
import { endFlags, type OrderView } from '@/features/activity/rows';
import { useNearEnd } from '@/features/activity/live-list';

const th = 'border-b border-b-line h-11 text-xs font-medium text-secondary';
const tr = 'text-center text-sm text-white border-b border-b-line last:border-b-0 h-14 hover:bg-white/[0.03] cursor-pointer transition-colors duration-150';

function Route({ o }: { o: OrderView }) {
  return (
    <div className="flex items-center gap-x-2.5">
      <TokenAvatar side={o.from} size="h-7 w-7" badge="h-3.5 w-3.5" />
      <span className="text-secondary">→</span>
      <TokenAvatar side={o.to} size="h-7 w-7" badge="h-3.5 w-3.5" />
      <div className="ml-1 min-w-0 text-left">
        <p className="truncate font-semibold">{o.kind === 'stake' ? `Stake ${o.from.symbol}` : o.kind === 'withdraw' ? `Withdraw ${o.to.symbol}` : `${o.from.symbol} to ${o.to.symbol}`}</p>
        <p className="truncate text-xs text-secondary">{o.from.chain} to {o.to.chain}</p>
      </div>
    </div>
  );
}

const live = (o: OrderView) => endFlags(o).live;
/** What came out, in a few words (the why is on the order page): the refund when refunded, the USDC when delivered as USDC,
 *  the title when nothing came, else the token out (a pending side already reads `~<least>`). */
const out = (o: OrderView) => {
  const f = endFlags(o);
  if (f.refund) return o.refund ? `${o.refund.amountText} ${o.refund.symbol} refunded` : 'Refunded';
  if (f.asUsdc) return `${o.refund!.amountText} ${o.refund!.symbol}`;
  if (f.stopped) return o.title ?? '';
  return `${o.to.amountText} ${o.to.symbol}`.trim();
};
/** Under it: the stage while it moves, "as USDC" for a delivery as USDC, else how long it took (nothing when it never ran). */
const outSub = (o: OrderView) => {
  const f = endFlags(o);
  if (f.live) return o.stageText ?? '';
  if (f.stopped) return '';
  if (f.asUsdc) return o.took ? `as USDC in ${o.took}` : 'as USDC';
  return o.took ? `in ${o.took}` : '';
};

// Eight rows fill the table on a tall window, so any feed of eight or more fills the same box; phones fill the first screen.
const TABLE_ROWS = 8;
const CARD_ROWS = 6;
/** The Sent and Received cells while the feed loads. */
const Amount = () => (
  <>
    <SkeletonText className="mx-auto w-24" />
    <SkeletonText className="mx-auto w-16 text-xs" />
  </>
);

/** The table's columns, the same in its header and its rows (the header stays while the rows scroll). */
const Cols = () => (
  <colgroup>
    <col className="w-28" />
    {Array.from({ length: 14 }).map((_, i) => <col key={i} />)}
  </colgroup>
);

/** One scroll box (the table's rows, or the cards): its edge fades, and it asks for the next page near its end. */
function useListBox(onNearEnd: () => void) {
  const [box, setBox] = React.useState<HTMLDivElement | null>(null);
  const edge = useScrollFade<HTMLDivElement>();
  const ref = React.useCallback((el: HTMLDivElement | null) => { edge.ref(el); setBox(el); }, [edge.ref]);
  useNearEnd(box, onNearEnd);
  return { ref, fade: edge.fade };
}

const none = () => {};

// Motion (approved 2026-10-29, part 2): rows glide to their new places, a new order slides down into the top, rows sink
// a little when pressed.
export function Results({ orders, loading, loadingMore, onNearEnd = none, onOpen, freshId }: { orders: OrderView[]; loading?: boolean; loadingMore?: boolean; onNearEnd?: () => void; onOpen: (o: OrderView) => void; freshId?: string }) {
  const mounted = useMounted();
  const table = useListBox(onNearEnd);
  const cards = useListBox(onNearEnd);
  const enter = (o: OrderView) => (mounted && freshId === o.id ? { initial: { opacity: 0, y: -12 }, animate: { opacity: 1, y: 0, transition: T.big } } : {});
  return (
    <>
      <div className="flex w-full flex-col overflow-hidden rounded-3xl border border-line bg-input-fields max-lg:hidden lg:min-h-0">
        <table className="w-full min-w-[900px] shrink-0 table-fixed">
          <Cols />
          <thead className={th}>
            <tr>
              <th className="w-28">Age</th>
              <th colSpan={4} className="text-left">Route</th>
              <th colSpan={2}>Sent</th>
              <th colSpan={2}>Received</th>
              <th colSpan={2}>Via</th>
              <th colSpan={2}>Status</th>
              <th colSpan={2}>Order</th>
            </tr>
          </thead>
        </table>
        <div ref={table.ref} className={cn('no-scrollbar w-full lg:min-h-0 lg:overflow-y-auto', table.fade)}>
        <table className="w-full min-w-[900px] table-fixed">
          <Cols />
          <tbody>
            {loading
              ? Array.from({ length: TABLE_ROWS }).map((_, i) => (
                  <tr key={i} className="h-14 border-b border-b-line text-sm last:border-b-0">
                    <td><SkeletonText className="mx-auto w-14" /></td>
                    <td colSpan={4}>
                      <div className="flex items-center gap-x-2.5">
                        <Skeleton className="h-7 w-7 shrink-0" />
                        <Skeleton className="h-2 w-3 shrink-0" />
                        <Skeleton className="h-7 w-7 shrink-0" />
                        <div className="ml-1 min-w-0"><SkeletonText className="w-28" /><SkeletonText className="w-36 max-w-full text-xs" /></div>
                      </div>
                    </td>
                    <td colSpan={2}><Amount /></td>
                    <td colSpan={2}><Amount /></td>
                    <td colSpan={2}><SkeletonText className="mx-auto w-20 text-xs" /></td>
                    <td colSpan={2}><Skeleton className="mx-auto h-5 w-20" /></td>
                    <td colSpan={2}><SkeletonText className="mx-auto w-24 text-xs" /></td>
                  </tr>
                ))
              : orders.map((o) => (
                  <motion.tr
                    key={o.id}
                    data-testid="scanner-row"
                    layout="position"
                    transition={{ default: T.hover, layout: T.big }}
                    whileTap={pressCard}
                    {...enter(o)}
                    onClick={() => onOpen(o)}
                    className={cn(tr, freshId === o.id && 'bg-white/[0.03]')}
                  >
                    <td className="text-secondary">{o.ago}</td>
                    <td colSpan={4}><Route o={o} /></td>
                    <td colSpan={2}>
                      <p className="font-semibold">{o.from.amountText} {o.from.symbol}</p>
                      <p className="text-xs text-secondary">{o.from.usdText}</p>
                    </td>
                    <td colSpan={2}>
                      <p className={cn('font-semibold', o.status === 'refunded' && 'text-warn', live(o) && 'text-secondary')}>{out(o)}</p>
                      <p className="text-xs text-secondary">{outSub(o)}</p>
                    </td>
                    <td colSpan={2}><ViaPill minter={o.viaMinter} /></td>
                    <td colSpan={2}><StatusPill status={o.status} /></td>
                    <td colSpan={2} className="font-mono text-xs text-secondary">{short(o.id)}</td>
                  </motion.tr>
                ))}
          </tbody>
        </table>
        {loadingMore && <LoadingMore className="border-t border-t-line" />}
        </div>
      </div>
      <div ref={cards.ref} className={cn('no-scrollbar flex w-full flex-col gap-y-2.5 md:min-h-0 md:overflow-y-auto lg:hidden', cards.fade)}>
        {loading
          ? Array.from({ length: CARD_ROWS }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-3 rounded-3xl border border-line bg-input-fields p-4 text-sm">
                <div className="flex min-w-0 items-center gap-x-2">
                  <Skeleton className="h-8 w-8 shrink-0" />
                  <Skeleton className="h-8 w-8 shrink-0" />
                  <div className="ml-1 min-w-0"><SkeletonText className="w-24 max-w-full" /><SkeletonText className="w-28 max-w-full text-xs" /></div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-y-1">
                  <Skeleton className="h-5 w-20" />
                  <SkeletonText className="w-12 text-xs" />
                </div>
              </div>
            ))
          : orders.map((o) => (
              <motion.div
                key={o.id}
                data-testid="scanner-card"
                layout="position"
                transition={{ default: T.hover, layout: T.big }}
                whileTap={pressCard}
                {...enter(o)}
                onClick={() => onOpen(o)}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-3xl border border-line bg-input-fields p-4 text-sm text-white transition-colors hover:border-line-strong"
              >
                <div className="flex min-w-0 items-center gap-x-2">
                  <TokenAvatar side={o.from} size="h-8 w-8" badge="h-3.5 w-3.5" />
                  <TokenAvatar side={o.to} size="h-8 w-8" badge="h-3.5 w-3.5" />
                  <div className="ml-1 min-w-0">
                    <p className="font-semibold [overflow-wrap:anywhere]">{o.from.amountText} {o.from.symbol}</p>
                    <p className="text-xs text-secondary [overflow-wrap:anywhere]">to {out(o)}</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-y-1">
                  <StatusPill status={o.status} />
                  <p className="text-xs text-secondary">{o.ago}</p>
                </div>
              </motion.div>
            ))}
        {loadingMore && <LoadingMore />}
      </div>
    </>
  );
}
