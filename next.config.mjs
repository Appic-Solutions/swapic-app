// The environment picks the whole config (src/config/index.ts); every value in it is public.
const env = process.env.NEXT_PUBLIC_SWAPIC_ENV;
if (!['test', 'prod', 'e2e'].includes(env ?? '')) {
  throw new Error('Set NEXT_PUBLIC_SWAPIC_ENV to test, prod or e2e (use the npm scripts)');
}

// Optional peers of @coinbase/cdp-sdk (reached through @wagmi/connectors' Base Account connector) that the app
// never uses and never installs: one throwing stub stands in (tools/stubs/x402.mjs).
const X402_STUB = './tools/stubs/x402.mjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
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
