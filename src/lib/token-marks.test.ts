import { describe, expect, it } from 'vitest';
import { listedFor, markOf, needsConfirm, symbolReading, TOKEN_LISTS, type TokenLists } from './token-marks';

const BASE = 'eip155:8453';
const USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const lists: TokenLists = { [BASE]: [{ address: USDC, symbol: 'USDC' }], 'icp:737ba355e855bd4b61279056603e0550': [{ address: 'xevnm-gaaaa-aaaar-qafnq-cai', symbol: 'ckUSDC' }] };
const t = (address: string, symbol: string, verified = true, chain = BASE) => ({ chain, address, symbol, verified });

describe('token marks', () => {
  it('ticks the listed address on its chain, whatever its case', () => {
    expect(markOf(t(USDC.toUpperCase().replace('0X', '0x'), 'USDC'), lists)).toBe('verified');
    expect(markOf(t('xevnm-gaaaa-aaaar-qafnq-cai', 'ckUSDC', true, 'icp:737ba355e855bd4b61279056603e0550'), lists)).toBe('verified');
  });
  it('calls a listed symbol at another address fake, letters from another alphabet included', () => {
    const other = '0x9a4fe21c07b3d6a5e81f0c2d94b7a3e6f15c8d2b';
    expect(markOf(t(other, 'USDC'), lists)).toBe('fake');
    expect(markOf(t(other, 'USDС'), lists)).toBe('fake'); // Cyrillic Es
    expect(markOf(t(other, 'usdc'), lists)).toBe('fake');
    expect(markOf(t(other, 'US\u200bDC'), lists)).toBe('fake');
    expect(listedFor(t(other, 'USDС'), lists)?.token.address).toBe(USDC);
    // the same symbol on another chain is that chain's business
    expect(markOf(t(other, 'USDC', true, 'eip155:42161'), lists)).toBe('plain');
  });
  it('shows other known tokens plainly, and a token Swapic does not know as unverified', () => {
    expect(markOf(t('0x71c3b9e04a2d86f5c1e7b30d9a4f62e85c0d17a3', 'ORBT'), lists)).toBe('plain');
    expect(markOf(t('0x71c3b9e04a2d86f5c1e7b30d9a4f62e85c0d17a3', 'WOOF', false), lists)).toBe('unverified');
  });
  it('ticks each chain\'s own coin (the zero address on EVM, the ICP ledger)', () => {
    expect(markOf(t('0x0000000000000000000000000000000000000000', 'POL', true, 'eip155:137'))).toBe('verified');
    expect(markOf(t('ryjl3-tyaaa-aaaaa-aaaba-cai', 'ICP', true, 'icp:737ba355e855bd4b61279056603e0550'))).toBe('verified');
    expect(markOf(t('0x0000000000000000000000000000000000000000', 'POL', false, 'eip155:137'))).toBe('unverified');
  });
  it('asks to confirm only unverified and fake tokens', () => {
    expect(['verified', 'plain', 'unverified', 'fake'].map((m) => needsConfirm(m as never))).toEqual([false, false, true, true]);
    expect(symbolReading('ＵＳＤＣ')).toBe('USDC');
  });
  it('ticks the reviewed list: Circle USDC on Base, and a USDC at another Base address is fake', () => {
    expect(markOf(t(USDC, 'USDC'))).toBe('verified');
    expect(markOf(t('0x9a4fe21c07b3d6a5e81f0c2d94b7a3e6f15c8d2b', 'USDC'))).toBe('fake');
  });
  it('lists every address once, in lower case, under one of the ten chains', () => {
    const lists = Object.entries(TOKEN_LISTS);
    expect(lists).toHaveLength(10);
    for (const [chain, tokens] of lists) {
      expect(chain).toMatch(/^eip155:\d+$/);
      expect(new Set(tokens.map((x) => x.address)).size).toBe(tokens.length);
      for (const x of tokens) expect(x.address).toMatch(/^0x[0-9a-f]{40}$/);
    }
  });
});
