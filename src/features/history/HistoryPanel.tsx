'use client';
// History: moved from the design's history-screens.tsx HistoryPanel (the approved static look), wired to every connected
// wallet's rows (useHistory). A row opens with its steps (GET /v2/orders/{id}/steps), fetched once when opened and every
// 10 s while it is pending; "Open in Scanner" opens /scanner?order=<id>.
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Box from '@/components/ui/box';
import { OrderRow } from '@/components/orders/OrderRow';
import { OrderRowSkeleton } from '@/components/orders/OrderRowSkeleton';
import { getSteps, type ActivityRow } from '@/lib/api';
import { stepViews } from '@/lib/copy/status';
import { useWalletMenu } from '@/lib/wallets/menu';
import type { OrderView } from '@/features/activity/rows';
import { counts as countRows, filterRows, useHistory, type Filter } from './data';
import { Empty } from './Empty';
import { Filters } from './Filters';
import { WalletChips } from './WalletChips';

/** The token a step names, from the row's own sides (rows carry symbol and decimals; contract 5.7). */
const metaOf = (r: ActivityRow) => (chain: string | null, token: string | null) => {
  for (const s of [r.from, r.to, ...(r.refund ? [r.refund] : [])]) {
    if (s.chain === chain && s.token !== null && token !== null && s.token.toLowerCase() === token.toLowerCase() && s.symbol !== null && s.decimals !== null) {
      return { symbol: s.symbol, decimals: s.decimals };
    }
  }
  return null;
};

function HistoryRow({ order, raw, open, onToggle }: { order: OrderView; raw: ActivityRow; open: boolean; onToggle: () => void }) {
  const router = useRouter();
  const live = order.status === 'pending' || order.status === 'queued';
  const steps = useQuery({
    queryKey: ['steps', order.id],
    queryFn: () => getSteps(order.id),
    enabled: open,
    refetchInterval: () => (open && live && typeof document !== 'undefined' && document.visibilityState === 'visible' ? 10_000 : false),
  }).data;
  return (
    <OrderRow
      order={order}
      open={open}
      onToggle={onToggle}
      onOpenScanner={() => router.push(`/scanner?order=${encodeURIComponent(order.id)}`)}
      steps={steps ? stepViews(steps, { gasMode: raw.gasMode, refund: raw.refund, token: metaOf(raw) }) : undefined}
    />
  );
}

export function HistoryPanel() {
  const router = useRouter();
  const openMenu = useWalletMenu((s) => s.setOpen);
  const h = useHistory();
  const [filter, setFilter] = React.useState<Filter>('All');
  const [openId, setOpenId] = React.useState<string | null>(null);
  const shown = filterRows(h.rows, filter);
  const connected = h.state !== 'nowallet';
  const rawOf = new Map(h.raw.map((r) => [r.id, r]));
  return (
    <Box className="justify-start gap-y-6 md:h-fit md:max-h-[760px] md:w-full md:max-w-[537px] md:overflow-y-hidden">
      <div className="flex w-full flex-wrap items-center justify-between gap-3 text-white">
        <h1 className="text-2xl font-bold md:text-3xl">History</h1>
        {connected && <WalletChips wallets={h.wallets} />}
      </div>
      {connected && h.state !== 'empty' && <Filters value={filter} onChange={setFilter} counts={countRows(h.rows)} />}
      <div className="flex w-full flex-col gap-y-4 md:min-h-0 md:flex-1 md:overflow-y-auto md:pr-1">
        {h.state === 'loading' && [0, 1, 2].map((i) => <OrderRowSkeleton key={i} />)}
        {h.state === 'nowallet' && (
          <Empty img="/images/wallet.svg" title="Connect your wallet to see your history" text="Connect an EVM or ICP wallet, or both. You'll see every swap, stake and withdrawal they made, in one list." action="Connect wallet" onAction={() => openMenu(true)} />
        )}
        {h.state === 'empty' && (
          <Empty img="/images/empty.png" title="No swaps yet" text="Your swaps, stakes and withdrawals show up here as soon as you make one, with every step and its transaction." action="Make a swap" onAction={() => router.push('/')} />
        )}
        {h.state === 'error' && (
          <Empty img="/images/empty.png" title="Couldn't load your history" text="The history service didn't answer. Your funds are safe; this only affects the list." action="Try again" onAction={() => void h.refetch()} />
        )}
        {h.state === 'ready' && (
          <>
            {shown.map((o) => (
              <div key={o.id} className="animate-fade">
                <HistoryRow order={o} raw={rawOf.get(o.id)!} open={openId === o.id} onToggle={() => setOpenId(openId === o.id ? null : o.id)} />
              </div>
            ))}
            {h.hasMore && (
              <button onClick={() => void h.more()} disabled={h.loadingMore} className="mx-auto mb-1 flex items-center gap-x-1.5 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white/80 transition-colors hover:bg-white/20 active:scale-95">
                Show older
              </button>
            )}
          </>
        )}
      </div>
    </Box>
  );
}
