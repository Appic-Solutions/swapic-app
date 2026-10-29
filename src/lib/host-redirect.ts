import type { AppConfig } from '@/config';

export interface Here { host: string; pathname: string; search: string; hash: string }

/** The URL to send the visitor to, or null to stay. */
export function redirectTarget(here: Here, cfg: AppConfig): string | null {
  if (!cfg.redirectHosts.includes(here.host)) return null;
  return `${cfg.siteOrigin}${here.pathname}${here.search}${here.hash}`;
}
