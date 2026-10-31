'use client';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApiError, getQuote, swapCapOf, userMessage, type Quote, type QuoteQuery } from '@/lib/api';
import { parseUnits } from '@/lib/money';
import { useWallets, type EvmWallet, type IcpWallet } from '@/lib/wallets/store';
import type { QuoteState } from './button';
import { icpClient } from '@/lib/icp';
import { findByTag, pickOptions } from './options';
import { loadGuardContext } from './guards/context';
import { routeOffered } from './guards/evm';
import { useSwapForm, type SwapFormState } from './form';

type Wallets = { evm: EvmWallet | null; icp: IcpWallet | null };

/** A smart wallet's address is known to be the person's only on the chain it is connected on, where its code was read
 *  (plan 2 Smart wallets, lead 2026-10-29): the connected address is the recipient only when the destination is that chain
 *  (any source, ICP included); elsewhere it is typed. Code that could not be read (smartWallet null) counts as smart here
 *  (fail closed). Swaps to ICP are unchanged. */
export function smartWalletTypesRecipient(f: Pick<SwapFormState, 'from' | 'to'>, w: Wallets): boolean {
  const evm = w.evm;
  if (!evm || evm.smartWallet === false || evm.smartWallet === undefined || !f.to || f.to.chain_type !== 'EVM') return false;
  return evm.chainId === null || f.to.chain !== `eip155:${evm.chainId}`;
}

export function quoteQueryOf(f: Pick<SwapFormState, 'from' | 'to' | 'amountText' | 'recipient'>, w: Wallets): QuoteQuery | null {
  if (!f.from || !f.to) return null;
  let amount: bigint;
  try { amount = parseUnits(f.amountText, f.from.decimals); } catch { return null; }
  if (amount <= 0n) return null;
  const payer = f.from.chain_type === 'ICP' ? w.icp?.principal : w.evm?.address;
  const own = f.to.chain_type === 'ICP' ? w.icp?.principal : smartWalletTypesRecipient(f, w) ? undefined : w.evm?.address;
  const recipient = f.recipient.show ? (f.recipient.address && !f.recipient.error ? f.recipient.address : undefined) : own;
  return {
    fromChain: f.from.chain, fromToken: f.from.address, amount: amount.toString(), toChain: f.to.chain, toToken: f.to.address,
    ...(payer ? { payer } : {}), ...(recipient ? { recipient } : {}), allRoutes: true,
  };
}

const PAUSED = 'Swaps are paused right now';
/** Contract 5.15 (lead's copy, 2026-10-28): while any withdrawal waits in line the canister takes no new ICP to EVM swap
 *  (`impl/src/pool/icp_swap/mod.rs:292`) and the quoter withholds those routes with a reason starting `poolShort:`. */
export const ICP_PAUSED = 'Swaps from ICP are paused for a few minutes while the pool refills. Try again soon.';

/** An ICP source quote held back while the pool refills: `icpPull.whyNot` (contract 5.15), or, as today's quoter answers
 *  a quote with no route at all, a 422 `no_route` whose reasons hold `poolShort:` (`answer/mod.rs` Quote::of, engine/icp/mod.rs:934-938). */
export function icpSwapsPaused(fromIcp: boolean, quote: Quote | undefined, error: unknown): boolean {
  if (!fromIcp) return false;
  const pull = quote?.icpPull;
  if (pull && pull.whyNot?.startsWith('poolShort:') && !pull.routes.some((r) => r.executable)) return true;
  return error instanceof ApiError && error.code === 'no_route' && error.message.includes('poolShort:');
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

/** The canister's anchors (get_config, Eco's prover, its EVM address), kept 10 minutes and used only to choose which cards
 *  to show; every signature reads them again, fresh (Task 7). */
export function useGuardContext() {
  return useQuery({ queryKey: ['guard-context'], queryFn: () => loadGuardContext(icpClient()), staleTime: 10 * 60_000, gcTime: 10 * 60_000, retry: 1, refetchOnWindowFocus: false }).data;
}

/** 600 ms after typing stops; again every 20 s while the page is visible (spec 5.1, my call); no retry (60 a minute per IP). */
export function useSwapQuote() {
  const f = useSwapForm();
  const w = useWallets();
  const amountText = useDebounced(f.amountText, 600);
  const query = quoteQueryOf({ ...f, amountText }, w);
  const q = useQuery({
    queryKey: ['quote', query],
    queryFn: ({ signal }) => getQuote(query!, signal),
    enabled: !!query,
    staleTime: 0,
    gcTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: () => (typeof document !== 'undefined' && document.visibilityState === 'visible' ? 20_000 : false),
  });
  const indicative = !query?.payer || !query?.recipient;
  const guard = useGuardContext();
  const options = q.data ? pickOptions(q.data, { indicative, accept: (r, mode) => routeOffered(q.data!, r, mode, { payer: query?.payer, recipient: query?.recipient, guard }) }) : [];
  const error = q.error ? userMessage(q.error) : null;
  const icpPaused = icpSwapsPaused(f.from?.chain_type === 'ICP', q.data, q.error);
  // over the canister's per swap cap (422 no_route, reasonCode aboveSwapCap): its own line and button, with the cap
  const cap = swapCapOf(q.error);
  const state: QuoteState = !query ? 'none' : q.isFetching && !q.data && !q.error ? 'loading' : icpPaused ? 'icpPaused' : error === PAUSED ? 'paused'
    : cap !== null ? 'capped' : q.error instanceof ApiError && q.error.code === 'no_route' ? 'empty' : q.error ? 'error' : options.length ? 'ready' : 'empty';
  const picked = findByTag(options, f.tag) ?? options[0];
  return { query, quote: q.data as Quote | undefined, state, options, picked, error, indicative, cap };
}
