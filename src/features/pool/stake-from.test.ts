import { describe, expect, it } from 'vitest';
import type { UiToken } from '@/components/ui/token-types';
import { defaultStakeFrom } from './stake-from';

const usdc = (chain: string, chainId: number): UiToken => ({
  key: `${chain}|0x${chainId}`, chain, chainId, chainName: chain, chainLogo: '', chain_type: chain.startsWith('icp') ? 'ICP' : 'EVM',
  address: `0x${chainId}`, symbol: 'USDC', name: 'USD Coin', logo: '', decimals: 6, priceUsd: null, verified: true,
});
const tokens = [usdc('eip155:1', 1), usdc('eip155:8453', 8453), usdc('eip155:42161', 42161), usdc('eip155:137', 137)];

describe('defaultStakeFrom', () => {
  it('opens on the connected chain when Swapic serves USDC there', () => {
    expect(defaultStakeFrom(tokens, 8453)?.chain).toBe('eip155:8453');
    expect(defaultStakeFrom(tokens, 137)?.chain).toBe('eip155:137');
  });
  it('falls back to Arbitrum for a chain Swapic does not serve, or no wallet', () => {
    expect(defaultStakeFrom(tokens, 10)?.chain).toBe('eip155:42161');
    expect(defaultStakeFrom(tokens, null)?.chain).toBe('eip155:42161');
  });
  it('never picks ckUSDC for an EVM chain id, and is null with nothing offered', () => {
    expect(defaultStakeFrom([usdc('icp:737ba355e855bd4b61279056603e0550', 0)], 0)?.chain).toBe('icp:737ba355e855bd4b61279056603e0550');
    expect(defaultStakeFrom([...tokens, usdc('icp:737ba355e855bd4b61279056603e0550', 0)], 0)?.chain).toBe('eip155:42161');
    expect(defaultStakeFrom([], 8453)).toBeNull();
  });
});
