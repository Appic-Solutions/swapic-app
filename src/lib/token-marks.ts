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
  [...s.normalize('NFKC').replace(/[\u200b-\u200f\u2060\ufeff]/g, '')].map((ch) => LOOKALIKE[ch] ?? ch).join('').toUpperCase();

const addressKey = (chain: string, a: string) => (chain.startsWith('eip155:') ? a.toLowerCase() : a);

/** One chain's listed tokens by address and by the reading of their symbol (the first listed wins a reading). */
interface ChainIndex { byAddress: Map<string, ListedToken>; byReading: Map<string, ListedToken> }

function indexLists(lists: TokenLists): Map<string, ChainIndex> {
  const out = new Map<string, ChainIndex>();
  for (const [chain, listed] of Object.entries(lists)) {
    const byAddress = new Map<string, ListedToken>();
    const byReading = new Map<string, ListedToken>();
    for (const l of listed) {
      byAddress.set(addressKey(chain, l.address), l);
      const reading = symbolReading(l.symbol);
      if (!byReading.has(reading)) byReading.set(reading, l);
    }
    out.set(chain, { byAddress, byReading });
  }
  return out;
}

// built once per list (the repo's at module load), never per row or render
const INDEXES = new WeakMap<TokenLists, Map<string, ChainIndex>>([[TOKEN_LISTS, indexLists(TOKEN_LISTS)]]);
function indexFor(lists: TokenLists): Map<string, ChainIndex> {
  let index = INDEXES.get(lists);
  if (!index) INDEXES.set(lists, (index = indexLists(lists)));
  return index;
}

/** The listed token `t` is, or pretends to be (same reading of its symbol, another address); null when neither. */
export function listedFor(t: Pick<UiToken, 'chain' | 'address' | 'symbol'>, lists: TokenLists = TOKEN_LISTS): { token: ListedToken; same: boolean } | null {
  const index = indexFor(lists).get(t.chain);
  if (!index) return null;
  const same = index.byAddress.get(addressKey(t.chain, t.address));
  if (same) return { token: same, same: true };
  const imitated = index.byReading.get(symbolReading(t.symbol));
  return imitated ? { token: imitated, same: false } : null;
}

/** Each chain's own coin as the quoter names it: the zero address on EVM, the ICP ledger on ICP. Ticked like the list. */
const NATIVE_COINS = new Set(['0x0000000000000000000000000000000000000000', 'ryjl3-tyaaa-aaaaa-aaaba-cai']);
export function markOf(t: Pick<UiToken, 'chain' | 'address' | 'symbol' | 'verified'>, lists: TokenLists = TOKEN_LISTS): TokenMark {
  if (t.verified && NATIVE_COINS.has(addressKey(t.chain, t.address))) return 'verified';
  const l = listedFor(t, lists);
  if (l) return l.same ? 'verified' : 'fake';
  return t.verified ? 'plain' : 'unverified';
}

/** A mark that asks for a confirm before the token is picked. */
export const needsConfirm = (m: TokenMark) => m === 'unverified' || m === 'fake';
