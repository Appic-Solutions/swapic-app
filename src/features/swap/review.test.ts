import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Quote } from '@/lib/api';
import { pickOptions } from './options';
import { minOutOf, reviewData, reviewRefresh } from './review';

const q: Quote = JSON.parse(readFileSync('tests/fixtures/real/quote/arb-usdc-to-pol-wbtc.json', 'utf8'));
const tok = (symbol: string, decimals: number, chain: string, address: string) => ({ key: '', chain, chainId: Number(chain.split(':')[1]), chainName: '', chainLogo: '', chain_type: 'EVM' as const, address, symbol, name: symbol, logo: '', decimals, priceUsd: null, verified: true });
const from = tok('USDC', 6, 'eip155:42161', q.fromToken.address.toLowerCase());
const to = tok('WBTC', 8, 'eip155:137', q.toToken.address.toLowerCase());

describe('reviewData', () => {
  it('shows exactly the amounts the checks bind (spec 5.2, rule 1)', () => {
    const [gasless, paid] = pickOptions(q, { indicative: false });
    const native = { symbol: 'ETH', decimals: 18, priceUsd: '3920.10' };
    const g = reviewData({ option: gasless!, quote: q, from, to, amountIn: 5_000_000n, native, recipient: { label: 'Your EVM wallet', address: '0xf00e', chain: 'eip155:137' } });
    expect(g.payText).toBe('5.00 USDC');
    expect(g.minText).toBe('0.00005946 WBTC');
    expect(g.steps.map((s) => s.label)).toEqual(['Sign in your wallet (no gas)']);
    expect(g.button).toBe('Sign and swap');
    const p = reviewData({ option: paid!, quote: q, from, to, amountIn: 5_000_000n, native, recipient: { label: 'Your EVM wallet', address: '0xf00e', chain: 'eip155:137' } });
    // the exact amount: this approve comes back on every swap, so it never says once
    expect(p.steps.map((s) => s.label)).toEqual(['Approve USDC (you pay gas)', 'Confirm swap (you pay gas)']);
    expect(p.steps[0]!.sub).toBe('Lets Swapic use 5 USDC for this swap');
    expect(p.steps[1]!.sub).toBe('About 0.00000429 ETH');
    expect(p.button).toBe('Approve and swap');
  });
  it('a gasless route that must approve shows the step before its named quote comes, and blocks with no coin', () => {
    const [gasless] = pickOptions(q, { indicative: false });
    const option = { ...gasless!, route: { ...gasless!.route, needsApproval: true } };
    const data = (held: boolean | null) => reviewData({ option, quote: q, from, to, amountIn: 5_000_000n, native: { symbol: 'ETH', decimals: 18, priceUsd: '3920.10', held }, recipient: { label: 'Your EVM wallet', address: '0xf00e', chain: 'eip155:137' } });
    const a = data(true);
    expect(a.steps.map((s) => s.label)).toEqual(['Approve USDC (once, you pay gas)', 'Sign in your wallet (no gas)']);
    expect(a.steps[0]!.sub).toBe('Lets Swapic use your USDC. Only the first time.');
    expect(a.button).toBe('Approve and swap');
    expect(a.blocked).toBe(false);
    const b = data(false);
    expect(b.button).toBe('Add ETH to continue');
    expect(b.blocked).toBe(true);
  });
  it('a token whose allowance is set to 0 first says the wallet asks twice, on the one step', () => {
    const [gasless] = pickOptions(q, { indicative: false });
    const approval = { token: '0x1', spender: '0x2', amount: '1', resetFirst: true };
    const option = { ...gasless!, route: { ...gasless!.route, sign: { ...gasless!.route.sign!, approval } } };
    const d = reviewData({ option, quote: q, from, to, amountIn: 5_000_000n, native: { symbol: 'ETH', decimals: 18, priceUsd: '3920.10', held: true }, recipient: { label: 'Your EVM wallet', address: '0xf00e', chain: 'eip155:137' } });
    expect(d.steps.map((s) => s.sub)).toEqual(['Lets Swapic use your USDC. Only the first time. Your wallet asks twice: first it sets your USDC approval to 0.', 'Swapic sends it and pays the gas']);
  });
});

describe('reviewRefresh (Review swap\'s 20 s refresh)', () => {
  const [gasless] = pickOptions(q, { indicative: false });
  const withMin = (min: string) => ({ ...gasless!, route: { ...gasless!.route, amountOutMin: min } });
  const shown = minOutOf(gasless!);
  it('updates quietly when the fresh option pays the same or more', () => {
    expect(reviewRefresh(shown, withMin(shown.toString()))).toEqual({ kind: 'quiet', option: withMin(shown.toString()) });
    expect(reviewRefresh(shown, withMin((shown + 1n).toString())).kind).toBe('quiet');
  });
  it('is a new price when it pays less, by even one unit', () => {
    expect(reviewRefresh(shown, withMin((shown - 1n).toString())).kind).toBe('newPrice');
  });
  it('reads the least out the checks bind, never the estimate', () => {
    const more = { ...withMin((shown - 1n).toString()), route: { ...withMin((shown - 1n).toString()).route, amountOut: '999999999999' } };
    expect(reviewRefresh(shown, more).kind).toBe('newPrice');
  });
  it('leaves the review as it is when the fresh quote has no option with that tag', () => {
    expect(reviewRefresh(shown, undefined)).toEqual({ kind: 'none' });
  });
});

