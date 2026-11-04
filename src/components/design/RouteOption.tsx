// Route option card: the live BridgeOption (src/app/(panel)/bridge/_components/
// select-token/BridgeOption.tsx) with these design changes Jeff asked for:
// 1. the amount out shows its dollar value under it;
// 2. the "via" pill never breaks across lines (it moves to its own line on
//    narrow phone cards instead);
// 3. every route shows Swapic as the provider, and the details show only the
//    total fee, who pays gas and the time (no internal fee names);
// 4. a big price impact shows a yellow warning under the amount;
// 5. on the review page (review) the card is the live BridgeReview card:
//    always open, no chevron, not clickable.
// Moved from the design's RouteOption.tsx (sha 809fa5d65615): it shows texts the caller
// formats with @/lib/money (no number math here), and one badge pill per tag.
// Motion (approved 2026-10-29, src/lib/motion.ts): the card is a motion element (MotionCard), so with a layoutId it
// glides from the Swap list to Review swap and back; it lifts 2 px with a brighter edge on hover and sinks a little when
// pressed.
// Quote timer (Jeff's pick 2026-10-31, the design's quote-timer.tsx option B and its RouteOption slots): the picked card
// shows the countdown label in its top row (timer); new numbers arrive in place: the old amount fades out, the new one
// fades in rising 8 px (arrive, the design's rise).
import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDownIcon, ClockIcon, FireIcon } from '@/components/icons';
import { MotionCard } from '@/components/motion/parts';
import { T, fade, rise, tw, lift, pressCard, usePhone } from '@/lib/motion';
import { cn } from '@/lib/cn';
import { SWAPIC_LOGO } from './swapic-logo';

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
  totalFeeText: string;
  /** The Gas row of the details. */
  gasText: string;
  /** Yellow warning under the amount, e.g. when the price impact is big. */
  warning?: string;
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

export default function RouteOption({ isSelected, isExpanded, onSelect, onExpand, option, className, toToken, review, layoutId, cardRef, timer, arrive }: RouteOptionProps) {
  const phone = usePhone();
  const amount = (
    <>
      <p className="text-base lg:text-xl">~ {option.amountOutText + ' ' + toToken.symbol}</p>
      <p className="text-xs font-normal text-[#898989]">{option.usdOutText ?? ''}</p>
    </>
  );
  return (
    <MotionCard
      ref={cardRef}
      onClick={() => onSelect(option.key)}
      // The glide only runs between views (the list and the review page have different dependencies); opening the
      // details never glides.
      layoutId={layoutId}
      layoutDependency={layoutId ? (review ? 'review' : 'list') : undefined}
      layoutCrossfade={false}
      // Lift and press run through motion here (a glide leaves an inline transform that would block CSS hover transforms).
      whileHover={review ? undefined : lift}
      whileTap={review ? undefined : pressCard}
      transition={{ default: T.hover, layout: T.big }}
      style={layoutId ? { borderRadius: phone ? 20 : 36 } : undefined}
      className={cn(
        'w-full flex-col items-start justify-between gap-3 overflow-hidden rounded-[20px] border !py-4 px-4',
        'md:rounded-[36px] md:px-6',
        tw.quick,
        review ? 'cursor-auto hover:bg-[#000000]/0' : cn('cursor-pointer', isSelected ? 'hover:border-blue-500' : 'hover:border-gray-500'),
        'bg-highlighted-card',
        isSelected ? 'border-blue-600' : 'border-gray-700',
        className,
      )}
    >
      <div className="flex w-full items-center justify-between">
        <div className="flex flex-1 items-center gap-x-2">
          {option.tags.map((tag) => (
            <p key={tag} className={cn('w-fit rounded-[10px] px-2 py-1 text-xs font-thin text-muted md:text-sm', 'bg-primary-buttons text-white')}>
              {tag}
            </p>
          ))}
          {!option.gasless && <span className="text-xs font-normal text-[#898989]">You pay gas</span>}
        </div>
        {timer && <div className={cn('flex shrink-0 items-center', !review && 'mr-2')}>{timer}</div>}
        {!review && (
          <button
            onClick={(e) => { e.stopPropagation(); onExpand(option.key); }}
            className={cn('ml-auto flex items-center rounded-[10px] bg-gray-400 bg-opacity-20 p-2 transition hover:bg-opacity-30', tw.panel, tw.pressIcon, isExpanded && 'rotate-180')}
          >
            <ChevronDownIcon width={10} height={10} />
          </button>
        )}
      </div>
      <div className="flex w-full flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-x-2">
          <div className="rounded-full border-2 border-white/50 p-1 md:p-1">
            <div className="relative h-7 w-7 lg:h-10 lg:w-10">
              <img src={toToken.logo} alt="" className="absolute inset-0 h-full w-full rounded-full object-contain" />
            </div>
          </div>
          {arrive ? (
            // A new price: the old numbers fade out, then the new ones come in.
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={option.amountOutText} className="flex flex-col" variants={arrive === 'rise' ? rise : fade} initial="hidden" animate="shown" exit="gone">
                {amount}
              </motion.div>
            </AnimatePresence>
          ) : (
            <div className="flex flex-col">{amount}</div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-x-1 whitespace-nowrap rounded-xl bg-white px-2 py-1 md:rounded-2xl md:px-4">
          <span className="text-xs text-blue-600 lg:text-sm">via Swapic</span>
          <img src={SWAPIC_LOGO} alt="" width={16} height={16} className="min-h-4 min-w-4 rounded-full bg-black p-0.5" />
        </div>
      </div>
      {option.warning && (
        <p className="flex w-full items-center gap-x-1.5 text-xs font-normal text-yellow-600">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {option.warning}
        </p>
      )}
      <div className="flex w-full items-end justify-end gap-x-4">
        <span className="flex w-max items-center gap-x-1">
          {/* Jeff 2026-11-04: a gasless card says so beside the gas icon, never a dollar figure */}
          <p className="text-xs font-thin text-primary">{option.gasless ? 'Gasless' : option.totalFeeText}</p>
          <FireIcon width={15} height={15} className="text-primary" />
        </span>
        <span className="flex w-max items-center gap-x-1">
          <p className="text-xs font-thin text-primary">{option.durationText}</p>
          <ClockIcon width={15} height={15} className="text-primary" />
        </span>
      </div>
      {/* Not transition-all: a hidden card (the one left behind by a glide) must hide its details at once. */}
      <div className={cn('w-full border-t border-gray-700', 'transform transition-[opacity,transform,padding]', tw.panel, isExpanded ? 'translate-y-0 pt-3 opacity-100' : 'h-0 -translate-y-2 overflow-hidden opacity-0')}>
        <div className="space-y-3">
          <p className="text-sm font-medium">Option Details:</p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm"><span className="text-muted">Total Fee:</span><span>{option.totalFeeText}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted">Gas:</span><span>{option.gasText}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted">Estimated Time:</span><span>{option.durationText}</span></div>
          </div>
        </div>
      </div>
    </MotionCard>
  );
}
