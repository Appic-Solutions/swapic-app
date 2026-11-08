'use client';
// Review swap: moved from the design's review-screens.tsx ReviewPanel (approved with its motion, Jeff 2026-10-29), taking
// reviewData's strings (no Number, no rounding here). Inside the Swap page's in place panel (MorphFrame) its parts fade in,
// the picked route card glides in from the Swap list (shared layoutId) and later shrinks into the status circle; the
// button breathes a soft glow while the wallet asks ("Confirm in your wallet"), and the waiting step lights up; once a
// transaction was sent they say the network is awaited instead ("Approving, waiting for the network", "Confirming").
import * as React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Avatar } from '@/components/ui/avatar';
import RouteOption from '@/components/design/RouteOption';
import { InfoRow } from '@/components/design/InfoRow';
import { SideBlock } from '@/components/design/SideBlock';
import { TwoColumn } from '@/components/design/TwoColumn';
import { statCard } from '@/components/design/stat-card';
import { CopyButton, useCopied } from '@/components/orders/CopyButton';
import { Steps } from '@/components/orders/Steps';
import Skeleton, { SkeletonText } from '@/components/ui/skeleton';
import type { SideView, StepView } from '@/components/orders/types';
import { ArrowDownIcon } from '@/components/icons';
import { ConfirmButton, MotionCard, routeLayoutId } from '@/components/motion/parts';
import { short } from '@/lib/copy/format';
import { APPROVING, CONFIRMING_SWAP, confirmingOn } from '@/lib/copy/status';
import { chainLogo } from '@/lib/explorer';
import { cn } from '@/lib/cn';
import { fade, rise } from '@/lib/motion';
import type { reviewData } from '../review';

export type ReviewData = ReturnType<typeof reviewData>;

export interface ReviewPanelProps {
  data: ReviewData;
  /** The pay and get sides (logos, chain names). */
  pay: SideView;
  get: SideView;
  /** The token received: needs symbol and logo (the route card). */
  toToken: { symbol: string; logo: string };
  /** State of each wallet step (todo before signing). */
  states?: StepView['state'][];
  disabled?: boolean;
  /** Button text instead of data.button. */
  button?: string;
  /** Note under the steps: a new price, too many tries, a failure. */
  note?: React.ReactNode;
  /** The minimum before the price moved, shown struck through. */
  wasMinText?: string;
  /** The wallet asks: the button says "Confirm in your wallet" with a spinner and breathes softly. */
  waiting?: boolean;
  /** The wallet sent the swap and the chain is awaited: the waiting step and the button say so instead. */
  confirming?: boolean;
  /** The wallet sent an approve and its receipt is awaited: the waiting step and the button say the network is awaited. */
  approving?: boolean;
  /** The person cancelled in the wallet: a short line under the button. */
  cancelled?: boolean;
  /** The route card's element (Your swap shrinks a copy of it into the status circle). */
  routeRef?: React.Ref<HTMLDivElement>;
  /** The quote timer on the route card (none while the wallet asks: nothing updates then). */
  timer?: React.ReactNode;
  /** Each token's mark after its amount (the tick or a flag pill), and the one line to check a flagged token by. */
  marks?: { pay?: React.ReactNode; get?: React.ReactNode; check?: React.ReactNode };
  onBack: () => void;
  onSign: () => void;
}

/** The wallet list while its steps are not known yet (Steps, row for row): nothing to read, nothing that later turns out wrong. */
const StepsWaiting = () => (
  <div className="flex flex-col gap-y-4" data-testid="wallet-steps-waiting">
    {[0, 1].map((i) => (
      <div key={i} className="flex min-w-0 items-center gap-x-4 text-sm font-medium md:gap-x-5">
        <Skeleton className="h-9 w-9 shrink-0" />
        <div className="min-w-0">
          <SkeletonText className="w-44 max-w-full" />
          <SkeletonText className="w-52 max-w-full text-xs font-normal" />
        </div>
      </div>
    ))}
  </div>
);

export function ReviewPanel({ data, pay, get, toToken, states, disabled, button, note, wasMinText, waiting, confirming, approving, cancelled, routeRef, timer, marks, onBack, onSign }: ReviewPanelProps) {
  const [copied, copy] = useCopied();
  const { recipient } = data;
  const steps: StepView[] = data.steps.map((s, i) => {
    const state = states?.[i] ?? 'todo';
    return { key: String(i), label: s.label, sub: state === 'wait' ? (confirming ? confirmingOn(pay.chain) : approving ? APPROVING : 'Check your wallet') : s.sub, state };
  });
  return (
    <TwoColumn
      inPlace
      title="Review swap"
      onBack={onBack}
      left={
        // short windows (a laptop at 125%): a little tighter
        <MotionCard variants={fade} className="cursor-auto flex-col items-start justify-between gap-4 lg:flex-1 md:short:gap-3 md:short:p-5">
          <div className="flex w-full flex-1 flex-col justify-center gap-4 md:short:gap-3">
            <SideBlock label="You pay" side={pay} amount={data.payText} badge={marks?.pay} />
            <div className="ml-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-secondary"><ArrowDownIcon width={16} height={16} /></div>
            {/* a fresh price (the 20 s refresh): the old minimum fades out, the new one fades in (the design's quote timer) */}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={data.minText} variants={fade} initial="hidden" animate="shown" exit="gone">
                <SideBlock label="You get at least" side={get} amount={data.minText} tone={wasMinText ? 'text-warn' : undefined} badge={marks?.get} />
                {wasMinText && <p className="ml-16 mt-1 text-sm font-normal text-secondary">was <span className="line-through">{wasMinText}</span></p>}
              </motion.div>
            </AnimatePresence>
            {marks?.check}
          </div>
          <div className="w-full space-y-2 border-t border-line pt-3">
            <InfoRow k="Send to">
              <Avatar src={chainLogo(recipient.chain)} className="h-5 w-5" />
              <span className="max-sm:hidden">{recipient.label}</span>
              <span className="font-mono font-normal text-white">{short(recipient.address)}</span>
              <CopyButton id="to" copied={copied} onCopy={copy} text={recipient.address} />
            </InfoRow>
            <InfoRow k="If it can't finish">Refunded as {data.refundAs}</InfoRow>
          </div>
        </MotionCard>
      }
      right={
        <>
          {/* The picked route: it glides here from the Swap list (and on to the status circle). */}
          <RouteOption review layoutId={routeLayoutId(data.option.key)} cardRef={routeRef} option={data.option} toToken={toToken} isSelected isExpanded onSelect={() => {}} onExpand={() => {}} timer={timer} arrive="rise" />
          <motion.div variants={rise} className={cn(statCard, 'gap-y-4 lg:flex-1')}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xl font-semibold text-white">In your wallet</p>
              {!data.pending && <p className="text-sm text-secondary">{steps.length === 1 ? '1 step' : `${steps.length} steps`}</p>}
            </div>
            {/* a note in its place says why the steps never came */}
            {data.pending ? !note && <StepsWaiting /> : <Steps steps={steps} numbered animated />}
          </motion.div>
          {note && <motion.div variants={fade}>{note}</motion.div>}
        </>
      }
      action={<ConfirmButton label={button ?? data.button} waiting={waiting} waitingLabel={confirming ? CONFIRMING_SWAP : approving ? APPROVING : undefined} cancelled={cancelled} disabled={disabled} onClick={onSign} />}
    />
  );
}
