'use client';
// Moved from the design's scanner-screens.tsx Route and Results: desktop the live Explore table markup, phones stacked cards.
import * as React from 'react';
import Skeleton from '@/components/ui/skeleton';
import { motion } from 'motion/react';
import { flyNames } from '@/components/orders/OrderRow';
import { T, pressCard, useMounted } from '@/lib/motion';
import { StatusPill } from '@/components/orders/StatusPill';
import { TokenAvatar } from '@/components/orders/TokenAvatar';
import { ViaPill } from '@/components/orders/ViaPill';
import { short } from '@/lib/copy/format';
import { cn } from '@/lib/cn';
import type { OrderView } from '@/features/activity/rows';

const th = 'border-b border-b-[#555555] h-12 bg-[#323232] font-semibold text-[#8D8D8D]';
const tr = 'text-center text-sm text-white border-b border-b-[#393939] h-14 bg-[#272727] hover:bg-[#2C2C2C] cursor-pointer transition-all duration-200 ease-in-out';

function Route({ o }: { o: OrderView }) {
  const fly = flyNames(o.id);
  return (
    <div className="flex items-center gap-x-2.5">
      <TokenAvatar side={o.from} size="h-7 w-7" badge="h-3.5 w-3.5" fly={fly.from} />
      <span className="text-[#898989]">→</span>
      <TokenAvatar side={o.to} size="h-7 w-7" badge="h-3.5 w-3.5" fly={fly.to} />
      <div className="ml-1 min-w-0 text-left">
        <p className="truncate font-semibold">{o.kind === 'stake' ? `Stake ${o.from.symbol}` : o.kind === 'withdraw' ? `Withdraw ${o.to.symbol}` : `${o.from.symbol} to ${o.to.symbol}`}</p>
        <p className="truncate text-xs text-[#898989]">{o.from.chain} to {o.to.chain}</p>
      </div>
    </div>
  );
}

const live = (o: OrderView) => o.status === 'pending' || o.status === 'queued';
/** What came out: the refund when refunded, else the token out (a pending side already reads `~<least>`). */
const out = (o: OrderView) => {
  if (o.ending === 'refunded') return o.refund ? `${o.refund.amountText} ${o.refund.symbol} refunded` : 'Refunded';
  if (o.ending === 'deliveredAsUsdc' && o.refund) return `${o.refund.amountText} ${o.refund.symbol}`;
  if (o.status === 'didntStart' || o.status === 'onHold') return o.title ?? '';
  return `${o.to.amountText} ${o.to.symbol}`.trim();
};
const outSub = (o: OrderView) => (live(o) ? o.stageText ?? '' : o.reason ?? (o.took ? `in ${o.took}` : ''));

// Motion (approved 2026-10-29, part 2): rows glide to their new places, a new order slides down into the top, rows sink
// a little when pressed; their tokens and status pill fly to the order page when one opens (data-fly).
export function Results({ orders, loading, onOpen, freshId }: { orders: OrderView[]; loading?: boolean; onOpen: (o: OrderView) => void; freshId?: string }) {
  const mounted = useMounted();
  const enter = (o: OrderView) => (mounted && freshId === o.id ? { initial: { opacity: 0, y: -12 }, animate: { opacity: 1, y: 0, transition: T.big } } : {});
  return (
    <>
      <div className="w-full overflow-auto max-md:hidden md:max-h-[470px]">
        <table className="w-full min-w-[900px] table-fixed overflow-hidden rounded-2xl">
          <thead className={th}>
            <tr>
              <th className="w-28">Age</th>
              <th colSpan={3} className="text-left">Route</th>
              <th colSpan={2}>Sent</th>
              <th colSpan={2}>Received</th>
              <th colSpan={2}>Via</th>
              <th colSpan={2}>Status</th>
              <th colSpan={2}>Order</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 7 }).map((_, i) => (
                  <tr key={i} className="h-14 border-b border-b-[#393939] bg-[#272727]">
                    <td><Skeleton className="mx-auto h-4 w-14 rounded" /></td>
                    <td colSpan={3}><div className="flex items-center gap-x-2"><Skeleton className="h-7 w-7 rounded-full" /><Skeleton className="h-7 w-7 rounded-full" /><Skeleton className="h-4 w-28 rounded" /></div></td>
                    <td colSpan={2}><Skeleton className="mx-auto h-4 w-20 rounded" /></td>
                    <td colSpan={2}><Skeleton className="mx-auto h-4 w-20 rounded" /></td>
                    <td colSpan={2}><Skeleton className="mx-auto h-6 w-24 rounded-full" /></td>
                    <td colSpan={2}><Skeleton className="mx-auto h-6 w-20 rounded-full" /></td>
                    <td colSpan={2}><Skeleton className="mx-auto h-4 w-24 rounded" /></td>
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
                    className={cn(tr, freshId === o.id && 'bg-[#2C2C2C]')}
                  >
                    <td className="text-[#898989]">{o.ago}</td>
                    <td colSpan={3}><Route o={o} /></td>
                    <td colSpan={2}>
                      <p className="font-semibold">{o.from.amountText} {o.from.symbol}</p>
                      <p className="text-xs text-[#898989]">{o.from.usdText}</p>
                    </td>
                    <td colSpan={2}>
                      <p className={cn('font-semibold', o.status === 'refunded' && 'text-yellow-500', live(o) && 'text-white/60')}>{out(o)}</p>
                      <p className="text-xs text-[#898989]">{outSub(o)}</p>
                    </td>
                    <td colSpan={2}><ViaPill /></td>
                    <td colSpan={2}><StatusPill status={o.status} fly={flyNames(o.id).pill} /></td>
                    <td colSpan={2} className="font-mono text-xs text-[#898989]">{short(o.id)}</td>
                  </motion.tr>
                ))}
          </tbody>
        </table>
      </div>
      <div className="flex w-full flex-col gap-y-2.5 md:hidden">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[76px] w-full rounded-2xl" />)
          : orders.map((o) => (
              <motion.div
                key={o.id}
                data-testid="scanner-card"
                layout="position"
                transition={{ default: T.hover, layout: T.big }}
                whileTap={pressCard}
                {...enter(o)}
                onClick={() => onOpen(o)}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-[#272727] p-4 text-sm text-white transition-colors active:bg-[#2C2C2C]"
              >
                <div className="flex min-w-0 items-center gap-x-2">
                  <TokenAvatar side={o.from} size="h-8 w-8" badge="h-3.5 w-3.5" fly={flyNames(o.id).from} />
                  <TokenAvatar side={o.to} size="h-8 w-8" badge="h-3.5 w-3.5" fly={flyNames(o.id).to} />
                  <div className="ml-1 min-w-0">
                    <p className="truncate font-semibold">{o.from.amountText} {o.from.symbol}</p>
                    <p className="truncate text-xs text-[#898989]">to {out(o)}</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-y-1">
                  <StatusPill status={o.status} fly={flyNames(o.id).pill} />
                  <p className="text-xs text-[#898989]">{o.ago}</p>
                </div>
              </motion.div>
            ))}
      </div>
    </>
  );
}
