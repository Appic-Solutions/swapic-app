import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Quote } from '@/lib/api';
import { pickOptions } from './options';
import { reviewData } from './review';

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
    expect(p.steps.map((s) => s.label)).toEqual(['Approve USDC (once, you pay gas)', 'Confirm swap (you pay gas)']);
    expect(p.steps[1]!.sub).toBe('About 0.00000429 ETH');
    expect(p.button).toBe('Approve and swap');
  });
});
