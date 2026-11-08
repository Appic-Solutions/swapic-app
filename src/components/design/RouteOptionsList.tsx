// Route list: every route in a column on desktop. The column is as tall as the Swap panel's left side and scrolls inside
// it, fading at the edge with more behind it (Jeff 2026-11-05); a card picked or opened low in the list scrolls into view.
// Phones and tablets show only the top suggested route at full width, with no title and no sideways scroll; the others
// stay in the page, hidden by CSS, so the picked route is always the one shown.
// States: ready (route cards), loading (the skeleton card), empty.
// The caller owns the selection (selectedKey, onSelect); only which card is open stays inside.
// Phones (Jeff, 2026-10-31): the route card starts open; desktop opens the picked one. The chevron closes and opens each.
// Motion (src/lib/motion.ts): cards that arrive after a quote fade up one after another; in the in place
// panel the cards not picked fade out on Review swap while the picked one glides there (shared layoutId).
import * as React from 'react';
import { preload } from 'react-dom';
import { motion } from 'motion/react';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/card';
import RouteOptionSkeleton from '@/components/ui/route-option-skeleton';
import { routeLayoutId } from '@/components/motion/parts';
import { useScrollFade } from '@/components/ui/use-scroll-fade';
import { DUR, fade, listItem, useMounted, usePhone, useReducedMotion } from '@/lib/motion';
import RouteOption, { type RouteOptionView } from './RouteOption';

export interface RouteOptionsListProps {
  options: RouteOptionView[];
  /** The token received: needs symbol and logo. */
  toToken: { symbol: string; logo: string };
  /** ready shows the cards, loading the skeleton cards, empty the no-route message. */
  state: 'ready' | 'loading' | 'empty';
  selectedKey: string | null;
  onSelect: (key: string) => void;
  /** Title and text of the empty card (default: no routes found). */
  emptyTitle?: string;
  emptyText?: string;
  /** The list itself just appeared in a panel already showing: its first cards fade up too. */
  enter?: boolean;
  /** The quote timer, on the picked card. */
  timer?: React.ReactNode;
}

/** The no route picture: asked for as soon as a route column shows, so it is there when the empty state comes. */
const EMPTY_IMAGE = '/images/empty.png';

export default function RouteOptionsList({ options, toToken, state, selectedKey, onSelect, emptyTitle = 'No routes found', emptyText = 'No route can swap this amount right now. Try a smaller amount or another token.', enter, timer }: RouteOptionsListProps) {
  preload(EMPTY_IMAGE, { as: 'image' });
  const first = options[0]?.key;
  const phone = usePhone();
  // which cards are open: on phones all of them, on desktop the picked one
  const opened = (): Set<string> => new Set(phone ? options.map((o) => o.key) : [selectedKey ?? first].filter((k): k is string => !!k));
  const [expanded, setExpanded] = React.useState<Set<string>>(opened);
  // New routes: they start open as above, before the first paint (a card painted shut for one frame moved the button 65 px).
  React.useLayoutEffect(() => { setExpanded(opened()); }, [first]); // eslint-disable-line react-hooks/exhaustive-deps
  // phones open and close each card on its own; desktop keeps one open at a time
  const toggle = (key: string) => {
    setExpanded((cur) => {
      if (!phone) return cur.has(key) ? new Set() : new Set([key]);
      const next = new Set(cur);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
    reveal(key);
  };
  const list = React.useRef<HTMLDivElement>(null);
  const edge = useScrollFade(list);
  const reduced = useReducedMotion();
  // A card picked or opened low in the column comes up into view, once its details have opened.
  const reveal = (key: string) => setTimeout(() => {
    const box = list.current;
    const cellEl = box?.querySelector<HTMLElement>(`[data-route="${CSS.escape(key)}"]`);
    if (box && cellEl && box.scrollHeight > box.clientHeight) box.scrollTo({ top: cellEl.offsetTop, behavior: reduced ? 'auto' : 'smooth' });
  }, DUR.panel * 1000);
  // What shows after the first render (routes after loading) arrives with a stagger.
  const mounted = useMounted() || !!enter;
  // below lg only this route shows: the picked one, or the first
  const top = options.find((o) => o.key === selectedKey)?.key ?? first;
  const cell = (key: React.Key, i: number, child: React.ReactNode, picked = false, hidden = false) => (
    // The picked card stays solid: it glides to the next view instead of fading.
    <motion.div key={key} data-route={key} variants={picked ? undefined : fade} className={'h-fit w-full shrink-0 ' + (hidden ? 'max-lg:hidden' : '')}>
      <motion.div {...(mounted ? listItem(i) : {})}>{child}</motion.div>
    </motion.div>
  );
  // Below lg one route card shows under the amount: an invisible loading card shares its grid cell, so the column keeps
  // one height while it loads, shows routes or shows none, and the panel never jumps (the tester's report, 2026-11-08).
  // From lg the column is as tall as the panel's left side in every state already.
  const cellAll = 'col-start-1 row-start-1';
  return (
    <div className="grid w-full lg:flex lg:h-full lg:flex-col lg:items-start">
      <div aria-hidden className={cn(cellAll, 'invisible w-full lg:hidden')}><RouteOptionSkeleton open /></div>
      {state === 'empty' ? (
        <motion.div variants={fade} className={cn(cellAll, 'w-full lg:h-full')} {...(mounted ? listItem(0) : {})}>
          <Card className="h-full cursor-auto flex-col items-center justify-center gap-3 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={EMPTY_IMAGE} alt="" width={80} height={80} />
            <p className="text-xl font-semibold">{emptyTitle}</p>
            <p className="text-sm font-normal text-secondary">{emptyText}</p>
          </Card>
        </motion.div>
      ) : (
        // layoutScroll: the picked card's glide to Review swap starts from where the scrolled list shows it
        <motion.div ref={edge.ref} layoutScroll className={cn(cellAll, 'no-scrollbar relative flex w-full flex-col gap-4 lg:h-full lg:overflow-y-auto', edge.fade)}>
          {state === 'loading'
            ? [cell('s1', 0, <RouteOptionSkeleton open />), cell('s2', 1, <RouteOptionSkeleton />, false, true)]
            : options.map((o, i) =>
                cell(
                  o.key,
                  i,
                  <RouteOption
                    option={o}
                    toToken={toToken}
                    layoutId={selectedKey === o.key ? routeLayoutId(o.key) : undefined}
                    isSelected={selectedKey === o.key}
                    timer={selectedKey === o.key ? timer : undefined}
                    arrive="rise"
                    isExpanded={expanded.has(o.key)}
                    onSelect={(key) => { onSelect(key); reveal(key); }}
                    onExpand={toggle}
                  />,
                  selectedKey === o.key,
                  o.key !== top,
                ),
              )}
        </motion.div>
      )}
    </div>
  );
}
