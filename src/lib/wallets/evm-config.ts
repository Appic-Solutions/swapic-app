'use client';
// Created once at import, as platform-v2 does (src/lib/wrappers/wallet/wrapper.tsx:25-35), with the
// logins that make contract wallets turned off (spec 5.6) and no AppKit swap or onramp (another provider).
// AppKit 1.8 lets the Reown dashboard override the local `features` once its remote config loads
// (@reown/appkit/dist/esm/src/utils/ConfigUtil.js), so this imports the `react-core` entry, which builds
// AppKit with `basic: true`: email, socials, swaps and onramp stay off whatever the dashboard says
// (plans/2026-10-29-app-stack-upgrade.md). `features` stays as written: it documents the intent.
// The adapter also adds a Base Account connector (a smart wallet). Smart wallets may swap now (Jeff, 2026-10-29, option B):
// the connect-time guard (guard.ts, run by bridge.tsx) flags them so the Swap panel asks for the recipient on another
// chain and the Pool keeps Stake off.
import { createAppKit } from '@reown/appkit/react-core';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { baseAccount, coinbaseWallet } from '@wagmi/connectors';
import { SolanaAdapter } from '@reown/appkit-adapter-solana/react';
import { base, solana } from '@reown/appkit/networks';
import { config } from '@/config';
import { SOLANA_CHAIN } from '@/lib/explorer';
import { networks } from './networks';

export { networks };

// Coinbase Wallet and Base Account are given here with their SDK telemetry off: on, each SDK injects an inline analytics
// script (Coinbase's ClientAnalytics) that the site's Content-Security-Policy blocks (plan 4 Task 6). The adapter adds its own
// Base Account only when none is given (same id); its Coinbase connector is turned off below (enableCoinbase: false), since
// its id check misses this one.
export const wagmiAdapter = new WagmiAdapter({
  projectId: config.reownProjectId,
  networks,
  ssr: false,
  connectors: [
    coinbaseWallet({ version: '4', appName: 'Swapic', preference: { options: 'eoaOnly', telemetry: false } }),
    baseAccount({ appName: 'Swapic', preference: { telemetry: false } }),
  ],
});
export const wagmiConfig = wagmiAdapter.wagmiConfig;

// Solana beside the EVM chains, one wallet window for both (design 5.5): Phantom, Solflare, Backpack and WalletConnect phones
// through Wallet Standard. Only where this build shows Solana: anywhere else the app loads as it always did.
const solanaShown = config.chains.includes(SOLANA_CHAIN);

export const appKit = createAppKit({
  adapters: solanaShown ? [wagmiAdapter, new SolanaAdapter()] : [wagmiAdapter],
  networks: solanaShown ? [...networks, solana] : networks,
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
  enableCoinbase: false,
  themeMode: 'dark',
  allowUnsupportedChain: false,
});
