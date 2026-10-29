'use client';
// Created once at import, as platform-v2 does (src/lib/wrappers/wallet/wrapper.tsx:25-35), with the
// logins that make contract wallets turned off (spec 5.6) and no AppKit swap or onramp (another provider).
// AppKit 1.8 lets the Reown dashboard override the local `features` once its remote config loads
// (@reown/appkit/dist/esm/src/utils/ConfigUtil.js), so this imports the `react-core` entry, which builds
// AppKit with `basic: true`: email, socials, swaps and onramp stay off whatever the dashboard says
// (plans/2026-10-29-app-stack-upgrade.md). `features` stays as written: it documents the intent.
// The adapter still adds a Base Account connector (a smart-contract wallet) that no option here turns off: see the
// design note in evm-signer.ts.
import { createAppKit } from '@reown/appkit/react-core';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { arbitrum, base, mainnet, polygon, type AppKitNetwork } from '@reown/appkit/networks';
import { config } from '@/config';

export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [base, arbitrum, mainnet, polygon];

export const wagmiAdapter = new WagmiAdapter({ projectId: config.reownProjectId, networks, ssr: false });
export const wagmiConfig = wagmiAdapter.wagmiConfig;

export const appKit = createAppKit({
  adapters: [wagmiAdapter],
  networks,
  defaultNetwork: base,
  projectId: config.reownProjectId,
  metadata: {
    name: 'Swapic',
    description: 'Swap any token from one chain to another',
    // the page's own origin: WalletConnect's verify step compares them
    url: config.siteOrigin,
    icons: [`${config.siteOrigin}/images/landing/logo/swapic-logo.svg`],
  },
  features: { email: false, socials: false, analytics: false, swaps: false, onramp: false },
  coinbasePreference: 'eoaOnly',
  themeMode: 'dark',
  allowUnsupportedChain: false,
});
