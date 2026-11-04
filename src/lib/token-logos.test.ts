import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FALLBACK_FILES, fallbackLogo } from './token-logos';

describe('the token logo fallback', () => {
  it('names the native coin by the zero address or "native"', () => {
    expect(fallbackLogo('eip155:8453', '0x0000000000000000000000000000000000000000')).toBe('/images/logo/chains-logos/ethereum.svg');
    expect(fallbackLogo('eip155:143', 'native')).toBe('/images/tokens/mon.svg');
  });
  it('finds an EVM token in any case and an ICP ledger by its principal', () => {
    expect(fallbackLogo('eip155:999', '0x9FDBDA0A5E284C32744D2F17EE5C74B284993463')).toBe('/images/tokens/ubtc.svg');
    expect(fallbackLogo('icp:737ba355e855bd4b61279056603e0550', 'mxzaz-hqaaa-aaaar-qaada-cai')).toBe('/images/tokens/ckbtc.svg');
  });
  it('knows nothing else', () => {
    expect(fallbackLogo('eip155:8453', '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913')).toBeUndefined();
    expect(fallbackLogo('eip155:5', 'native')).toBeUndefined();
  });
  it('has every file it names', () => {
    expect(FALLBACK_FILES.filter((f) => !existsSync(`public${f}`))).toEqual([]);
  });
});
