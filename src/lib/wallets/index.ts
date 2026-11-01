'use client';
import { useMemo } from 'react';
import { useWallets } from './store';
import { wagmiSigner, type EvmSigner } from './evm-signer';

export function useEvmSigner(): EvmSigner | null {
  const evm = useWallets((s) => s.evm);
  return useMemo(() => {
    if (!evm) return null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    if (process.env.NEXT_PUBLIC_SWAPIC_ENV === 'e2e') return (require('./e2e') as typeof import('./e2e')).e2eEvmSigner(evm.address);
    return wagmiSigner(evm.address);
  }, [evm]);
}

export { useWallets } from './store';
export type { EvmWallet, IcpWallet, IcpSignerId } from './store';
export { type EvmSigner, type SignableTypedData } from './evm-signer';
export { isUserRejection, isLostSignerAnswer } from './rejection';
export { useIcpCaller } from './icp-caller';
export { Providers, queryClient, PLUG_PRESENT } from './providers';
export { PLUG_INSTALL_URL } from './plug';
export { loadEvmList, useEvmConnect, useEvmModalOpen, useIcpConnect, useDisconnectWallets } from './bridge';
