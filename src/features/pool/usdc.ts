'use client';
import * as React from 'react';
import { config } from '@/config';
import type { UiToken } from '@/components/ui/token-types';
import { chainLogo, chainName, chainNumber } from '@/lib/explorer';
import { BSC_CHAIN } from '@/lib/chains';
import { useGuardContext } from '@/features/swap/quote';
import { useChains } from '@/features/swap/tokens';
import { CKUSDC } from './flows';

export const USDC_LOGO = '/images/tokens/usdc.png';

/** USDC on each EVM chain the app serves: the address is the canister's (get_config, plan check C4), never the quoter's;
 *  the chain's name and logo follow GET /v2/chains. Empty until both have answered. */
export function useUsdcTokens(): UiToken[] {
  const { chains } = useChains();
  const guard = useGuardContext();
  return React.useMemo(() => chains.flatMap((c) => {
    // the pool takes no BNB Chain USDC (BSC design N5): its money travels by Across, not into the pool
    if (c.chainId === config.icpChain || c.chainId === BSC_CHAIN) return [];
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

/** ckUSDC on ICP, the pool's ICP side: a stake from ICP pays in it and an ICP stake pays out in it. */
export const CKUSDC_TOKEN: UiToken = {
  key: `${config.icpChain}|${CKUSDC}`, chain: config.icpChain, chainId: 0, chainName: chainName(config.icpChain), chainLogo: chainLogo(config.icpChain),
  chain_type: 'ICP', address: CKUSDC, canisterId: CKUSDC, symbol: 'ckUSDC', name: 'ckUSDC', logo: USDC_LOGO, decimals: 6, priceUsd: null, verified: true,
};
