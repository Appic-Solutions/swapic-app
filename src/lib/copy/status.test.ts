import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { problems } from '../../../scripts/check-copy.mjs';
import { reasonSentence, refundLine, short, stepViews, tokenAmountText, tookText } from './status';

const contract = (f: string) => JSON.parse(readFileSync(`tests/fixtures/contract/${f}`, 'utf8'));
const META: Record<string, { symbol: string; decimals: number }> = {
  'mxzaz-hqaaa-aaaar-qaada-cai': { symbol: 'ckBTC', decimals: 8 },
  '0xaf88d065e77c8cc2239327c5edb3a432268e5831': { symbol: 'USDC', decimals: 6 },
};
const token = (_c: string | null, t: string | null) => (t ? META[t.toLowerCase()] ?? null : null);

describe('status words', () => {
  it('turns the contract steps into the design labels', () => {
    const v = stepViews(contract('steps-delivered.json'), { gasMode: 'gasless', refund: null, token });
    expect(v.map((s) => s.label)).toEqual(['Signed, no gas', 'Sent on Arbitrum', 'On its way to ICP', 'Paid out on ICP', 'Delivered 0.002403 ckBTC']);
    expect(v[1]!.took).toBe('3.1 s');
    expect(v[1]!.tx?.href).toMatch(/^https:\/\/arbiscan\.io\/tx\/0x684f/);
    expect(v[3]!.tx?.text).toBe('block 2,184,903');
  });
  it('writes the refund from the data (spec 5.2)', () => {
    const row = contract('scanner-search-tx.json').items[0];
    expect(refundLine(row.refund)).toBe('Refunded 119.80 USDC to 0xf00e…89ac on Polygon');
    expect(refundLine({ ...row.refund, chain: null })).toBe('Your stake is back');
  });
  it('turns each closed reason word into its sentence, never the backend text (Review Focus 5)', () => {
    const same = { refundChain: 'eip155:137', fromChain: 'eip155:137' };
    const away = { refundChain: 'icp:737ba355e855bd4b61279056603e0550', fromChain: 'eip155:1' };
    expect(reasonSentence('expired', away)).toBe('The swap ran out of time');
    expect(reasonSentence('timedOut', away)).toBe('The swap ran out of time');
    expect(reasonSentence('priceMoved', away)).toBe('The price moved past your limit');
    expect(reasonSentence('notFilled', same)).toBe('The swap could not be filled');
    expect(reasonSentence('poolShort', away)).toBe('The pool could not pay it right now');
    expect(reasonSentence('stopped', away)).toBe('Stopped, our team is on it');
    expect(reasonSentence('other', same)).toBe('The swap could not be filled');
    expect(reasonSentence(null, away)).toBe('The swap could not finish');
    // the contract's row carries the text and the word: only the word is read
    const row = contract('scanner-search-tx.json').items[0];
    expect(reasonSentence(row.reasonCode, { refundChain: row.refund.chain, fromChain: row.from.chain })).toBe('The swap could not be filled');
    expect(reasonSentence('the intent was not filled before its deadline', away)).toBe('The swap could not finish');
  });
  it('formats amounts, addresses and durations as the design does', () => {
    expect(tokenAmountText(119_800_000n, 6, 'USDC')).toBe('119.80');
    expect(tokenAmountText(240_300n, 8, 'ckBTC')).toBe('0.002403');
    expect(short('3yfhk-v3nwx-2xo3k-pjyl5-ugvqk-ywkpy-qaq7m-aocl5-iz5re-kxxtc-2qe')).toBe('3yfhk…2qe');
    expect(tookText(3100)).toBe('3.1 s');
    expect(tookText(125_000)).toBe('2 min');
  });
  it('every word it can produce passes the copy check', () => {
    const v = stepViews(contract('steps-delivered.json'), { gasMode: 'gasless', refund: null, token });
    const texts = [...v.map((s) => s.label), 'Waiting in line', 'Refunding', 'Your stake is back', ...['expired', 'priceMoved', 'notFilled', 'poolShort', 'stopped', null].map((w) => reasonSentence(w, { refundChain: null, fromChain: null }))];
    expect(problems(texts)).toEqual([]);
  });
});
