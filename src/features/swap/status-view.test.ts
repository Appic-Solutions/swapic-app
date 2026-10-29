import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { statusView } from './status-view';

const c = (f: string) => JSON.parse(readFileSync(`tests/fixtures/contract/${f}`, 'utf8'));
const side = { symbol: 'ckBTC', logo: '', chain: 'ICP', chainLogo: '', amountText: '0.002403', usdText: '$249.31' };
const token = () => ({ symbol: 'ckBTC', decimals: 8 });

describe('statusView', () => {
  it('delivered: title, ring on the destination, every step done', () => {
    const v = statusView({ status: c('order-status-delivered.json'), steps: c('steps-delivered.json'), pay: side, get: side, nowSec: 1793407940, feeText: '$0.69', gasText: 'None, Swapic paid it', toWallet: 'x', orderId: 'x', token });
    expect(v.phase).toBe('delivered');
    expect(v.title).toBe('Delivered');
    expect(v.steps.every((s) => s.state === 'done')).toBe(true);
  });
  it('refunded: the refund line and the plain reason, from the data', () => {
    const row = c('scanner-search-tx.json').items[0];
    // the steps end with the refund and its closed word (contract 5.14); the status's own reason text is never read
    const d = c('steps-delivered.json');
    const steps = { ...d, outcome: 'refunded', steps: [...d.steps.slice(0, 2), { step: 'refunded', state: 'done', chain: 'eip155:137', atMs: 1793407990000, tx: null, block: null, amount: '119800000', token: null, reason: 'expired' }] };
    const v = statusView({ status: { ...c('order-status-delivered.json'), outcome: 'refunded', stage: 'refunded', refund: row.refund, reason: row.reason }, steps, pay: side, get: side, nowSec: 0, feeText: '', gasText: '', toWallet: '', orderId: '', token });
    expect(v.phase).toBe('refunded');
    expect(v.text).toBe('Refunded 119.80 USDC to 0xf00e…89ac on Polygon');
    expect(v.reason).toBe('The swap ran out of time');
  });
});
