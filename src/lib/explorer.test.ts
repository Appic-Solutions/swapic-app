import { describe, expect, it } from 'vitest';
import { chainKind, chainName, chainNumber, evmId, isKnownChain, normalizeAddress, txLink } from './explorer';

describe('explorer', () => {
  it('numbers chains the way the components do', () => {
    expect(chainNumber('eip155:8453')).toBe(8453);
    expect(chainNumber('icp:737ba355e855bd4b61279056603e0550')).toBe(0);
    expect(chainNumber('solana:x')).toBeUndefined();
    expect(chainNumber('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp')).toBeUndefined();
  });
  it('reads a chain kind, and links a Solana transaction on Solscan', () => {
    expect(chainKind('eip155:8453')).toEqual({ kind: 'evm', id: 8453 });
    expect(chainKind('icp:737ba355e855bd4b61279056603e0550')).toEqual({ kind: 'icp' });
    expect(chainKind('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp')).toEqual({ kind: 'solana' });
    expect(chainKind('cosmos:1')).toBeNull();
    expect(txLink('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', 'abc')).toBe('https://solscan.io/tx/abc');
    expect(() => evmId('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp')).toThrow();
    expect(normalizeAddress('0xABC')).toBe('0xabc');
    expect(normalizeAddress('H6e8JkVf')).toBe('H6e8JkVf');
  });
  it('names chains and links transactions per chain', () => {
    expect(chainName('eip155:42161')).toBe('Arbitrum');
    expect(txLink('eip155:137', '0xab')).toBe('https://polygonscan.com/tx/0xab');
    expect(isKnownChain('eip155:10')).toBe(true);
    expect(isKnownChain('eip155:56')).toBe(false);
  });
});
