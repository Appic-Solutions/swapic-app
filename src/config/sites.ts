// Tests and scripts only (the app reads its own environment's entry from NEXT_PUBLIC_SWAPIC_SITE): every environment's
// config, from sites.json.
import sites from './sites.json';
import { appConfig, envOf, type AppConfig, type Site, type SwapicEnv } from './index';

export const SITES: Record<SwapicEnv, Site> = sites;
export const configFor = (env: string): AppConfig => appConfig(envOf(env), SITES[envOf(env)]);
