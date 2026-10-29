'use client';
// The Swap page body: the panel or a token page (the design's SwapFlowScreen views), then the info sections (Task 6).
// It reads `pick`, `from`, `to`, `amount` and `send` from the link once on load (useQueryOnce, never useSearchParams,
// which breaks the static build without a Suspense boundary), so a swap can be shared as a link.
import * as React from 'react';
import { config } from '@/config';
import type { UiToken } from '@/components/ui/token-types';
import { useQueryOnce } from '@/lib/use-query-once';
import { useWallets } from '@/lib/wallets';
import { recipientError, useSwapForm } from '../form';
import { useTokenList } from '../tokens';
import { SwapPanel } from './SwapPanel';
import { TokenSelect } from './TokenSelect';

type View = 'swap' | 'from' | 'to' | 'review' | 'status';
const ARBITRUM = 'eip155:42161';

/** A token named in the link by its key (`<chain>|<address>`), found in that chain's list. */
function useLinkedToken(key: string | null): UiToken | undefined {
  const [chain, address] = key && key.includes('|') ? (key.split('|') as [string, string]) : ['', ''];
  const lower = chain === config.icpChain ? address : address.toLowerCase();
  const { tokens } = useTokenList(chain, address);
  return chain ? tokens.find((t) => t.address === lower) : undefined;
}

export function SwapHome() {
  const [view, setView] = React.useState<View>('swap');
  const f = useSwapForm();
  const evm = useWallets((s) => s.evm);
  const q = useQueryOnce();

  // the link, once
  const linkedFrom = useLinkedToken(q?.get('from') ?? null);
  const linkedTo = useLinkedToken(q?.get('to') ?? null);
  const applied = React.useRef(false);
  React.useEffect(() => {
    if (!q || applied.current) return;
    const pick = q.get('pick');
    if (pick === 'from' || pick === 'to') setView(pick);
    const wantsFrom = !!q.get('from');
    const wantsTo = !!q.get('to');
    if ((wantsFrom && !linkedFrom) || (wantsTo && !linkedTo)) return; // wait for the token lists
    applied.current = true;
    const send = q.get('send');
    const to = linkedTo ?? f.to;
    f.set({
      ...(linkedFrom ? { from: linkedFrom } : {}),
      ...(linkedTo ? { to: linkedTo } : {}),
      ...(q.get('amount') ? { amountText: q.get('amount')! } : {}),
      ...(send ? { recipient: { show: true, address: send, error: recipientError(to, send) } } : {}),
    });
  }, [q, linkedFrom, linkedTo, f]);

  const pickToken = (side: 'from' | 'to') => (t: UiToken) => {
    const other = side === 'from' ? f.to : f.from;
    const next = { [side]: t } as Partial<typeof f>;
    // a new To token: the typed address is checked again for its chain
    if (side === 'to') next.recipient = { ...f.recipient, error: recipientError(t, f.recipient.address) };
    if (other && other.key === t.key) next[side === 'from' ? 'to' : 'from'] = null;
    f.set(next);
    setView('swap');
  };

  if (view === 'from' || view === 'to') {
    const current = view === 'from' ? f.from : f.to;
    const start = current?.chain ?? (view === 'from' ? (evm?.chainId ? `eip155:${evm.chainId}` : ARBITRUM) : config.icpChain);
    return (
      <TokenSelect
        key={view}
        title={view === 'from' ? 'Swap From' : 'Swap To'}
        chain={start}
        selected={current}
        onBack={() => setView('swap')}
        onSelect={pickToken(view)}
      />
    );
  }
  // the review and the progress are drawn by Tasks 9 and 10 (held for Jeff's motion approval): nothing yet
  if (view === 'review' || view === 'status') return null;
  return (
    <div className="flex w-full animate-fade md:items-center md:justify-center">
      <SwapPanel onPick={(side) => setView(side)} onReview={() => setView('review')} />
    </div>
  );
}
