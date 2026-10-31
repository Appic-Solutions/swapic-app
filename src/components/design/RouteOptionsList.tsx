'use client';
// Route list: the live BridgeOptionsList markup (column on desktop, sideways
// scroll row on phones), titled "Route Options". It fills its parent's height
// on desktop and scrolls, so the Swap panel ends at the Review swap button.
// States: ready (route cards), loading (the live skeleton cards), empty.
// Moved from the design's RouteOptionsList.tsx (sha e53b49171544): the caller owns the
// selection (selectedKey, onSelect); only which card is open stays inside.
// Motion (approved 2026-10-29, src/lib/motion.ts): skeletons shimmer; cards that arrive after a quote fade up one after
// another; in the in place panel the cards not picked fade out on Review swap while the picked one glides there (shared
// layoutId).
import * as React from 'react';
import { motion } from 'motion/react';
import { Card } from '@/components/ui/card';
import RouteOptionSkeleton from '@/components/ui/route-option-skeleton';
import { routeLayoutId } from '@/components/motion/parts';
import { fade, listItem, tw, useMounted } from '@/lib/motion';
import RouteOption, { type RouteOptionView } from './RouteOption';
import type { RadialCountDownProps } from '@/components/ui/radial-count-down';

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
  timer?: RadialCountDownProps;
}

export default function RouteOptionsList({ options, toToken, state, selectedKey, onSelect, emptyTitle = 'No routes found', emptyText = 'No route can swap this amount right now. Try a smaller amount or another token.', enter, timer }: RouteOptionsListProps) {
  const first = options[0]?.key;
  const [expanded, setExpanded] = React.useState<string | undefined>(selectedKey ?? first);
  // New routes: the picked one starts open.
  React.useEffect(() => { setExpanded(selectedKey ?? first); }, [first]); // eslint-disable-line react-hooks/exhaustive-deps
  // What shows after the first render (routes after loading) arrives with a stagger.
  const mounted = useMounted() || !!enter;
  const row = React.useRef<HTMLDivElement>(null);
  const mountedOnce = React.useRef(false);
  React.useEffect(() => { mountedOnce.current = true; }, []);
  // Phones: a picked card further along the row starts in view.
  React.useLayoutEffect(() => {
    const i = options.findIndex((o) => o.key === selectedKey);
    const el = row.current?.children[i] as HTMLElement | undefined;
    if (row.current && el && i > 0 && row.current.scrollWidth > row.current.clientWidth) row.current.scrollLeft = el.offsetLeft - 24;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const cell = (key: React.Key, i: number, child: React.ReactNode, picked = false, single = false) => (
    // The picked card stays solid: it glides to the next view instead of fading.
    <motion.div key={key} variants={picked ? undefined : fade} className={'h-fit shrink-0 ' + (single ? 'w-full' : 'w-[280px] md:w-full')}>
      <motion.div {...(mounted ? listItem(i) : {})}>{child}</motion.div>
    </motion.div>
  );
  return (
    <div className="flex flex-col items-start md:pr-2 lg:h-full lg:w-full">
      <motion.p variants={fade} {...(enter && !mountedOnce.current ? listItem(0) : {})} className="mb-5 text-[26px] font-bold leading-7 text-primary md:hidden md:text-[40px] md:leading-10">Route Options</motion.p>
      {state === 'empty' ? (
        <motion.div variants={fade} className="w-full lg:h-full" {...(mounted ? listItem(0) : {})}>
          <Card className="cursor-auto flex-col items-center justify-center gap-3 text-center hover:bg-[#000000]/0 lg:h-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/empty.png" alt="" width={80} height={80} />
            <p className="text-xl font-bold">{emptyTitle}</p>
            <p className="text-sm font-normal text-[#898989]">{emptyText}</p>
          </Card>
        </motion.div>
      ) : (
        <div ref={row} className={'flex w-full gap-4 overflow-x-auto hide-scrollbar lg:h-full lg:flex-col lg:overflow-y-auto ' + (state === 'loading' ? tw.shimmerAll : '')}>
          {state === 'loading'
            ? [cell('s1', 0, <RouteOptionSkeleton />), cell('s2', 1, <RouteOptionSkeleton />)]
            : options.map((o, i) =>
                cell(
                  o.key,
                  i,
                  <RouteOption
                    option={o}
                    toToken={toToken}
                    layoutId={routeLayoutId(o.key)}
                    isSelected={selectedKey === o.key}
                    timer={selectedKey === o.key ? timer : undefined}
                    isExpanded={expanded === o.key}
                    onSelect={onSelect}
                    onExpand={(key) => setExpanded(expanded === key ? undefined : key)}
                  />,
                  selectedKey === o.key,
                  options.length < 2,
                ),
              )}
        </div>
      )}
    </div>
  );
}
