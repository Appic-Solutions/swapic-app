// Route option card, the layout Jeff picked 2026-11-05 (sample 4 on the canvas): tags and timer, the amount large with its
// dollar value and the time, gas in its own box, and the details opening under it.
// 1. Every route shows Swapic as the provider; a big price impact shows a yellow warning under the amount.
// 2. A gasless card reads 0 gas fees in a green box, unless the wallet must approve Permit2 first (Jeff 2026-11-06): then it
//    says so, or, with none of the coin to pay for that approve, that it cannot go on. The fee row shows on a You pay gas card and on Review swap (Jeff
//    2026-11-05: the home page promises the total fee before you sign), never on a gasless card in the Swap list.
// 3. On the review page (review) the card is always open, has no chevron and is not clickable.
// It shows texts the caller formats with @/lib/money (no number math here), and one pill per tag.
// Motion (src/lib/motion.ts): the card is a motion element (MotionCard), so with a layoutId it glides from the Swap list to
// Review swap and back. Hover only brightens the edge (Jeff 2026-11-05: nothing moves, a lift clipped the top border in
// the list's scroll box); it sinks a little when pressed.
// Quote timer (Jeff's pick 2026-10-31): the picked card shows the countdown in its top row (timer); new numbers arrive in
// place: the old amount fades out, the new one fades in rising 8 px (arrive).
import * as React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDownIcon, ClockIcon, GasIcon, WarningIcon, ZapIcon } from '@/components/icons';
import { MotionCard } from '@/components/motion/parts';
import { heroSize } from '@/components/ui/amount-size';
import { NOTE_YELLOW } from '@/components/ui/styles';
import { T, fade, rise, tw, pressCard } from '@/lib/motion';
import { cn } from '@/lib/cn';
import { SWAPIC_LOGO } from './swapic-logo';

const ICP_LOGO = '/images/tokens/icp.svg';

export interface RouteOptionView {
  /** Unique id of the route. */
  key: string;
  /** One badge pill each: Gasless, Fastest, Best price (one route can carry two). */
  tags: string[];
  /** True when Swapic pays the gas (the user only signs). */
  gasless: boolean;
  durationText: string;
  amountOutText: string;
  /** Dollar value of the amount out, formatted; null when unknown. */
  usdOutText: string | null;
  /** What the swap loses against what is paid, "-69%", once it is at least a percent; high: it is a big share. */
  loss?: { text: string; high: boolean };
  /** The network fee taken from the swap, where the card shows no Fee row. */
  networkFeeText?: string;
  totalFeeText: string;
  /** The least the user receives (the route's least less the small cushion, shownMinOf) with the token's symbol: the details' first row. */
  minOutText: string;
  /** What the gas costs: the You pay gas box. */
  gasText: string;
  /** The ck minter's slow path, the fallback when Swapic's pool cannot cover the swap: its own name and the ICP logo. */
  viaMinter?: boolean;
  /** Yellow warning under the amount, e.g. when the price impact is big. */
  warning?: string;
  /** The green box's line on a gasless card: "Just sign, no ETH needed", or the wallet has none of the coin. */
  gaslessNote?: string;
  /** The wallet must approve first: it can ('once'), or it holds no coin to pay with ('noCoin'). */
  approve?: 'once' | 'noCoin';
  /** The line on a card that cannot go on. */
  approveBlocked?: string;
}

export interface RouteOptionProps {
  option: RouteOptionView;
  /** The token received: needs symbol and logo. */
  toToken: { symbol: string; logo: string };
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: (key: string) => void;
  onExpand: (key: string) => void;
  className?: string;
  /** Review page look: always open, no chevron, not clickable. */
  review?: boolean;
  /** Shared glide id: the card with the same id in the next view takes over from this one. */
  layoutId?: string;
  /** The card's element (Your swap shrinks a copy of it into the status circle). */
  cardRef?: React.Ref<HTMLDivElement>;
  /** The quote timer in the top row (the picked card while a price shows). */
  timer?: React.ReactNode;
  /** New numbers arrive in place: the old ones fade out, then the new ones fade in ('fade') or fade in rising 8 px ('rise'). */
  arrive?: 'fade' | 'rise';
}

/** The gas the user pays, without the view's ", you pay it"; nothing when the coin has no price. */
const gasAmount = (gasText: string) => (gasText === 'You pay it' ? '' : gasText.replace(/, you pay it$/, ''));

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-3 whitespace-nowrap">
    <span className="shrink-0 font-normal text-secondary">{label}</span>
    <span className="min-w-0 truncate font-medium text-white">{children}</span>
  </div>
);

const Time = ({ text, className }: { text: string; className?: string }) => (
  <span className={cn('items-center gap-x-1 whitespace-nowrap font-normal text-secondary', className)}>
    <ClockIcon width={16} height={16} />
    {text}
  </span>
);

/** Gas on a gasless card: nothing to pay, and the line that says why (Just sign, or the wallet holds none of the coin). */
const NoGasBox = ({ note }: { note?: string }) => (
  <div className="flex w-full flex-wrap items-center gap-x-2 gap-y-0.5 rounded-2xl bg-emerald-400/10 px-3 py-2.5 text-xs ring-1 ring-inset ring-emerald-400/20 md:px-4 md:text-sm">
    <span className="inline-flex items-center gap-x-1 whitespace-nowrap font-semibold text-emerald-300">
      <ZapIcon width={16} height={16} className="fill-emerald-400 text-emerald-400" />
      0 gas fees
    </span>
    <span className="font-normal text-emerald-100/80">{note ?? 'Just sign'}</span>
  </div>
);

const PayGasBox = ({ gasText }: { gasText: string }) => (
  <div className="flex w-full items-center justify-between gap-3 whitespace-nowrap rounded-2xl bg-inset px-3 py-2.5 text-xs md:px-4 md:text-sm">
    <span className="flex items-center gap-x-1 font-normal text-secondary">
      <GasIcon width={16} height={16} />
      You pay gas
    </span>
    <span className="font-medium">{gasAmount(gasText)}</span>
  </div>
);

/** Gas on a gasless card whose wallet must approve first: the swap is free, the approve is not. */
const ApproveBox = () => (
  <div className="flex w-full items-center justify-between gap-3 whitespace-nowrap rounded-2xl bg-inset px-3 py-2.5 text-xs md:px-4 md:text-sm">
    <span className="flex items-center gap-x-1 font-normal text-secondary">
      <GasIcon width={16} height={16} />
      Approve once, then sign
    </span>
    <span className="font-medium">You pay gas once</span>
  </div>
);

/** The same card when the wallet holds no coin to pay for the approve. */
const NoCoinBox = ({ text }: { text?: string }) => (
  <div className={cn('flex w-full items-center gap-x-1.5 rounded-2xl px-3 py-2.5 text-xs font-medium text-warn md:px-4 md:text-sm', NOTE_YELLOW)}>
    <WarningIcon width={16} height={16} className="shrink-0" />
    <span className="[text-wrap:balance]">{text}</span>
  </div>
);

export default function RouteOption({ isSelected, isExpanded, onSelect, onExpand, option: o, className, toToken, review, layoutId, cardRef, timer, arrive }: RouteOptionProps) {
  const open = review || isExpanded;
  const hero = (
    <div className="flex w-full items-center justify-between gap-x-3">
      <div className="flex min-w-0 items-center gap-x-3">
        <img src={toToken.logo} alt="" className="h-10 w-10 shrink-0 rounded-full object-contain lg:h-12 lg:w-12" />
        <div className="flex min-w-0 flex-col">
          <span className="text-xs font-normal text-secondary">You get about</span>
          <p className="flex min-w-0 items-baseline gap-x-1.5 whitespace-nowrap font-semibold leading-tight">
            <span className={cn('min-w-0 whitespace-normal [overflow-wrap:anywhere]', heroSize(o.amountOutText))}>{o.amountOutText}</span>
            <span className="shrink-0 text-sm font-medium text-secondary lg:text-lg">{toToken.symbol}</span>
          </p>
          <span className="flex items-center gap-x-2 whitespace-nowrap text-xs font-normal text-secondary">
            <span>
              {o.usdOutText ?? ''}
              {o.loss && <span className={cn('ml-1', o.loss.high && 'text-warn')}>{o.loss.text}</span>}
            </span>
            {/* phones: the time sits here, there is no room beside the amount */}
            <Time text={o.durationText} className="flex md:hidden" />
          </span>
        </div>
      </div>
      <Time text={o.durationText} className="hidden text-sm md:flex" />
    </div>
  );
  return (
    <MotionCard
      ref={cardRef}
      onClick={() => onSelect(o.key)}
      // The glide only runs between views (the list and the review page have different dependencies); opening the
      // details never glides.
      layoutId={layoutId}
      layoutDependency={layoutId ? (review ? 'review' : 'list') : undefined}
      layoutCrossfade={false}
      // The press runs through motion here (a glide leaves an inline transform that would block CSS transforms).
      whileTap={review ? undefined : pressCard}
      transition={{ default: T.hover, layout: T.big }}
      style={layoutId ? { borderRadius: 24 } : undefined}
      className={cn(
        'w-full flex-col items-start justify-between gap-3 overflow-hidden p-4 md:p-5',
        tw.quick,
        !review && cn('cursor-pointer', isSelected ? 'hover:border-blue-400' : 'hover:border-line-strong'),
        !review && !isSelected ? 'cursor-pointer' : 'bg-highlighted-card',
        isSelected ? 'border-blue-600' : 'border-line',
        className,
      )}
    >
      <div className="flex w-full flex-wrap items-center gap-2">
        {o.tags.map((tag) => (
          <span key={tag} className="whitespace-nowrap rounded-full bg-primary-buttons px-2.5 py-1 text-xs font-medium text-white">
            {tag}
          </span>
        ))}
        <div className="ml-auto flex shrink-0 items-center gap-x-2">
          {timer}
          {!review && (
            <button
              aria-label={isExpanded ? 'Hide details' : 'Show details'}
              onClick={(e) => { e.stopPropagation(); onExpand(o.key); }}
              className={cn('flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] transition hover:bg-white/10', tw.panel, tw.pressIcon, isExpanded && 'rotate-180')}
            >
              <ChevronDownIcon width={16} height={16} />
            </button>
          )}
        </div>
      </div>
      {arrive ? (
        // A new price: the old numbers fade out, then the new ones come in.
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={o.amountOutText} className="w-full" variants={arrive === 'rise' ? rise : fade} initial="hidden" animate="shown" exit="gone">
            {hero}
          </motion.div>
        </AnimatePresence>
      ) : (
        hero
      )}
      {o.warning && (
        <p className="flex w-full items-center gap-x-1.5 text-xs font-normal text-warn">
          <WarningIcon width={16} height={16} className="shrink-0" />
          {o.warning}
        </p>
      )}
      {o.approve === 'noCoin' ? <NoCoinBox text={o.approveBlocked} /> : o.approve === 'once' ? <ApproveBox /> : o.gasless ? <NoGasBox note={o.gaslessNote} /> : <PayGasBox gasText={o.gasText} />}
      {/* Not transition-all: a hidden card (the one left behind by a glide) must hide its details at once. */}
      <div className={cn('w-full transform transition-[opacity,transform]', tw.panel, open ? 'translate-y-0 opacity-100' : '-mt-3 h-0 -translate-y-2 overflow-hidden opacity-0')}>
        <div className="space-y-2 border-t border-line pt-3 text-xs md:text-sm">
          <Row label="You get at least">{o.minOutText}</Row>
          {(!o.gasless || review) && <Row label="Fee">{o.totalFeeText}</Row>}
          {o.gasless && !review && o.networkFeeText && <Row label="Network fee">{o.networkFeeText}</Row>}
          <Row label="Route">
            <span className="inline-flex items-center gap-x-1">
              <span className="font-normal text-secondary">via</span> {o.viaMinter ? 'ckETH minter' : 'Swapic'}
              <img src={o.viaMinter ? ICP_LOGO : SWAPIC_LOGO} alt="" width={14} height={14} className="h-3.5 w-3.5" />
            </span>
          </Row>
        </div>
      </div>
    </MotionCard>
  );
}
