import { describe, expect, it } from 'vitest';
import { chainName, chainNumber, isKnownChain, txLink } from './explorer';

describe('explorer', () => {
  it('numbers chains the way the components do', () => {
    expect(chainNumber('eip155:8453')).toBe(8453);
    expect(chainNumber('icp:737ba355e855bd4b61279056603e0550')).toBe(0);
    expect(() => chainNumber('solana:x')).toThrow();
  });
  it('names chains and links transactions per chain', () => {
    expect(chainName('eip155:42161')).toBe('Arbitrum');
    expect(txLink('eip155:137', '0xab')).toBe('https://polygonscan.com/tx/0xab');
    expect(isKnownChain('eip155:10')).toBe(false);
  });
});
