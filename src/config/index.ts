/** Every value here ships in the site and is public (spec section 3). */
export type SwapicEnv = 'test' | 'prod' | 'e2e';

export interface AppConfig {
  env: SwapicEnv;
  /** Quoter and watcher behind one host, by path (contract 1.1). */
  apiBase: string;
  icpHost: string;
  /** The Swapic canister (hfisl), the spender of every ICP approval. */
  swapicCanisterId: string;
  /** Public by design (platform-v2 src/lib/configs/wagmi.tsx:15). */
  reownProjectId: string;
  /** Public by design; null keeps Sentry off until Jeff gives the DSN. */
  sentryDsn: string | null;
  /** Where the site lives; AppKit's metadata url. */
  siteOrigin: string;
  /** Internet Identity and NFID derive the principal from this origin; null: the page's own. */
  derivationOrigin: string | null;
  /** Raw canister hosts that send the visitor to siteOrigin (same principal every visit). */
  redirectHosts: readonly string[];
  icpChain: string;
  /** CAIP-2 ids the app knows logos for; the quoter's chain list is filtered to these. */
  chains: readonly string[];
}

export const ICP_CHAIN = 'icp:737ba355e855bd4b61279056603e0550';
const CHAINS = ['eip155:8453', 'eip155:42161', 'eip155:1', 'eip155:137', ICP_CHAIN] as const;

const shared = {
  icpHost: 'https://icp-api.io',
  swapicCanisterId: 'hfisl-ayaaa-aaaar-qch3q-cai',
  reownProjectId: '77560e246a64e6b8843d098a5e802306',
  icpChain: ICP_CHAIN,
  chains: CHAINS,
};

const rawHosts = (id: string) => [`${id}.icp0.io`, `${id}.ic0.app`, `${id}.raw.icp0.io`, `${id}.raw.ic0.app`];

const CONFIGS: Record<SwapicEnv, AppConfig> = {
  test: {
    ...shared,
    env: 'test',
    // staging: Jeff's VPS behind nginx (contract 1.1); it runs on the one real canister, so the test site moves real money
    apiBase: 'https://api-test.swapic.xyz',
    sentryDsn: null,
    siteOrigin: 'https://test.swapic.xyz',
    derivationOrigin: null,
    redirectHosts: rawHosts('ib67n-yiaaa-aaaao-qjwca-cai'),
  },
  prod: {
    ...shared,
    env: 'prod',
    apiBase: 'https://api.swapic.xyz',
    sentryDsn: null,
    siteOrigin: 'https://swapic.xyz',
    derivationOrigin: 'https://swapic.xyz',
    redirectHosts: rawHosts('dduc6-3yaaa-aaaal-ai63a-cai'),
  },
  e2e: {
    ...shared,
    env: 'e2e',
    apiBase: 'https://api.e2e.swapic.invalid',
    sentryDsn: null,
    siteOrigin: 'http://localhost:3100',
    derivationOrigin: null,
    redirectHosts: [],
  },
};

export function configFor(env: string | undefined): AppConfig {
  if (env === 'test' || env === 'prod' || env === 'e2e') return CONFIGS[env];
  throw new Error('NEXT_PUBLIC_SWAPIC_ENV must be test, prod or e2e');
}

export const config: AppConfig = configFor(process.env.NEXT_PUBLIC_SWAPIC_ENV);

/**
 * True only in the e2e build. For reading only: a site that picks a fake (client, signer) writes
 * `process.env.NEXT_PUBLIC_SWAPIC_ENV === 'e2e'` inline, because the bundler folds that literal to false in
 * the other builds and drops the branch with its require(), while an imported const is not folded.
 */
export const IS_E2E = process.env.NEXT_PUBLIC_SWAPIC_ENV === 'e2e';
