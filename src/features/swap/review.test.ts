import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Quote } from '@/lib/api';
import { pickOptions } from './options';
import { minOutOf, reviewData, reviewRefresh, shownMin } from './review';

const q: Quote = JSON.parse(readFileSync('tests/fixtures/real/quote/arb-usdc-to-pol-wbtc.json', 'utf8'));
const tok = (symbol: string, decimals: number, chain: string, address: string) => ({ key: '', chain, chainId: Number(chain.split(':')[1]), chainName: '', chainLogo: '', chain_type: 'EVM' as const, address, symbol, name: symbol, logo: '', decimals, priceUsd: null, verified: true });
const from = tok('USDC', 6, 'eip155:42161', q.fromToken.address.toLowerCase());
const to = tok('WBTC', 8, 'eip155:137', q.toToken.address.toLowerCase());

describe('reviewData', () => {
  it('shows the amounts the checks bind, the minimum a small cushion under the quote\'s (spec 5.2, rule 1)', () => {
    const [gasless, paid] = pickOptions(q, { indicative: false });
    const native = { symbol: 'ETH', decimals: 18, priceUsd: '3920.10' };
    const g = reviewData({ option: gasless!, quote: q, from, to, amountIn: 5_000_000n, native, recipient: { label: 'Your EVM wallet', address: '0xf00e', chain: 'eip155:137' } });
    expect(g.payText).toBe('5.00 USDC');
    // amountOutMin 5946 sats less 0.05% (2 sats): the route card's row says the same
    expect(g.minText).toBe('0.00005944 WBTC');
    expect(g.min).toBe(5_944n);
    expect(g.option.minOutText).toBe('0.00005944 WBTC');
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

describe('the cushioned minimum (the price moved only below what was shown)', () => {
  const [gasless] = pickOptions(q, { indicative: false });
  const withMin = (min: bigint) => ({ ...gasless!, route: { ...gasless!.route, amountOutMin: min.toString() } });
  // a 107 USDC payout as measured: the built order's network fee 53,506 against the list's 53,464 micro USDC
  const listMin = 106_946_536n;
  const builtMin = listMin - (53_506n - 53_464n);
  const shown = shownMin(withMin(listMin));
  it('shows 0.05% under the quote\'s own minimum, rounded down, at least 1 unit, never below 0', () => {
    expect(shown).toBe(listMin - 53_473n);
    expect(shownMin(withMin(1_999n))).toBe(1_998n);
    expect(shownMin(withMin(4_000n))).toBe(3_998n);
    expect(shownMin(withMin(1n))).toBe(0n);
    expect(shownMin(withMin(0n))).toBe(0n);
  });
  it('a built order a few dozen units lower is quiet; one under the shown minimum asks again', () => {
    expect(reviewRefresh(shown, withMin(builtMin)).kind).toBe('quiet');
    expect(reviewRefresh(shown, withMin(shown)).kind).toBe('quiet');
    expect(reviewRefresh(shown, withMin(shown - 1n)).kind).toBe('newPrice');
  });
  it('a quiet refresh keeps the minimum on screen, and raises it only when the fresh route\'s own is higher', () => {
    expect(shownMin(withMin(builtMin), shown)).toBe(shown);
    const higher = listMin + 1_000_000n;
    expect(shownMin(withMin(higher), shown)).toBe(higher - higher / 2000n);
    // a kept minimum the route no longer pays is never shown
    expect(shownMin(withMin(shown - 1n), shown)).toBe(shown - 1n - (shown - 1n) / 2000n);
    const usdc = tok('USDC', 6, 'eip155:137', '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359');
    const d = reviewData({ option: withMin(builtMin), quote: q, from, to: usdc, amountIn: 5_000_000n, native: { symbol: 'ETH', decimals: 18, priceUsd: null }, recipient: { label: 'Your EVM wallet', address: '0xf00e', chain: 'eip155:137' }, kept: shown });
    expect(d.min).toBe(shown);
    expect(d.minText).toBe('106.89 USDC');
    expect(d.option.minOutText).toBe('106.893 USDC');
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

