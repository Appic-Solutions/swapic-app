import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { endFlags, endText, listInterval, mergeRows, orderView, tookOf } from './rows';

const c = (f: string) => JSON.parse(readFileSync(`tests/fixtures/contract/${f}`, 'utf8'));
const logo = () => '/x.png';

describe('orderView', () => {
  it('draws a refunded swap from the data (5.13 example)', () => {
    const v = orderView(c('scanner-search-tx.json').items[0], 1_793_220_800, logo);
    expect(v.status).toBe('refunded');
    expect(v.from).toMatchObject({ symbol: 'USDT', chain: 'Polygon', amountText: '120.00', usdText: '$120.00' });
    expect(v.refundLine).toBe('Refunded 119.80 USDC to 0xf00e…89ac on Polygon');
    expect(v.reason).toBe("This swap couldn't be filled, so you got 119.80 USDC back on Polygon."); // its reasonCode, notFilled; the backend's text is never read
    expect(v.gas).toBe('Gasless');
    expect(v.feeText).toBe('$0.69');
    expect(v.took).toBe('4 min');
  });
  it('draws a queued withdrawal from the pool (5.9 example)', () => {
    const v = orderView(c('orders-page.json').orders[0], 1_793_397_300, logo);
    expect(v.status).toBe('queued');
    expect(v.from).toMatchObject({ symbol: 'USDC', chain: 'Swapic Pool', amountText: '601.71' });
    expect(v.to.amountText).toBe('~601.11');
    expect(v.gas).toBe('No gas');
    expect(v.stageText).toMatch(/^In line/);
  });
  it('draws a stake\'s `to` as the pool, whatever chain an older backend writes (contract 5.7, plan check row 26)', () => {
    const r = c('orders-page.json').orders[0];
    const stake = { ...r, kind: 'stake' as const, id: `0x${'ab'.repeat(32)}`, from: { ...r.to }, to: { ...r.from, chain: 'icp:737ba355e855bd4b61279056603e0550' } };
    expect(orderView(stake, 1_793_397_300, logo).to).toMatchObject({ chain: 'Swapic Pool', symbol: 'USDC' });
  });
  it('names the receiver and the token of an undone ICP swap\'s refund (contract 5.10)', () => {
    const row = c('scanner-search-tx.json').items[0];
    const refund = { chain: 'icp:737ba355e855bd4b61279056603e0550', token: 'ryjl3-tyaaa-aaaaa-aaaba-cai', symbol: 'ICP', decimals: 8, amount: '1180000000', receiver: '3yfhk-v3nwx-2xo3k-pjyl5-ugvqk-ywkpy-qaq7m-aocl5-iz5re-kxxtc-2qe', tx: null, block: 2184903 };
    expect(orderView({ ...row, refund }, 1_793_220_800, logo).refundLine).toMatch(/^Refunded [\d.]+ ICP to 3yfhk…2qe on ICP$/);
  });
  it('never prints a number it cannot scale (Review Focus 1)', () => {
    const row = c('scanner-search-tx.json').items[0];
    const v = orderView({ ...row, to: { ...row.to, symbol: null, decimals: null } }, 0, logo);
    expect(v.to.symbol).toBe('ryjl3…cai');
    expect(v.to.amountText).toBe('');
  });
  it('keeps one row when both wallets see the same order (Review Focus 5)', () => {
    const r = c('scanner-search-tx.json').items[0];
    expect(mergeRows([[r], [{ ...r, direction: 'self' }]]).length).toBe(1);
    // a list refreshes faster only while one of its rows is still in progress
    expect(listInterval([{ outcome: 'delivered' }, { outcome: 'pending' }], 10_000, 30_000)).toBe(10_000);
    expect(listInterval([{ outcome: 'delivered' }, { outcome: 'refunded' }], 10_000, 30_000)).toBe(30_000);
    expect(listInterval([], 10_000, 30_000)).toBe(30_000);
  });
});

describe('how long it took (chain times, services d5e49ff)', () => {
  const row = c('scanner-search-tx.json').items[0];
  it('takes tookS when it is a number, never the watcher\'s clock (82 s by the watcher, 22 s by the chain)', () => {
    const r = { ...row, outcome: 'delivered', createdAt: 1_000, endedAt: 1_082, startedAt: 1_010, deliveredAt: 1_032, tookS: 22 };
    expect(tookOf(r)).toBe('22 sec');
    const v = orderView(r, 2_000, logo);
    expect(v.took).toBe('22 sec');
    expect(v.deliveredAt).toBe(1_032);
  });
  it('falls back to endedAt - createdAt only for a row written before chain times (both null, or left out)', () => {
    expect(tookOf({ outcome: 'delivered', createdAt: 1_000, endedAt: 1_082, deliveredAt: null, tookS: null })).toBe('1 min');
    expect(tookOf({ outcome: 'delivered', createdAt: 1_000, endedAt: 1_040 })).toBe('40 sec');
    // a chain time is known but tookS is not: no guess from the watcher's clock
    expect(tookOf({ outcome: 'delivered', createdAt: 1_000, endedAt: 1_082, deliveredAt: 1_032, tookS: null })).toBeNull();
  });
  it('shows nothing while it is pending', () => {
    expect(tookOf({ outcome: 'pending', createdAt: 1_000, endedAt: null, deliveredAt: null, tookS: null })).toBeNull();
    expect(tookOf({ outcome: 'pending', createdAt: 1_000, endedAt: 1_082, deliveredAt: null, tookS: 22 })).toBeNull();
    const v = orderView({ ...row, outcome: 'pending', stage: 'bridging', endedAt: null, refund: null, deliveredAt: 1_032, tookS: 22 }, 2_000, logo);
    expect(v.took).toBeNull();
    expect(v.deliveredAt).toBeNull();
  });
  it('never shows a negative time', () => expect(tookOf({ outcome: 'delivered', createdAt: 0, endedAt: 1, tookS: -3 })).toBe('0 sec'));
});


describe('endFlags and endText, one reading for the row, the Scanner and the order page', () => {
  const refunded = c('scanner-search-tx.json').items[0];
  const at = (over: object) => orderView({ ...refunded, ...over }, 1_793_220_800, logo);
  it('a refund: its title and how long, the refund side shown', () => {
    const v = at({});
    expect(endText(v)).toBe('Refunded in 4 min');
    expect(endFlags(v)).toEqual({ live: false, refund: true, asUsdc: false, stopped: false });
  });
  it('delivered as USDC: the USDC side, and how long', () => {
    const v = at({ reasonCode: 'deliveredAsUsdc' });
    expect(endText(v)).toBe('Delivered as USDC in 4 min');
    expect(endFlags(v)).toMatchObject({ refund: false, asUsdc: true });
  });
  it('never ran or held: the title alone, nothing received to show', () => {
    expect(endText(at({ outcome: 'failed', stage: 'failed', refund: null, reasonCode: 'other' }))).toBe("Didn't start");
    expect(endFlags(at({ outcome: 'failed', stage: 'failed', refund: null, reasonCode: 'other' })).stopped).toBe(true);
    expect(endText(at({ outcome: 'pending', stage: 'arrived', onHold: true }))).toBe('On hold');
  });
  it('a swap that never ran says what it cost: never "no fee was charged" on a you pay gas one, gas only with its own transaction', () => {
    const failed = { outcome: 'failed', stage: 'failed', refund: null, reasonCode: 'other' };
    const paid = at({ ...failed, gasMode: 'userPays', from: { ...refunded.from, tx: '0x684f95dab7af11295cd6afddac52254d67ef56082e6dba42eb7c5fe4de427f7a' } });
    expect(paid.reason).toBe('Your USDT never left your wallet and Swapic charged no fee. The gas you paid the network is not refunded. Get a new quote to try again.');
    expect(paid.reason).not.toMatch(/no fee was charged/);
    expect(paid.feeText).toBe('None');
    // its transaction never reached the chain (dropped, replaced, never sent): no gas spent on the swap
    expect(at({ ...failed, gasMode: 'userPays', from: { ...refunded.from, tx: null } }).reason).toBe('Your USDT never left your wallet, Swapic charged no fee, and the swap spent no gas. Get a new quote to try again.');
    expect(at({ ...failed, gasMode: 'gasless' }).reason).toBe('Nothing left your wallet and no fee was charged. Get a new quote to try again.');
  });
  it('a moving order reads its stage', () => {
    const v = orderView(c('orders-page.json').orders[0], 1_793_397_300, logo);
    expect(endFlags(v).live).toBe(true);
    expect(endText(v)).toMatch(/^In line/);
  });
});

describe('the route a row names', () => {
  const row = c('orders-page.json').orders[0];
  it('follows the row, and an older watcher reads as Swapic', () => {
    expect(orderView(row, 1_793_397_300, logo).viaMinter).toBe(false);
    expect(orderView({ ...row, viaMinter: true }, 1_793_397_300, logo).viaMinter).toBe(true);
  });
});
