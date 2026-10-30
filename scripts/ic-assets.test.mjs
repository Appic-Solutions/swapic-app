import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cspFor, slashAliases, sentryHost } from './ic-assets.mjs';
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

describe('deep links with a trailing slash', () => {
  it('gives every exported page a <route>/index.html with the same bytes (the asset canister serves /pool/ from it)', () => {
    const out = mkdtempSync(join(tmpdir(), 'swapic-out-'));
    mkdirSync(join(out, 'pool'), { recursive: true });
    mkdirSync(join(out, '_next', 'static'), { recursive: true });
    for (const [f, body] of [['index.html', 'swap'], ['404.html', 'nf'], ['_not-found.html', 'nf'], ['pool.html', 'pool'], ['history.html', 'history'], ['pool/stake.html', 'stake'], ['_next/static/x.html', 'x']]) writeFileSync(join(out, f), body);
    expect(slashAliases(out)).toEqual(['history/index.html', 'pool/index.html', 'pool/stake/index.html']);
    expect(readFileSync(join(out, 'pool', 'index.html'), 'utf8')).toBe('pool');
    expect(readFileSync(join(out, 'pool', 'stake', 'index.html'), 'utf8')).toBe('stake');
    // never the home page, the not found pages or Next's own files
    expect(existsSync(join(out, 'index', 'index.html'))).toBe(false);
    expect(existsSync(join(out, '404', 'index.html'))).toBe(false);
    expect(existsSync(join(out, '_next', 'static', 'x', 'index.html'))).toBe(false);
    // run again: nothing more to write
    expect(slashAliases(out)).toEqual([]);
  });
});

