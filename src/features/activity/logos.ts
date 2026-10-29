'use client';
import { useQueryClient } from '@tanstack/react-query';
import type { TokensAnswer } from '@/lib/api';
import type { LogoFor } from './rows';

const BY_SYMBOL: Record<string, string> = { USDC: '/images/tokens/usdc.png', ckUSDC: '/images/tokens/usdc.png', USDT: '/images/tokens/usdt.png', ckUSDT: '/images/tokens/usdt.png', WBTC: '/images/tokens/btc.png', ckBTC: '/images/tokens/btc.png', ETH: '/images/logo/chains-logos/ethereum.svg', ckETH: '/images/logo/chains-logos/ethereum.svg', ICP: '/images/logo/chains-logos/icp.svg' };

/** A token's logo from the token lists already fetched (plan 2's picker), else by symbol, else the placeholder. */
export function useLogoFor(): LogoFor {
  const qc = useQueryClient();
  return (chain, token, symbol) => {
    if (chain && token) {
      for (const [, data] of qc.getQueriesData<{ pages: TokensAnswer[] }>({ queryKey: ['tokens', chain] })) {
        const hit = data?.pages.flatMap((p) => p.tokens).find((t) => t.address.toLowerCase() === token.toLowerCase());
        if (hit?.logo) return hit.logo;
      }
    }
    return (symbol && BY_SYMBOL[symbol]) || (chain === null ? '/images/tokens/usdc.png' : '/images/logo/placeholder.png');
  };
}
