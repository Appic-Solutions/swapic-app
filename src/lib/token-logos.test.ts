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

describe('WETH', () => {
  it('uses the app\'s own logo on every chain, over the list\'s, since the list\'s is cut off by the round crop', async () => {
    const { ownLogo } = await import('./token-logos');
    expect(ownLogo('eip155:8453', '0x4200000000000000000000000000000000000006')).toBe('/images/tokens/weth.png');
    expect(ownLogo('eip155:42161', '0x82AF49447D8A07E3BD95BD0D56F35241523FBAB1')).toBe('/images/tokens/weth.png');
    expect(ownLogo('eip155:8453', '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913')).toBeUndefined();
  });
});

describe('an order\'s native coin', () => {
  it('is the chain\'s own coin when the order writes it as 0xEeee…EEeE, as Swapic\'s orders do', () => {
    expect(fallbackLogo('eip155:137', '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE')).toBe('/images/logo/chains-logos/polygon.svg');
    expect(fallbackLogo('eip155:143', '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee')).toBe('/images/tokens/mon.svg');
  });
});

describe('a logo from the quoter\'s list, by address', () => {
  it('takes the listed token\'s logo, the native coin\'s for 0xEeee…, and nothing for a token not listed', async () => {
    const { logoInList } = await import('./token-logos');
    const answer = {
      chain: 'eip155:137',
      tokens: [
        { address: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270', symbol: 'WPOL', name: 'Wrapped POL', decimals: 18, logo: 'https://s2.example/wpol.png', verified: true, class: 'listed' },
        { address: '0x0000000000000000000000000000000000000000', symbol: 'POL', name: 'POL', decimals: 18, logo: 'https://s2.example/pol.png', verified: true, class: 'native' },
      ],
    };
    expect(logoInList(answer, '0x0D500B1d8E8eF31E21C99d1Db9A6444d3ADf1270')).toBe('https://s2.example/wpol.png');
    expect(logoInList(answer, '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE')).toBe('https://s2.example/pol.png');
    expect(logoInList(answer, '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913')).toBeNull();
  });
});
