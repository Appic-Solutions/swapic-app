// The token marks (the calmer design Jeff approved, 2026-11-01, design-sync verified-tokens.tsx): a blue tick on tokens of
// Swapic's own hand made list (src/config/verified-tokens.json, the top tokens of each chain, filled after Jeff's review);
// other tokens Swapic knows (the quoter's `verified`) show plainly; a token Swapic does not know (one found by its pasted
// address) is "Unverified"; a token that takes a listed token's symbol at another address, letters from another alphabet
// included, is "Fake". Unverified and fake tokens are picked only after a confirm.
import list from '@/config/verified-tokens.json';
import type { UiToken } from '@/components/ui/token-types';

/** One listed token: `address` lower case on EVM, the ledger principal on ICP. */
export interface ListedToken { address: string; symbol: string }
/** The list file's shape: CAIP-2 chain id to its listed tokens. */
export type TokenLists = Record<string, ListedToken[]>;
export type TokenMark = 'verified' | 'plain' | 'unverified' | 'fake';

export const TOKEN_LISTS: TokenLists = list;

// Letters from other alphabets that read as Latin capitals (Cyrillic, Greek), and the invisible characters a name can hide.
const LOOKALIKE: Record<string, string> = {
  А: 'A', В: 'B', С: 'C', Е: 'E', Н: 'H', І: 'I', Ј: 'J', К: 'K', М: 'M', О: 'O', Р: 'P', Ѕ: 'S', Т: 'T', Х: 'X', У: 'Y',
  а: 'A', в: 'B', с: 'C', е: 'E', н: 'H', і: 'I', ј: 'J', к: 'K', м: 'M', о: 'O', р: 'P', ѕ: 'S', т: 'T', х: 'X', у: 'Y',
  Α: 'A', Β: 'B', Ε: 'E', Ζ: 'Z', Η: 'H', Ι: 'I', Κ: 'K', Μ: 'M', Ν: 'N', Ο: 'O', Ρ: 'P', Τ: 'T', Υ: 'Y', Χ: 'X',
  α: 'A', ι: 'I', κ: 'K', ν: 'V', ο: 'O', ρ: 'P', τ: 'T', υ: 'U', χ: 'X',
};
/** A symbol as it reads: compatibility forms folded, lookalike letters made Latin, invisible characters dropped, capitals. */
export const symbolReading = (s: string) =>
  [...s.normalize('NFKC').replace(/[​-‏⁠﻿]/g, '')].map((ch) => LOOKALIKE[ch] ?? ch).join('').toUpperCase();

const sameAddress = (chain: string, a: string, b: string) => (chain.startsWith('eip155:') ? a.toLowerCase() === b.toLowerCase() : a === b);

/** The listed token `t` is, or pretends to be (same reading of its symbol, another address); null when neither. */
export function listedFor(t: Pick<UiToken, 'chain' | 'address' | 'symbol'>, lists: TokenLists = TOKEN_LISTS): { token: ListedToken; same: boolean } | null {
  const listed = lists[t.chain] ?? [];
  const same = listed.find((l) => sameAddress(t.chain, l.address, t.address));
  if (same) return { token: same, same: true };
  const reading = symbolReading(t.symbol);
  const imitated = listed.find((l) => symbolReading(l.symbol) === reading);
  return imitated ? { token: imitated, same: false } : null;
}

export function markOf(t: Pick<UiToken, 'chain' | 'address' | 'symbol' | 'verified'>, lists: TokenLists = TOKEN_LISTS): TokenMark {
  const l = listedFor(t, lists);
  if (l) return l.same ? 'verified' : 'fake';
  return t.verified ? 'plain' : 'unverified';
}

/** A mark that asks for a confirm before the token is picked. */
export const needsConfirm = (m: TokenMark) => m === 'unverified' || m === 'fake';
