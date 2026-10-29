import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { BalancesAnswer, ChainInfo, TokensAnswer } from '@/lib/api';
import { joinBalances, toUiToken } from './tokens';

const chains: ChainInfo[] = JSON.parse(readFileSync('tests/fixtures/contract/chains.json', 'utf8'));
const base = chains.find((c) => c.chainId === 'eip155:8453')!;
const tokens: TokensAnswer = JSON.parse(readFileSync('tests/fixtures/contract/tokens-8453.json', 'utf8'));
const balances: BalancesAnswer = JSON.parse(readFileSync('tests/fixtures/contract/balances.json', 'utf8'));

describe('tokens', () => {
  it('builds the components token with the chain numbering and a placeholder logo', () => {
    const t = toUiToken(tokens.tokens[0]!, base);
    expect(t).toMatchObject({ chain: 'eip155:8453', chainId: 8453, chainName: 'Base', chain_type: 'EVM', contractAddress: t.address });
    expect(t.logo).toBe('/images/logo/placeholder.png');
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
