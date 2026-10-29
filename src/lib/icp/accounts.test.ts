import { describe, expect, it } from 'vitest';
import { hexToBytes, icpAccountText, parseIcpAccount } from './accounts';

const P = '3yfhk-v3nwx-2xo3k-pjyl5-ugvqk-ywkpy-qaq7m-aocl5-iz5re-kxxtc-2qe';

describe('accounts', () => {
  it('reads principal and principal.subaccount_hex, and writes them back', () => {
    expect(icpAccountText(parseIcpAccount(P))).toBe(P);
    const sub = '00'.repeat(31) + '01';
    const a = parseIcpAccount(`${P}.${sub}`);
    expect(a.subaccount[0]?.length).toBe(32);
    expect(icpAccountText(a)).toBe(`${P}.${sub}`);
  });
  it('refuses a short subaccount and odd hex', () => {
    expect(() => parseIcpAccount(`${P}.0102`)).toThrow();
    expect(() => hexToBytes('0xabc')).toThrow();
    expect(Array.from(hexToBytes('0x0aff'))).toEqual([10, 255]);
  });
});
