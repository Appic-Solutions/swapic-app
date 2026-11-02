'use client';
// One History row: moved from the design's orders-ui.tsx OrderRow (the approved static look; its body has no motion part),
// reading OrderView (src/features/activity/rows.ts): from and to tokens with the status line, amounts, the via pill, the fee,
// and its steps when opened (given by the caller once fetched; skeletons until then).
import * as React from 'react';
import Skeleton from '@/components/ui/skeleton';
import { motion } from 'motion/react';
import { T, openHeight, tw, useMounted, useReducedMotion } from '@/lib/motion';
import { ChevronDownIcon, FireIcon, ManageSearchIcon, ParkOutlineBridgeIcon, PoolIcon } from '@/components/icons';
import { short } from '@/lib/copy/format';
import { cn } from '@/lib/cn';
import type { OrderView } from '@/features/activity/rows';
import { CopyButton, useCopied } from './CopyButton';
import { StatusPill } from './StatusPill';
import { Steps } from './Steps';
import { TokenAvatar } from './TokenAvatar';
import type { SideView, StepView } from './types';
import { ViaPill } from './ViaPill';

/** Names of an order's pieces for the in place change to its order page (tokens and status fly there). */
export const flyNames = (id: string) => ({ from: `from-${short(id)}`, to: `to-${short(id)}`, pill: `pill-${short(id)}` });

export const where = (s: SideView) => `${s.symbol} ${s.chain === 'Swapic Pool' ? 'in' : 'on'} ${s.chain}`;

const centerText = (o: OrderView) => {
  const took = o.took ? ` in ${o.took}` : '';
  if (o.status === 'pending' || o.status === 'queued') return o.stageText ?? '';
  if (o.ending === 'delivered') return `${o.kind === 'stake' ? 'Staked' : o.kind === 'withdraw' ? 'Paid out' : 'Delivered'}${took}`;
  return `${o.title ?? ''}${o.ending === 'refunded' || o.ending === 'deliveredAsUsdc' ? took : ''}`;
};
const kindText = (o: OrderView) => (o.kind === 'stake' ? 'Stake' : o.kind === 'withdraw' ? 'Withdraw' : o.direction === 'received' ? 'Received' : 'Swap');

/** The design's timeline skeleton while the steps load. */
export function StepsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-x-5"><Skeleton className="h-9 w-9 rounded-full" /><div className="flex flex-col gap-y-1.5"><Skeleton className="h-4 w-48" /><Skeleton className="h-3 w-24" /></div></div>
      ))}
    </div>
  );
}

export interface OrderRowProps {
  order: OrderView;
  open?: boolean;
  onToggle?: () => void;
  onOpenScanner?: () => void;
  fresh?: boolean;
  steps?: StepView[];
}

export function OrderRow({ order: o, open, onToggle, onOpenScanner, fresh, steps }: OrderRowProps) {
  const [copied, copy] = useCopied();
  const reduced = useReducedMotion();
  const mounted = useMounted();
  const fly = flyNames(o.id);
  const ok = o.status === 'delivered';
  const live = o.status === 'pending' || o.status === 'queued';
  const refund = o.status === 'refunded';
  // as USDC: the money arrived, as the USDC side shows
  const asUsdc = o.ending === 'deliveredAsUsdc' && !!o.refund;
  const stopTone = o.status === 'didntStart' ? 'border-white/30' : o.status === 'onHold' ? 'border-amber-400' : null;
  const lineTone = ok ? 'border-green-500' : refund ? 'border-yellow-500' : stopTone ?? 'border-green-500';
  const Icon = o.kind === 'swap' ? ParkOutlineBridgeIcon : PoolIcon;
  return (
    <div
      data-testid="order-row"
      className={cn(
        'flex w-full flex-col bg-input-fields bg-cover bg-center bg-no-repeat shadow-md',
        'rounded-2xl p-5 backdrop-blur-[30px] hover:bg-black/75 hover:ring-1 hover:ring-inset hover:ring-white/10',
        tw.quick,
        'md:rounded-[36px] md:p-6',
        fresh && 'animate-slide-in-from-top',
      )}
    >
      {/* Kind, status, date */}
      <div className="flex items-center justify-between gap-x-3 text-sm font-bold text-[#898989]">
        <div className="flex min-w-0 items-center gap-x-2">
          <p className="text-white">{kindText(o)}</p>
          {o.direction === 'received' && o.payer && <p className="truncate font-normal">from {short(o.payer)}</p>}
          {/* the status cross fades as the live order moves on (only changes after the first render animate) */}
          <motion.span key={o.status} className="flex" initial={mounted ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={T.enter}><StatusPill status={o.status} fly={fly.pill} /></motion.span>
        </div>
        <p className="shrink-0">{o.day}, {o.time}</p>
      </div>
      {/* Tokens and the status line */}
      <div className="my-4 flex w-full items-center justify-between">
        <TokenAvatar side={o.from} fly={fly.from} />
        <div className="flex w-full items-center justify-center">
          <div className="flex-1 border-t-[3px] border-green-500" />
          <div
            className={cn(
              'relative z-10 rounded-full p-2.5',
              'bg-[linear-gradient(81.4deg,_#000000_-15.41%,_#1D1D1D_113.98%)]',
              refund ? 'border-2 border-solid border-yellow-500' : stopTone ? `border-2 border-solid ${stopTone}` : 'before:absolute before:inset-0 before:rounded-full before:border-2 before:border-green-500',
              live && 'before:animate-spin before:border-t-transparent',
            )}
          >
            <Icon className="h-5 w-5 text-white md:h-6 md:w-6" width={24} height={24} />
          </div>
          <div className={cn('flex-1 border-t-[3px] transition-colors duration-500', live ? 'border-dashed border-white/30' : lineTone, refund && 'border-dashed')} />
        </div>
        <TokenAvatar side={(refund || asUsdc) && o.refund ? o.refund : o.to} fly={fly.to} />
      </div>
      {/* Amounts */}
      <div className="mb-4 flex items-start justify-between gap-x-4 text-xs font-bold text-[#898989] *:flex *:flex-1 *:flex-col *:justify-center">
        <div>
          <p>{where(o.from)}</p>
          <p className="text-xl leading-7 text-white">{o.from.amountText}</p>
          <p className="font-normal">{o.from.usdText}</p>
        </div>
        <motion.div key={centerText(o)} className="items-center self-center text-center max-md:hidden" initial={mounted ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={T.enter}>{centerText(o)}</motion.div>
        <div className="items-end text-right">
          {asUsdc ? (
            <>
              <p>{where(o.refund!)}</p>
              <p className="text-xl leading-7 text-white">{o.refund!.amountText} {o.refund!.symbol}</p>
              <p className="font-normal">{o.title}</p>
            </>
          ) : stopTone ? (
            <>
              <p>{where(o.to)}</p>
              <p className="text-xl leading-7 text-white/40">{o.title}</p>
            </>
          ) : refund && o.refund ? (
            <>
              <p>Refunded on {o.refund.chain}</p>
              <p className="text-xl leading-7 text-yellow-500">{o.refund.amountText} {o.refund.symbol}</p>
              <p className="font-normal">{o.reason}</p>
            </>
          ) : refund && o.refundLine ? (
            // an undone withdrawal: its stake came back to the pool (contract 5.10), nothing was paid out
            <>
              <p>{o.refundLine}</p>
              <p className="text-xl leading-7 text-yellow-500">{o.from.amountText}</p>
              <p className="font-normal">{o.reason}</p>
            </>
          ) : (
            <>
              <p>{where(o.to)}</p>
              <p className={cn('text-xl leading-7', live ? 'text-white/60' : 'text-white')}>{o.to.amountText}</p>
              <p className="font-normal">{o.to.usdText}</p>
            </>
          )}
        </div>
      </div>
      {/* Steps */}
      {/* Steps: open and close with a smooth height change (openHeight). */}
      <motion.div className="overflow-hidden" initial={false} animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }} transition={openHeight(!!open, reduced)}>
      <div className="mb-6 flex flex-col gap-y-4">
        <div className="flex items-center justify-between gap-x-3 text-sm font-bold text-[#898989]">
          <div className="flex items-center gap-x-1 whitespace-nowrap">
            <span className="max-sm:hidden">Order ID:</span><span className="sm:hidden">Order</span> <span className="font-mono font-normal text-white/80">{short(o.id)}</span>
            <CopyButton id={o.id} copied={copied} onCopy={copy} text={o.id} />
          </div>
          <a data-testid="open-scanner" onClick={onOpenScanner} className={cn('flex cursor-pointer items-center gap-x-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white hover:bg-white/20', tw.quick, tw.press)}>
            <ManageSearchIcon width={14} height={14} /><span className="whitespace-nowrap"><span className="max-sm:hidden">Open in </span>Scanner</span>
          </a>
        </div>
        {steps ? <Steps steps={steps} animated /> : open ? <StepsSkeleton /> : null}
      </div>
      </motion.div>
      {/* Via, details toggle, fee */}
      <div className="flex items-center justify-between gap-x-3 text-xs text-[#898989] *:flex *:items-center *:font-semibold">
        <div className="gap-x-1.5">
          <ViaPill />
          <span className="max-sm:hidden">{o.gas}</span>
        </div>
        <div onClick={onToggle} className={cn('cursor-pointer select-none gap-x-1 whitespace-nowrap text-sm hover:text-white sm:gap-x-2', tw.quick, tw.press)}>
          {open ? 'Hide Details' : 'View Details'}
          <ChevronDownIcon width={20} height={20} className={cn('transition-transform', tw.panel, open && 'rotate-180 transform')} />
        </div>
        <div className="gap-x-1 whitespace-nowrap text-white">
          {o.feeText ?? ''}
          <FireIcon width={20} height={20} />
        </div>
      </div>
    </div>
  );
}
