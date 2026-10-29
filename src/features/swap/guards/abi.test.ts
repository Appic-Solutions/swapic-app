import { describe, expect, it } from 'vitest';
import type { PoolTerms } from '@/lib/api';
import { poolRefOf } from './abi';

// The canister's own vectors (canister/types/src/pool/tests.rs:13-75, at simplify 1bbb0a1).
const terms = (t: Partial<PoolTerms>): PoolTerms => ({ ref: '', salt: '', kind: 'stake', account: '', premium: '0', icpFees: '0', rebalanceShare: '0', candid: '0x', ...t });

describe('poolRefOf, the canister formula', () => {
  it('V1, a swap to the anonymous principal in ckUSDC', () => {
    expect(poolRefOf(terms({ kind: 'swap', account: '2vxsx-fae', tokenOut: 'xevnm-gaaaa-aaaar-qafnq-cai', minOut: '1000000', premium: '10000', icpFees: '10000', salt: `0x${'11'.repeat(32)}` })))
      .toBe('0x2ca558b613087d4829efcfc433da96c2803012b2840e9775d83f94e880a03a35');
  });
  it('V2, an EVM stake', () => {
    expect(poolRefOf(terms({ account: '0xf00EBA8E5Fd231b526ADFAAa68B4d0ede72A89AC', rebalanceShare: '500', salt: `0x${'22'.repeat(32)}` })))
      .toBe('0x27af0178f431306b588718a3e754c7fd1024ab2c720620145bec989680400b56');
  });
  it('V3, an ICP stake from a subaccount', () => {
    expect(poolRefOf(terms({ account: `2vxsx-fae.${'00'.repeat(31)}01`, salt: `0x${'33'.repeat(32)}` })))
      .toBe('0x66c5a89c63e57dbf6d1180f4af6090d5e7d98508d054e62b8f63d8a79c032b9d');
  });
  it('refuses a subaccount that is not 32 bytes, and a salt that is not', () => {
    expect(() => poolRefOf(terms({ account: '2vxsx-fae.01', salt: `0x${'33'.repeat(32)}` }))).toThrow(/poolTerms/);
    expect(() => poolRefOf(terms({ account: '2vxsx-fae', salt: '0x00' }))).toThrow(/poolTerms/);
  });
});
