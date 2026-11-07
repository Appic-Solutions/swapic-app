'use client';
import { useQueryClient } from '@tanstack/react-query';
import type { TokensAnswer } from '@/lib/api';
import type { LogoFor } from './rows';
import { fallbackLogo, ownLogo } from '@/lib/token-logos';

const BY_SYMBOL: Record<string, string> = { USDC: '/images/tokens/usdc.png', ckUSDC: '/images/tokens/usdc.png', USDT: '/images/tokens/usdt.png', ckUSDT: '/images/tokens/usdt.png', WBTC: '/images/tokens/btc.png', ckBTC: '/images/tokens/btc.png', ETH: '/images/logo/chains-logos/ethereum.svg', ckETH: '/images/logo/chains-logos/ethereum.svg', ICP: '/images/logo/chains-logos/icp.svg' };

/** A token's logo from the token lists already fetched (plan 2's picker), else the app's own (lib/token-logos), else by
 *  symbol, else the placeholder. */
export function useLogoFor(): LogoFor {
  const qc = useQueryClient();
  return (chain, token, symbol) => {
    if (chain && token) {
      const preferred = ownLogo(chain, token);
      if (preferred) return preferred;
      for (const [, data] of qc.getQueriesData<{ pages: TokensAnswer[] }>({ queryKey: ['tokens', chain] })) {
        const hit = data?.pages.flatMap((p) => p.tokens).find((t) => t.address.toLowerCase() === token.toLowerCase());
        if (hit?.logo) return hit.logo;
      }
      const own = fallbackLogo(chain, token);
      if (own) return own;
    }
    return (symbol && BY_SYMBOL[symbol]) || (chain === null ? '/images/tokens/usdc.png' : '/images/logo/placeholder.png');
  };
}
