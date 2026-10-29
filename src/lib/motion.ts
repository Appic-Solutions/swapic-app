'use client';
// Moved as is from the approved design's motion.ts (parts 1 and 2, approved by Jeff 2026-10-29; the lead's frozen
// snapshot .superpowers/sdd/2026-10-29-lead/motion-part2-approved): every value unchanged.
// Swapic motion: every duration, easing, shared variant and motion class in
// one module, so the live app can copy it as is.
//
// Feel: smooth and calm. Things glide and fade; a movement starts quickly and
// slows gently to a stop. Nothing bounces, no spring overshoot, no shaking.
// Reduce motion (the OS setting) leaves plain fades only: MotionRoot sets
// MotionConfig reducedMotion="user" (motion then skips transforms and layout
// glides), and the classes below reset their hover lifts and press sinks.
import * as React from 'react';
import { MotionConfig, LayoutGroup, PresenceContext, useReducedMotion } from 'motion/react';
import type { Transition, Variants } from 'motion/react';

/** Durations in seconds. */
export const DUR = {
  /** Hover and press feedback. */
  hover: 0.15,
  /** Cards and panels entering, menus opening, token pages. */
  panel: 0.25,
  /** The big in place change (Swap, Review swap, Your swap), shared glides, the tab highlight. */
  big: 0.35,
  /** Anything leaving: a bit faster than entries. */
  exit: 0.18,
  /** Between list items. */
  stagger: 0.04,
  /** Entering parts wait this long after a change starts, so the exit leads (less double text). */
  lead: 0.14,
  /** A check drawing itself in, a step line filling. */
  draw: 0.35,
  /** One half of the waiting glow (it breathes in, then out). */
  breathe: 1.6,
  /** One pass of the skeleton highlight. */
  shimmer: 1.6,
  /** The soft glow behind a delivered swap fading in. */
  glow: 0.6,
};

/** The waiting glow around a button the wallet signs: at rest and at its brightest. */
export const GLOW = {
  off: '0 0 0px 0px rgba(59,130,246,0)',
  on: '0 0 26px 2px rgba(59,130,246,0.45)',
};

/** A card flying into a bigger card grows at most this much (more reads as a zoom). */
export const FLY_GROW = 1.1;

/** Times in milliseconds, for timers. */
export const MS = {
  /** A copy button shows its check this long. */
  copied: 1000,
  /** Pause after the last wallet check draws, before Your swap. */
  hold: 400,
};

/** Cubic bezier curves. */
export const EASE = {
  /** Entries: fast start, gentle stop. */
  enter: [0.22, 1, 0.36, 1] as [number, number, number, number],
  /** Exits: leave steadily, a little faster. */
  exit: [0.4, 0, 1, 1] as [number, number, number, number],
  /** The waiting glow: slow in, slow out. */
  breathe: [0.37, 0, 0.63, 1] as [number, number, number, number],
};

export const T = {
  hover: { duration: DUR.hover, ease: EASE.enter },
  enter: { duration: DUR.panel, ease: EASE.enter },
  big: { duration: DUR.big, ease: EASE.enter },
  exit: { duration: DUR.exit, ease: EASE.exit },
  draw: { duration: DUR.draw, ease: EASE.enter },
} satisfies Record<string, Transition>;

// ---------------------------------------------------------------- variants
// Labels: hidden (before entering), shown (at rest), gone (leaving).

/** Plain fade. */
export const fade: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: T.enter },
  gone: { opacity: 0, transition: T.exit },
};
/** Fade with a short rise (8 px), for cards that arrive in a column. */
export const rise: Variants = {
  hidden: { opacity: 0, y: 8 },
  shown: { opacity: 1, y: 0, transition: T.enter },
  gone: { opacity: 0, transition: T.exit },
};
/** Token pages: slide in from 16 px to the right (the live slide-in), fade out. */
export const page: Variants = {
  hidden: { opacity: 0, x: 16 },
  shown: { opacity: 1, x: 0, transition: T.enter },
  gone: { opacity: 0, x: 16, transition: T.exit },
};
/** A view inside the in place panel: its fading parts come in together, just after the old ones start leaving. */
export const view: Variants = {
  hidden: {},
  shown: { transition: { delayChildren: DUR.lead } },
  gone: {},
};
/** Menus: grow out of the button that opened them (set transformOrigin there). */
export const menu: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: -4 },
  shown: { opacity: 1, scale: 1, y: 0, transition: T.enter },
  gone: { opacity: 0, scale: 0.96, y: -4, transition: T.exit },
};
/** Hover and press for motion elements (same values as tw.lift and tw.press*). */
export const lift = { y: -2 };
export const press = { scale: 0.97 };
export const pressCard = { scale: 0.99 };

/** Something new in a list (rows after loading, route cards after a quote). */
export const listItem = (i: number) => ({
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { ...T.enter, delay: i * DUR.stagger } },
});

/**
 * Something new at the top of a list (a History row, a feed card): it opens
 * from nothing, the list below glides down (350 ms), and it fades in. gap: the
 * list's gap in px, which it also opens.
 */
export const arriveTop = (gap: number) => ({
  initial: { height: 0, opacity: 0, marginBottom: -gap, overflow: 'hidden' },
  animate: { height: 'auto', opacity: 1, marginBottom: 0, transitionEnd: { overflow: 'visible' }, transition: T.big },
});

// ---------------------------------------------------------------- classes
// Tailwind classes with the same values (Tailwind needs literal strings, so
// these repeat the numbers above; change both together).

export const tw = {
  /** Hover and press transition: 150 ms, entry easing. */
  quick: 'transition duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]',
  /** Panel speed: things that open, rotate or change size (250 ms). */
  panel: 'duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
  /** The big change (350 ms), e.g. the Swap panel widening for routes. Reduce motion: instant. */
  big: 'duration-[350ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
  /** Buttons sink a little when pressed. */
  press: 'active:scale-[0.97] motion-reduce:active:scale-100',
  /** Wide rows and token cards. */
  pressRow: 'active:scale-[0.98] motion-reduce:active:scale-100',
  /** Big cards (route cards). */
  pressCard: 'active:scale-[0.99] motion-reduce:active:scale-100',
  /** Small round icon buttons (copy, flip, chevrons). */
  pressIcon: 'active:scale-90 motion-reduce:active:scale-100',
  /** Cards lift 2 px on hover. */
  lift: 'hover:-translate-y-0.5 motion-reduce:hover:translate-y-0',
  /** Brighter edge on hover for cards without a border. */
  edge: 'hover:ring-1 hover:ring-white/15',
  /** Skeleton shimmer on a Skeleton (replaces its pulse): a soft light band crosses it every 1.6 s; 70% opacity is the pulse's middle, so it looks as dim at rest. */
  shimmer: 'animate-shimmer bg-[linear-gradient(100deg,transparent_30%,rgba(255,255,255,0.14)_50%,transparent_70%)] bg-[length:200%_100%] opacity-70 motion-reduce:animate-pulse',
  /** The soft green glow behind a delivered swap's circle. */
  glowDelivered: 'bg-[radial-gradient(circle,rgba(18,183,106,0.42)_0%,rgba(18,183,106,0.16)_42%,rgba(18,183,106,0)_70%)]',
  /** Skeleton shimmer for every Skeleton inside (real skeleton components). */
  shimmerAll: '[&_.animate-pulse]:animate-shimmer [&_.animate-pulse]:bg-[linear-gradient(100deg,transparent_30%,rgba(255,255,255,0.14)_50%,transparent_70%)] [&_.animate-pulse]:bg-[length:200%_100%] [&_.animate-pulse]:opacity-70 motion-reduce:[&_.animate-pulse]:animate-pulse',
};

/** Opening a part by height (0 to auto): enters and leaves like the rest; reduce motion opens it at once (it still fades). */
export const openHeight = (open: boolean, reduced: boolean | null): Transition =>
  reduced ? { height: { duration: 0 }, opacity: open ? T.enter : T.exit } : open ? T.enter : T.exit;

// ---------------------------------------------------------------- helpers

/** True only on a component's first render: keys a presence child's initial so the first one does not animate. */
export function useFirstRender() {
  const first = React.useRef(true);
  React.useEffect(() => { first.current = false; }, []);
  return first.current;
}

/** True once the component has rendered before: things that appear after that animate in. */
export function useMounted() {
  const mounted = React.useRef(false);
  React.useEffect(() => { mounted.current = true; }, []);
  return mounted.current;
}

/** Inside an AnimatePresence (its children can play exits). */
export const useInPresence = () => React.useContext(PresenceContext) !== null;

export { useReducedMotion };

/** Phone layout (below md, 768 px), read once at mount. */
export const usePhone = () => React.useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches)[0];

// Drawers (vaul) slide with their own CSS animation; these rules give them the
// panel timings (enter 250 ms, leave 180 ms) for the sheet and its overlay.
const bezier = (e: number[]) => `cubic-bezier(${e.join(',')})`;
const SHEET_CSS =
  `[data-vaul-drawer][data-state=open],[data-vaul-overlay][data-state=open]{animation-duration:${DUR.panel}s!important;animation-timing-function:${bezier(EASE.enter)}!important}` +
  `[data-vaul-drawer][data-state=closed],[data-vaul-overlay][data-state=closed]{animation-duration:${DUR.exit}s!important;animation-timing-function:${bezier(EASE.exit)}!important}` +
  // Reduce motion: the sheet appears in place; the overlay still fades.
  `@media (prefers-reduced-motion: reduce){[data-vaul-drawer][data-state]{animation-duration:0.01s!important}}`;
function useSheetTimings() {
  React.useEffect(() => {
    if (typeof document === 'undefined' || document.getElementById('swapic-motion')) return;
    const s = document.createElement('style');
    s.id = 'swapic-motion';
    s.textContent = SHEET_CSS;
    document.head.appendChild(s);
  }, []);
}

/**
 * Wrap the app (or each screen) in this: reduce motion follows the OS, the
 * default transition is the entry one, and layout ids (shared glides) stay
 * inside this tree, so two screens on one page never glide into each other.
 */
export function MotionRoot({ children }: { children?: React.ReactNode }) {
  const id = React.useId();
  useSheetTimings();
  return React.createElement(MotionConfig, { reducedMotion: 'user', transition: T.enter }, React.createElement(LayoutGroup, { id }, children));
}
