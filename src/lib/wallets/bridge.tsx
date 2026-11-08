'use client';
import { useEffect } from 'react';
import { getAccount, getBytecode } from 'wagmi/actions';
import { useAppKitAccount, useAppKitNetwork, useAppKitState, useDisconnect as useAppKitDisconnect, useAppKit } from '@reown/appkit/react-core';
import { useAuth, useSigner } from '@nfid/identitykit/react';
import { icpSignerOf, kitIdOf, useWallets, type IcpSignerId } from './store';
import { wagmiConfig } from './evm-config';
import { BASE_ACCOUNT_CONNECTOR_ID, judgeEvmWallet } from './guard';

type ChainId = (typeof wagmiConfig)['chains'][number]['id'];

/** Copies what the wallet SDKs report into the one store every screen reads. */
export function WalletBridge() {
  // each namespace read on its own: with no namespace AppKit answers whichever is active, and a base58 address is no 0x
  const { address, isConnected } = useAppKitAccount({ namespace: 'eip155' });
  const { address: solAddress, isConnected: solConnected } = useAppKitAccount({ namespace: 'solana' });
  const { chainId } = useAppKitNetwork();
  const { user } = useAuth();
  const signer = useSigner();
  const { setEvm, setIcp, setSol } = useWallets.getState();

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SWAPIC_ENV === 'e2e') return;
    setSol(solConnected && solAddress ? { address: solAddress } : null);
  }, [solAddress, solConnected, setSol]);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SWAPIC_ENV === 'e2e') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const w = (require('./e2e') as typeof import('./e2e')).e2eWallets();
      setEvm(w.evm ? { address: w.evm, chainId: 8453, smartWallet: !!w.evmSmart } : null);
      setIcp(w.icp ? { principal: w.icp, signer: 'OISY' } : null);
      setSol(w.sol ? { address: w.sol } : null);
    }
  }, [setEvm, setIcp, setSol]);

  // The connect-time guard (guard.ts): a wallet reaches the store once judged, a smart one flagged (never disconnected).
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SWAPIC_ENV === 'e2e') return;
    if (!isConnected || !address) {
      setEvm(null);
      return;
    }
    const wallet = address as `0x${string}`;
    // with Solana the active network, AppKit's chain id is no EVM id: wagmi still knows the EVM wallet's
    const chain = typeof chainId === 'number' ? chainId : Number(chainId) || getAccount(wagmiConfig).chainId || null;
    let live = true;
    void (async () => {
      const connectorId = getAccount(wagmiConfig).connector?.id;
      // null: the code could not be read (unknown); read again on the next connect or chain switch (this effect)
      let code: string | null = null;
      if (connectorId !== BASE_ACCOUNT_CONNECTOR_ID && chain !== null) {
        try {
          code = (await getBytecode(wagmiConfig, { address: wallet, chainId: chain as ChainId })) ?? '0x';
        } catch {
          code = null;
        }
      }
      if (!live) return;
      const kind = judgeEvmWallet(connectorId, code);
      setEvm({ address: wallet, chainId: chain, smartWallet: kind === 'unknown' ? null : kind === 'smart' });
    })();
    return () => {
      live = false;
    };
  }, [address, isConnected, chainId, setEvm]);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SWAPIC_ENV === 'e2e') return;
    setIcp(user ? { principal: user.principal.toText(), signer: icpSignerOf(signer?.id) } : null);
  }, [user, signer, setIcp]);

  return null;
}

// The EVM wallet list. AppKit's basic build (the react-core entry, evm-config.ts) loads only its WalletConnect QR, All
// wallets and Downloads views, so open({ view: 'Connect' }) showed an empty window: w3m-connect-view was never defined
// (checked on test.swapic.xyz, 2026-11-01). The full build always loads @reown/appkit-scaffold-ui's core views; this
// loads the same module once (prefetched when the wallet menu opens), before the list opens. If it cannot load, the
// basic build's own WalletConnect view opens instead of an empty one.
let evmViews: Promise<unknown> | undefined;
export function loadEvmList(): Promise<unknown> {
  evmViews ??= import('@reown/appkit-scaffold-ui').catch((e: unknown) => {
    evmViews = undefined;
    throw e;
  });
  return evmViews;
}

export function useEvmConnect() {
  const { open } = useAppKit();
  return async () => {
    const loaded = await loadEvmList().then(() => true, () => false);
    return open({ view: loaded ? 'Connect' : 'ConnectingWalletConnectBasic' });
  };
}
/** True while AppKit's own wallet list is open (the menu shows "Check your wallet" until it closes). */
export function useEvmModalOpen(): boolean {
  return useAppKitState().open;
}
/** The same wallet window, on its Solana wallets. */
export function useSolConnect() {
  const { open } = useAppKit();
  return async () => {
    const loaded = await loadEvmList().then(() => true, () => false);
    return open({ view: loaded ? 'Connect' : 'ConnectingWalletConnectBasic', namespace: 'solana' });
  };
}
export function useIcpConnect() {
  const { connect } = useAuth();
  return (signer?: IcpSignerId) => connect(signer && kitIdOf(signer));
}
export function useDisconnectWallets() {
  const { disconnect } = useAppKitDisconnect();
  const { disconnect: icp } = useAuth();
  const { setEvm, setIcp, setSol } = useWallets.getState();
  return {
    evm: async () => { await disconnect({ namespace: 'eip155' }); setEvm(null); },
    icp: async () => { await icp(); setIcp(null); },
    sol: async () => { await disconnect({ namespace: 'solana' }); setSol(null); },
  };
}
