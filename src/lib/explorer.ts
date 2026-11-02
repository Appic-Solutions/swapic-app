import { ICP_CHAIN } from '@/config';
import type { UiToken } from '@/components/ui/token-types';
import { chainRow } from './chains';

const PLACEHOLDER = '/images/logo/placeholder.png';
const explorerOf = (chainId: number) => chainRow(`eip155:${chainId}`)?.explorer ?? 'https://etherscan.io';

/** The components' chain number: the EVM id, 0 for ICP. Throws on a chain the app does not know. */
export function chainNumber(caip2: string): number {
  if (caip2 === ICP_CHAIN) return 0;
  const m = /^eip155:(\d+)$/.exec(caip2);
  if (!m) throw new Error(`unknown chain ${caip2}`);
  return Number(m[1]);
}
export const isKnownChain = (caip2: string) => !!chainRow(caip2);
export const chainName = (caip2: string) => chainRow(caip2)?.name ?? caip2;
export const chainLogo = (caip2: string) => chainRow(caip2)?.logo ?? PLACEHOLDER;
export const txLink = (caip2: string, hash: string) => `${explorerOf(chainNumber(caip2))}/tx/${hash}`;
/** An ICP ledger has no block page we rely on; the link opens the ledger's dashboard page. */
export const icpBlockLink = (ledger: string, _block: number) => `https://dashboard.internetcomputer.org/canister/${ledger}`;
export function tokenLink(t: UiToken): string {
  if (t.chain_type === 'ICP') return `https://dashboard.internetcomputer.org/canister/${t.address}`;
  const e = explorerOf(t.chainId);
  return t.address === '0x0000000000000000000000000000000000000000' ? e : `${e}/token/${t.address}`;
}
