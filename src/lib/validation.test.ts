import { describe, expect, it } from 'vitest';
import { isEvmAddress, isIcpPrincipal } from './validation';

describe('isEvmAddress', () => {
  it('takes the checksummed address and the lower case one', () => {
    expect(isEvmAddress('0xf00EBA8E5Fd231b526ADFAAa68B4d0ede72A89AC')).toBe(true);
    expect(isEvmAddress('0xf00eba8e5fd231b526adfaaa68b4d0ede72a89ac')).toBe(true);
  });
  it('refuses a broken checksum, a short one and junk', () => {
    expect(isEvmAddress('0xf00EBA8E5Fd231b526ADFAAa68B4d0ede72A89Ac')).toBe(false);
    expect(isEvmAddress('0x3A9c2E07b5F81dC4')).toBe(false);
    expect(isEvmAddress('hello')).toBe(false);
  });
});

describe('isIcpPrincipal', () => {
  it('takes a principal', () => {
    expect(isIcpPrincipal('3yfhk-v3nwx-2xo3k-pjyl5-ugvqk-ywkpy-qaq7m-aocl5-iz5re-kxxtc-2qe')).toBe(true);
    expect(isIcpPrincipal('hfisl-ayaaa-aaaar-qch3q-cai')).toBe(true);
  });
  it('refuses the anonymous principal, a 64 hex account id and a typo', () => {
    expect(isIcpPrincipal('2vxsx-fae')).toBe(false);
    expect(isIcpPrincipal('a'.repeat(64))).toBe(false);
    expect(isIcpPrincipal('3yfhk-hdnwx-2xo3k-pjyl5-ugvqk-zsj4q-rrq7m-aocl5-iz5re-kxxtc-2qf')).toBe(false);
    // the design's and the contract's own example text fails its checksum (checked 2026-10-28): the app's test principal
    // above keeps its short form, 3yfhk…2qe, with a valid checksum
    expect(isIcpPrincipal('3yfhk-hdnwx-2xo3k-pjyl5-ugvqk-zsj4q-rrq7m-aocl5-iz5re-kxxtc-2qe')).toBe(false);
  });
});
