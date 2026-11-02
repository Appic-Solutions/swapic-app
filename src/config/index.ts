/**
 * Every value here ships in the site and is public (spec section 3). Each environment's deploy values (API host, the Swapic
 * canister, the site and its asset canister) live in ONE file, sites.json; next.config.mjs hands a build its own
 * environment's entry as NEXT_PUBLIC_SWAPIC_SITE, so a build holds no other environment's hosts or canister. The contracts
 * are never configured here: the app reads every contract address from the canister's get_config (guards/context.ts).
 */
import chains from './chains.json';

export type SwapicEnv = 'test' | 'prod' | 'e2e';

/** One environment's entry in sites.json. */
export interface Site {
  apiBase: string;
  icpHost: string;
  /** The Swapic canister, the spender of every ICP approval; a placeholder until it is created (check-build refuses it). */
  swapicCanisterId: string;
  sentryDsn: string | null;
  siteOrigin: string;
  derivationOrigin: string | null;
  /** The asset canister serving the site; its raw hosts send the visitor to siteOrigin. */
  assetCanister: string | null;
  /** The custom domain the asset canister answers for (.well-known/ic-domains). */
  domain: string | null;
}

export interface AppConfig {
  env: SwapicEnv;
  /** Quoter and watcher behind one host, by path (contract 1.1). */
  apiBase: string;
  icpHost: string;
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
/** Every chain of the one chain table (chains.json, lib/chains.ts). */
const CHAINS: readonly string[] = chains.map((c) => c.id);
const REOWN_PROJECT_ID = '77560e246a64e6b8843d098a5e802306';

const rawHosts = (id: string) => [`${id}.icp0.io`, `${id}.ic0.app`, `${id}.raw.icp0.io`, `${id}.raw.ic0.app`];

export function envOf(env: string | undefined): SwapicEnv {
  if (env === 'test' || env === 'prod' || env === 'e2e') return env;
  throw new Error('NEXT_PUBLIC_SWAPIC_ENV must be test, prod or e2e');
}

export function appConfig(env: SwapicEnv, site: Site): AppConfig {
  return {
    env, apiBase: site.apiBase, icpHost: site.icpHost, swapicCanisterId: site.swapicCanisterId, reownProjectId: REOWN_PROJECT_ID,
    sentryDsn: site.sentryDsn, siteOrigin: site.siteOrigin, derivationOrigin: site.derivationOrigin,
    redirectHosts: site.assetCanister ? rawHosts(site.assetCanister) : [], icpChain: ICP_CHAIN, chains: CHAINS,
  };
}

function buildSite(): Site {
  const raw = process.env.NEXT_PUBLIC_SWAPIC_SITE;
  if (!raw) throw new Error('NEXT_PUBLIC_SWAPIC_SITE is unset: build through next.config.mjs (the npm scripts)');
  return JSON.parse(raw) as Site;
}

export const config: AppConfig = appConfig(envOf(process.env.NEXT_PUBLIC_SWAPIC_ENV), buildSite());

/**
 * True only in the e2e build. For reading only: a site that picks a fake (client, signer) writes
 * `process.env.NEXT_PUBLIC_SWAPIC_ENV === 'e2e'` inline, because the bundler folds that literal to false in
 * the other builds and drops the branch with its require(), while an imported const is not folded.
 */
export const IS_E2E = process.env.NEXT_PUBLIC_SWAPIC_ENV === 'e2e';
