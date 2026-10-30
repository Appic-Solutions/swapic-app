'use client';
// Your swap: moved from the design's review-screens.tsx SwapStatus and LiveRing (approved with their motion, Jeff
// 2026-10-29), taking statusView's data (status-view.ts), which follows the real tracking: the route card shrinks into the
// status circle, each step checks in only when the steps answer says it is done, the ring fills toward the real ETA, and
// it closes Delivered (check badge, glow) or Refunded (calm, yellow, the refund line saying where the USDC went) only
// when the status says so.
import * as React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle } from 'lucide-react';
import ActionButton from '@/components/ui/action-button';
import Stepper from '@/components/ui/stepper';
import { InfoRow } from '@/components/design/InfoRow';
import { Note } from '@/components/design/Note';
import { SideBlock } from '@/components/design/SideBlock';
import { TwoColumn } from '@/components/design/TwoColumn';
import { statCard } from '@/components/design/stat-card';
import { CopyButton, useCopied } from '@/components/orders/CopyButton';
import { StatusPill } from '@/components/orders/StatusPill';
import { Steps } from '@/components/orders/Steps';
import type { SideView } from '@/components/orders/types';
import { ArrowDownIcon, CheckIcon, ClockIcon, HistoryIcon } from '@/components/icons';
import { DrawCheck, MotionCard, shrinkInto, useFrame } from '@/components/motion/parts';
import { short } from '@/lib/copy/format';
import { cn } from '@/lib/cn';
import { DUR, EASE, T, fade, rise, tw, useReducedMotion } from '@/lib/motion';
import { SWAPIC_LOGO } from '@/components/design/swapic-logo';
import type { StatusData } from '../status-view';

type Phase = StatusData['phase'];
const PILL: Record<Phase, 'pending' | 'delivered' | 'refunded'> = { progress: 'pending', delivered: 'delivered', refunded: 'refunded' };

export interface LiveRingProps {
  phase: Phase;
  logo: string;
  /** How much of the ring is filled while it moves (0 to 1). */
  progress: number;
  /** Seconds the fill takes to reach progress (the time running down, linear). */
  fillFor: number;
  /** Yellow: the swap could not finish and the USDC is on its way back. */
  refunding?: boolean;
  /** The route card of the view that is leaving: a copy of it shrinks into this circle. */
  from?: React.RefObject<HTMLElement | null>;
  /** Another flow's page (Your stake): the Swapic mark sits on its dark round badge, like the pool's avatar. */
  badge?: boolean;
}

// The route card shrinks into it, the ring fills as the time runs down, then closes (green, or yellow for a refund). On
// Delivered a check draws in on its edge and a soft glow appears behind it.
export function LiveRing({ phase, logo, progress, fillFor, refunding, from, badge }: LiveRingProps) {
  const closed = phase !== 'progress';
  const yellow = refunding || phase === 'refunded';
  const color = yellow ? '#eab308' : '#16a34a';
  const firstLogo = React.useRef(logo);
  const ring = React.useRef<HTMLDivElement>(null);
  const frame = useFrame();
  const reduced = useReducedMotion();
  // The route card shrinks into the circle; the ring shows as it lands.
  const [flying] = React.useState(() => !!from?.current && !!frame && !reduced);
  const arrive = flying ? DUR.big * 0.55 : 0;
  React.useLayoutEffect(() => {
    if (!flying || !from?.current || !ring.current || !frame?.current) return;
    return shrinkInto(from.current, ring.current, frame.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div ref={ring} data-testid="status-ring" data-phase={phase} className="relative flex h-[90px] w-[90px] items-center justify-center rounded-full">
      <AnimatePresence>
        {phase === 'delivered' && (
          <motion.div
            className={'pointer-events-none absolute -inset-9 rounded-full ' + tw.glowDelivered}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: DUR.glow, ease: EASE.enter, delay: DUR.big }}
          />
        )}
      </AnimatePresence>
      <motion.svg
        className="absolute inset-0 -rotate-90"
        width={90}
        height={90}
        viewBox="0 0 90 90"
        fill="none"
        initial={{ opacity: flying ? 0 : 1 }}
        animate={{ opacity: closed ? 0 : 1 }}
        transition={{ ...T.enter, delay: closed ? DUR.big + DUR.panel : arrive }}
      >
        <circle cx={45} cy={45} r={43.5} stroke="rgba(255,255,255,0.1)" strokeWidth={3} />
        <motion.circle
          cx={45}
          cy={45}
          r={43.5}
          strokeWidth={3}
          strokeLinecap="round"
          initial={{ pathLength: 0, stroke: color }}
          animate={{ pathLength: closed ? 1 : progress, stroke: color }}
          transition={{ pathLength: closed ? T.big : { duration: fillFor, ease: 'linear' }, stroke: T.enter }}
        />
      </motion.svg>
      {/* A closed ring at rest is the static one: a 2 px border. */}
      <motion.div
        className={cn('absolute inset-0 rounded-full border-2', yellow ? 'border-yellow-500' : 'border-green-500')}
        initial={false}
        animate={{ opacity: closed ? 1 : 0 }}
        transition={{ ...T.enter, delay: closed ? DUR.big : 0 }}
      />
      <AnimatePresence initial={flying} mode="popLayout">
        <motion.img
          key={logo}
          src={logo}
          alt=""
          width={80}
          height={80}
          className={cn('relative object-contain', badge && logo === SWAPIC_LOGO && 'rounded-full bg-[#0B0B0B] p-4 ring-1 ring-white/20')}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: T.exit }}
          transition={{ ...T.enter, delay: logo === firstLogo.current ? arrive : 0 }}
        />
      </AnimatePresence>
      {phase === 'delivered' && (
        <motion.span
          className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#12b76a] text-white ring-4 ring-[#161616]"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...T.enter, delay: DUR.big }}
        >
          <DrawCheck size={16} delay={DUR.big + 0.1} className="[stroke-width:2.5]" />
        </motion.span>
      )}
    </div>
  );
}

/** Another flow's page after signing in the same layout (Your stake, design review-screens.tsx StatusText): its words,
 *  details, note and buttons. Its cards fade in without the rise (the calm fade, motion row 71). */
export interface StatusText {
  title: string;
  /** Label of what went in ("You staked"). */
  paid: string;
  /** Label of what comes out ("Added to your stake"). */
  get: string;
  rows: [string, React.ReactNode][];
  note: React.ReactNode;
  action: React.ReactNode;
}

export interface SwapStatusProps {
  data: StatusData;
  /** The ring's motion: how full, how long to get there, yellow while refunding, the card it grows out of. */
  ring: Omit<LiveRingProps, 'phase' | 'logo'>;
  onNew?: () => void;
  onHistory?: () => void;
  /** Not a swap: the words, details, note and buttons of that flow (the stake status). */
  text?: StatusText;
}

/** After signing: where the money is (ring and stepper), what was paid and what comes, the steps, and the details. */
export function SwapStatus({ data: d, ring, onNew, onHistory, text }: SwapStatusProps) {
  const card = text ? fade : rise;
  const [copied, copy] = useCopied();
  const done = d.steps.filter((s) => s.state === 'done').length;
  const refundSide: (SideView & { amount: string }) | null = d.phase === 'refunded' && d.refund ? { ...d.refund, amount: `${d.refund.amountText} ${d.refund.symbol}` } : null;
  return (
    <TwoColumn
      inPlace
      title={text?.title ?? 'Your swap'}
      left={
        <MotionCard variants={fade} className="cursor-auto flex-col items-start justify-between gap-5 hover:bg-[#000000]/0 lg:flex-1">
          <motion.div variants={fade} className="flex w-full items-center justify-between gap-3">
            <motion.span key={d.phase} variants={fade} className="flex"><StatusPill status={d.failed ? 'failed' : PILL[d.phase]} /></motion.span>
            <p className="text-sm font-semibold text-[#898989]">{d.when}</p>
          </motion.div>
          <div className="flex w-full flex-col items-center gap-2 text-center">
            <LiveRing phase={d.phase} logo={d.ringLogo} badge={!!text} {...ring} />
            <motion.div variants={fade} className="flex flex-col items-center gap-2">
              <motion.p key={d.title} variants={fade} className="mt-1 text-lg font-bold text-white">{d.title}</motion.p>
              <motion.p key={d.text} variants={fade} className="text-sm font-semibold text-[#9F9F9F]">{d.text}</motion.p>
              {d.steps.length > 0 && <div className="mt-2"><Stepper totalSteps={d.steps.length} currentStep={d.phase === 'progress' ? done + 1 : d.steps.length} /></div>}
            </motion.div>
          </div>
          <motion.div variants={fade} className="flex w-full flex-col gap-4">
            <SideBlock label={text?.paid ?? 'You paid'} side={d.pay} amount={`${d.pay.amountText} ${d.pay.symbol}`} />
            <div className="ml-3 flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white/70"><ArrowDownIcon width={14} height={14} /></div>
            <motion.div key={refundSide ? 'refund' : d.phase} variants={fade}>
              {refundSide ? (
                <SideBlock label={`Refunded to ${d.refund!.toText}`} side={refundSide} amount={refundSide.amount} tone="text-yellow-500" />
              ) : (
                <SideBlock label={text?.get ?? (d.phase === 'delivered' ? 'You got' : 'You get')} side={d.get} amount={`${d.get.amountText} ${d.get.symbol}`} tone={d.phase === 'progress' ? 'text-white/60' : undefined} />
              )}
            </motion.div>
          </motion.div>
        </MotionCard>
      }
      right={
        <>
          <motion.div variants={card} className={cn(statCard, 'gap-y-5 lg:flex-1')}>
            <div className="flex items-center justify-between">
              <p className="text-xl font-bold text-white">Steps</p>
              <motion.p key={d.phase} variants={fade} className="flex items-center gap-x-1.5 text-sm text-[#898989]">
                <ClockIcon width={16} height={16} />
                {d.totalText}
              </motion.p>
            </div>
            <Steps steps={d.steps} gap="gap-y-6" line="after:h-[24px]" animated />
          </motion.div>
          <motion.div variants={card} className={cn(statCard, 'gap-y-2.5')}>
            {text ? text.rows.map(([k, v]) => <InfoRow key={k} k={k}>{v}</InfoRow>) : (
              <>
                <InfoRow k="Order ID"><span className="font-mono font-normal">{short(d.orderId)}</span><CopyButton id="id" copied={copied} onCopy={copy} text={d.orderId} /></InfoRow>
                <InfoRow k="To wallet"><span className="font-mono font-normal">{short(d.to)}</span><CopyButton id="to" copied={copied} onCopy={copy} text={d.to} /></InfoRow>
                <InfoRow k="Fee">{d.fee}</InfoRow>
                <InfoRow k="Gas">{d.gas}</InfoRow>
              </>
            )}
          </motion.div>
          <motion.div key={d.phase} variants={fade}>
            {text ? text.note : d.failed ? (
              // stopped for a human (contract 5.10): nothing more is known, so nothing more is said
              <Note tone="yellow" icon={<AlertTriangle className="h-[18px] w-[18px]" />}>{d.reason ?? 'Stopped, our team is on it'}.</Note>
            ) : d.phase === 'refunded' ? (
              <Note tone="yellow" icon={<AlertTriangle className="h-[18px] w-[18px]" />}>
                {d.reason ? `Why: ${d.reason.charAt(0).toLowerCase() + d.reason.slice(1)}, so nothing was swapped. ` : ''}A swap pays out in full or comes back as USDC.
              </Note>
            ) : d.phase === 'delivered' ? (
              <Note icon={<CheckIcon />}>All {d.get.amountText} {d.get.symbol} arrived in your {d.get.chain === 'ICP' ? 'ICP' : 'EVM'} wallet {short(d.to)}.</Note>
            ) : (
              <Note tone="blue" icon={<ClockIcon width={18} height={18} />}>You can leave this page. Your swap shows in History.</Note>
            )}
          </motion.div>
        </>
      }
      action={text ? text.action : (
        <div className="flex w-full items-center gap-x-2">
          <button
            onClick={onHistory}
            className={cn('flex h-12 shrink-0 items-center justify-center gap-x-2 rounded-xl bg-white/10 px-4 text-white hover:bg-white/20', tw.quick, tw.press)}
          >
            <HistoryIcon width={20} height={20} />History
          </button>
          <ActionButton isDisabled={false} onClick={onNew}>Make another swap</ActionButton>
        </div>
      )}
    />
  );
}
