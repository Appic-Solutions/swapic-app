import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { problems } from '../../../scripts/check-copy.mjs';
import { endingOf, endSentence, endTitle, pillOf, refundLine, short, stageText, stepViews, tokenAmountText, tookText, type EndInput } from './status';

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
    expect(v[1]!.took).toBe('3.1 sec');
    expect(v[1]!.tx?.href).toMatch(/^https:\/\/arbiscan\.io\/tx\/0x684f/);
    expect(v[3]!.tx?.text).toBe('block 2,184,903');
  });
  it('says a ck deposit is minting, and how long that takes, only while it waits there', () => {
    const steps = contract('steps-delivered.json');
    const waiting = { ...steps, steps: steps.steps.map((s: { step: string; state: string }) => (s.step === 'onItsWay' ? { ...s, state: 'wait' } : s)) };
    const row = stepViews(waiting, { gasMode: 'gasless', refund: null, token, stage: 'minting' }).find((s) => s.key.endsWith('onItsWay'))!;
    expect(row.label).toBe('Minting ckUSDC on ICP');
    expect(row.sub).toBe('Takes about 20 minutes');
    const done = stepViews(steps, { gasMode: 'gasless', refund: null, token, stage: 'minting' }).find((s) => s.key.endsWith('onItsWay'))!;
    expect(done.label).toBe('On its way to ICP');
    expect(done.sub).toBeUndefined();
    const line = { kind: 'swap', stage: 'minting', to: { chain: 'icp:737ba355e855bd4b61279056603e0550' } };
    expect(stageText({ ...line, etaAt: 1_300 }, 100)).toBe('Minting ckUSDC on ICP, about 20 min');
    expect(stageText({ ...line, etaAt: null }, 100)).toBe('Minting ckUSDC on ICP');
    expect(problems(['Minting ckUSDC on ICP', 'Takes about 20 minutes'])).toEqual([]);
  });
  it('writes the refund from the data (spec 5.2)', () => {
    const row = contract('scanner-search-tx.json').items[0];
    expect(refundLine(row.refund)).toBe('Refunded 119.80 USDC to 0xf00e…89ac on Polygon');
    expect(refundLine({ ...row.refund, chain: null })).toBe('Your stake is back');
  });
  it('reads each end as the approved table does', () => {
    const at = (x: Partial<EndInput>) => endingOf({ id: '0xabc', outcome: 'failed', stage: 'failed', reasonCode: null, gasMode: 'userPays', ...x });
    expect(at({})).toBe('didntStart');
    expect(at({ gasMode: 'gasless', reasonCode: 'expired' })).toBe('notSent');
    expect(at({ gasMode: 'userPays', reasonCode: 'expired' })).toBe('didntStart');
    expect(at({ reasonCode: 'stopped' })).toBe('onHold');
    expect(at({ id: 'payout-7' })).toBe('onHold');
    expect(at({ outcome: 'refunded', reasonCode: 'deliveredAsUsdc' })).toBe('deliveredAsUsdc');
    expect(at({ outcome: 'refunded', reasonCode: 'priceMoved' })).toBe('refunded');
    expect(at({ outcome: 'pending', stage: 'queued' })).toBe('queued');
    // the hold flag (services S11, not final) wins over a pending order
    expect(at({ outcome: 'pending', stage: 'arrived', onHold: true })).toBe('onHold');
    expect(pillOf('deliveredAsUsdc')).toBe('delivered');
    expect(pillOf('notSent')).toBe('didntStart');
    expect(endTitle('notSent')).toBe("Swap didn't start");
  });
  it('says what happened in one sentence, from the closed word, naming the amount and chain', () => {
    const row = contract('scanner-search-tx.json').items[0];
    const r = row.refund;
    const say = (code: string | null) => endSentence('refunded', { reasonCode: code, refund: r, toSymbol: 'WBTC' });
    expect(say('expired')).toBe('Took too long, so you got 119.80 USDC back on Polygon.');
    expect(say('timedOut')).toBe('Took too long, so you got 119.80 USDC back on Polygon.');
    expect(say('priceMoved')).toBe('The price moved more than you allowed, so you got 119.80 USDC back on Polygon.');
    expect(say('notFilled')).toBe("This swap couldn't be filled, so you got 119.80 USDC back on Polygon.");
    expect(say('poolShort')).toBe("Swapic couldn't complete this one right now, so you got 119.80 USDC back.");
    expect(say('the intent was not filled before its deadline')).toBe("This swap couldn't finish, so you got 119.80 USDC back on Polygon.");
    expect(endSentence('refunded', { reasonCode: null, refund: { ...r, chain: null }, toSymbol: null })).toBe('Your stake is back.');
    expect(endSentence('deliveredAsUsdc', { reasonCode: 'deliveredAsUsdc', refund: r, toSymbol: 'WBTC' })).toBe("WBTC couldn't be bought on Polygon, so you got 119.80 USDC instead.");
    expect(endSentence('didntStart', { reasonCode: null, refund: null, toSymbol: null })).toBe('Nothing left your wallet and no fee was charged. Get a new quote to try again.');
    expect(endSentence('notSent', { reasonCode: 'expired', refund: null, toSymbol: null })).toBe("We couldn't send your swap to the network in time. Nothing left your wallet and no fee was charged.");
    expect(endSentence('onHold', { reasonCode: 'stopped', refund: null, toSymbol: null })).toBe("Your money is safe. We're checking this swap and will finish or refund it.");
    expect(endSentence('delivered', { reasonCode: null, refund: null, toSymbol: null })).toBeNull();
  });
  it('formats amounts, addresses and durations as the design does', () => {
    expect(tokenAmountText(119_800_000n, 6, 'USDC')).toBe('119.80');
    expect(tokenAmountText(240_300n, 8, 'ckBTC')).toBe('0.002403');
    expect(short('3yfhk-v3nwx-2xo3k-pjyl5-ugvqk-ywkpy-qaq7m-aocl5-iz5re-kxxtc-2qe')).toBe('3yfhk…2qe');
    expect(tookText(3100)).toBe('3.1 sec');
    expect(tookText(125_000)).toBe('2 min');
  });
  it('every word it can produce passes the copy check', () => {
    const v = stepViews(contract('steps-delivered.json'), { gasMode: 'gasless', refund: null, token });
    const ends = ['refunded', 'deliveredAsUsdc', 'didntStart', 'notSent', 'onHold'] as const;
    const words = ['expired', 'priceMoved', 'notFilled', 'poolShort', 'deliveredAsUsdc', 'stopped', null];
    const texts = [
      ...v.map((s) => s.label), 'Waiting in line', 'Refunding', 'Your stake is back',
      ...ends.flatMap((e) => [endTitle(e)!, ...words.map((w) => endSentence(e, { reasonCode: w, refund: null, toSymbol: 'WBTC' })!)]),
    ];
    expect(problems(texts)).toEqual([]);
  });
});

describe('a swap through the ckETH minter', () => {
  it('names what the user waits on and its real time, and only while it waits', () => {
    const answer = { kind: 'swap', steps: [{ step: 'onItsWay', state: 'wait', chain: null, tx: null, block: null, amount: null, token: null, reason: null, atMs: null }] } as unknown as Parameters<typeof stepViews>[0];
    const ctx = { gasMode: 'gasless' as const, refund: null, token: () => null };
    const [wait] = stepViews(answer, { ...ctx, stage: 'withdrawing' });
    expect(wait!.label).toBe('The ckETH minter is paying USDC on Ethereum');
    expect(wait!.sub).toBe('Usually 2 to 6 minutes');
    const [other] = stepViews(answer, { ...ctx, stage: 'swapping' });
    expect(other!.sub).toBeUndefined();
    expect(stageText({ kind: 'swap', stage: 'withdrawing', etaAt: null, to: { chain: 'eip155:1' } }, 0)).toBe('The ckETH minter is paying USDC on Ethereum');
  });
});
