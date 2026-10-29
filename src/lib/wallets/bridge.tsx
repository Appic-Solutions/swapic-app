'use client';
import { useEffect, useRef } from 'react';
import { getAccount, getBytecode } from 'wagmi/actions';
import { useAppKitAccount, useAppKitNetwork, useAppKitState, useDisconnect as useAppKitDisconnect, useAppKit } from '@reown/appkit/react-core';
import { useAuth, useSigner } from '@nfid/identitykit/react';
import { useWallets, type IcpSignerId } from './store';
import { wagmiConfig } from './evm-config';
import { BASE_ACCOUNT_CONNECTOR_ID, judgeEvmWallet } from './guard';

type ChainId = (typeof wagmiConfig)['chains'][number]['id'];

/** Copies what the wallet SDKs report into the one store every screen reads. */
export function WalletBridge() {
  const { address, isConnected } = useAppKitAccount();
  const { chainId } = useAppKitNetwork();
  const { user } = useAuth();
  const signer = useSigner();
  const { setEvm, setIcp, setEvmRefused } = useWallets.getState();
  const { disconnect: disconnectEvm } = useAppKitDisconnect();
  const disconnectRef = useRef(disconnectEvm);
  disconnectRef.current = disconnectEvm;

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SWAPIC_ENV === 'e2e') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const w = (require('./e2e') as typeof import('./e2e')).e2eWallets();
      setEvm(w.evm ? { address: w.evm, chainId: 8453 } : null);
      setIcp(w.icp ? { principal: w.icp, signer: 'OISY' } : null);
    }
  }, [setEvm, setIcp]);

  // The connect-time guard (guard.ts): a wallet reaches the store only once judged; a refused one is disconnected.
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SWAPIC_ENV === 'e2e') return;
    if (!isConnected || !address) {
      setEvm(null);
      return;
    }
    const wallet = address as `0x${string}`;
    const chain = typeof chainId === 'number' ? chainId : Number(chainId) || null;
    let live = true;
    void (async () => {
      const connectorId = getAccount(wagmiConfig).connector?.id;
      let code: string | undefined;
      if (connectorId !== BASE_ACCOUNT_CONNECTOR_ID && chain !== null) {
        try {
          code = await getBytecode(wagmiConfig, { address: wallet, chainId: chain as ChainId });
        } catch {
          code = undefined; // unread: the quoter's payerIsContract refusal is the backstop
        }
      }
      if (!live) return;
      if (judgeEvmWallet(connectorId, code) === 'refuse') {
        setEvm(null);
        setEvmRefused(true);
        await disconnectRef.current();
        return;
      }
      setEvmRefused(false);
      setEvm({ address: wallet, chainId: chain });
    })();
    return () => {
      live = false;
    };
  }, [address, isConnected, chainId, setEvm, setEvmRefused]);

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
