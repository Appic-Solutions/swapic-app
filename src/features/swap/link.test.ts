import { describe, expect, it } from 'vitest';
import { linkAmount, parseSwapLink, parseTokenKey, swapLinkQuery, tokenKeyOf } from './link';

const ICP = 'icp:737ba355e855bd4b61279056603e0550';
const ARB_USDC = 'eip155:42161|0xaf88d065e77c8cc2239327c5edb3a432268e5831';
const CKBTC = `${ICP}|mxzaz-hqaaa-aaaar-qaada-cai`;

describe('the swap link', () => {
  it('round trips the exact keys and the amount', () => {
    const query = swapLinkQuery({ from: { key: ARB_USDC, decimals: 6 }, to: { key: CKBTC }, amountText: '250' });
    expect(query).toBe(`?from=${ARB_USDC}&to=${CKBTC}&amount=250`);
    const back = parseSwapLink(new URLSearchParams(query));
    expect(tokenKeyOf(back.from!)).toBe(ARB_USDC);
    expect(tokenKeyOf(back.to!)).toBe(CKBTC);
    expect(back.amount).toBe('250');
    // the same link percent-encoded (as a browser may copy it) reads the same
    const encoded = parseSwapLink(new URLSearchParams(new URLSearchParams({ from: ARB_USDC, to: CKBTC }).toString()));
    expect(tokenKeyOf(encoded.from!)).toBe(ARB_USDC);
  });
  it('reads a checksummed address and the short ICP form, refuses anything else', () => {
    expect(parseTokenKey('eip155:42161|0xaf88d065e77c8cC2239327C5EDb3A432268e5831')).toEqual({ chain: 'eip155:42161', address: '0xaf88d065e77c8cc2239327c5edb3a432268e5831' });
    expect(parseTokenKey('icp|mxzaz-hqaaa-aaaar-qaada-cai')).toEqual({ chain: ICP, address: 'mxzaz-hqaaa-aaaar-qaada-cai' });
    for (const bad of ['USDC-arbitrum', 'eip155:42161|0x12', 'solana:1|abc', 'eip155:42161', '', `${ICP}|not-a-principal`]) expect(parseTokenKey(bad)).toBeNull();
  });
  it('never reads a receiving address from the link', () => {
    const p = parseSwapLink(new URLSearchParams(`from=${ARB_USDC}&send=0x000000000000000000000000000000000000dEaD`));
    expect(p).toEqual({ from: { chain: 'eip155:42161', address: '0xaf88d065e77c8cc2239327c5edb3a432268e5831' }, to: null, amount: null });
    expect(swapLinkQuery({ from: { key: ARB_USDC, decimals: 6 }, to: null, amountText: '1' })).not.toContain('send');
  });
  it('drops an amount the token cannot hold, never guesses one', () => {
    expect(linkAmount('250.50', 6)).toBe('250.5');
    for (const bad of ['abc', '1e5', '-3', '0', '1.1234567', '1,000']) expect(linkAmount(bad, 6)).toBeNull();
    expect(swapLinkQuery({ from: { key: ARB_USDC, decimals: 6 }, to: { key: CKBTC }, amountText: '1.1234567' })).toBe(`?from=${ARB_USDC}&to=${CKBTC}`);
  });
});
