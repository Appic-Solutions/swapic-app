'use client';
// History's data: every connected wallet's rows in one call (contract 5.9 takes both kinds of wallet), merged and newest
// first, refreshed every 30 s while visible and never faster (the 20 a minute wallet lookup bucket is shared with the
// Scanner's wallet chips and search, contract 1.6).
import { useInfiniteQuery } from '@tanstack/react-query';
import { getOrders, type ActivityRow } from '@/lib/api';
// the store only: the @/lib/wallets barrel creates AppKit at import, which unit tests cannot load
import { useWallets, type EvmWallet, type IcpWallet } from '@/lib/wallets/store';
import { mergeRows, orderView, type OrderView } from '@/features/activity/rows';
import { useLogoFor } from '@/features/activity/logos';

export type Filter = 'All' | 'Swaps' | 'Pool';
export const historyWallets = (w: { evm: EvmWallet | null; icp: IcpWallet | null }) => [w.evm?.address, w.icp?.principal].filter((x): x is string => !!x);
export const filterRows = (rows: OrderView[], f: Filter) => rows.filter((o) => f === 'All' || (f === 'Swaps' ? o.kind === 'swap' : o.kind !== 'swap'));
export const counts = (rows: OrderView[]) => ({ All: rows.length, Swaps: filterRows(rows, 'Swaps').length, Pool: filterRows(rows, 'Pool').length });

export function useHistory() {
  const evm = useWallets((s) => s.evm);
  const icp = useWallets((s) => s.icp);
  const wallets = historyWallets({ evm, icp });
  const logo = useLogoFor();
  const q = useInfiniteQuery({
    queryKey: ['history', wallets.join(',')],
    queryFn: ({ pageParam }) => getOrders(wallets, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.nextCursor ?? undefined,
    enabled: wallets.length > 0,
    refetchInterval: () => (typeof document !== 'undefined' && document.visibilityState === 'visible' ? 30_000 : false),
  });
  const now = Math.floor(Date.now() / 1000);
  const raw: ActivityRow[] = mergeRows((q.data?.pages ?? []).map((p) => p.orders));
  const rows = raw.map((r) => orderView(r, now, logo));
  const state = !wallets.length ? 'nowallet' : q.isLoading ? 'loading' : q.isError ? 'error' : rows.length ? 'ready' : 'empty';
  return {
    rows, raw, wallets, state: state as 'nowallet' | 'loading' | 'empty' | 'error' | 'ready',
    more: () => q.fetchNextPage(), hasMore: !!q.hasNextPage, loadingMore: q.isFetchingNextPage, refetch: () => q.refetch(),
  };
}
