'use client';
// One order: moved from the design's scanner-screens.tsx OrderDetail (the approved static look), wired to the row (an id
// lookup, GET /v2/scanner/search, contract 5.13) and its timeline (GET /v2/orders/{id}/steps through useActivity, polling
// while pending). What went in and came out, who sent and received it, the route, and the timeline.
import * as React from 'react';
import Box from '@/components/ui/box';
import BoxHeader from '@/components/ui/box-header';
import { Card } from '@/components/ui/card';
import Skeleton from '@/components/ui/skeleton';
import { InfoRow } from '@/components/design/InfoRow';
import { SideBlock } from '@/components/design/SideBlock';
import { statCard } from '@/components/design/stat-card';
import { CopyButton, useCopied } from '@/components/orders/CopyButton';
import { StatusPill } from '@/components/orders/StatusPill';
import { Steps } from '@/components/orders/Steps';
import { ViaPill } from '@/components/orders/ViaPill';
import type { StepView } from '@/components/orders/types';
import { ArrowDownIcon, CheckIcon, ClockIcon, LinkIcon } from '@/components/icons';
import { config } from '@/config';
import { short } from '@/lib/copy/format';
import { cn } from '@/lib/cn';
import type { OrderView } from '@/features/activity/rows';

/** "29 Oct 2026" (display only). */
const fullDay = (sec: number) => { const d = new Date(sec * 1000); return `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })} ${d.getFullYear()}`; };
const clock = (sec: number) => { const d = new Date(sec * 1000); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`; };

export function OrderDetail({ order: o, steps, loading, onBack }: { order: OrderView | null; steps: StepView[] | undefined; loading: boolean; onBack: () => void }) {
  const [copied, copy] = useCopied();
  const live = !!o && (o.status === 'pending' || o.status === 'queued');
  const refund = o?.status === 'refunded';
  const took = o?.took ? ` in ${o.took}` : '';
  const headline = !o ? '' : refund ? `Refunded${took}` : live ? o.stageText ?? '' : o.status === 'failed' ? 'Failed' : `${o.kind === 'stake' ? 'Staked' : o.kind === 'withdraw' ? 'Paid out' : 'Delivered'}${took}`;
  const busy = loading || !o;
  return (
    <Box className="flex h-full flex-col gap-6 overflow-x-hidden md:h-fit md:w-full md:max-w-[537px] lg:max-w-[1060px]">
      <div className="flex w-full items-center justify-center">
        <BoxHeader title="Order" onBack={onBack} />
        {o && (
          <CopyLink id={o.id} copied={copied} onCopy={copy} />
        )}
      </div>
      <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-stretch">
        <div data-testid="col-left" className="flex w-full lg:max-w-[482px] lg:shrink-0">
          <Card className="h-full cursor-auto flex-col items-start justify-start gap-4 hover:bg-[#000000]/0">
            {busy ? (
              <div className="flex w-full flex-col gap-y-4">
                <Skeleton className="h-6 w-40" />
                {[0, 1].map((i) => <div key={i} className="flex items-center gap-4"><Skeleton className="h-12 w-12 rounded-full" /><div className="flex flex-col gap-y-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-6 w-36" /></div></div>)}
              </div>
            ) : (
              <>
                <div className="flex w-full items-center justify-between gap-3">
                  <StatusPill status={o.status} />
                  <p className="text-sm font-semibold text-[#898989]">{headline}</p>
                </div>
                <div className="flex w-full flex-1 flex-col justify-center gap-4">
                  <SideBlock label="Sent" side={o.from} amount={`${o.from.amountText} ${o.from.symbol}`} />
                  <div className="ml-3 flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white/70"><ArrowDownIcon width={14} height={14} /></div>
                  {refund && o.refund ? (
                    <SideBlock label={`Refunded to ${o.refund.toText}`} side={o.refund} amount={`${o.refund.amountText} ${o.refund.symbol}`} tone="text-yellow-500" />
                  ) : (
                    <SideBlock label={live ? 'Receiving' : 'Received'} side={o.to} amount={`${o.to.amountText} ${o.to.symbol}`} tone={live ? 'text-white/60' : undefined} />
                  )}
                </div>
              </>
            )}
          </Card>
        </div>
        <div data-testid="col-right" className="flex w-full flex-col gap-4">
          <div className={cn(statCard, 'flex-1 gap-y-5')}>
            <div className="flex items-center justify-between">
              <p className="text-xl font-bold text-white">Timeline</p>
              {!busy && (
                <p className="flex items-center gap-x-1.5 text-sm text-[#898989]">
                  <ClockIcon width={16} height={16} />
                  {live ? 'Updating live' : o.took ? `${o.took} total` : ''}
                </p>
              )}
            </div>
            {busy || !steps ? (
              [0, 1, 2, 3].map((i) => <div key={i} className="flex items-center gap-x-5"><Skeleton className="h-9 w-9 rounded-full" /><div className="flex flex-col gap-y-1.5"><Skeleton className="h-4 w-48" /><Skeleton className="h-3 w-24" /></div></div>)
            ) : (
              <Steps steps={steps} gap="gap-y-6" line="after:h-[24px]" />
            )}
          </div>
          {!busy && refund && (
            <div className="flex animate-slide-in-from-top items-start gap-x-3 rounded-2xl bg-yellow-500/20 p-4 text-sm text-white">
              <span className="mt-0.5 shrink-0 text-yellow-500"><ClockIcon width={18} height={18} /></span>
              <p>{o.reason}, so nothing was swapped. {o.refundLine ? `${o.refundLine}. ` : ''}A swap pays out in full or comes back as USDC, never a mix.</p>
            </div>
          )}
          {!busy && live && (
            <div className="flex animate-slide-in-from-top items-start gap-x-3 rounded-2xl bg-blue-600/35 p-4 text-sm text-white">
              <span className="mt-0.5 shrink-0"><ClockIcon width={18} height={18} /></span>
              <p>This page updates by itself. If the swap can&apos;t finish, the money comes back as USDC.</p>
            </div>
          )}
        </div>
      </div>
      <div className={cn(statCard, 'grid w-full gap-x-12 lg:grid-cols-2')}>
        {busy
          ? Array.from({ length: 8 }).map((_, i) => <div key={i} className="flex justify-between"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-32" /></div>)
          : (
            <>
              <InfoRow k="Order ID"><span className="font-mono font-normal">{short(o.id)}</span><CopyButton id="id" copied={copied} onCopy={copy} text={o.id} /></InfoRow>
              <InfoRow k="Route"><ViaPill /></InfoRow>
              <InfoRow k="From wallet"><span className="font-mono font-normal">{o.payer ? short(o.payer) : ''}</span>{o.payer && <CopyButton id="payer" copied={copied} onCopy={copy} text={o.payer} />}</InfoRow>
              <InfoRow k="Gas">{o.gas === 'Gasless' ? 'Gasless, Swapic paid it' : o.gas}</InfoRow>
              <InfoRow k="To wallet"><span className="font-mono font-normal">{o.recipient ? short(o.recipient) : ''}</span>{o.recipient && <CopyButton id="recipient" copied={copied} onCopy={copy} text={o.recipient} />}</InfoRow>
              <InfoRow k="Fee">{o.feeText ?? ''}</InfoRow>
              <InfoRow k="Created">{fullDay(o.createdAt)}, {steps?.[0]?.at ?? clock(o.createdAt)}</InfoRow>
              <InfoRow k={refund ? 'Refunded' : 'Finished'}>{live || o.endedAt === null ? 'Not yet' : `${fullDay(o.endedAt)}, ${steps?.at(-1)?.at ?? clock(o.endedAt)}`}</InfoRow>
            </>
          )}
      </div>
    </Box>
  );
}

function CopyLink({ id, copied, onCopy }: { id: string; copied: string | null; onCopy: (k: string) => void }) {
  const link = `${config.siteOrigin}/scanner?order=${encodeURIComponent(id)}`;
  return (
    <a
      onClick={() => void navigator.clipboard?.writeText(link).then(() => onCopy('link'), () => {})}
      className="absolute right-4 flex cursor-pointer items-center gap-x-1 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/20 active:scale-95 md:right-10"
    >
      {copied === 'link' ? <CheckIcon width={14} height={14} className="text-[#12b76a]" /> : <LinkIcon width={14} height={14} />}
      {copied === 'link' ? 'Copied' : 'Copy link'}
    </a>
  );
}
