import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, matchesGlob } from 'node:path';
import { CACHE_DAY, CACHE_FOREVER, alternativeOriginsFor, assetRules, chainRpcHosts, cspFor, siteFor, slashAliases, sentryHost } from './ic-assets.mjs';

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
  it('takes prod\'s hosts and domain from src/config/sites.json, the file the app build reads', () => {
    const prod = siteFor('prod');
    expect(prod.domain).toBe('swapic.xyz');
    expect(prod.apiBase).toBe('https://api.swapic.xyz');
    expect(prod.assetCanister).toBe('dduc6-3yaaa-aaaal-ai63a-cai');
    const connect = cspFor(prod, []).split('; ').find((d) => d.startsWith('connect-src'));
    expect(connect).toContain('https://api.swapic.xyz');
    expect(connect).not.toMatch(/api-test|test\.swapic/);
    expect(() => siteFor('e2e')).toThrow(/usage/);
  });
  it('lets the wallet read the chains WalletConnect\'s RPC does not serve, and only those hosts', () => {
    const hosts = chainRpcHosts();
    expect(hosts).toContain('https://rpc.monad.xyz');
    expect(hosts.every((h) => /^https:\/\/[a-z0-9.-]+$/.test(h))).toBe(true);
    const connect = cspFor(siteFor('prod'), [], hosts).split('; ').find((d) => d.startsWith('connect-src'));
    for (const h of hosts) expect(connect).toContain(h);
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
    // one file per page: the .html is gone, so the asset canister certifies /pool for that one file
    expect(existsSync(join(out, 'pool.html'))).toBe(false);
    expect(existsSync(join(out, 'history.html'))).toBe(false);
    expect(existsSync(join(out, 'pool', 'stake.html'))).toBe(false);
    // never the home page, the not found pages or Next's own files
    expect(existsSync(join(out, 'index', 'index.html'))).toBe(false);
    expect(existsSync(join(out, '404', 'index.html'))).toBe(false);
    expect(existsSync(join(out, '_next', 'static', 'x', 'index.html'))).toBe(false);
    // run again: nothing more to write
    expect(slashAliases(out)).toEqual([]);
  });
});


describe('the ii-alternative-origins file', () => {
  it('lists the site under a derivation origin, and is not written without one, as on prod: OISY closes on one', () => {
    expect(JSON.parse(alternativeOriginsFor({ derivationOrigin: 'https://a.example', siteOrigin: 'https://b.example' }))).toEqual({ alternativeOrigins: ['https://b.example'] });
    expect(alternativeOriginsFor(siteFor('prod'))).toBeNull();
    expect(alternativeOriginsFor(siteFor('test'))).toBeNull();
  });
});

describe('the cache rules', () => {
  const SECURITY = { 'Content-Security-Policy': "default-src 'self'", 'X-Frame-Options': 'DENY', 'X-Content-Type-Options': 'nosniff' };
  const rules = assetRules(SECURITY);
  // the asset canister's reading: every rule that matches, in order, a later header replacing an earlier one
  const headersOf = (file) => rules.filter((r) => r.headers && matchesGlob(file, r.match)).reduce((h, r) => ({ ...h, ...r.headers }), {});
  it('keeps names that change with their content forever, other public files a day, and checks pages every time', () => {
    expect(headersOf('_next/static/chunks/0mc4r8s-3z28c.js')['Cache-Control']).toBe(CACHE_FOREVER);
    expect(headersOf('images/coins/7cc0fcf4/btc.webp')['Cache-Control']).toBe(CACHE_FOREVER);
    expect(headersOf('images/coins/7cc0fcf4/rest.webp')['Cache-Control']).toBe(CACHE_FOREVER);
    expect(headersOf('images/tokens/usdc.svg')['Cache-Control']).toBe(CACHE_DAY);
    expect(headersOf('images/wallet.webp')['Cache-Control']).toBe(CACHE_DAY);
    expect(headersOf('favicon.svg')['Cache-Control']).toBe(CACHE_DAY);
    expect(headersOf('index.html')['Cache-Control']).toBe('no-cache');
    expect(headersOf('pool/index.html')['Cache-Control']).toBe('no-cache');
    // what a release rewrites under the same name (the pages' data) is never cached
    expect(headersOf('index.txt')['Cache-Control']).toBeUndefined();
    expect(CACHE_FOREVER).toBe('public, max-age=31536000, immutable');
  });
  it('sends the security headers with every file', () => {
    for (const r of rules) if (r.headers) expect(r.headers).toMatchObject(SECURITY);
    for (const f of ['images/coins/7cc0fcf4/btc.webp', 'images/tokens/usdc.svg', 'favicon.ico', 'index.html', 'index.txt']) expect(headersOf(f)).toMatchObject(SECURITY);
  });
});
