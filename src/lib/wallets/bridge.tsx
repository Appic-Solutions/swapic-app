'use client';
import { useEffect } from 'react';
import { useAppKitAccount, useAppKitNetwork, useAppKitState, useDisconnect as useAppKitDisconnect, useAppKit } from '@reown/appkit/react-core';
import { useAuth, useSigner } from '@nfid/identitykit/react';
import { useWallets, type IcpSignerId } from './store';

/** Copies what the wallet SDKs report into the one store every screen reads. */
export function WalletBridge() {
  const { address, isConnected } = useAppKitAccount();
  const { chainId } = useAppKitNetwork();
  const { user } = useAuth();
  const signer = useSigner();
  const { setEvm, setIcp } = useWallets.getState();

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SWAPIC_ENV === 'e2e') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const w = (require('./e2e') as typeof import('./e2e')).e2eWallets();
      setEvm(w.evm ? { address: w.evm, chainId: 8453 } : null);
      setIcp(w.icp ? { principal: w.icp, signer: 'OISY' } : null);
    }
  }, [setEvm, setIcp]);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SWAPIC_ENV === 'e2e') return;
    setEvm(isConnected && address ? { address: address as `0x${string}`, chainId: typeof chainId === 'number' ? chainId : Number(chainId) || null } : null);
  }, [address, isConnected, chainId, setEvm]);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SWAPIC_ENV === 'e2e') return;
    setIcp(user ? { principal: user.principal.toText(), signer: (signer?.id as IcpSignerId | undefined) ?? null } : null);
  }, [user, signer, setIcp]);

  return null;
}

export function useEvmConnect() {
  const { open } = useAppKit();
  return () => open({ view: 'Connect' });
}
/** True while AppKit's own wallet list is open (the menu shows "Check your wallet" until it closes). */
export function useEvmModalOpen(): boolean {
  return useAppKitState().open;
}
export function useIcpConnect() {
  const { connect } = useAuth();
  return (signer?: IcpSignerId) => connect(signer);
}
export function useDisconnectWallets() {
  const { disconnect: evm } = useAppKitDisconnect();
  const { disconnect: icp } = useAuth();
  const { setEvm, setIcp } = useWallets.getState();
  return {
    evm: async () => { await evm(); setEvm(null); },
    icp: async () => { await icp(); setIcp(null); },
  };
}
