import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { clockText, short } from '@/lib/copy/status';
import { NOT_SEEN_GRACE_S, ownSteps, statusView, whenText } from './status-view';

const c = (f: string) => JSON.parse(readFileSync(`tests/fixtures/contract/${f}`, 'utf8'));
const side = { symbol: 'ckBTC', logo: '', chain: 'ICP', chainLogo: '', amountText: '0.002403', usdText: '$249.31' };
const token = () => ({ symbol: 'ckBTC', decimals: 8 });

describe('statusView', () => {
  it('delivered: title, ring on the destination, every step done', () => {
    const v = statusView({ status: c('order-status-delivered.json'), steps: c('steps-delivered.json'), pay: side, get: side, nowSec: 1793407940, feeText: '$0.69', gasText: 'None, Swapic paid it', gasMode: 'gasless', toWallet: 'x', orderId: 'x', token });
    expect(v.phase).toBe('delivered');
    expect(v.title).toBe('Delivered');
    expect(v.steps.every((s) => s.state === 'done')).toBe(true);
  });
  it('refunded: the refund line and the plain reason, from the data', () => {
    const row = c('scanner-search-tx.json').items[0];
    // the steps end with the refund and its closed word (contract 5.14); the status's own reason text is never read
    const d = c('steps-delivered.json');
    const steps = { ...d, outcome: 'refunded', steps: [...d.steps.slice(0, 2), { step: 'refunded', state: 'done', chain: 'eip155:137', atMs: 1793407990000, tx: null, block: null, amount: '119800000', token: null, reason: 'expired' }] };
    const v = statusView({ status: { ...c('order-status-delivered.json'), outcome: 'refunded', stage: 'refunded', refund: row.refund, reason: row.reason }, steps, pay: side, get: side, nowSec: 0, feeText: '', gasText: '', gasMode: 'userPays', toWallet: '', orderId: '', token });
    expect(v.phase).toBe('refunded');
    expect(v.text).toBe('Refunded 119.80 USDC to 0xf00e…89ac on Polygon');
    expect(v.reason).toBe('Took too long, so you got 119.80 USDC back on Polygon.');
  });
});

describe('statusView, the approved ends', () => {
  const base = c('order-status-delivered.json');
  const d = c('steps-delivered.json');
  const at = (outcome: string, reason: string | null, gasMode: 'gasless' | 'userPays', extra: object = {}) => statusView({
    status: { ...base, outcome, stage: outcome, refund: null, ...extra },
    steps: { ...d, outcome, steps: [d.steps[0], { step: 'failed', state: 'fail', chain: null, atMs: null, tx: null, block: null, amount: null, token: null, reason }] },
    pay: side, get: side, nowSec: 0, feeText: '$0.18', gasText: 'None', gasMode, toWallet: '', orderId: '0xabc', token,
  });
  it('a gasless signature never sent in time: Swap didn\'t start, nothing taken, no fee', () => {
    const v = at('failed', 'expired', 'gasless');
    expect(v.phase).toBe('stopped');
    expect(v.title).toBe("Swap didn't start");
    expect(v.text).toBe("We couldn't send your swap to the network in time. Nothing left your wallet and no fee was charged.");
    expect(v.fee).toBe('None');
  });
  it('reads who paid gas from the route\'s mode, never from the words on screen', () => {
    // the Gas row says None, but the route was you pay gas: an expired one simply never started
    expect(at('failed', 'expired', 'userPays').title).toBe("Didn't start");
  });
  it('an order refused before anything moved: Didn\'t start', () => {
    const v = at('failed', 'other', 'userPays');
    expect(v.title).toBe("Didn't start");
    expect(v.fee).toBe('None');
  });
  it('money the canister holds: On hold, from the hold flag even while pending', () => {
    const v = at('pending', null, 'userPays', { onHold: true });
    expect(v.phase).toBe('held');
    expect(v.title).toBe('On hold');
  });
});

describe('statusView, chain times (services d5e49ff)', () => {
  it('Arrived in and the total come from tookS, not the steps\' own times', () => {
    const status = { ...c('order-status-delivered.json'), startedAt: 1793407900, deliveredAt: 1793407922, tookS: 22 };
    const v = statusView({ status, steps: c('steps-delivered.json'), pay: side, get: side, nowSec: 1793407940, feeText: '', gasText: 'None, Swapic paid it', gasMode: 'gasless', toWallet: '', orderId: '', token });
    expect(v.text).toBe('Arrived in 22 sec');
    expect(v.totalText).toBe('22 sec total');
  });
  it('without chain times it reads the steps as before', () => {
    const v = statusView({ status: c('order-status-delivered.json'), steps: c('steps-delivered.json'), pay: side, get: side, nowSec: 1793407940, feeText: '', gasText: 'None, Swapic paid it', gasMode: 'gasless', toWallet: '', orderId: '', token });
    expect(v.text).not.toBe('Arrived in 22 sec');
    expect(v.text).toMatch(/^Arrived in /);
  });
});


describe('statusView, an order never seen starting by its deadline', () => {
  const DEADLINE = 1792336203;
  const past = DEADLINE + NOT_SEEN_GRACE_S + 1;
  const usdt = { ...side, symbol: 'USDT', chain: 'Ethereum', chainLogo: '/images/logo/chains-logos/ethereum.svg' };
  // the watcher's answer for a quoted order nothing started: pending, no source, and no steps (its steps door 404s)
  const quoted = { ...c('order-status-delivered.json'), status: 'quoted', srcTx: null, dstTx: null, outcome: 'pending', stage: 'quoted', etaAt: null, refund: null };
  const view = (o: { status?: object; steps?: object; nowSec?: number; deadline?: number | null; gasMode?: 'gasless' | 'userPays' } = {}) => statusView({
    status: { ...quoted, ...o.status } as never, steps: o.steps as never, pay: usdt, get: side, nowSec: o.nowSec ?? past,
    feeText: '$0.18', gasText: '~$0.42, you paid it', gasMode: o.gasMode ?? 'userPays', toWallet: '', orderId: '0xabc', token,
    deadline: o.deadline === undefined ? DEADLINE : o.deadline,
  });

  it('you pay gas, past the deadline and two minutes: Swap didn\'t start, the token kept, no fee or gas, a step that says so', () => {
    const v = view();
    expect(v.phase).toBe('stopped');
    expect(v.title).toBe("Swap didn't start");
    expect(v.text).toBe("Your swap wasn't confirmed on the network in time. Your USDT never left your wallet.");
    expect(v.fee).toBe('None');
    expect(v.gas).toBe('None');
    expect(v.steps.map((s) => [s.label, s.state])).toEqual([["Didn't start", 'fail']]);
  });
  it('before the deadline and two minutes it is still on its way', () => {
    expect(view({ nowSec: DEADLINE + NOT_SEEN_GRACE_S }).phase).toBe('progress');
  });
  it('never when the app saw its receipt (no deadline given), however late', () => {
    expect(view({ deadline: null, nowSec: DEADLINE + 3_600 }).phase).toBe('progress');
  });
  it('never once the tracking has a source transaction, a relay, or a hold', () => {
    expect(view({ status: { srcTx: '0x684f95dab7af11295cd6afddac52254d67ef56082e6dba42eb7c5fe4de427f7a' } }).phase).toBe('progress');
    expect(view({ status: { signedTxId: 103 } }).phase).toBe('progress');
    expect(view({ status: { onHold: true } }).phase).toBe('held');
  });
  it('the watcher\'s own failed answer later (300 s past the deadline) keeps the same words', () => {
    const v = view({ status: { status: 'failed', outcome: 'failed', stage: 'failed' } });
    expect(v.title).toBe("Swap didn't start");
    expect(v.text).toBe("Your swap wasn't confirmed on the network in time. Your USDT never left your wallet.");
  });
  it('a failure with another word stays the watcher\'s', () => {
    const d = c('steps-delivered.json');
    const steps = { ...d, outcome: 'failed', steps: [{ step: 'failed', state: 'fail', chain: null, atMs: null, tx: null, block: null, amount: null, token: null, reason: 'other' }] };
    expect(view({ status: { outcome: 'failed', stage: 'failed' }, steps }).title).toBe("Didn't start");
  });
  it('gasless: signed, then nothing: the approved Swap didn\'t start words, the signed step kept', () => {
    const d = c('steps-delivered.json');
    const steps = { ...d, outcome: 'pending', steps: d.steps.map((x: object, k: number) => (k === 0 ? x : { ...x, state: k === 1 ? 'wait' : 'todo', atMs: null, tx: null })) };
    const v = view({ gasMode: 'gasless', steps });
    expect(v.phase).toBe('stopped');
    expect(v.text).toBe("We couldn't send your swap to the network in time. Nothing left your wallet and no fee was charged.");
    expect(v.steps.map((s) => [s.label, s.state])).toEqual([['Signed, no gas', 'done'], ["Didn't start", 'fail']]);
  });
  it('the ring shows the chain the swap leaves from, never Swapic\'s mark', () => {
    expect(view({ nowSec: DEADLINE }).ringLogo).toBe('/images/logo/chains-logos/ethereum.svg');
    const d = statusView({ status: c('order-status-delivered.json'), steps: c('steps-delivered.json'), pay: usdt, get: side, nowSec: 1793407940, feeText: '', gasText: '', gasMode: 'gasless', toWallet: '', orderId: '', token });
    expect(d.ringLogo).toBe('/images/logo/chains-logos/ethereum.svg');
  });
});

describe('statusView, before Swapic has recorded the order (the Steps panel is never empty)', () => {
  // the watcher has the order as quoted at most: pending, no source, its steps door 404s or answers none
  const quoted = { ...c('order-status-delivered.json'), status: 'quoted', srcTx: null, dstTx: null, outcome: 'pending', stage: 'quoted', etaAt: null, refund: null, startedAt: undefined, tookS: undefined };
  const SENT_AT = 1793407924100;
  const TX = '0x684f95dab7af11295cd6afddac52254d67ef56082e6dba42eb7c5fe4de427f7a';
  const view = (o: { steps?: object; own?: { chain: string; tx: string | null; atMs: number } | null; gasMode?: 'gasless' | 'userPays'; status?: object } = {}) => statusView({
    status: { ...quoted, ...o.status } as never, steps: o.steps as never, pay: side, get: side, nowSec: Math.floor(SENT_AT / 1000) + 30,
    feeText: '$0.18', gasText: '~$0.42, you paid it', gasMode: o.gasMode ?? 'userPays', toWallet: '', orderId: '0xabc', token,
    own: o.own === undefined ? { chain: 'eip155:42161', tx: TX, atMs: SENT_AT } : o.own,
  });

  it('you pay gas, no steps answer yet: the swap sent on its chain with its link and time, then a row waiting for Swapic', () => {
    const v = view();
    expect(v.phase).toBe('progress');
    expect(v.early).toBe(true);
    expect(v.steps).toEqual([
      // the row Swapic will write for it, read by stepViews: the same words and link
      { key: '0-sent', label: 'Sent on Arbitrum', state: 'done', at: clockText(SENT_AT), took: undefined, tx: { text: short(TX), href: `https://arbiscan.io/tx/${TX}` } },
      { key: 'own-wait', label: 'Waiting for Swapic to pick it up', state: 'wait' },
    ]);
    expect(v.when).toBe(whenText(SENT_AT, (Math.floor(SENT_AT / 1000) + 30) * 1000));
  });
  it('an answer with no steps reads the same', () => {
    const steps = { ...c('steps-delivered.json'), outcome: 'pending', steps: [] };
    expect(view({ steps }).steps.map((s) => [s.label, s.state])).toEqual([['Sent on Arbitrum', 'done'], ['Waiting for Swapic to pick it up', 'wait']]);
  });
  it('gasless: the signature handed to Swapic, no transaction; an ICP sale: sent on ICP, no link', () => {
    const g = view({ gasMode: 'gasless', own: { chain: 'eip155:42161', tx: null, atMs: SENT_AT } });
    expect(g.steps.map((s) => [s.label, s.state, s.tx])).toEqual([['Signed, no gas', 'done', undefined], ['Waiting for Swapic to pick it up', 'wait', undefined]]);
    expect(ownSteps({ chain: 'icp:737ba355e855bd4b61279056603e0550', tx: null, atMs: SENT_AT }, 'gasless').map((s) => [s.label, s.tx])).toEqual([['Sent on ICP', undefined], ['Waiting for Swapic to pick it up', undefined]]);
  });
  it('Swapic\'s own steps replace them as soon as they come', () => {
    const d = c('steps-delivered.json');
    const steps = { ...d, outcome: 'pending', steps: d.steps.map((x: object, k: number) => (k < 2 ? x : { ...x, state: k === 2 ? 'wait' : 'todo', atMs: null })) };
    const v = view({ steps });
    expect(v.early).toBeUndefined();
    expect(v.steps.map((s) => s.label)).not.toContain('Waiting for Swapic to pick it up');
    expect(v.steps[1]!.label).toBe('Sent on Arbitrum');
  });
  it('an order that ended keeps its own steps, and with no send of the app\'s own nothing is made up', () => {
    expect(view({ status: { outcome: 'delivered', stage: 'delivered' } }).early).toBeUndefined();
    expect(view({ own: null }).steps).toEqual([]);
  });
  it('only while Swapic has not recorded the order (no stage, or the quote\'s): never once queued or later', () => {
    expect(view({ status: { stage: undefined } }).early).toBe(true);
    for (const stage of ['submitted', 'queued', 'swapping', 'bridging', 'minting']) {
      const v = view({ status: { status: stage, stage } });
      expect(v.early).toBeUndefined();
      expect(v.steps.map((x) => x.label)).not.toContain('Waiting for Swapic to pick it up');
    }
  });
});
