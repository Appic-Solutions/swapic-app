'use client';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { WagmiProvider } from 'wagmi';
import { IdentityKitProvider } from '@nfid/identitykit/react';
import { IdentityKitAuthType, InternetIdentity, NFIDW, OISY } from '@nfid/identitykit';
import '@nfid/identitykit/react/styles.css';
import { config } from '@/config';
import { wagmiConfig } from './evm-config';
import { WalletBridge } from './bridge';

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, gcTime: 10 * 60_000, refetchOnWindowFocus: false, retry: 1 } },
});

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
          signers={[OISY, NFIDW, InternetIdentity]}
          authType={{ OISY: IdentityKitAuthType.ACCOUNTS, NFIDW: IdentityKitAuthType.ACCOUNTS, InternetIdentity: IdentityKitAuthType.DELEGATION }}
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
