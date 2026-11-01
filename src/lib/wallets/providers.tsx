'use client';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { WagmiProvider } from 'wagmi';
import { IdentityKitProvider } from '@nfid/identitykit/react';
import { IdentityKitAuthType, IdentityKitTransportType, InternetIdentity, NFIDW, OISY, type IdentityKitSignerConfig } from '@nfid/identitykit';
import '@nfid/identitykit/react/styles.css';
import { config } from '@/config';
import { wagmiConfig } from './evm-config';
import { WalletBridge } from './bridge';
import { PLUG_UUID, forgetMissingPlug, plugInstalled } from './plug';

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, gcTime: 10 * 60_000, refetchOnWindowFocus: false, retry: 1 } },
});

/** Plug is listed only when its extension answered at load (plug.ts: a listed signer that cannot be found stalls IdentityKit). */
export const PLUG_PRESENT = plugInstalled();
forgetMissingPlug(PLUG_PRESENT, () => (typeof window === 'undefined' ? undefined : window.localStorage));
const PLUG: IdentityKitSignerConfig = { id: PLUG_UUID, providerUrl: '', label: 'Plug', transportType: IdentityKitTransportType.EXTENSION };
const SIGNERS = PLUG_PRESENT ? [OISY, NFIDW, InternetIdentity, PLUG] : [OISY, NFIDW, InternetIdentity];

/** Only the chain and token lists outlive the tab (spec section 4); never quotes or orders. */
const persister = typeof window === 'undefined' ? undefined : createSyncStoragePersister({ storage: window.localStorage, key: 'swapic-cache-v1' });

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister: persister!,
          maxAge: 24 * 60 * 60_000,
          dehydrateOptions: { shouldDehydrateQuery: (q) => q.queryKey[0] === 'chains' || q.queryKey[0] === 'tokens' },
        }}
      >
        <IdentityKitProvider
          signers={SIGNERS}
          authType={{ OISY: IdentityKitAuthType.ACCOUNTS, NFIDW: IdentityKitAuthType.ACCOUNTS, InternetIdentity: IdentityKitAuthType.DELEGATION, [PLUG_UUID]: IdentityKitAuthType.ACCOUNTS }}
          signerClientOptions={config.derivationOrigin ? { derivationOrigin: config.derivationOrigin } : {}}
          featuredSigner={false}
          discoverExtensionSigners={false}
        >
          <WalletBridge />
          {children}
        </IdentityKitProvider>
      </PersistQueryClientProvider>
    </WagmiProvider>
  );
}
