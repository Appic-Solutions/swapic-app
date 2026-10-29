import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { orderView } from '@/features/activity/rows';
import { counts, filterRows, historyWallets } from './data';

const c = (f: string) => JSON.parse(readFileSync(`tests/fixtures/contract/${f}`, 'utf8'));
const views = [c('orders-page.json').orders[0], c('scanner-search-tx.json').items[0]].map((r) => orderView(r, 1_793_400_000, () => ''));

describe('history data', () => {
  it('asks for both connected wallets', () => {
    expect(historyWallets({ evm: { address: '0xf00eba8e5fd231b526adfaaa68b4d0ede72a89ac', chainId: 1 }, icp: { principal: '3yfhk-v3nwx-2xo3k-pjyl5-ugvqk-ywkpy-qaq7m-aocl5-iz5re-kxxtc-2qe', signer: 'OISY' } }))
      .toEqual(['0xf00eba8e5fd231b526adfaaa68b4d0ede72a89ac', '3yfhk-v3nwx-2xo3k-pjyl5-ugvqk-ywkpy-qaq7m-aocl5-iz5re-kxxtc-2qe']);
    expect(historyWallets({ evm: null, icp: null })).toEqual([]);
  });
  it('filters and counts like the design (All, Swaps, Pool)', () => {
    expect(counts(views)).toEqual({ All: 2, Swaps: 1, Pool: 1 });
    expect(filterRows(views, 'Pool').map((v) => v.kind)).toEqual(['withdraw']);
  });
});
