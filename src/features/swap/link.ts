// The shareable swap link (Jeff, 2026-10-29): the exact token keys the app already reads, written exactly as read so a
// copied link round trips: `/?from=eip155:42161|0xaf88…&to=icp:737ba355e855bd4b61279056603e0550|xevnm…&amount=250`.
// The receiving address is never part of it, read or written (a scam link could quietly send the money elsewhere).
import { config } from '@/config';
import { formatUnits, parseUnits } from '@/lib/money';
import { decode58 } from '@/lib/solana/base58';
import { SOLANA_CHAIN } from '@/lib/explorer';
import { isEvmAddress, isIcpPrincipal } from '@/lib/validation';

export interface TokenRef { chain: string; address: string }

/** `eip155:<id>|<0x address>` or `<ICP chain>|<ledger principal>` (also `icp|<ledger>`); anything else is not a token. */
export function parseTokenKey(text: string | null | undefined): TokenRef | null {
  if (!text) return null;
  const bar = text.indexOf('|');
  if (bar < 0) return null;
  const chain = text.slice(0, bar).trim();
  const address = text.slice(bar + 1).trim();
  if (/^eip155:[1-9]\d{0,9}$/.test(chain)) {
    return /^0x[0-9a-fA-F]{40}$/.test(address) && isEvmAddress(address.toLowerCase()) ? { chain, address: address.toLowerCase() } : null;
  }
  // a mint: 32 bytes of base58, on the curve or not
  if (chain === SOLANA_CHAIN) return address.length <= 44 && decode58(address)?.length === 32 ? { chain, address } : null;
  if (chain === config.icpChain || chain === 'icp') return isIcpPrincipal(address) ? { chain: config.icpChain, address } : null;
  return null;
}

/** The key a token carries (UiToken.key). */
export const tokenKeyOf = (t: TokenRef) => `${t.chain}|${t.address}`;

/** A typed amount the token can hold, in its canonical text; null when it does not parse or is not above zero. */
export function linkAmount(text: string | null | undefined, decimals: number): string | null {
  if (!text) return null;
  try {
    const v = parseUnits(text, decimals);
    return v > 0n ? formatUnits(v, decimals).replace(/,/g, '') : null;
  } catch {
    return null;
  }
}

/** What a link asks for: the tokens and the amount text. `send` (a receiving address) is never read. */
export function parseSwapLink(params: URLSearchParams): { from: TokenRef | null; to: TokenRef | null; amount: string | null } {
  return { from: parseTokenKey(params.get('from')), to: parseTokenKey(params.get('to')), amount: params.get('amount') };
}

// `:` and `|` stay readable; everything else is encoded
const enc = (v: string) => encodeURIComponent(v).replace(/%3A/gi, ':').replace(/%7C/gi, '|');

/** The query string for the picks on screen (empty when nothing is picked); the amount only when it is valid. */
export function swapLinkQuery(i: { from: { key: string; decimals: number } | null; to: { key: string } | null; amountText: string }): string {
  const parts: string[] = [];
  if (i.from) parts.push(`from=${enc(i.from.key)}`);
  if (i.to) parts.push(`to=${enc(i.to.key)}`);
  const amount = i.from ? linkAmount(i.amountText, i.from.decimals) : null;
  if (amount) parts.push(`amount=${enc(amount)}`);
  return parts.length ? `?${parts.join('&')}` : '';
}
