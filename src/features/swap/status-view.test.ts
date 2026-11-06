import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { statusView } from './status-view';

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

