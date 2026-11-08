'use client';
import { useMemo } from 'react';
import { useWallets } from './store';
import { useAppKitProvider } from '@reown/appkit/react';
import { wagmiSigner, type EvmSigner } from './evm-signer';
import { solSigner, type SolanaWalletProvider, type SolSigner } from './sol-signer';

export function useEvmSigner(): EvmSigner | null {
  const evm = useWallets((s) => s.evm);
  return useMemo(() => {
    if (!evm) return null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    if (process.env.NEXT_PUBLIC_SWAPIC_ENV === 'e2e') return (require('./e2e') as typeof import('./e2e')).e2eEvmSigner(evm.address);
    return wagmiSigner(evm.address, evm.smartWallet);
  }, [evm]);
}

/** The connected Solana wallet's signer, or null. */
export function useSolSigner(): SolSigner | null {
  const sol = useWallets((s) => s.sol);
  const { walletProvider } = useAppKitProvider<SolanaWalletProvider>('solana');
  return useMemo(() => {
    if (!sol) return null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    if (process.env.NEXT_PUBLIC_SWAPIC_ENV === 'e2e') return (require('./e2e') as typeof import('./e2e')).e2eSolSigner(sol.address);
    return walletProvider ? solSigner(sol.address, walletProvider) : null;
  }, [sol, walletProvider]);
}

export { useWallets } from './store';
export type { EvmWallet, IcpWallet, IcpSignerId, SolWallet } from './store';
export type { SolSigner } from './sol-signer';
export { type EvmSigner, type SignableTypedData } from './evm-signer';
export { isUserRejection, isLostSignerAnswer, isUnsupportedSign } from './rejection';
export { useIcpCaller } from './icp-caller';
export { Providers, queryClient, PLUG_PRESENT } from './providers';
export { PLUG_INSTALL_URL } from './plug';
export { loadEvmList, useEvmConnect, useEvmModalOpen, useIcpConnect, useSolConnect, useDisconnectWallets } from './bridge';
