'use client';
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getTokens, type TokensAnswer } from '@/lib/api';
import type { LogoFor } from './rows';
import { fallbackLogo, logoInList, ownLogo } from '@/lib/token-logos';

const BY_SYMBOL: Record<string, string> = { USDC: '/images/tokens/usdc.png', ckUSDC: '/images/tokens/usdc.png', USDT: '/images/tokens/usdt.png', ckUSDT: '/images/tokens/usdt.png', WBTC: '/images/tokens/btc.png', ckBTC: '/images/tokens/btc.png', ETH: '/images/logo/chains-logos/ethereum.svg', ckETH: '/images/logo/chains-logos/ethereum.svg', ICP: '/images/logo/chains-logos/icp.svg', BNB: '/images/logo/chains-logos/bsc.png' };

const logoKey = (chain: string, token: string) => ['token-logo', chain, token.toLowerCase()] as const;

/** A token's logo from the token lists already fetched (plan 2's picker), else the app's own (lib/token-logos), else the
 *  quoter's list asked by the token's address (once per token, kept for the visit; the row redraws when it comes), else by
 *  symbol, else the placeholder. */
export function useLogoFor(): LogoFor {
  const qc = useQueryClient();
  const [, redraw] = useState(0);
  // the tokens a render found no logo for: asked after it, never while it renders
  const missing = useRef(new Map<string, [string, string]>());
  useEffect(() => {
    const ask = [...missing.current.values()];
    missing.current.clear();
    for (const [chain, token] of ask) {
      const key = logoKey(chain, token);
      if (qc.getQueryState(key)) continue;
      qc.query({ queryKey: key, queryFn: async () => logoInList(await getTokens(chain, token), token), staleTime: 'static' })
        .then((logo) => logo && redraw((n) => n + 1))
        .catch(() => undefined);
    }
  });
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
      const listed = qc.getQueryData<string | null>(logoKey(chain, token));
      if (listed) return listed;
      if (listed === undefined && chain.startsWith('eip155:')) missing.current.set(`${chain}|${token.toLowerCase()}`, [chain, token]);
    }
    return (symbol && BY_SYMBOL[symbol]) || (chain === null ? '/images/tokens/usdc.png' : '/images/logo/placeholder.png');
  };
}
