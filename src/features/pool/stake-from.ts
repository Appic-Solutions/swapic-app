import type { UiToken } from '@/components/ui/token-types';

const ARBITRUM = 'eip155:42161';

/** Where Stake opens (lead, 2026-10-29): USDC on the EVM wallet's connected chain when Swapic serves USDC there, else USDC
 *  on Arbitrum (as the design shows), else the first offered. */
export function defaultStakeFrom(tokens: UiToken[], connectedChainId: number | null): UiToken | null {
  const here = connectedChainId === null ? undefined : tokens.find((t) => t.chain_type === 'EVM' && t.chainId === connectedChainId);
  return here ?? tokens.find((t) => t.chain === ARBITRUM) ?? tokens[0] ?? null;
}
