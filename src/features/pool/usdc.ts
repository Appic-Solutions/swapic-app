'use client';
import * as React from 'react';
import { config } from '@/config';
import type { UiToken } from '@/components/ui/token-types';
import { chainLogo, chainName, chainNumber } from '@/lib/explorer';
import { useGuardContext } from '@/features/swap/quote';
import { useChains } from '@/features/swap/tokens';

export const USDC_LOGO = '/images/tokens/usdc.png';

/** USDC on each EVM chain the app serves: the address is the canister's (get_config, plan check C4), never the quoter's;
 *  the chain's name and logo follow GET /v2/chains. Empty until both have answered. */
export function useUsdcTokens(): UiToken[] {
  const { chains } = useChains();
  const guard = useGuardContext();
  return React.useMemo(() => chains.flatMap((c) => {
    if (c.chainId === config.icpChain) return [];
    const usdc = guard?.config.chains.get(chainNumber(c.chainId))?.usdc;
    if (!usdc) return [];
    const address = usdc.toLowerCase();
    return [{
      key: `${c.chainId}|${address}`, chain: c.chainId, chainId: chainNumber(c.chainId), chainName: chainName(c.chainId), chainLogo: chainLogo(c.chainId),
      chain_type: 'EVM' as const, address, contractAddress: address, symbol: 'USDC', name: 'USD Coin', logo: USDC_LOGO,
      decimals: c.usdc.decimals, priceUsd: null, verified: true,
    }];
  }), [chains, guard]);
}
