// The environment picks the whole config (src/config/index.ts); every value in it is public.
const env = process.env.NEXT_PUBLIC_SWAPIC_ENV;
if (!['test', 'prod', 'e2e'].includes(env ?? '')) {
  throw new Error('Set NEXT_PUBLIC_SWAPIC_ENV to test, prod or e2e (use the npm scripts)');
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
