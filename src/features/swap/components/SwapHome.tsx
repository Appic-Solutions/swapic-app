'use client';
// The Swap page body: the panel and the info sections (the design's SwapHomeScreen), or a token page (SwapFlowScreen).
// The shareable link (Jeff, 2026-10-29, link.ts): it reads `pick`, `from`, `to` and `amount` once on load (useQueryOnce,
// never useSearchParams, which breaks the static build without a Suspense boundary), and from then on the address bar
// follows the picks and the amount (history.replaceState, 300 ms after the last change, never a new history entry). A token
// from the link that is not on Swapic's list opens its token page first, with the unknown token warning. The receiving
// address is never read from a link nor written to one.
import * as React from 'react';
import type { UiToken } from '@/components/ui/token-types';
import { useQueryOnce } from '@/lib/use-query-once';
import { recipientError, useSwapForm } from '../form';
import { useChains, useTokenList } from '../tokens';
import { linkAmount, parseSwapLink, swapLinkQuery, type TokenRef } from '../link';
import { SwapFlow } from './SwapFlow';
import type { LinkLoading } from './SwapPanel';
import { TokenSelect } from './TokenSelect';
import { ALL_CHAINS } from './ChainPicker';
import { ScrollHint } from '@/features/home/ScrollHint';
import { HowItWorks } from '@/features/home/HowItWorks';
import { Chains } from '@/features/home/Chains';
import { Earn } from '@/features/home/Earn';
import { Why } from '@/features/home/Why';
import { Faq } from '@/features/home/Faq';
import { Footer } from '@/features/home/Footer';
import { AnimatePresence } from 'motion/react';
import { Enter } from '@/components/motion/parts';
import { fade, useFirstRender } from '@/lib/motion';
import { cn } from '@/lib/cn';

type View = 'swap' | 'from' | 'to' | 'review' | 'status';

/** A token named in the link by its exact key, looked up in that chain's list (an unlisted one comes back unverified). */
function useLinkedToken(ref: TokenRef | null): { token: UiToken | undefined; done: boolean } {
  const { chains, settled: chainsSettled } = useChains();
  const { tokens, settled } = useTokenList(ref?.chain ?? '', ref?.address ?? '');
  if (!ref) return { token: undefined, done: true };
  // a chain the app does not serve never answers: done, nothing found
  if (chainsSettled && !chains.some((c) => c.chainId === ref.chain)) return { token: undefined, done: true };
  // done once the list has answered (isLoading is false for a moment before a newly enabled query starts)
  return { token: tokens.find((t) => t.address === ref.address), done: settled };
}

export function SwapHome() {
  const [view, setView] = React.useState<View>('swap');
  const f = useSwapForm();
  const q = useQueryOnce();
  const first = useFirstRender();

  // the link, once
  const link = React.useMemo(() => (q ? parseSwapLink(q) : null), [q]);
  const linkedFrom = useLinkedToken(link?.from ?? null);
  const linkedTo = useLinkedToken(link?.to ?? null);
  const [ready, setReady] = React.useState(false);
  // tokens from the link that are not on the list: their token page opens first, its search filled with the address
  const [unlisted, setUnlisted] = React.useState<{ side: 'from' | 'to'; query: string; chain: string }[]>([]);
  const pendingAmount = React.useRef<string | null>(null);
  // a shared link while its tokens load: the panel keeps the shape it is about to take (no jump when they arrive)
  const linking: LinkLoading | null = link && !ready && (link.from || link.to) ? { from: !!link.from, to: !!link.to, amount: !!link.amount } : null;
  React.useEffect(() => {
    if (!q || ready) return;
    if (!linkedFrom.done || !linkedTo.done) return; // wait for the token lists
    setReady(true);
    const pick = q.get('pick');
    const known = (r: { token: UiToken | undefined }) => (r.token && r.token.verified ? r.token : undefined);
    const from = known(linkedFrom);
    const to = known(linkedTo);
    const queue: { side: 'from' | 'to'; query: string; chain: string }[] = [];
    if (link?.from && linkedFrom.token && !from) queue.push({ side: 'from', query: link.from.address, chain: link.from.chain });
    if (link?.to && linkedTo.token && !to) queue.push({ side: 'to', query: link.to.address, chain: link.to.chain });
    const amount = from ? linkAmount(link?.amount, from.decimals) : null;
    if (!from && queue[0]?.side === 'from') pendingAmount.current = link?.amount ?? null;
    f.set({ ...(from ? { from } : {}), ...(to ? { to } : {}), ...(amount ? { amountText: amount } : {}) });
    setUnlisted(queue);
    if (queue.length) setView(queue[0]!.side);
    else if (pick === 'from' || pick === 'to') setView(pick);
  }, [q, ready, link, linkedFrom, linkedTo, f]);

  // the address bar follows the picks and the amount, once the link has been read
  React.useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      const query = swapLinkQuery({ from: f.from, to: f.to, amountText: f.amountText });
      if (query !== window.location.search) window.history.replaceState(window.history.state, '', `${window.location.pathname}${query}${window.location.hash}`);
    }, 300);
    return () => clearTimeout(t);
  }, [ready, f.from, f.to, f.amountText]);

  const pickToken = (side: 'from' | 'to') => (t: UiToken) => {
    const other = side === 'from' ? f.to : f.from;
    const next = { [side]: t } as Partial<typeof f>;
    // a new To token: the typed address is checked again for its chain
    if (side === 'to') next.recipient = { ...f.recipient, error: recipientError(t, f.recipient.address) };
    if (other && other.key === t.key) next[side === 'from' ? 'to' : 'from'] = null;
    // a From token picked from a link's unlisted token page: the link's amount, when the token can hold it
    if (side === 'from' && pendingAmount.current !== null) {
      const amount = linkAmount(pendingAmount.current, t.decimals);
      if (amount) next.amountText = amount;
      pendingAmount.current = null;
    }
    f.set(next);
    const rest = unlisted.filter((u) => u.side !== side);
    setUnlisted(rest);
    setView(rest[0]?.side ?? 'swap');
  };

  const tokenPage = view === 'from' || view === 'to' ? (() => {
    const current = view === 'from' ? f.from : f.to;
    // the chain menu opens on All chains (Jeff, 2026-11-04); a shared link's unlisted token opens on its own chain, where its warning shows
    const start = unlisted.find((u) => u.side === view)?.chain ?? ALL_CHAINS;
    return (
      <TokenSelect
        key={view}
        title={view === 'from' ? 'Swap From' : 'Swap To'}
        chain={start}
        selected={current}
        onBack={() => { setUnlisted([]); setView('swap'); }}
        onSelect={pickToken(view)}
        initialQuery={unlisted.find((u) => u.side === view)?.query}
      />
    );
  })() : null;
  // Motion (approved 2026-10-29): the Swap panel fades out and the token page slides in from 16 px right; Back plays it
  // in reverse. Swap, Review swap and Your swap change in place in one frame (SwapFlow). The design's SwapHomeScreen: the
  // panel and the scroll hint, then the info sections (on the Swap view only).
  const flowView = view === 'review' || view === 'status' ? view : 'swap';
  return (
    <AnimatePresence mode="wait">
      {tokenPage ?? (
        <Enter key="panel" skip={first} variants={fade} className="flex w-full flex-col items-center">
          {/* The first screen, in every view: the panel stays on one center line while the home sections and the hint come and
              go (Jeff 2026-11-05: without this it jumped 85 px down on Review swap, then climbed back). The frame variables
              (globals.css) are what the header, the page padding and the bottom nav take above and below it. A short window
              (a laptop at 125%) has no 720 px floor: the first screen is the window, the hint keeps its 48 px at the bottom in the
              Swap view (--page-reserve, which a panel sized to the window leaves free; Review swap and Your swap take the
              whole height), and a panel taller than the rest starts at the top instead of running under the header. */}
          <div
            className={cn(
              'relative flex w-full flex-col items-center justify-center md:min-h-[max(720px,calc(var(--fold,100vh)-var(--frame-top)-var(--frame-bottom)))]',
              'md:short:min-h-[calc(100dvh-var(--frame-top)-var(--frame-bottom))] md:short:[justify-content:safe_center]',
              flowView === 'swap' && 'md:short:pb-12 md:short:[--page-reserve:48px] md:tiny:pb-0 md:tiny:[--page-reserve:0px]',
            )}
          >
            <SwapFlow view={flowView} setView={setView} onPick={(side) => setView(side)} linking={linking} />
            {/* a tiny window has no room for it under the panel */}
            {flowView === 'swap' && <div className="md:tiny:hidden"><ScrollHint /></div>}
          </div>
          {flowView === 'swap' && (
            <>
              <HowItWorks />
              <Chains />
              <Earn />
              <Why />
              <Faq />
              <Footer />
            </>
          )}
        </Enter>
      )}
    </AnimatePresence>
  );
}
