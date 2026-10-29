'use client';
// The token page: moved from the design's swap-screens.tsx TokenSelect (the approved static look, as the design bundle
// built 2026-10-29 14:46 holds it), wired to data: chain circles from GET /v2/chains, tokens from GET /v2/tokens (50 a
// page, more as the list scrolls), balances beside them, a pasted address found on no list flagged.
import * as React from 'react';
import Box from '@/components/ui/box';
import BoxHeader from '@/components/ui/box-header';
import ChainItem from '@/components/ui/chain-item';
import TokenListItem from '@/components/ui/token-list-item';
import TokenSkeleton from '@/components/ui/token-skeleton';
import Skeleton from '@/components/ui/skeleton';
import type { UiToken } from '@/components/ui/token-types';
import { chainLogo, chainNumber } from '@/lib/explorer';
import { useChains, useTokenList } from '../tokens';
import { motion } from 'motion/react';
import { cn } from '@/lib/cn';
import { listItem, page, tw, useInPresence, useMounted } from '@/lib/motion';
import { useFrame } from '@/components/motion/parts';

export interface TokenSelectProps {
  title: string;
  /** The CAIP-2 chain shown first. */
  chain: string;
  selected: UiToken | null;
  onBack: () => void;
  onSelect: (t: UiToken) => void;
  /** Only these chains (CAIP-2), e.g. the chains a withdrawal can pay to. */
  chains?: string[];
  /** A fixed list per chain instead of the quoter's (plan 3's "Receive on"). */
  fixedTokens?: Record<string, UiToken[]>;
  /** Shown instead of the search box. */
  note?: React.ReactNode;
  /** The search box starts with this (a token address from a shared link: an unlisted one shows its warning first). */
  initialQuery?: string;
}

/** The design's order of the chain circles (design data.ts swapicChains); a chain the design does not name goes last. */
const DESIGN_ORDER = ['icp:737ba355e855bd4b61279056603e0550', 'eip155:1', 'eip155:8453', 'eip155:42161', 'eip155:137'];
const place = (c: string) => (DESIGN_ORDER.includes(c) ? DESIGN_ORDER.indexOf(c) : DESIGN_ORDER.length);

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function TokenSelect({ title, chain: start, selected, onBack, onSelect, chains: only, fixedTokens, note, initialQuery }: TokenSelectProps) {
  const [chain, setChain] = React.useState(start);
  const [query, setQuery] = React.useState(initialQuery ?? '');
  const searched = useDebounced(query.trim(), 300);
  const { chains } = useChains();
  const list = useTokenList(chain, fixedTokens ? '' : searched);
  const fixed = fixedTokens?.[chain];
  const tokens = fixed ?? list.tokens;
  const loading = fixed ? false : list.isLoading;
  const pasted = !fixed && list.pasted;
  // Rows that show after the first render (after loading, a chain switch) fade up one after another.
  const mounted = useMounted();
  // Opened inside the Swap page's AnimatePresence: slides in and out.
  const opened = useInPresence();
  // Inside a MorphFrame (the Pool's one panel: Stake From, Receive on) the frame is the Box and changes the panel in
  // place, so only the content shows, at the Box's inner height (motion part 2).
  const inFrame = useFrame() !== null;

  // more tokens as the list scrolls to its end
  const sentinel = React.useRef<HTMLDivElement>(null);
  const { hasMore, loadMore } = list;
  React.useEffect(() => {
    const el = sentinel.current;
    if (!el || fixed || !hasMore) return;
    const seen = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) loadMore();
    });
    seen.observe(el);
    return () => seen.disconnect();
  }, [fixed, hasMore, loadMore, tokens.length]);

  const content = (
    <>
      <div className="[&_button]:transition [&_button]:duration-150 [&_button:hover]:opacity-70 [&_button:active]:scale-[0.97] motion-reduce:[&_button:active]:scale-100"><BoxHeader title={title} onBack={onBack} /></div>
      <div className="grid w-full select-none grid-cols-5 place-items-center gap-5">
        {chains
          .filter((c) => !only || only.includes(c.chainId))
          .sort((a, b) => place(a.chainId) - place(b.chainId))
          .map((c) => (
            <div key={c.chainId} className={cn('rounded-full hover:scale-[1.06] active:scale-95 motion-reduce:hover:scale-100 motion-reduce:active:scale-100', tw.quick)}>
              <ChainItem
                chain={{ chainId: chainNumber(c.chainId), name: c.name, logo: chainLogo(c.chainId) }}
                selectedId={chainNumber(chain)}
                onClick={() => setChain(c.chainId)}
              />
            </div>
          ))}
      </div>
      <hr className="w-full bg-[#636363]/25 max-md:hidden" />
      {note}
      {!note && (
        <input
          type="text"
          placeholder="Search token"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-md border-[#000000] bg-white/30 px-3 py-2 text-white placeholder:text-white/50"
        />
      )}
      <div className={'flex h-full w-full flex-col gap-y-6 overflow-y-scroll ' + (loading ? tw.shimmerAll : '')}>
        {loading ? (
          [0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex w-full items-center justify-between">
              <TokenSkeleton />
              <div className="flex flex-col items-end gap-y-2 pr-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
          ))
        ) : tokens.length ? (
          <>
            {pasted && (
              <div className="animate-slide-in-from-top rounded-md bg-yellow-600/10 p-4 text-left text-white">
                <span className="inline pr-2 text-yellow-600">Not on our list.</span>
                <p className="inline text-sm font-thin">Check the address before you swap.</p>
              </div>
            )}
            {tokens.map((t, i) => (
              <motion.div key={t.key} {...(mounted ? listItem(Math.min(i, 12)) : {})} className={cn(tw.quick, tw.pressRow, '[&>div]:transition-colors [&>div]:duration-150')}>
                <TokenListItem token={t} onClick={() => onSelect(t)} isSelected={!!selected && selected.key === t.key} />
              </motion.div>
            ))}
            <div ref={sentinel} aria-hidden className="h-px w-full shrink-0" />
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-primary">No coins were found.</div>
        )}
      </div>
    </>
  );
  if (inFrame) return <div className="flex w-full flex-col items-center justify-normal gap-y-6 md:h-[543px]">{content}</div>;
  return (
    // Motion (approved 2026-10-29): opened from the Swap panel (inside an AnimatePresence) it slides in from 16 px right
    // and fades in; Back fades it out drifting right. On its own it shows at rest at once.
    <motion.div className="flex w-full md:items-center md:justify-center" variants={page} initial={opened ? 'hidden' : false} animate="shown" exit="gone">
      <Box className="justify-normal gap-y-6 md:h-[607px] md:max-w-[537px]">{content}</Box>
    </motion.div>
  );
}
