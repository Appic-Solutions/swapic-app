// The public values the header builder needs, the same as src/config/index.ts for test and prod (scripts/ic-assets.test.mjs
// keeps the two equal). Nothing here is secret: every value ships in the site.
const CONFIGS = {
  test: { apiBase: 'https://api-test.swapic.xyz', icpHost: 'https://icp-api.io', sentryDsn: null },
  prod: { apiBase: 'https://api.swapic.xyz', icpHost: 'https://icp-api.io', sentryDsn: null },
};

export function configFor(env) {
  const c = CONFIGS[env];
  if (!c) throw new Error('env must be test or prod');
  return c;
}
