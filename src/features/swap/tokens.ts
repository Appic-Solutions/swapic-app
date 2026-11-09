'use client';
import { skipToken, useInfiniteQuery, useQueries, useQuery } from '@tanstack/react-query';
import { Principal } from '@icp-sdk/core/principal';
import { config } from '@/config';
import { getBalances, getChains, getTokens, type BalancesAnswer, type ChainInfo, type TokenAnswer } from '@/lib/api';
import { icpClient } from '@/lib/icp';
import { chainLogo, chainName, chainNumber, isKnownChain } from '@/lib/explorer';
import { formatListAmount, formatListUsd, usdMicro } from '@/lib/money';
import { chainPlace } from '@/lib/chains';
import { fallbackLogo, ownLogo } from '@/lib/token-logos';
import { isEvmAddress, isIcpPrincipal } from '@/lib/validation';
import { useWallets } from '@/lib/wallets/store';
import type { UiToken } from '@/components/ui/token-types';

export function toUiToken(t: TokenAnswer, chain: ChainInfo, balance?: bigint): UiToken {
  const icp = chain.chainId === config.icpChain;
  const address = icp ? t.address : t.address.toLowerCase();
  const ui: UiToken = {
    key: `${chain.chainId}|${address}`, chain: chain.chainId, chainId: chainNumber(chain.chainId),
    chainName: chainName(chain.chainId), chainLogo: chainLogo(chain.chainId), chain_type: icp ? 'ICP' : 'EVM',
    address, ...(icp ? { canisterId: address } : { contractAddress: address }),
    symbol: t.symbol, name: t.name, logo: ownLogo(chain.chainId, address) ?? t.logo ?? fallbackLogo(chain.chainId, address) ?? '/images/logo/placeholder.png', decimals: t.decimals,
    priceUsd: t.priceUsd ?? null, verified: t.verified,
  };
  return balance === undefined ? ui : withBalance(ui, balance);
}

export function withBalance(t: UiToken, balance: bigint): UiToken {
  const usd = usdMicro(balance, t.decimals, t.priceUsd);
  return { ...t, balance, balanceText: formatListAmount(balance, t.decimals), usdBalanceText: usd === null ? undefined : formatListUsd(usd) };
}

/** Balances joined by address; an answer for another chain is ignored. */
export function joinBalances(list: UiToken[], b: BalancesAnswer | undefined, chain: string): UiToken[] {
  if (!b || b.chain !== chain) return list;
  const by = new Map(b.balances.map((x) => [x.token.toLowerCase(), BigInt(x.balance)]));
  return list.map((t) => (by.has(t.address) ? withBalance(t, by.get(t.address)!) : t));
}

export function useChains() {
  const q = useQuery({ queryKey: ['chains'], queryFn: getChains, staleTime: 10 * 60_000 });
  const chains = (q.data ?? []).filter((c) => config.chains.includes(c.chainId) && isKnownChain(c.chainId));
  return { chains, isLoading: q.isLoading, settled: q.isSuccess || q.isError };
}

/** These ICP tokens with the ICP wallet's balances, one read per ledger: a row shows its balance as soon as its own answer
 *  comes, and a slow or failed ledger holds back only itself. Every token list that shows ICP tokens reads through here. */
function useIcpBalances(list: UiToken[]): UiToken[] {
  const principal = useWallets((s) => s.icp?.principal);
  const answers = useQueries({
    queries: list.map((t) => ({
      queryKey: ['icp-balance', t.address, principal],
      queryFn: principal ? () => icpClient().balance(t.address, Principal.fromText(principal)) : skipToken,
      staleTime: 10_000,
    })),
  });
  return list.map((t, i) => {
    const balance = answers[i]?.data;
    return balance === undefined ? t : withBalance(t, balance);
  });
}

export function useTokenList(chain: string, query: string) {
  const { chains } = useChains();
  const info = chains.find((c) => c.chainId === chain);
  const evm = useWallets((s) => s.evm);
  const isIcp = chain === config.icpChain;
  const pasted = isIcp ? isIcpPrincipal(query) : isEvmAddress(query);
  const list = useInfiniteQuery({
    queryKey: ['tokens', chain, query],
    queryFn: ({ pageParam }) => getTokens(chain, query || undefined, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.nextCursor,
    enabled: !!info,
    staleTime: 60_000,
  });
  const raw = (list.data?.pages ?? []).flatMap((p) => p.tokens);
  const base = info ? raw.map((t) => toUiToken(t, info)) : [];
  const balances = useQuery({
    queryKey: ['balances', chain, evm?.address, pasted ? query.toLowerCase() : ''],
    queryFn: () => getBalances(evm!.address, chain, pasted ? [query] : []),
    enabled: !isIcp && !!evm && !!info,
    staleTime: 10_000,
  });
  const icpRows = useIcpBalances(isIcp ? base : []);
  const tokens = isIcp ? icpRows : joinBalances(base, balances.data, chain);
  return {
    tokens, isLoading: list.isLoading || !info, settled: list.isSuccess || list.isError,
    loadMore: () => list.fetchNextPage(), hasMore: !!list.hasNextPage,
  };
}

/** "All chains" on the token page (chain picker designs, 2026-11-04): the tokens the wallet holds first, by dollar value
 *  (a held token with no price after the priced ones); then each chain's list in its own order, one token from each chain
 *  in turn, so every chain's top tokens show near the top. `lists` come in the chain table's order. */
export function mergeAllChains(lists: readonly UiToken[][]): UiToken[] {
  const usd = (t: UiToken) => (t.balance ? usdMicro(t.balance, t.decimals, t.priceUsd) ?? 0n : 0n);
  const held = lists.flat().filter((t) => !!t.balance).sort((a, b) => { const d = usd(b) - usd(a); return d > 0n ? 1 : d < 0n ? -1 : 0; });
  const heldKeys = new Set(held.map((t) => t.key));
  const rest: UiToken[] = [];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest; i++) for (const l of lists) { const t = l[i]; if (t && !heldKeys.has(t.key)) rest.push(t); }
  return [...held, ...rest];
}

/** Runs at most `max` calls at once; the others wait their turn, in order (a finished call hands its place on). */
export function limiter(max: number) {
  let running = 0;
  const waiting: (() => void)[] = [];
  return async <T>(run: () => Promise<T>): Promise<T> => {
    if (running < max) running++;
    else await new Promise<void>((go) => waiting.push(go));
    try {
      return await run();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else running--;
    }
  };
}

/** "All chains" asks every chain for tokens and balances: never more than three requests at once. */
const allChainsTurn = limiter(3);

/** Every served chain's first page of tokens (only `only` when given), with both wallets' balances, merged for "All chains".
 *  The quoter's requests take turns, three at a time (allChainsTurn); the ICP reads go to the ledgers, outside those turns.
 *  The search that names them is already debounced by the token page. */
export function useAllTokens(query: string, enabled: boolean, only?: readonly string[]) {
  const { chains } = useChains();
  const evm = useWallets((s) => s.evm);
  const infos = chains.filter((c) => !only || only.includes(c.chainId)).sort((a, b) => chainPlace(a.chainId) - chainPlace(b.chainId));
  const lists = useQueries({
    queries: infos.map((info) => ({
      queryKey: ['tokens-first', info.chainId, query],
      queryFn: () => allChainsTurn(() => getTokens(info.chainId, query || undefined)),
      enabled, staleTime: 60_000,
    })),
  });
  const balances = useQueries({
    queries: infos.map((info) => ({
      // the same key as useTokenList's balances, so a chain's balances are read once
      queryKey: ['balances', info.chainId, evm?.address, ''],
      queryFn: () => allChainsTurn(() => getBalances(evm!.address, info.chainId, [])),
      enabled: enabled && !!evm && info.chainId !== config.icpChain,
      staleTime: 10_000,
    })),
  });
  const rows = infos.map((info, i) =>
    joinBalances((lists[i]?.data?.tokens ?? []).map((t) => toUiToken(t, info)), balances[i]?.data, info.chainId));
  const icpAt = infos.findIndex((info) => info.chainId === config.icpChain);
  const icpRows = useIcpBalances(enabled ? (rows[icpAt] ?? []) : []);
  const tokens = mergeAllChains(rows.map((list, i) => (i === icpAt ? icpRows : list)));
  return { tokens, isLoading: enabled && (infos.length === 0 || lists.every((q) => q.isLoading)) };
}

export function useBalance(token: UiToken | null) {
  const evm = useWallets((s) => s.evm);
  const icp = useWallets((s) => s.icp);
  const q = useQuery({
    queryKey: ['balance', token?.key, token?.chain_type === 'ICP' ? icp?.principal : evm?.address],
    queryFn: async () => {
      if (token!.chain_type === 'ICP') return icpClient().balance(token!.address, Principal.fromText(icp!.principal));
      // contract 5.1: a verified token ranked below 200 is answered only when named, so the picked token is always named
      // (the coin is always answered); a named token missing from the answer is 0
      const b = await getBalances(evm!.address, token!.chain, token!.address === '0x0000000000000000000000000000000000000000' ? [] : [token!.address]);
      const row = b.chain === token!.chain ? b.balances.find((x) => x.token.toLowerCase() === token!.address) : undefined;
      return row ? BigInt(row.balance) : 0n;
    },
    enabled: !!token && (token.chain_type === 'ICP' ? !!icp : !!evm),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
  return { balance: q.data, loading: q.isLoading && q.fetchStatus !== 'idle' };
}
