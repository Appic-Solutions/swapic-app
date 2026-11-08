import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ActivityRow, OrderStatusAnswer, StepsAnswer } from '@/lib/api';
import { patchFromStatus, patchFromSteps, watchIds } from './end-watch';

const c = (f: string) => JSON.parse(readFileSync(`tests/fixtures/contract/${f}`, 'utf8'));
const pending: ActivityRow = c('scanner-latest.json').items[0];
const r = (id: string, createdAt: number, outcome: ActivityRow['outcome'] = 'pending') => ({ id, createdAt, outcome });

describe('watchIds', () => {
  it('the newest rows in progress, at most five, never a stake or a withdrawal without a status of its own', () => {
    const rows = [r('0x1', 1), r('0x2', 2, 'delivered'), r('payout-7', 3), r('stake-ab', 4), r('withdraw-cd', 5), r('0x6', 6), r('0x7', 7), r('0x8', 8), r('0x9', 9), r('0xa', 10)];
    expect(watchIds(rows)).toEqual(['0xa', '0x9', '0x8', '0x7', '0x6']);
    expect(watchIds(rows, 10)).toEqual(['0xa', '0x9', '0x8', '0x7', '0x6', 'payout-7', '0x1']);
  });
});

describe('patchFromStatus', () => {
  it('takes the end, what arrived and when from an ended status', () => {
    const s: OrderStatusAnswer = { ...c('order-status-delivered.json'), outcome: 'delivered', stage: 'delivered', amountOut: '74400000', deliveredAt: 1793408240, tookS: 26 };
    const v = patchFromStatus(s, 1793408300)(pending);
    expect(v).toMatchObject({ outcome: 'delivered', stage: 'delivered', endedAt: 1793408240, deliveredAt: 1793408240, tookS: 26 });
    expect(v.to.amount).toBe('74400000');
    expect(v.id).toBe(pending.id);
  });
});

describe('patchFromSteps', () => {
  it('takes the end and its reason word from ended steps', () => {
    const a: StepsAnswer = { id: pending.id, kind: 'swap', outcome: 'refunded', steps: [
      { step: 'signed', state: 'done', chain: 'eip155:8453', atMs: 1793408214000, tx: null, block: null, amount: null, token: null, reason: null },
      { step: 'refunded', state: 'done', chain: 'eip155:8453', atMs: 1793408300000, tx: '0x1', block: null, amount: '75000000', token: null, reason: 'deliveredAsUsdc' },
    ] };
    expect(patchFromSteps(a)(pending)).toMatchObject({ outcome: 'refunded', reasonCode: 'deliveredAsUsdc', endedAt: 1793408300 });
  });
});
