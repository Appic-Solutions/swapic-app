// AppKit's network for every EVM chain of the one chain table (lib/chains.ts), Base first: the default network. Kept apart
// from evm-config.ts (which creates AppKit at import) so a unit test can check every chain has its network.
import { arbitrum, base, hyperEvm, mainnet, monad, optimism, plasma, polygon, unichain, worldchain, type AppKitNetwork } from '@reown/appkit/networks';
import { CHAIN_IDS } from '@/lib/chains';

export const APPKIT_NETWORKS: readonly AppKitNetwork[] = [base, arbitrum, mainnet, polygon, optimism, unichain, monad, hyperEvm, worldchain, plasma];
export const networks = APPKIT_NETWORKS.filter((n) => CHAIN_IDS.includes(`eip155:${n.id}`)) as [AppKitNetwork, ...AppKitNetwork[]];
