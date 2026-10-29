import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mergeRows, orderView } from './rows';

const c = (f: string) => JSON.parse(readFileSync(`tests/fixtures/contract/${f}`, 'utf8'));
const logo = () => '/x.png';

describe('orderView', () => {
  it('draws a refunded swap from the data (5.13 example)', () => {
    const v = orderView(c('scanner-search-tx.json').items[0], 1_793_220_800, logo);
    expect(v.status).toBe('refunded');
    expect(v.from).toMatchObject({ symbol: 'USDT', chain: 'Polygon', amountText: '120.00', usdText: '$120.00' });
    expect(v.refundLine).toBe('Refunded 119.80 USDC to 0xf00e…89ac on Polygon');
    expect(v.reason).toBe('The swap could not be filled'); // its reasonCode, notFilled; the backend's text is never read
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
  });
});
