'use client';
// One History row: moved from the design's orders-ui.tsx OrderRow (the approved static look; its body has no motion part),
// reading OrderView (src/features/activity/rows.ts): from and to tokens with the status line, amounts, the via pill, the fee,
// and its steps when opened (given by the caller once fetched; skeletons until then). The row shows how it ended in a few
// words; the sentence that says why is on the order page (Open in Scanner).
import * as React from 'react';
import Skeleton, { SkeletonText } from '@/components/ui/skeleton';
import { motion } from 'motion/react';
import { T, openHeight, tw, useMounted, useReducedMotion } from '@/lib/motion';
import { ChevronDownIcon, FeeIcon, ScannerIcon, SwapIcon, PoolIcon } from '@/components/icons';
import { short } from '@/lib/copy/format';
import { cn } from '@/lib/cn';
import { QUIET } from '@/components/ui/styles';
import { endFlags, endText, type OrderView } from '@/features/activity/rows';
import { CopyButton, useCopied } from './CopyButton';
import { StatusPill } from './StatusPill';
import { Steps } from './Steps';
import { TokenAvatar } from './TokenAvatar';
import type { SideView, StepView } from './types';
import { ViaPill } from './ViaPill';

export const where = (s: SideView) => `${s.symbol} ${s.chain === 'Swapic Pool' ? 'in' : 'on'} ${s.chain}`;

const kindText = (o: OrderView) => (o.kind === 'stake' ? 'Stake' : o.kind === 'withdraw' ? 'Withdraw' : o.direction === 'received' ? 'Received' : 'Swap');

/** How many steps an order's timeline ends up with, so its skeleton opens to the same height (contract 5.14's examples). */
export const stepRows = (o: OrderView | null) => (!o || o.kind === 'swap' ? (o?.status === 'refunded' ? 4 : 5) : 3);

/** The timeline while the steps load (Steps.tsx, row for row): the circle and its line, the label, the time and the link. */
export function StepsSkeleton({ rows = 5, gap = 'gap-y-4', line = 'h-4' }: { rows?: number; gap?: string; line?: string }) {
  return (
    <div className={cn('flex flex-col', gap)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-x-4 text-sm font-medium">
          <div className="flex min-w-0 items-center gap-x-4 md:gap-x-5">
            <div className="relative shrink-0">
              <Skeleton className="h-9 w-9" />
              {i < rows - 1 && <span className={cn('absolute left-1/2 top-full w-[2px] -translate-x-1/2 bg-white/10', line)} />}
            </div>
            <SkeletonText className="w-36" />
          </div>
          <div className="flex shrink-0 flex-col items-end text-xs font-normal">
            <SkeletonText className="w-16" />
            <SkeletonText className="w-20" />
          </div>
        </div>
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
  const ok = o.status === 'delivered';
  const { live, refund, asUsdc } = endFlags(o);
  const stopTone = o.status === 'didntStart' ? 'border-white/30' : o.status === 'onHold' ? 'border-warn' : null;
  const lineTone = ok ? 'border-green-500' : refund ? 'border-warn' : stopTone ?? 'border-green-500';
  const Icon = o.kind === 'swap' ? SwapIcon : PoolIcon;
  return (
    <div
      data-testid="order-row"
      className={cn(
        'flex w-full flex-col rounded-3xl border border-line bg-input-fields p-5 hover:border-line-strong md:p-6',
        tw.quick,
        fresh && 'animate-slide-in-from-top',
      )}
    >
      {/* Kind, status, date */}
      <div className="flex items-center justify-between gap-x-3 text-sm font-medium text-secondary">
        <div className="flex min-w-0 items-center gap-x-2">
          <p className="text-white">{kindText(o)}</p>
          {o.direction === 'received' && o.payer && <p className="truncate font-normal">from {short(o.payer)}</p>}
          {/* the status cross fades as the live order moves on (only changes after the first render animate) */}
          <motion.span key={o.status} className="flex" initial={mounted ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={T.enter}><StatusPill status={o.status} /></motion.span>
        </div>
        <p className="shrink-0">{o.day}, {o.time}</p>
      </div>
      {/* Tokens and the status line */}
      <div className="my-4 flex w-full items-center justify-between">
        <TokenAvatar side={o.from} />
        <div className="flex w-full items-center justify-center">
          <div className="flex-1 border-t-[3px] border-green-500" />
          <div
            className={cn(
              'relative z-10 rounded-full p-2.5',
              'bg-[linear-gradient(81.4deg,_#000000_-15.41%,_#1D1D1D_113.98%)]',
              refund ? 'border-2 border-solid border-warn' : stopTone ? `border-2 border-solid ${stopTone}` : 'before:absolute before:inset-0 before:rounded-full before:border-2 before:border-green-500',
              live && 'before:animate-spin before:border-t-transparent',
            )}
          >
            <Icon className="h-5 w-5 text-white md:h-6 md:w-6" width={24} height={24} />
          </div>
          <div className={cn('flex-1 border-t-[3px] transition-colors duration-[350ms]', live ? 'border-dashed border-white/30' : lineTone, refund && 'border-dashed')} />
        </div>
        <TokenAvatar side={(refund || asUsdc) && o.refund ? o.refund : o.to} />
      </div>
      {/* Amounts */}
      <div className="mb-4 flex items-start justify-between gap-x-4 text-xs font-medium text-secondary *:flex *:min-w-0 *:flex-1 *:flex-col *:justify-center [&_p]:[overflow-wrap:anywhere]">
        <div>
          <p>{where(o.from)}</p>
          <p className="text-xl leading-7 text-white">{o.from.amountText}</p>
          <p className="font-normal">{o.from.usdText}</p>
        </div>
        <motion.div key={endText(o)} className="items-center self-center text-center max-md:hidden" initial={mounted ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={T.enter}>{endText(o)}</motion.div>
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
              <p className="text-xl leading-7 text-faint">{o.title}</p>
            </>
          ) : refund && o.refund ? (
            <>
              <p>Refunded on {o.refund.chain}</p>
              <p className="text-xl leading-7 text-warn">{o.refund.amountText} {o.refund.symbol}</p>
              {/* the why is on the order page; the list shows the outcome only */}
              <p className="font-normal">{o.refund.usdText}</p>
            </>
          ) : refund && o.refundLine ? (
            // an undone withdrawal: its stake came back to the pool (contract 5.10), nothing was paid out
            <>
              <p>{o.refundLine}</p>
              <p className="text-xl leading-7 text-warn">{o.from.amountText}</p>
              <p className="font-normal">{o.from.usdText}</p>
            </>
          ) : (
            <>
              <p>{where(o.to)}</p>
              <p className={cn('text-xl leading-7', live ? 'text-secondary' : 'text-white')}>{o.to.amountText}</p>
              <p className="font-normal">{o.to.usdText}</p>
            </>
          )}
        </div>
      </div>
      {/* Steps */}
      {/* Steps: open and close with a smooth height change (openHeight). */}
      <motion.div className="-mx-3 overflow-hidden px-3" initial={false} animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }} transition={openHeight(!!open, reduced)}>
      <div className="mb-6 flex flex-col gap-y-4">
        <div className="flex items-center justify-between gap-x-3 text-sm font-medium text-secondary">
          <div className="flex items-center gap-x-1 whitespace-nowrap">
            <span className="max-sm:hidden">Order ID:</span><span className="sm:hidden">Order</span> <span className="font-mono font-normal text-white">{short(o.id)}</span>
            <CopyButton id={o.id} copied={copied} onCopy={copy} text={o.id} />
          </div>
          <a data-testid="open-scanner" onClick={onOpenScanner} className={cn(QUIET, 'h-8 cursor-pointer gap-x-1 px-3 text-xs')}>
            <ScannerIcon width={16} height={16} /><span className="whitespace-nowrap"><span className="max-sm:hidden">Open in </span>Scanner</span>
          </a>
        </div>
        {steps ? <Steps steps={steps} animated /> : open ? <StepsSkeleton rows={stepRows(o)} /> : null}
      </div>
      </motion.div>
      {/* Via, details toggle, fee */}
      <div className="flex items-center justify-between gap-x-3 text-xs text-secondary *:flex *:items-center *:font-medium">
        <div className="gap-x-1.5">
          <ViaPill minter={o.viaMinter} />
          <span className="max-sm:hidden">{o.gas}</span>
        </div>
        <div onClick={onToggle} className={cn('cursor-pointer select-none gap-x-1 whitespace-nowrap text-sm hover:text-white sm:gap-x-2', tw.quick, tw.press)}>
          {open ? 'Hide Details' : 'View Details'}
          <ChevronDownIcon width={20} height={20} className={cn('transition-transform', tw.panel, open && 'rotate-180 transform')} />
        </div>
        <div className="gap-x-1 whitespace-nowrap text-white">
          {o.feeText ?? ''}
          <FeeIcon width={16} height={16} />
        </div>
      </div>
    </div>
  );
}
