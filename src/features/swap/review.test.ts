import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Quote } from '@/lib/api';
import { cushioned, forPayer, pickOptions } from './options';
import { minOutOf, reviewData, reviewRefresh, sameSteps } from './review';

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

describe('You pay gas through Permit2: the steps say what is really asked', () => {
  const [, paid] = pickOptions(q, { indicative: false });
  const typedData = { types: {}, primaryType: 'PermitWitnessTransferFrom', domain: { chainId: 42161, verifyingContract: '0x1' }, message: {} };
  const maximum = { token: '0x1', spender: '0x2', amount: '1' };
  const withField = (approval?: typeof maximum & { resetFirst?: boolean }) => ({ ...paid!, route: { ...paid!.route, permit2Pay: { typedData, nonce: '1', deadline: '2', ...(approval ? { approval } : {}) } } });
  const review = (option: ReturnType<typeof withField>, pending?: boolean) => reviewData({ option, quote: q, from, to, amountIn: 5_000_000n, native: { symbol: 'ETH', decimals: 18, priceUsd: '3920.10', held: true }, recipient: { label: 'Your EVM wallet', address: '0xf00e', chain: 'eip155:137' }, pending });
  it('first time: approve once, sign, confirm', () => {
    const d = review(withField(maximum));
    expect(d.steps).toEqual([
      { label: 'Approve USDC (once, you pay gas)', sub: 'Lets Swapic use your USDC. Only the first time.' },
      { label: 'Sign in your wallet (no gas)', sub: 'Lets Swapic use 5 USDC for this swap' },
      { label: 'Confirm swap (you pay gas)', sub: 'About 0.00000429 ETH' },
    ]);
    expect(d.button).toBe('Approve and swap');
    expect(d.blocked).toBe(false);
  });
  it('later swaps: sign, confirm', () => {
    const d = review(withField());
    expect(d.steps.map((s) => s.label)).toEqual(['Sign in your wallet (no gas)', 'Confirm swap (you pay gas)']);
    expect(d.button).toBe('Sign and swap');
  });
  it('a token whose allowance is set to 0 first says the wallet asks twice, on the one step', () => {
    expect(review(withField({ ...maximum, resetFirst: true })).steps[0]!.sub).toBe('Lets Swapic use your USDC. Only the first time. Your wallet asks twice: first it sets your USDC approval to 0.');
  });
  it('the old text stays on the old path alone: a payer who cannot sign has the exact approve, on every swap', () => {
    const d = review(forPayer(withField(maximum), false) as ReturnType<typeof withField>);
    expect(d.steps.map((s) => s.label)).toEqual(['Approve USDC (you pay gas)', 'Confirm swap (you pay gas)']);
    expect(d.steps[0]!.sub).toBe('Lets Swapic use 5 USDC for this swap');
    expect(d.button).toBe('Approve and swap');
    expect(review(forPayer(withField(), true) as ReturnType<typeof withField>).steps.map((s) => s.label)).toEqual(['Sign in your wallet (no gas)', 'Confirm swap (you pay gas)']);
  });
  it('a native input keeps today\'s one step, whatever the route carries (it has no approval)', () => {
    const native = { ...withField(maximum), route: { ...withField(maximum).route, approval: undefined, order: { ...paid!.route.order!, tokenIn: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' } } };
    expect(review(forPayer(native, true) as ReturnType<typeof withField>).steps.map((s) => s.label)).toEqual(['Confirm swap (you pay gas)']);
  });
  it('the priced route before its named quote claims no steps, and nothing can be read as one', () => {
    const d = review(paid! as ReturnType<typeof withField>, true);
    expect(d.pending).toBe(true);
    expect(d.steps).toEqual([]);
    // no step named yet: the button promises none of them
    expect(d.button).toBe('Getting your swap ready');
    expect(review(withField()).pending).toBe(false);
  });
  it('the allowance to Swapic already covers this swap: run(order) alone, whatever Permit2 would ask', () => {
    const covered = (approval?: typeof maximum) => { const o = withField(approval); const { approval: _a, ...route } = o.route; return { ...o, route }; };
    const d = review(forPayer(covered(maximum), true) as ReturnType<typeof withField>);
    expect(d.steps.map((s) => s.label)).toEqual(['Confirm swap (you pay gas)']);
    expect(d.button).toBe('Confirm swap');
    expect(review(forPayer(covered(), true) as ReturnType<typeof withField>).steps.map((s) => s.label)).toEqual(['Confirm swap (you pay gas)']);
  });
  it('sameSteps goes by label and place: a count or a label changed starts the list over, a fresher gas line does not', () => {
    const first = review(withField(maximum)).steps;
    const later = review(withField()).steps;
    const today = review(forPayer(withField(maximum), false) as ReturnType<typeof withField>).steps;
    expect(sameSteps(first, later)).toBe(false);
    // two rows each, and the first is another step: an approve's done must not stay on an unsigned Sign row
    expect(sameSteps(today, later)).toBe(false);
    expect(sameSteps(later, later.map((s) => ({ ...s, sub: 'About 1 ETH' })))).toBe(true);
  });
});

describe('the cushioned minimum (the price moved only below what was shown)', () => {
  const [gasless] = pickOptions(q, { indicative: false });
  const withMin = (min: bigint) => ({ ...gasless!, route: { ...gasless!.route, amountOutMin: min.toString() } });
  const usdc = tok('USDC', 6, 'eip155:137', '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359');
  const review = (min: bigint) => reviewData({ option: withMin(min), quote: q, from, to: usdc, amountIn: 5_000_000n, native: { symbol: 'ETH', decimals: 18, priceUsd: null }, recipient: { label: 'Your EVM wallet', address: '0xf00e', chain: 'eip155:137' } });
  // a 107 USDC payout as measured: the built order's network fee 53,506 against the list's 53,464 micro USDC
  const listMin = 106_946_536n;
  const shown = review(listMin).min;
  it('shows 0.05% under the quote\'s own minimum, rounded down; no cushion where 0.05% is under one unit', () => {
    expect(shown).toBe(listMin - 53_473n);
    expect(cushioned(4_000n)).toBe(3_998n);
    expect(cushioned(2_000n)).toBe(1_999n);
    expect(cushioned(1_999n)).toBe(1_999n);
    expect(cushioned(1n)).toBe(1n);
    expect(cushioned(0n)).toBe(0n);
  });
  it('a built order a few dozen units lower is quiet; one under the shown minimum asks again', () => {
    expect(reviewRefresh(shown, withMin(listMin - 42n)).kind).toBe('quiet');
    expect(reviewRefresh(shown, withMin(shown)).kind).toBe('quiet');
    expect(reviewRefresh(shown, withMin(shown - 1n)).kind).toBe('newPrice');
  });
  it('a quiet refresh shows the fresh quote\'s own cushioned minimum, up or down, so the cushion stands against it', () => {
    // a refresh whose least is 7 units above the minimum on screen: quiet, and the screen follows it down
    const fresh = shown + 7n;
    expect(reviewRefresh(shown, withMin(fresh)).kind).toBe('quiet');
    const after = review(fresh).min;
    expect(after).toBe(fresh - fresh / 2000n);
    // the order built at confirm, 42 units under that refresh: still quiet against what is on screen now
    expect(reviewRefresh(after, withMin(fresh - 42n)).kind).toBe('quiet');
    // a better quote raises it
    expect(review(listMin + 1_000_000n).min).toBe(listMin + 1_000_000n - (listMin + 1_000_000n) / 2000n);
  });
  it('the review shows the minimum once, in one format: its line and the route card\'s row', () => {
    const d = review(listMin);
    expect(d.minText).toBe('106.89 USDC');
    expect(d.option.minOutText).toBe(d.minText);
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

