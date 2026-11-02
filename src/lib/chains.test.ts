import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CHAINS, chainPlace, payoutPlace } from './chains';
import { chainLogo, chainName, txLink } from './explorer';

describe('the one chain table', () => {
  it('names, logos and explorers come from it', () => {
    expect(chainName('eip155:8453')).toBe('Base');
    expect(chainLogo('eip155:10')).toBe('/images/logo/chains-logos/optimism.svg');
    expect(txLink('eip155:42161', '0xab')).toBe('https://arbiscan.io/tx/0xab');
    expect(chainName('eip155:5')).toBe('eip155:5');
  });
  it('orders chains as the table does, the pool chain first for payouts', () => {
    expect(chainPlace('icp:737ba355e855bd4b61279056603e0550')).toBe(0);
    expect(chainPlace('eip155:5')).toBe(CHAINS.length);
    const payouts = ['eip155:137', 'eip155:1', 'eip155:8453', 'eip155:42161'].sort((a, b) => payoutPlace(a) - payoutPlace(b));
    expect(payouts).toEqual(['eip155:8453', 'eip155:1', 'eip155:42161', 'eip155:137']);
  });
  it('lists which logo files are still missing (Jeff to supply them)', () => {
    const missing = CHAINS.filter((c) => !existsSync(`public${c.logo}`)).map((c) => c.name);
    expect(missing).toEqual(['Unichain', 'Monad', 'HyperEVM', 'World Chain', 'Plasma']);
  });
});
