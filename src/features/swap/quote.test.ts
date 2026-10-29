import { describe, expect, it } from 'vitest';
import type { UiToken } from '@/components/ui/token-types';
import { ApiError } from '@/lib/api';
import { icpSwapsPaused, quoteQueryOf } from './quote';

const t = (chain: string, address: string, decimals: number, chain_type: 'EVM' | 'ICP'): UiToken => ({
  key: `${chain}|${address}`, chain, chainId: chain_type === 'ICP' ? 0 : 1, chainName: '', chainLogo: '', chain_type, address, symbol: 'X', name: 'X', logo: '', decimals, priceUsd: null, verified: true,
});
const usdcArb = t('eip155:42161', '0xaf88d065e77c8cc2239327c5edb3a432268e5831', 6, 'EVM');
const ckbtc = t('icp:737ba355e855bd4b61279056603e0550', 'mxzaz-hqaaa-aaaar-qaada-cai', 8, 'ICP');
const wallets = { evm: { address: '0xf00eba8e5fd231b526adfaaa68b4d0ede72a89ac' as const, chainId: 42161 }, icp: { principal: '3yfhk-v3nwx-2xo3k-pjyl5-ugvqk-ywkpy-qaq7m-aocl5-iz5re-kxxtc-2qe', signer: 'OISY' as const } };
const form = { from: usdcArb, to: ckbtc, amountText: '250', recipient: { show: false, address: '', error: '' } };

describe('quoteQueryOf', () => {
  it('asks for every route with the From wallet paying and the To wallet receiving', () => {
    expect(quoteQueryOf(form, wallets)).toEqual({
      fromChain: 'eip155:42161', fromToken: usdcArb.address, amount: '250000000', toChain: ckbtc.chain, toToken: ckbtc.address,
      payer: wallets.evm.address, recipient: wallets.icp.principal, allRoutes: true,
    });
  });
  it('sends to the typed address when Send To Wallet is open and valid, and quotes without a wallet', () => {
    const p = 'k2t6j-2nvnp-4zjm3-25dtz-6xhaa-c7boj-5gayf-oj3xs-i43lp-teztq-6ae';
    expect(quoteQueryOf({ ...form, recipient: { show: true, address: p, error: '' } }, wallets)?.recipient).toBe(p);
    expect(quoteQueryOf({ ...form, recipient: { show: true, address: 'nope', error: 'ICP Wallet Address is not valid' } }, wallets)?.recipient).toBeUndefined();
    const q = quoteQueryOf(form, { evm: null, icp: null })!;
    expect(q.payer).toBeUndefined();
    expect(q.recipient).toBeUndefined();
  });
  it('reads "swaps from ICP paused" in both shapes, and only for an ICP source (contract 5.15)', () => {
    const held = { icpPull: { allowed: true, whyNot: "poolShort: the pool's Base pocket holds 0.00 USDC, below the payout", routes: [] } } as never;
    expect(icpSwapsPaused(true, held, null)).toBe(true);
    const refused = new ApiError(422, 'no_route', "no route could carry this swap: poolShort: the pool's Base pocket holds 0.00 USDC, below the payout", '/v2/quote');
    expect(icpSwapsPaused(true, undefined, refused)).toBe(true);
    expect(icpSwapsPaused(false, undefined, refused)).toBe(false);
    expect(icpSwapsPaused(true, undefined, new ApiError(422, 'no_route', 'no route could carry this swap: eco did not answer', '/v2/quote'))).toBe(false);
  });
  it('asks nothing without both tokens or a positive, readable amount', () => {
    expect(quoteQueryOf({ ...form, to: null }, wallets)).toBeNull();
    expect(quoteQueryOf({ ...form, amountText: '0' }, wallets)).toBeNull();
    expect(quoteQueryOf({ ...form, amountText: '1,5' }, wallets)).toBeNull();
  });
});
