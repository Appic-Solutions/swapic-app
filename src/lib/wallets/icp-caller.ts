'use client';
import { useAgent, useAuth } from '@nfid/identitykit/react';
import { config } from '@/config';
import type { IcpCaller } from '@/lib/icp';
import { useWallets } from './store';

/** The connected ICP wallet's agent and principal, or null. OISY's agent asks OISY for every call (ICRC-49). */
export function useIcpCaller(): IcpCaller | null {
  const icp = useWallets((s) => s.icp);
  const agent = useAgent({ host: config.icpHost });
  const { user } = useAuth();
  if (process.env.NEXT_PUBLIC_SWAPIC_ENV === 'e2e') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return icp ? (require('./e2e') as typeof import('./e2e')).e2eIcpCaller() : null;
  }
  if (!icp || !agent || !user) return null;
  return { agent, principal: user.principal };
}
