import { describe, expect, it } from 'vitest';
import { cspFor, sentryHost } from './ic-assets.mjs';
import { configFor as jsConfig } from './config-json.mjs';
import { configFor as tsConfig } from '../src/config/index.ts';

describe('the CSP', () => {
  it('lists exactly the hosts the environment needs', () => {
    const csp = cspFor({ apiBase: 'https://api-test.swapic.xyz', icpHost: 'https://icp-api.io', sentryDsn: null }, ["'sha256-abc='"]);
    const connect = csp.split('; ').find((d) => d.startsWith('connect-src'));
    expect(connect).toBe(
      "connect-src 'self' https://api-test.swapic.xyz https://icp-api.io https://rpc.walletconnect.org https://rpc.walletconnect.com wss://relay.walletconnect.org wss://relay.walletconnect.com https://pulse.walletconnect.org https://api.web3modal.org https://api.web3modal.com https://verify.walletconnect.org https://verify.walletconnect.com https://echo.walletconnect.com",
    );
    expect(csp).toContain("script-src 'self' 'sha256-abc='");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("'unsafe-inline' 'self';");
  });
  it('adds the Sentry ingest host from the DSN only', () => {
    expect(sentryHost('https://k@o123.ingest.de.sentry.io/456')).toBe('https://o123.ingest.de.sentry.io');
    const csp = cspFor({ apiBase: 'https://api.swapic.xyz', icpHost: 'https://icp-api.io', sentryDsn: 'https://k@o123.ingest.de.sentry.io/456' }, []);
    expect(csp).toContain('https://o123.ingest.de.sentry.io');
  });
  it('takes the same public values as src/config (two small files kept equal by this test)', () => {
    for (const env of ['test', 'prod']) {
      const ts = tsConfig(env);
      expect(jsConfig(env)).toEqual({ apiBase: ts.apiBase, icpHost: ts.icpHost, sentryDsn: ts.sentryDsn });
    }
  });
});
