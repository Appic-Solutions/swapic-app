// Route list: the live BridgeOptionsList markup (column on desktop, sideways
// scroll row on phones), titled "Route Options". It fills its parent's height
// on desktop and scrolls, so the Swap panel ends at the Review swap button.
// States: ready (route cards), loading (the live skeleton cards), empty.
// Moved from the design's RouteOptionsList.tsx (sha e53b49171544): the caller owns the
// selection (selectedKey, onSelect); only which card is open stays inside.
import * as React from 'react';
import { Card } from '@/components/ui/card';
import RouteOptionSkeleton from '@/components/ui/route-option-skeleton';
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
}

export default function RouteOptionsList({ options, toToken, state, selectedKey, onSelect, emptyTitle = 'No routes found', emptyText = 'No route can swap this amount right now. Try a smaller amount or another token.' }: RouteOptionsListProps) {
  const first = options[0]?.key;
  const [expanded, setExpanded] = React.useState<string | undefined>(first);
  React.useEffect(() => { setExpanded(first); }, [first]);
  const cell = (key: React.Key, child: React.ReactNode, single = false) => (
    <div key={key} className={'h-fit shrink-0 ' + (single ? 'w-full' : 'w-[280px] md:w-full')}>{child}</div>
  );
  return (
    <div className="flex animate-slide-in flex-col items-start opacity-0 md:pr-2 lg:h-full lg:w-full">
      <p className="mb-5 text-[26px] font-bold leading-7 text-primary md:hidden md:text-[40px] md:leading-10">Route Options</p>
      {state === 'empty' ? (
        <Card className="cursor-auto flex-col items-center justify-center gap-3 text-center hover:bg-[#000000]/0 lg:h-full">
          <img src="/images/empty.png" alt="" width={80} height={80} />
          <p className="text-xl font-bold">{emptyTitle}</p>
          <p className="text-sm font-normal text-[#898989]">{emptyText}</p>
        </Card>
      ) : (
        <div className="flex w-full gap-4 overflow-x-auto hide-scrollbar lg:h-full lg:flex-col lg:overflow-y-auto">
          {state === 'loading'
            ? [cell(1, <RouteOptionSkeleton />), cell(2, <RouteOptionSkeleton />)]
            : options.map((o) =>
                cell(
                  o.key,
                  <RouteOption
                    option={o}
                    toToken={toToken}
                    isSelected={selectedKey === o.key}
                    isExpanded={expanded === o.key}
                    onSelect={onSelect}
                    onExpand={(key) => setExpanded(expanded === key ? undefined : key)}
                  />,
                  options.length < 2,
                ),
              )}
        </div>
      )}
    </div>
  );
}
