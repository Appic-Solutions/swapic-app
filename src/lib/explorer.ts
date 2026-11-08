import { ICP_CHAIN } from '@/config';
import type { UiToken } from '@/components/ui/token-types';
import { chainRow } from './chains';

const PLACEHOLDER = '/images/logo/placeholder.png';
const explorerOf = (chainId: number) => chainRow(`eip155:${chainId}`)?.explorer ?? 'https://etherscan.io';

export const SOLANA_CHAIN = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
export type ChainKind = { kind: 'evm'; id: number } | { kind: 'icp' } | { kind: 'solana' };

/** What a CAIP-2 id names; null for a chain the app does not know how to treat. */
export function chainKind(caip2: string): ChainKind | null {
  if (caip2 === ICP_CHAIN) return { kind: 'icp' };
  if (caip2 === SOLANA_CHAIN) return { kind: 'solana' };
  const m = /^eip155:(\d+)$/.exec(caip2);
  return m ? { kind: 'evm', id: Number(m[1]) } : null;
}

/** The components' chain number: the EVM id, 0 for ICP, undefined for anything else. */
export function chainNumber(caip2: string): number | undefined {
  const kind = chainKind(caip2);
  return kind?.kind === 'evm' ? kind.id : kind?.kind === 'icp' ? 0 : undefined;
}

/** An EVM chain's id, where the code only ever runs for one: anything else is a bug. */
export function evmId(caip2: string): number {
  const kind = chainKind(caip2);
  if (kind?.kind !== 'evm') throw new Error(`not an EVM chain: ${caip2}`);
  return kind.id;
}

/** Base58 is case sensitive: only `0x` text is lowered. */
export const normalizeAddress = (text: string) => (/^0x/i.test(text) ? text.toLowerCase() : text);
export const isKnownChain = (caip2: string) => !!chainRow(caip2);
export const chainName = (caip2: string) => chainRow(caip2)?.name ?? caip2;
export const chainLogo = (caip2: string) => chainRow(caip2)?.logo ?? PLACEHOLDER;
export const txLink = (caip2: string, hash: string) =>
  `${chainRow(caip2)?.explorer ?? explorerOf(chainNumber(caip2) ?? 1)}/tx/${hash}`;
/** An ICP ledger has no block page we rely on; the link opens the ledger's dashboard page. */
export const icpBlockLink = (ledger: string, _block: number) => `https://dashboard.internetcomputer.org/canister/${ledger}`;
export function tokenLink(t: UiToken): string {
  if (t.chain_type === 'ICP') return `https://dashboard.internetcomputer.org/canister/${t.address}`;
  if (t.chain_type === 'SOLANA') return `https://solscan.io/token/${t.address}`;
  const e = explorerOf(t.chainId);
  return t.address === '0x0000000000000000000000000000000000000000' ? e : `${e}/token/${t.address}`;
}
