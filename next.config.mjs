import { readFileSync } from 'node:fs';

// The environment picks its entry of src/config/sites.json (every value in it is public); the build gets that entry alone,
// so it holds no other environment's hosts or canister (src/config/index.ts).
const env = process.env.NEXT_PUBLIC_SWAPIC_ENV;
if (!['test', 'prod', 'e2e'].includes(env ?? '')) {
  throw new Error('Set NEXT_PUBLIC_SWAPIC_ENV to test, prod or e2e (use the npm scripts)');
}
const site = JSON.parse(readFileSync(new URL('./src/config/sites.json', import.meta.url), 'utf8'))[env];

// Optional peers of @coinbase/cdp-sdk (reached through @wagmi/connectors' Base Account connector) that the app
// never uses and never installs: one throwing stub stands in (tools/stubs/x402.mjs).
const X402_STUB = './tools/stubs/x402.mjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  env: { NEXT_PUBLIC_SWAPIC_SITE: JSON.stringify(site) },
  images: { unoptimized: true },
  reactStrictMode: true,
  // next dev would otherwise write an AGENTS.md into the repo; docs never enter git
  agentRules: false,
  turbopack: {
    resolveAlias: {
      '@x402/core/client': X402_STUB,
      '@x402/evm': X402_STUB,
      '@x402/evm/exact/client': X402_STUB,
      '@x402/evm/upto/client': X402_STUB,
      '@x402/svm/exact/client': X402_STUB,
    },
  },
};

export default nextConfig;
