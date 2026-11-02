import { getJson, postJson } from './http';
import type * as Q from './quoter-types';

const enc = encodeURIComponent;

export const getChains = () => getJson<Q.ChainInfo[]>('/v2/chains');
export const getTokens = (chain: string, q?: string, cursor?: string) => getJson<Q.TokensAnswer>('/v2/tokens', { chain, q, cursor });
export const getQuote = (q: Q.QuoteQuery, signal?: AbortSignal) =>
  getJson<Q.Quote>('/v2/quote', { ...q }, { signal, timeoutMs: 25_000 });
export const postStakeQuote = (r: Q.StakeRequest) => postJson<Q.StakeQuote>('/v2/stake/quote', r, { timeoutMs: 25_000 });
export const postWithdrawQuote = (r: Q.WithdrawRequest) => postJson<Q.WithdrawQuoteAnswer>('/v2/withdraw/quote', r, { timeoutMs: 25_000 });
export const getPool = () => getJson<Q.PoolAnswer>('/v2/pool');
export const getPoolHistory = (range: Q.PoolRange) => getJson<Q.PoolHistory>('/v2/pool/history', { range });
export const getPoolActivity = (cursor?: string) => getJson<Q.PoolActivity>('/v2/pool/activity', { cursor });
export const getAccount = (account: string) => getJson<Q.AccountAnswer>(`/v2/pool/accounts/${enc(account)}`);
export const getAccountHistory = (account: string, range: Q.PoolRange) =>
  getJson<Q.AccountHistory>(`/v2/pool/accounts/${enc(account)}/history`, { range });
export const getBalances = (wallet: string, chain: string, tokens: string[] = []) =>
  getJson<Q.BalancesAnswer>('/v2/balances', { wallet, chain, tokens: tokens.length ? tokens.slice(0, 20).join(',') : undefined });
