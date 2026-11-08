'use client';
// The token page: moved from the design's swap-screens.tsx TokenSelect (the approved static look, as the design bundle
// built 2026-10-29 14:46 holds it), wired to data: the chain menu from GET /v2/chains (ChainPicker.tsx, Jeff's pick of
// 2026-11-04), tokens from GET /v2/tokens (50 a page, more as the list scrolls), balances beside them. Each row carries its mark (lib/token-marks): the tick on Swapic's
// own list, "Unverified" on a token Swapic does not know, "Fake" on one that takes a listed token's symbol; a flagged
// row opens a confirm under it before it is picked, and a fake's confirm offers the real token first.
import * as React from 'react';
import Box from '@/components/ui/box';
import BoxHeader from '@/components/ui/box-header';
import TokenListItem from '@/components/ui/token-list-item';
import TokenSkeleton from '@/components/ui/token-skeleton';
import type { UiToken } from '@/components/ui/token-types';
import { chainPlace } from '@/lib/chains';
import { useAllTokens, useChains, useTokenList } from '../tokens';
import { ALL_CHAINS, ChainMenu, searchPlaceholder } from './ChainPicker';
import { FIELD } from '@/components/ui/styles';
import { findReal } from '../real-token';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/lib/cn';
import { listItem, openHeight, page, tw, useInPresence, useMounted, useReducedMotion } from '@/lib/motion';
import { getTokens } from '@/lib/api';
import { useWallets } from '@/lib/wallets/store';
import { listedFor, markOf, needsConfirm } from '@/lib/token-marks';
import { ConfirmPick } from './ConfirmPick';
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
  const shown = chains.filter((c) => !only || only.includes(c.chainId)).sort((a, b) => chainPlace(a.chainId) - chainPlace(b.chainId));
  // "All chains" loads only once picked (the quoter's lists, a few requests at a time); a fixed list merges its own
  const isAll = chain === ALL_CHAINS;
  const list = useTokenList(isAll ? '' : chain, fixedTokens ? '' : searched);
  const every = useAllTokens(searched, isAll && !fixedTokens, only);
  const fixed = fixedTokens && (isAll ? shown.flatMap((c) => fixedTokens[c.chainId] ?? []) : fixedTokens[chain]);
  const tokens = fixed ?? (isAll ? every.tokens : list.tokens);
  const loading = fixed ? false : isAll ? every.isLoading : list.isLoading;
  const wallet = useWallets((s) => !!s.evm || !!s.icp);
  // Rows that show after the first render (after loading, a chain switch) fade up one after another.
  const mounted = useMounted();
  // Opened inside the Swap page's AnimatePresence: slides in and out.
  const opened = useInPresence();
  // Inside a MorphFrame (the Pool's one panel: Stake From, Receive on) the frame is the Box and changes the panel in
  // place, so only the content shows, at the Box's inner height (motion part 2).
  const inFrame = useFrame() !== null;
  const reduced = useReducedMotion();
  // the flagged row whose confirm is open
  const [confirming, setConfirming] = React.useState<string | null>(null);
  // a fake's "Use the real X" while it looks, and what it says when the real token cannot be found
  const [real, setReal] = React.useState<{ busy: boolean; note: string | null }>({ busy: false, note: null });
  const open = (key: string | null) => { setConfirming(key); setReal({ busy: false, note: null }); };
  /** The confirm stays open until the real token is picked; when it cannot be found, it says so. */
  const pickReal = async (t: UiToken) => {
    setReal({ busy: true, note: null });
    const found = await findReal(t, tokens, chains.find((c) => c.chainId === t.chain), getTokens);
    if (found) { open(null); onSelect(found); return; }
    setReal({ busy: false, note: `We couldn't find the real ${listedFor(t)?.token.symbol ?? t.symbol} right now. Search for it by name, or try again.` });
  };

  // more tokens as the list scrolls to its end
  const sentinel = React.useRef<HTMLDivElement>(null);
  const { hasMore, loadMore } = list;
  React.useEffect(() => {
    const el = sentinel.current;
    if (!el || fixed || isAll || !hasMore) return;
    const seen = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) loadMore();
    });
    seen.observe(el);
    return () => seen.disconnect();
  }, [fixed, isAll, hasMore, loadMore, tokens.length]);

  const search = (
    <input
      type="text"
      placeholder={searchPlaceholder(chain)}
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      className={'w-full min-w-0 px-3 py-2 ' + FIELD}
    />
  );
  const tokenList = (
    <div className="hide-scrollbar flex h-full w-full min-w-0 flex-col gap-y-1 overflow-y-scroll">
      {loading ? (
        // enough rows to fill the panel; the wallet's tokens come first, the rest show no balance
        [0, 1, 2, 3, 4, 5, 6].map((i) => <TokenSkeleton key={i} balance={wallet && i < 3} />)
      ) : tokens.length ? (
        <>
          {tokens.map((t, i) => {
            const mark = markOf(t);
            const isSelected = !!selected && selected.key === t.key;
            const isOpen = confirming === t.key;
            return (
              <motion.div key={t.key} {...(mounted ? listItem(Math.min(i, 12)) : {})} className={cn(tw.quick, tw.pressRow, '[&>div]:transition-colors [&>div]:duration-100')}>
                <TokenListItem
                  token={t}
                  mark={mark}
                  isSelected={isSelected}
                  chainBadge
                  onClick={() => (needsConfirm(mark) && !isSelected ? open(isOpen ? null : t.key) : onSelect(t))}
                />
                <AnimatePresence initial={false}>
                  {isOpen && (mark === 'fake' || mark === 'unverified') && (
                    <motion.div
                      className="overflow-hidden"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto', transition: openHeight(true, reduced) }}
                      exit={{ opacity: 0, height: 0, transition: openHeight(false, reduced) }}
                    >
                      <ConfirmPick
                        token={t}
                        mark={mark}
                        realSymbol={mark === 'fake' ? listedFor(t)?.token.symbol : undefined}
                        onCancel={() => open(null)}
                        onConfirm={() => { open(null); onSelect(t); }}
                        onReal={mark === 'fake' ? () => void pickReal(t) : undefined}
                        realBusy={real.busy}
                        realNote={real.note}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
          <div ref={sentinel} aria-hidden className="h-px w-full shrink-0" />
        </>
      ) : (
        <div className="flex h-full w-full items-center justify-center text-primary">No coins were found.</div>
      )}
    </div>
  );

  const content = (
    <>
      <div className="[&_button]:transition [&_button]:duration-100 [&_button:hover]:opacity-70 [&_button:active]:scale-[0.97] motion-reduce:[&_button:active]:scale-100 md:short:[&_p]:text-2xl md:short:[&_button]:left-6 md:tiny:[&_button]:left-5"><BoxHeader title={title} onBack={onBack} /></div>
      <div className="flex w-full items-center gap-3">
        {note ? <div className="min-w-0 flex-1">{note}</div> : search}
        <ChainMenu chains={shown} value={chain} onChange={setChain} />
      </div>
      {tokenList}
    </>
  );
  // Short windows (a laptop at 125%): the page's height comes from the window (less the page frame, globals.css, and in the
  // Pool's panel its compact padding), never more than its usual height; the list scrolls inside it.
  if (inFrame) return <div className="flex w-full flex-col items-center justify-normal gap-y-6 md:h-[543px] md:short:h-[min(543px,calc(100dvh-var(--frame-top)-var(--frame-bottom)-48px))] md:short:gap-y-4 md:tiny:h-[min(543px,calc(100dvh-var(--frame-top)-var(--frame-bottom)-40px))] md:tiny:gap-y-3">{content}</div>;
  return (
    // Motion (approved 2026-10-29): opened from the Swap panel (inside an AnimatePresence) it slides in from 16 px right
    // and fades in; Back fades it out drifting right. On its own it shows at rest at once.
    <motion.div className="flex w-full md:items-center md:justify-center" variants={page} initial={opened ? 'hidden' : false} animate="shown" exit="gone">
      <Box className="justify-normal gap-y-6 md:h-[607px] md:max-w-[537px] md:short:h-[min(607px,calc(100dvh-var(--frame-top)-var(--frame-bottom)))] md:short:gap-y-4 md:short:p-6 md:tiny:gap-y-3 md:tiny:p-5">{content}</Box>
    </motion.div>
  );
}
