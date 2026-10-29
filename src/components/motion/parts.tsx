'use client';
// Moved from the approved design's motion-parts.tsx (Jeff, 2026-10-29), values in @/lib/motion: MotionCard (the live Card
// as a motion element, so a card can glide), Enter (a presence child), PanelBox and MorphFrame (one panel that changes in
// place: Swap, Review swap, Your swap), flyInto and shrinkInto (the route card flying into the status circle), DrawCheck
// (a check that draws itself in) and ConfirmButton (the wallet step's button with its waiting glow). The prototype's demo
// controls (DemoBar) are not part of the app.
import * as React from 'react';
import { motion, AnimatePresence, animate, useMotionValue } from 'motion/react';
import type { HTMLMotionProps } from 'motion/react';
import { cn } from '@/lib/cn';
import Box from '@/components/ui/box';
import ActionButton from '@/components/ui/action-button';
import Spinner from '@/components/ui/spinner';
import { DUR, EASE, GLOW, T, view as viewVariants, tw, openHeight, useFirstRender, useReducedMotion } from '@/lib/motion';

/** layoutId of a route card: the same id on the Swap list and on Review swap makes it glide between them. */
export const routeLayoutId = (id: string) => `route-${id}`;

// ---------------------------------------------------------------- card

// src/components/ui/card.tsx, class for class.
const CARD = cn(
  'group relative flex w-full items-center gap-x-7 overflow-clip',
  'rounded-3xl p-6 shadow-md',
  'text-xl font-bold leading-7 text-white',
  'bg-input-fields bg-cover bg-center bg-no-repeat',
  'backdrop-blur-[30.07605743408203px] duration-200 hover:bg-[#000000]/75',
  'md:rounded-[36px] md:p-9 md:text-2xl md:leading-8',
);

/** The live Card as a motion element: looks the same at rest, can glide with layoutId. */
export const MotionCard = React.forwardRef<HTMLDivElement, HTMLMotionProps<'div'>>(function MotionCard({ className, ...props }, ref) {
  return <motion.div ref={ref} className={cn(CARD, className as string)} {...props} />;
});

// ---------------------------------------------------------------- presence

/**
 * A child of AnimatePresence: enters with its variants (hidden to shown) and
 * leaves with them (gone). skip: shows at rest without entering (the first
 * child). The choice is kept for its whole life: motion hands it down to parts
 * that mount later, and a label that changed after mount would leave them hidden.
 */
export const Enter = React.forwardRef<HTMLDivElement, HTMLMotionProps<'div'> & { skip?: boolean }>(function Enter({ skip, ...props }, ref) {
  const [initial] = React.useState<false | 'hidden'>(skip ? false : 'hidden');
  return <motion.div ref={ref} initial={initial} animate="shown" exit="gone" {...props} />;
});

// ---------------------------------------------------------------- in place panel

const FrameContext = React.createContext<React.RefObject<HTMLDivElement | null> | null>(null);
/** The MorphFrame's element (parts that fly across views draw in it), or null outside one. */
export const useFrame = () => React.useContext(FrameContext);

// src/components/ui/box.tsx, class for class.
const BOX = cn(
  'relative overflow-y-auto overflow-x-hidden',
  'h-fit w-full md:backdrop-blur-md',
  'flex flex-col items-center justify-between',
  'md:bg-box-background md:bg-center md:bg-no-repeat',
  'md:m-auto md:rounded-3xl md:ring-8 md:ring-box-border',
  'md:max-h-[80vh] md:p-8',
  '*:z-10',
);
// One view inside the frame: the Box's own layout and padding. While it
// leaves it is held at the frame's centre, so a panel that narrows (or
// widens) around it does not slide it sideways.
const VIEW = 'flex w-full flex-col items-center justify-between gap-6 md:p-8 *:z-10 [&[data-motion-pop-id]]:!left-1/2 [&[data-motion-pop-id]]:[translate:-50%_0]';
/** The Swap panel's width: one column, two on large screens once it is wide. */
const SWAP_FRAME = 'h-full md:h-fit md:w-full md:max-w-[537px]';

/** The live Box, unless a MorphFrame already draws it (then only the content). */
export function PanelBox({ className, children }: { className?: string; children: React.ReactNode }) {
  return React.useContext(FrameContext) !== null ? <>{children}</> : <Box className={className}>{children}</Box>;
}

export interface MorphFrameProps {
  /** The view showing. A new value cross fades in place; shared cards glide. */
  view: string;
  /** Swap panel: two columns on large screens (with routes, Review swap, Your swap). */
  wide?: boolean;
  /** The panel's size classes for this view (default: the Swap panel's). Width changes glide (350 ms). */
  frameClass?: string;
  /** The view's own layout classes (added to the Box layout, e.g. a row on desktop). */
  viewClass?: string;
  /** Renders a view's content (its panels use PanelBox). */
  children: (view: string) => React.ReactNode;
}

/**
 * One panel that stays where it is while its content changes: the Box is
 * drawn once, its height glides to the new content (350 ms), the old view
 * fades out on top while the new one fades in, and cards with the same
 * layoutId glide from the old spot to the new one.
 */
export function MorphFrame({ view, wide, frameClass, viewClass, children }: MorphFrameProps) {
  const frame = React.useRef<HTMLDivElement>(null);
  const inner = React.useRef<HTMLDivElement>(null);
  const height = useMotionValue<number | 'auto'>('auto');
  const [moving, setMoving] = React.useState(false);
  const pending = React.useRef(false);
  const running = React.useRef<ReturnType<typeof animate> | null>(null);
  const reduced = useReducedMotion();
  const first = useFirstRender();
  const last = React.useRef(view);
  if (last.current !== view) {
    last.current = view;
    pending.current = true;
  }
  React.useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    // Inside a view the panel follows its content at once (the content
    // animates itself); on a view change it glides to the new height.
    const ro = new ResizeObserver(() => {
      const h = el.offsetHeight;
      if (pending.current || running.current) {
        pending.current = false;
        running.current?.stop();
        setMoving(true);
        running.current = animate(height, h, {
          ...T.big,
          duration: reduced ? 0 : DUR.big,
          onComplete: () => { running.current = null; setMoving(false); },
        });
      } else {
        height.set(h);
      }
    });
    ro.observe(el);
    return () => { ro.disconnect(); running.current?.stop(); };
  }, []);
  // A view change that keeps the height has nothing to glide.
  React.useEffect(() => {
    const t = setTimeout(() => { pending.current = false; }, DUR.big * 1000);
    return () => clearTimeout(t);
  }, [view]);
  return (
    <FrameContext.Provider value={frame}>
      <motion.div
        ref={frame}
        style={{ height }}
        className={cn(BOX, frameClass ?? cn(SWAP_FRAME, wide && 'lg:max-w-[1060px]'), 'md:p-0', 'transition-[max-width]', tw.big, moving && 'overflow-hidden')}
      >
        <div ref={inner} className="w-full">
          <AnimatePresence mode="popLayout">
            <Enter key={view} skip={first} className={cn(VIEW, viewClass)} variants={viewVariants}>
              {children(view)}
            </Enter>
          </AnimatePresence>
        </div>
      </motion.div>
    </FrameContext.Provider>
  );
}

// ---------------------------------------------------------------- fly into

/**
 * Flies a copy of `from` (an element of the view that is leaving) into
 * `target`, scaling it evenly so its text shrinks or grows instead of
 * squashing, and fades it out on the last stretch while the target fades in.
 * fit: 'contain' lands it inside the target (a card into the status circle),
 * 'width' matches the target's width (a card into another card). The copy is
 * drawn in the MorphFrame, so it moves with the panel while the panel changes
 * height. Hides `from` at once (the copy covers it exactly). Returns a stop
 * function.
 */
export function flyInto(from: HTMLElement, target: HTMLElement, frame: HTMLElement, fit: 'contain' | 'width' = 'contain') {
  const fr = frame.getBoundingClientRect();
  const a = from.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const copy = from.cloneNode(true) as HTMLElement;
  copy.removeAttribute('id');
  Object.assign(copy.style, {
    position: 'absolute', left: `${a.left - fr.left + frame.scrollLeft}px`, top: `${a.top - fr.top + frame.scrollTop}px`,
    width: `${a.width}px`, height: `${a.height}px`, margin: '0', zIndex: '30', pointerEvents: 'none',
    transform: 'none', transformOrigin: '50% 50%', visibility: 'visible', opacity: '1', transition: 'none',
  });
  frame.appendChild(copy);
  // filter, not visibility or opacity: a child with transition-all keeps showing while visibility
  // transitions, and motion rewrites opacity on a card with a layoutId.
  from.style.transition = 'none';
  from.style.filter = 'opacity(0)';
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const scale = fit === 'width' ? b.width / a.width : Math.min(b.width / a.width, b.height / a.height);
  const run = animate(copy, { x: [0, dx], y: [0, dy], scale: [1, scale], opacity: [1, 1, 0] }, {
    duration: DUR.big,
    ease: EASE.enter,
    opacity: { duration: DUR.big, times: [0, 0.55, 1], ease: 'linear' },
  });
  run.then(() => copy.remove());
  return () => { run.stop(); copy.remove(); };
}
/** A route card shrinking into the status circle. */
export const shrinkInto = (from: HTMLElement, target: HTMLElement, frame: HTMLElement) => flyInto(from, target, frame, 'contain');

const visible = (el: Element) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
/**
 * Pieces marked data-fly="name" fly from the leaving view (inside `fromScope`)
 * to the piece with the same name in the new view (inside `toScope`): e.g. an
 * order row's tokens and status pill land where the order page shows them.
 * Hidden duplicates (phone and desktop markup) are skipped.
 */
export function flyMatching(fromScope: Element, toScope: Element, frame: HTMLElement) {
  const stops: (() => void)[] = [];
  toScope.querySelectorAll<HTMLElement>('[data-fly]').forEach((to) => {
    if (!visible(to)) return;
    const from = [...fromScope.querySelectorAll<HTMLElement>(`[data-fly="${to.dataset.fly}"]`)].find(visible);
    if (from) stops.push(flyInto(from, to, frame, 'contain'));
  });
  return () => stops.forEach((s) => s());
}

// ---------------------------------------------------------------- check

/** The live CheckIcon, drawn in (350 ms). Reduce motion: it fades in. still: drawn already (a fixed screen). */
export function DrawCheck({ size = 24, delay = 0, className, still }: { size?: number; delay?: number; className?: string; still?: boolean }) {
  const reduced = useReducedMotion();
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" width={size} height={size} viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <motion.path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m4.5 12.75 6 6 9-13.5"
        initial={still ? false : reduced ? { opacity: 0 } : { pathLength: 0 }}
        animate={reduced ? { opacity: 1 } : { pathLength: 1 }}
        transition={{ ...T.draw, delay }}
      />
    </svg>
  );
}

// ---------------------------------------------------------------- wallet confirm

/**
 * The main button of a step the wallet signs: shows its label; while the
 * wallet asks it shows a spinner and "Confirm in your wallet" and breathes a
 * soft blue glow; after a cancel a short line opens under it.
 */
export function ConfirmButton({ label, waiting, cancelled, disabled, onClick }: { label?: React.ReactNode; waiting?: boolean; cancelled?: boolean; disabled?: boolean; onClick?: () => void }) {
  const reduced = useReducedMotion();
  return (
    <div className="w-full">
      <motion.div
        className="rounded-xl"
        initial={false}
        animate={{ boxShadow: waiting ? (reduced ? GLOW.on : [GLOW.off, GLOW.on]) : GLOW.off }}
        transition={waiting && !reduced ? { duration: DUR.breathe, ease: EASE.breathe, repeat: Infinity, repeatType: 'mirror' } : T.enter}
      >
        <ActionButton isDisabled={!!disabled} onClick={disabled || waiting ? undefined : onClick}>
          {waiting ? (
            <span className="inline-flex items-center justify-center gap-x-2">
              <span className="w-5"><Spinner width={18} height={18} className="fill-white text-white/30" /></span>
              Confirm in your wallet
            </span>
          ) : label}
        </ActionButton>
      </motion.div>
      <AnimatePresence initial={false}>
        {cancelled && (
          <motion.p
            className="overflow-hidden text-center text-sm font-normal text-[#898989]"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto', transition: openHeight(true, reduced) }}
            exit={{ opacity: 0, height: 0, transition: openHeight(false, reduced) }}
          >
            <span className="block pt-2">You cancelled in your wallet.</span>
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
