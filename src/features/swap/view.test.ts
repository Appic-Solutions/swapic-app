import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Quote } from '@/lib/api';
import type { UiToken } from '@/components/ui/token-types';
import { pickOptions } from './options';
import { etaText, routeView, sumFees } from './view';

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
    expect(g).toMatchObject({ tags: ['Gasless'], gasless: true, durationText: '15 Sec', amountOutText: '0.00005976', totalFeeText: '$0.15', gasText: 'None, Swapic pays it' });
    expect(g.usdOutText).toBe('$6.20');
    // the least the user receives, the quote's amountOutMin (5946 sats)
    expect(g.minOutText).toBe('0.00005946 WBTC');
    const p = routeView(paid!, { from: tok('USDC', 6, '1'), to: tok('WBTC', 8, null), amountIn: 5_000_000n, sameChainNoUsdc: false, native: eth });
    expect(p.gasless).toBe(false);
    // the design's native amount: userGasUsd 0.016821 at $3,920.10 an ETH is 0.00000429 ETH
    expect(p.gasText).toBe('~ 0.00000429 ETH, you pay it');
    expect(p.usdOutText).toBeNull();
    const noPrice = routeView(paid!, { from: tok('USDC', 6, '1'), to: tok('WBTC', 8, null), amountIn: 5_000_000n, sameChainNoUsdc: false, native: { ...eth, priceUsd: null } });
    expect(noPrice.gasText).toBe('You pay it');
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
    expect(etaText(12)).toBe('12 Sec');
    expect(etaText(1200)).toBe('20 Mins');
  });
});
