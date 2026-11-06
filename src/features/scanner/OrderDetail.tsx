'use client';
// One order: moved from the design's scanner-screens.tsx OrderDetail (the approved static look), wired to the row (an id
// lookup, GET /v2/scanner/search, contract 5.13) and its timeline (GET /v2/orders/{id}/steps through useActivity, polling
// while pending). What went in and came out, who sent and received it, the route, and the timeline.
import * as React from 'react';
import BoxHeader from '@/components/ui/box-header';
import { Card } from '@/components/ui/card';
import Skeleton, { SkeletonText } from '@/components/ui/skeleton';
import { InfoRow } from '@/components/design/InfoRow';
import { SideBlock } from '@/components/design/SideBlock';
import { statCard } from '@/components/design/stat-card';
import { CopyButton, useCopied } from '@/components/orders/CopyButton';
import { StepsSkeleton, stepRows } from '@/components/orders/OrderRow';
import { StatusPill } from '@/components/orders/StatusPill';
import { Steps } from '@/components/orders/Steps';
import { ViaPill } from '@/components/orders/ViaPill';
import type { StepView } from '@/components/orders/types';
import { ArrowDownIcon, CheckIcon, ClockIcon, LinkIcon } from '@/components/icons';
import { config } from '@/config';
import { short } from '@/lib/copy/format';
import { cn } from '@/lib/cn';
import { QUIET } from '@/components/ui/styles';
import { motion } from 'motion/react';
import { PanelBox } from '@/components/motion/parts';
import { T, fade, tw, useMounted } from '@/lib/motion';
import { endFlags, endText, type OrderView } from '@/features/activity/rows';

/** The order page's size, also the in place frame's when History or Scanner opens an order (motion part 2). */
export const ORDER_FRAME = 'h-full md:h-fit md:w-full md:max-w-[537px] lg:max-w-[1060px] overflow-x-hidden';

/** "29 Oct 2026" (display only). */
const fullDay = (sec: number) => { const d = new Date(sec * 1000); return `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })} ${d.getFullYear()}`; };
const clock = (sec: number) => { const d = new Date(sec * 1000); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`; };

const INFO = ['Order ID', 'Route', 'From wallet', 'Gas', 'To wallet', 'Fee', 'Created', 'Finished'];

/** SideBlock while the order loads. */
const SideSkeleton = () => (
  <div className="flex w-full items-center gap-4">
    <Skeleton className="h-12 w-12 shrink-0" />
    <div className="min-w-0 flex-1">
      <SkeletonText className="w-20 text-sm font-medium" />
      <SkeletonText className="w-40 max-w-full" />
      <SkeletonText className="w-28 text-sm font-normal" />
    </div>
  </div>
);

export function OrderDetail({ order: o, steps, loading, onBack }: { order: OrderView | null; steps: StepView[] | undefined; loading: boolean; onBack: () => void }) {
  const [copied, copy] = useCopied();
  // as USDC: what arrived is the USDC side; an order that never ran (or is held) shows nothing received
  const { live, refund, asUsdc, stopped } = o ? endFlags(o) : { live: false, refund: false, asUsdc: false, stopped: false };
  const headline = o ? endText(o) : '';
  const busy = loading || !o;
  // Motion (approved 2026-10-29, part 2): inside the History or Scanner panel (MorphFrame) the page comes with the calm
  // fade; the link copy turns into a check for a second.
  return (
    <PanelBox className="flex h-full flex-col gap-6 overflow-x-hidden md:h-fit md:w-full md:max-w-[537px] lg:max-w-[1060px]">
      <motion.div variants={fade} className="flex w-full items-center justify-center [&_button]:transition [&_button]:duration-150 [&_button:hover]:opacity-70 [&_button:active]:scale-[0.97] motion-reduce:[&_button:active]:scale-100">
        <BoxHeader title="Order" onBack={onBack} />
        {o ? <CopyLink id={o.id} copied={copied} onCopy={copy} /> : <Skeleton className="absolute right-0 h-8 w-[92px] rounded-xl md:right-8" />}
      </motion.div>
      <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-stretch">
        <motion.div variants={fade} data-testid="col-left" className="flex w-full lg:max-w-[482px] lg:shrink-0">
          <Card className="h-full cursor-auto flex-col items-start justify-start gap-4">
            {busy ? (
              <>
                <div className="flex w-full items-center justify-between gap-3">
                  <Skeleton className="h-5 w-20" />
                  <SkeletonText className="w-32 text-sm font-medium" />
                </div>
                <div className="flex w-full flex-1 flex-col justify-center gap-4">
                  <SideSkeleton />
                  <div className="ml-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-secondary"><ArrowDownIcon width={16} height={16} /></div>
                  <SideSkeleton />
                </div>
              </>
            ) : (
              <>
                <div className="flex w-full items-center justify-between gap-3">
                  <StatusPill status={o.status} />
                  <p className="text-sm font-medium text-secondary">{headline}</p>
                </div>
                <div className="flex w-full flex-1 flex-col justify-center gap-4">
                  <SideBlock label="Sent" side={o.from} amount={`${o.from.amountText} ${o.from.symbol}`} />
                  <div className="ml-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-secondary"><ArrowDownIcon width={16} height={16} /></div>
                  {asUsdc ? (
                    <SideBlock label="Received as USDC" side={o.refund!} amount={`${o.refund!.amountText} ${o.refund!.symbol}`} />
                  ) : stopped ? null : refund && o.refund ? (
                    <SideBlock label={`Refunded to ${o.refund.toText}`} side={o.refund} amount={`${o.refund.amountText} ${o.refund.symbol}`} tone="text-warn" />
                  ) : (
                    <SideBlock label={live ? 'Receiving' : 'Received'} side={o.to} amount={`${o.to.amountText} ${o.to.symbol}`} tone={live ? 'text-secondary' : undefined} />
                  )}
                </div>
              </>
            )}
          </Card>
        </motion.div>
        <motion.div variants={fade} data-testid="col-right" className="flex w-full flex-col gap-4">
          <div className={cn(statCard, 'flex-1 gap-y-5')}>
            <div className="flex items-center justify-between">
              <p className="text-xl font-semibold text-white">Timeline</p>
              {busy ? (
                <SkeletonText className="w-20 text-sm" />
              ) : (
                <p className="flex items-center gap-x-1.5 text-sm text-secondary">
                  <ClockIcon width={16} height={16} />
                  {live ? 'Updating live' : o.took ? `${o.took} total` : ''}
                </p>
              )}
            </div>
            {busy || !steps ? (
              <StepsSkeleton rows={stepRows(o)} gap="gap-y-6" line="h-6" />
            ) : (
              <Steps steps={steps} gap="gap-y-6" line="after:h-[24px]" />
            )}
          </div>
          {!busy && o.reason && !live && (
            <div className={cn('flex animate-slide-in-from-top items-start gap-x-3 rounded-2xl p-4 text-sm text-white', o.status === 'didntStart' ? 'bg-white/10' : o.status === 'onHold' ? 'bg-amber-500/20' : asUsdc ? 'bg-success/15' : 'bg-warn/10')}>
              <span className={cn('mt-0.5 shrink-0', o.status === 'didntStart' ? 'text-secondary' : o.status === 'onHold' ? 'text-warn' : asUsdc ? 'text-success' : 'text-warn')}><ClockIcon width={16} height={16} /></span>
              <p>{o.reason}</p>
            </div>
          )}
          {!busy && live && (
            <div className="flex animate-slide-in-from-top items-start gap-x-3 rounded-2xl bg-blue-500/10 p-4 text-sm text-white ring-1 ring-inset ring-blue-400/20">
              <span className="mt-0.5 shrink-0"><ClockIcon width={16} height={16} /></span>
              <p>This page updates by itself. If the swap can&apos;t finish, the money comes back as USDC.</p>
            </div>
          )}
        </motion.div>
      </div>
      <motion.div variants={fade} className={cn(statCard, 'grid w-full gap-x-12 lg:grid-cols-2')}>
        {busy
          ? INFO.map((k) => <InfoRow key={k} k={k}><SkeletonText className="w-28" /></InfoRow>)
          : (
            <>
              <InfoRow k="Order ID"><span className="font-mono font-normal">{short(o.id)}</span><CopyButton id="id" copied={copied} onCopy={copy} text={o.id} /></InfoRow>
              <InfoRow k="Route"><ViaPill minter={o.viaMinter} /></InfoRow>
              <InfoRow k="From wallet"><span className="font-mono font-normal">{o.payer ? short(o.payer) : ''}</span>{o.payer && <CopyButton id="payer" copied={copied} onCopy={copy} text={o.payer} />}</InfoRow>
              <InfoRow k="Gas">{o.gas === 'Gasless' ? 'Gasless, Swapic paid it' : o.gas}</InfoRow>
              <InfoRow k="To wallet"><span className="font-mono font-normal">{o.recipient ? short(o.recipient) : ''}</span>{o.recipient && <CopyButton id="recipient" copied={copied} onCopy={copy} text={o.recipient} />}</InfoRow>
              <InfoRow k="Fee">{o.feeText ?? ''}</InfoRow>
              <InfoRow k="Created">{fullDay(o.createdAt)}, {steps?.[0]?.at ?? clock(o.createdAt)}</InfoRow>
              {/* when it arrived: the chain's time (deliveredAt); before chain times, the last step's or the watcher's */}
              <InfoRow k={refund ? 'Refunded' : stopped ? 'Ended' : 'Finished'}>{live || o.endedAt === null ? 'Not yet' : o.deliveredAt !== null ? `${fullDay(o.deliveredAt)}, ${clock(o.deliveredAt)}` : `${fullDay(o.endedAt)}, ${steps?.at(-1)?.at ?? clock(o.endedAt)}`}</InfoRow>
            </>
          )}
      </motion.div>
    </PanelBox>
  );
}

function CopyLink({ id, copied, onCopy }: { id: string; copied: string | null; onCopy: (k: string) => void }) {
  const link = `${config.siteOrigin}/scanner?order=${encodeURIComponent(id)}`;
  const mounted = useMounted();
  return (
    <a
      onClick={() => void navigator.clipboard?.writeText(link).then(() => onCopy('link'), () => {})}
      className={cn(QUIET, 'absolute right-0 h-8 cursor-pointer gap-x-1 px-3 text-xs md:right-8')}
    >
      <motion.span key={copied === 'link' ? 'check' : 'link'} className="flex" initial={mounted ? { opacity: 0, scale: 0.6 } : false} animate={{ opacity: 1, scale: 1 }} transition={T.hover}>
        {copied === 'link' ? <CheckIcon width={16} height={16} className="text-success" /> : <LinkIcon width={16} height={16} />}
      </motion.span>
      {copied === 'link' ? 'Copied' : 'Copy link'}
    </a>
  );
}
