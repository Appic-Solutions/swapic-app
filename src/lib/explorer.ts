import { ICP_CHAIN } from '@/config';
import type { UiToken } from '@/components/ui/token-types';

const EVM: Record<number, { name: string; logo: string; explorer: string }> = {
  1: { name: 'Ethereum', logo: '/images/logo/chains-logos/ethereum.svg', explorer: 'https://etherscan.io' },
  137: { name: 'Polygon', logo: '/images/logo/chains-logos/polygon.svg', explorer: 'https://polygonscan.com' },
  8453: { name: 'Base', logo: '/images/logo/chains-logos/base.svg', explorer: 'https://basescan.org' },
  42161: { name: 'Arbitrum', logo: '/images/logo/chains-logos/arbitrum.svg', explorer: 'https://arbiscan.io' },
};
const ICP = { name: 'ICP', logo: '/images/logo/chains-logos/icp.svg' };

/** The components' chain number: the EVM id, 0 for ICP. Throws on a chain the app does not know. */
export function chainNumber(caip2: string): number {
  if (caip2 === ICP_CHAIN) return 0;
  const m = /^eip155:(\d+)$/.exec(caip2);
  if (!m) throw new Error(`unknown chain ${caip2}`);
  return Number(m[1]);
}
export function isKnownChain(caip2: string): boolean {
  try { return chainNumber(caip2) === 0 || chainNumber(caip2) in EVM; } catch { return false; }
}
export const chainName = (caip2: string) => (caip2 === ICP_CHAIN ? ICP.name : EVM[chainNumber(caip2)]?.name ?? caip2);
export const chainLogo = (caip2: string) => (caip2 === ICP_CHAIN ? ICP.logo : EVM[chainNumber(caip2)]?.logo ?? '/images/logo/placeholder.png');
export const txLink = (caip2: string, hash: string) => `${EVM[chainNumber(caip2)]?.explorer ?? 'https://etherscan.io'}/tx/${hash}`;
/** An ICP ledger has no block page we rely on; the link opens the ledger's dashboard page. */
export const icpBlockLink = (ledger: string, _block: number) => `https://dashboard.internetcomputer.org/canister/${ledger}`;
export function tokenLink(t: UiToken): string {
  if (t.chain_type === 'ICP') return `https://dashboard.internetcomputer.org/canister/${t.address}`;
  const e = EVM[t.chainId]?.explorer ?? 'https://etherscan.io';
  return t.address === '0x0000000000000000000000000000000000000000' ? e : `${e}/token/${t.address}`;
}
