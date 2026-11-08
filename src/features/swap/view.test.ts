import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Quote } from '@/lib/api';
import type { UiToken } from '@/components/ui/token-types';
import { pickOptions } from './options';
import { approveState, etaText, gasText, lossOf, routeView, sumFees } from './view';

const q: Quote = JSON.parse(readFileSync('tests/fixtures/real/quote/arb-usdc-to-pol-wbtc.json', 'utf8'));
const tok = (symbol: string, decimals: number, priceUsd: string | null): UiToken => ({
  key: symbol, chain: 'eip155:137', chainId: 137, chainName: 'Polygon', chainLogo: '', chain_type: 'EVM', address: '0x', symbol, name: symbol, logo: '', decimals, priceUsd, verified: true,
});

describe('routeView', () => {
  it('adds the fee lines in micro USDC and formats the card without Number', () => {
    expect(sumFees({ network: '157740', bridge: '679', platform: '0' })).toBe(158_419n);
    const [gasless, paid] = pickOptions(q, { indicative: false });
    const eth = { symbol: 'ETH', decimals: 18, priceUsd: '3920.10' };
    const g = routeView(gasless!, { from: tok('USDC', 6, '1'), to: tok('WBTC', 8, '103750'), amountIn: 5_000_000n, sameChainNoUsdc: false, native: eth });
    expect(g).toMatchObject({ tags: ['Gasless'], gasless: true, durationText: '15 sec', amountOutText: '0.00005976', totalFeeText: '$0.15', gasText: 'None, Swapic pays it' });
    expect(g.usdOutText).toBe('$6.20');
    // the least the user receives: the quote's amountOutMin (5946 sats) less the cushion (2 sats)
    expect(g.minOutText).toBe('0.00005944 WBTC');
    // a stable coin's minimum in its own format, two decimals, as Review swap's line shows it
    const toUsdc = { ...gasless!, route: { ...gasless!.route, amountOutMin: '106946536' } };
    expect(routeView(toUsdc, { from: tok('WBTC', 8, '103750'), to: tok('USDC', 6, '1'), amountIn: 5_000_000n, sameChainNoUsdc: false, native: eth }).minOutText).toBe('106.89 USDC');
    const p = routeView(paid!, { from: tok('USDC', 6, '1'), to: tok('WBTC', 8, null), amountIn: 5_000_000n, sameChainNoUsdc: false, native: eth });
    expect(p.gasless).toBe(false);
    // the design's native amount: userGasUsd 0.016821 at $3,920.10 an ETH is 0.00000429 ETH
    expect(p.gasText).toBe('~ 0.00000429 ETH, you pay it');
    expect(p.usdOutText).toBeNull();
    const noPrice = routeView(paid!, { from: tok('USDC', 6, '1'), to: tok('WBTC', 8, null), amountIn: 5_000_000n, sameChainNoUsdc: false, native: { ...eth, priceUsd: null } });
    expect(noPrice.gasText).toBe('You pay it');
  });
  it('a gasless card that must approve: once with the coin, blocked with none, and every other card as it was', () => {
    const [gasless, paid] = pickOptions(q, { indicative: false });
    const needs = { ...gasless!, route: { ...gasless!.route, needsApproval: true } };
    const coin = (held?: boolean | null) => ({ symbol: 'POL', decimals: 18, priceUsd: '0.2', held });
    const view = (p: typeof gasless, held?: boolean | null) =>
      routeView(p!, { from: tok('WBTC', 8, '103750'), to: tok('USDC', 6, '1'), amountIn: 250_000n, sameChainNoUsdc: false, native: coin(held) });
    expect(view(needs, true).approve).toBe('once');
    // the balance still loading is not a wallet with none
    expect(view(needs, null).approve).toBe('once');
    expect(view(needs, undefined).approve).toBe('once');
    expect(view(needs, false).approve).toBe('noCoin');
    expect(view(needs, false).approveBlocked).toBe('You need a little POL to approve WBTC once');
    // a named route says it as its approval
    const named = { ...gasless!, route: { ...gasless!.route, sign: { ...gasless!.route.sign!, approval: { token: '0x1', spender: '0x2', amount: '1' } } } };
    expect(approveState(named, coin(false))).toBe('noCoin');
    // Just sign: nothing to approve, with or without the coin
    expect(view(gasless, true).approve).toBeUndefined();
    expect(view(gasless, false).approve).toBeUndefined();
    // You pay gas is never blocked here, not even with no coin
    expect(view(paid, false).approve).toBeUndefined();
    expect(view({ ...paid!, route: { ...paid!.route, needsApproval: true } }, false).approve).toBeUndefined();
  });
  it('the gasless card says Just sign, or that the wallet has none of the coin; the paid card says nothing', () => {
    const [gasless, paid] = pickOptions(q, { indicative: false });
    const from = { ...tok('USDC', 6, '1'), chainName: 'Arbitrum' };
    const view = (p: typeof gasless, held?: boolean | null) =>
      routeView(p!, { from, to: tok('WBTC', 8, '103750'), amountIn: 5_000_000n, sameChainNoUsdc: false, native: { symbol: 'ETH', decimals: 18, priceUsd: '3920.10', held } });
    expect(view(gasless, true).gaslessNote).toBe('Just sign, no ETH needed');
    expect(view(gasless, null).gaslessNote).toBe('Just sign, no ETH needed');
    expect(view(gasless, false).gaslessNote).toBe('You have no ETH on Arbitrum. Gasless works anyway');
    expect(view(paid, false).gaslessNote).toBeUndefined();
  });
  it('writes times the way the design does', () => {
    expect(etaText(12)).toBe('12 sec');
    expect(etaText(1200)).toBe('20 min');
  });
});

describe('the ckETH minter card', () => {
  const route = { routeId: 'ckMinter', amountOut: '99310000', amountOutMin: '99310000', fees: { network: '690000', bridge: '0', platform: '0' }, etaSeconds: 330, warnings: [], icpCkSwap: { terms: { networkFee: '670000' } } };
  it('never says gasless or no fee: the network fee is on the card', () => {
    const option = { key: 'k', tags: [], mode: 'icpPull', route } as unknown as Parameters<typeof gasText>[0];
    expect(gasText(option, { symbol: null, decimals: 8, priceUsd: null, held: null } as never)).toBe('$0.67 network fee');
  });
});

describe('lossOf', () => {
  it('reads what the swap loses, from a percent up, and calls out a fifth or more', () => {
    expect(lossOf(2_290_000n, 700_000n)).toEqual({ text: '-69%', high: true });
    expect(lossOf(22_990_000n, 21_220_000n)).toEqual({ text: '-8%', high: false });
    expect(lossOf(100_000_000n, 99_600_000n)).toBeUndefined();
    expect(lossOf(100_000_000n, 100_500_000n)).toBeUndefined();
    expect(lossOf(null, 700_000n)).toBeUndefined();
    expect(lossOf(2_290_000n, null)).toBeUndefined();
  });
});
