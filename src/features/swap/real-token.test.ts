import { describe, expect, it, vi } from 'vitest';
import type { ChainInfo, TokensAnswer } from '@/lib/api';
import type { UiToken } from '@/components/ui/token-types';
import { findReal } from './real-token';

const BASE = 'eip155:8453';
const USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const chain: ChainInfo = { chainId: BASE, name: 'Base', nativeToken: { address: '0x0000000000000000000000000000000000000000', symbol: 'ETH', decimals: 18 }, usdc: { address: USDC, decimals: 6 }, gasless: true };
const ui = (address: string, symbol: string): UiToken => ({
  key: `${BASE}|${address}`, chain: BASE, chainId: 8453, chainName: 'Base', chainLogo: '', chain_type: 'EVM', address, symbol, name: symbol, logo: '', decimals: 6, priceUsd: null, verified: true,
});
const fake = ui('0x9a4fe21c07b3d6a5e81f0c2d94b7a3e6f15c8d2b', 'USDС');
const answer = (address: string): TokensAnswer => ({ chain: BASE, tokens: [{ address, symbol: 'USDC', name: 'USD Coin', decimals: 6, verified: true, class: 'stable' }] });

describe('Use the real X', () => {
  it('takes the real token from the rows on screen without asking', async () => {
    const ask = vi.fn();
    const real = ui(USDC, 'USDC');
    expect(await findReal(fake, [fake, real], chain, ask)).toBe(real);
    expect(ask).not.toHaveBeenCalled();
  });
  it('asks the list for it by address, and takes only that address', async () => {
    expect((await findReal(fake, [fake], chain, async () => answer(USDC)))?.address).toBe(USDC);
    expect(await findReal(fake, [fake], chain, async () => answer('0x0000000000000000000000000000000000000001'))).toBeNull();
  });
  it('answers null when the ask fails or the chain is unknown, so the confirm can say so', async () => {
    expect(await findReal(fake, [fake], chain, async () => { throw new Error('offline'); })).toBeNull();
    expect(await findReal(fake, [fake], undefined, async () => answer(USDC))).toBeNull();
  });
});
