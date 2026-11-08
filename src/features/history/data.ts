'use client';
// History's data: every connected wallet's rows in one call (contract 5.9 takes both kinds of wallet), merged and newest
// first. The newest page is asked again while visible every 30 s, or every 10 s while a row is still in progress (so a
// delivery shows within seconds of the steps), never faster, and only that page (useLiveList): the 20 a minute wallet
// lookup bucket is shared with the Scanner's wallet chips and search, contract 1.6. Older pages are asked once, as the list
// is scrolled near its end. The newest rows in progress watch their own status every 3 s (useEndWatch, the reads bucket),
// so a row ends on screen within about 3 s of its order; `ended` is also what an open row's steps call when they end.
import { getOrders } from '@/lib/api';
// the store only: the @/lib/wallets barrel creates AppKit at import, which unit tests cannot load
import { useWallets, type EvmWallet, type IcpWallet } from '@/lib/wallets/store';
import { orderView, type OrderView } from '@/features/activity/rows';
import { useLogoFor } from '@/features/activity/logos';
import { useLiveList } from '@/features/activity/live-list';
import { useEndWatch } from '@/features/activity/end-watch';

export type Filter = 'All' | 'Swaps' | 'Pool';
export const historyWallets = (w: { evm: EvmWallet | null; icp: IcpWallet | null }) => [w.evm?.address, w.icp?.principal].filter((x): x is string => !!x);
export const filterRows = (rows: OrderView[], f: Filter) => rows.filter((o) => f === 'All' || (f === 'Swaps' ? o.kind === 'swap' : o.kind !== 'swap'));
export const counts = (rows: OrderView[]) => ({ All: rows.length, Swaps: filterRows(rows, 'Swaps').length, Pool: filterRows(rows, 'Pool').length });

export function useHistory() {
  const evm = useWallets((s) => s.evm);
  const icp = useWallets((s) => s.icp);
  const wallets = historyWallets({ evm, icp });
  const logo = useLogoFor();
  const list = useLiveList({
    queryKey: ['history', wallets.join(',')],
    fetchPage: async (cursor) => { const p = await getOrders(wallets, cursor); return { rows: p.orders, nextCursor: p.nextCursor }; },
    enabled: wallets.length > 0,
    live: 10_000,
    idle: 30_000,
  });
  useEndWatch(list.rows, (id, patch) => void list.ended(id, patch));
  const now = Math.floor(Date.now() / 1000);
  const raw = list.rows;
  const rows = raw.map((r) => orderView(r, now, logo));
  const state = !wallets.length ? 'nowallet' : list.loading ? 'loading' : list.failed ? 'error' : rows.length ? 'ready' : 'empty';
  return {
    rows, raw, wallets, state: state as 'nowallet' | 'loading' | 'empty' | 'error' | 'ready',
    more: list.more, hasMore: list.hasMore, loadingMore: list.loadingMore, again: list.again, refetch: list.refetch, ended: list.ended,
  };
}
