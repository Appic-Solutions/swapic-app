import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { BalancesAnswer, ChainInfo, TokensAnswer } from '@/lib/api';
import type { UiToken } from '@/components/ui/token-types';
import { joinBalances, limiter, mergeAllChains, toUiToken, withBalance } from './tokens';

const chains: ChainInfo[] = JSON.parse(readFileSync('tests/fixtures/contract/chains.json', 'utf8'));
const base = chains.find((c) => c.chainId === 'eip155:8453')!;
const tokens: TokensAnswer = JSON.parse(readFileSync('tests/fixtures/contract/tokens-8453.json', 'utf8'));
const balances: BalancesAnswer = JSON.parse(readFileSync('tests/fixtures/contract/balances.json', 'utf8'));

describe('tokens', () => {
  it('builds the components token with the chain numbering; a logo the list lacks comes from the app, else the placeholder', () => {
    const t = toUiToken(tokens.tokens[0]!, base);
    expect(t).toMatchObject({ chain: 'eip155:8453', chainId: 8453, chainName: 'Base', chain_type: 'EVM', contractAddress: t.address });
    expect(t.logo).toBe('/images/logo/chains-logos/ethereum.svg');
    expect(toUiToken({ ...tokens.tokens[0]!, logo: 'https://logo.example/eth.png' }, base).logo).toBe('https://logo.example/eth.png');
    const usdbc = tokens.tokens.find((x) => x.symbol === 'USDbC')!;
    expect(toUiToken(usdbc, base).logo).toBe('/images/logo/placeholder.png');
  });
  it('joins balances by lower case address and ignores an answer for another chain', () => {
    const list = tokens.tokens.map((x) => toUiToken(x, base));
    const joined = joinBalances(list, balances, 'eip155:8453');
    const usdc = joined.find((x) => x.address === '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913')!;
    expect(usdc.balance).toBe(250_000_000n);
    expect(usdc.balanceText).toBe('250');
    expect(joinBalances(list, balances, 'eip155:42161').every((x) => x.balance === undefined)).toBe(true);
  });
});

describe('all chains', () => {
  const arb = chains.find((c) => c.chainId === 'eip155:42161')!;
  const onBase = tokens.tokens.slice(0, 3).map((x) => toUiToken({ ...x, priceUsd: x.symbol === 'ETH' ? '2000' : '1' }, base));
  const onArb = tokens.tokens.slice(0, 2).map((x) => toUiToken({ ...x, priceUsd: '1' }, arb));
  it('puts the held tokens first by dollar value, then one token from each chain in turn', () => {
    const [eth, weth, usdc] = onBase as [UiToken, UiToken, UiToken];
    const held = [withBalance(eth, 10n ** 15n), weth, withBalance(usdc, 5_000_000n)]; // $2 of ETH, $5 of USDC
    const merged = mergeAllChains([held, onArb]).map((t) => t.key);
    expect(merged).toEqual([usdc.key, eth.key, onArb[0]!.key, weth.key, onArb[1]!.key]);
  });
});

describe('the request limiter', () => {
  it('runs at most three at once and every call in turn', async () => {
    const turn = limiter(3);
    let now = 0;
    let most = 0;
    const done: number[] = [];
    const call = (i: number) => turn(async () => {
      now++; most = Math.max(most, now);
      await new Promise((r) => setTimeout(r, 5 + (i % 3)));
      now--; done.push(i);
      return i;
    });
    expect(await Promise.all([0, 1, 2, 3, 4, 5, 6].map(call))).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(most).toBe(3);
    expect(done).toHaveLength(7);
  });
  it('frees the place of a call that fails', async () => {
    const turn = limiter(1);
    await expect(turn(() => Promise.reject(new Error('down')))).rejects.toThrow('down');
    expect(await turn(async () => 'next')).toBe('next');
  });
});
