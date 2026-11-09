// Every chain the app knows, in one table (src/config/chains.json, which the header script reads too): its CAIP-2 id,
// name, logo, explorer, and the public RPC hosts the wallet's reads need where WalletConnect's own RPC does not serve the
// chain (AppKit's WC_HTTP_RPC_SUPPORTED_CHAINS; those hosts join the CSP). The table's order is the order chains show in.
// Adding a chain is one row here, its logo file, and its AppKit network (evm-config.ts; chains.test.ts checks both).
import table from '@/config/chains.json';

export interface ChainRow { id: string; name: string; logo: string; explorer: string; rpcHosts: string[] }

export const CHAINS: readonly ChainRow[] = table;
export const CHAIN_IDS: readonly string[] = CHAINS.map((c) => c.id);
/** Solana is known to every build and offered only by the one its release turns on (design 6, step 13). */
export const SHOWN_CHAIN_IDS: readonly string[] = CHAIN_IDS.filter(
  (id) => !id.startsWith('solana:') || process.env.NEXT_PUBLIC_SWAPIC_SOLANA === '1' || process.env.NEXT_PUBLIC_SWAPIC_ENV === 'e2e',
);
export const SHOWN_CHAINS: readonly ChainRow[] = CHAINS.filter((c) => SHOWN_CHAIN_IDS.includes(c.id));
/** The pool's chain: payouts leave from it, so it is the quickest place to receive. */
export const POOL_CHAIN = 'eip155:8453';
/** Stake From's chain when the wallet's own chain holds no USDC the pool takes (stake-from.ts). */
export const DEFAULT_FROM_CHAIN = 'eip155:42161';

export const chainRow = (caip2: string): ChainRow | undefined => CHAINS.find((c) => c.id === caip2);
/** Where a chain shows in a list: its row's place, after every known chain when unknown. */
export const chainPlace = (caip2: string) => {
  const i = CHAIN_IDS.indexOf(caip2);
  return i < 0 ? CHAIN_IDS.length : i;
};
/** Where a payout chain shows in Receive on: the pool's chain first, then the table's order. */
export const payoutPlace = (caip2: string) => (caip2 === POOL_CHAIN ? -1 : chainPlace(caip2));
