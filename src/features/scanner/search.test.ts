import { describe, expect, it } from 'vitest';
import { classify } from './search';

describe('classify', () => {
  it('turns wallets into chips and ids or hashes into lookups', () => {
    expect(classify(' 0xf00EBA8E5Fd231b526ADFAAa68B4d0ede72A89AC ')).toEqual({ kind: 'evm', value: '0xf00eba8e5fd231b526adfaaa68b4d0ede72a89ac' });
    expect(classify('3yfhk-v3nwx-2xo3k-pjyl5-ugvqk-ywkpy-qaq7m-aocl5-iz5re-kxxtc-2qe').kind).toBe('icp');
    expect(classify('0x278d9ce98715d455ab24565fd54356bad62b79be489524bddc5cdb672f741443').kind).toBe('lookup');
    expect(classify('payout-41').kind).toBe('lookup');
    expect(classify(`stake-${'ab'.repeat(32)}`).kind).toBe('lookup');
  });
  it('never sends what is none of the four forms (Review Focus 2)', () => {
    for (const t of ['0x12ab9f00c3', 'vitalik.eth', 'payout-', `stake-${'AB'.repeat(32)}`, '']) expect(classify(t).kind).toBe('none');
  });
});
