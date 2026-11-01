// Design note (what the site may load and talk to, plan 4 Task 6).
// Must never happen: the site talks to a host it does not need; a script runs that the build did not produce; the site is
// framed by another origin; a test or prod build ships an e2e fake; Sentry headers break CORS.
// How the design proves it: this script writes out/.ic-assets.json5 with one Content-Security-Policy whose connect-src lists
// exactly the environment's API host, the ICP host, WalletConnect and Reown's hosts and the Sentry ingest host from the DSN
// (none when no DSN); script-src 'self' plus the sha256 of every inline script the build emitted (Next inlines its flight
// data; hashing them is tighter than 'unsafe-inline'); frame-ancestors 'none', object-src 'none', base-uri 'self',
// form-action 'none'; img-src stays 'self' data: blob: https: because token logos come from any host the quoter's lists
// name. tests/e2e/csp.spec.ts serves the built out/ with these exact headers, opens every tab and both wallet menus, and
// fails on any violation and on any API request carrying sentry-trace or baggage. scripts/check-build.mjs fails when out/
// holds E2E-FAKE-MARKER; it is first shown to fail on the e2e build. Tests: scripts/ic-assets.test.mjs.
// Deep links with a trailing slash (staging 2026-10-31: /pool/ showed the Swap page). The asset canister serves /pool from
// pool.html, but /pool/ only from pool/index.html, and answers index.html (Swap) when that is missing. slashAliases moves
// every <route>.html the export made to <route>/index.html, so one file answers both /pool and /pool/. Never both files:
// with pool.html and pool/index.html each claiming /pool, the asset canister certified /pool for one of them only, and
// the gateway refused /pool, /history and /swap with a response verification error (staging 2026-11-01). The URL style of
// the app (no trailing slash) does not change. Tests: scripts/ic-assets.test.mjs.
// Usage: node scripts/ic-assets.mjs test|prod   (after `next build`, writes out/.ic-assets.json5 and out/.well-known/ic-domains)
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const WALLETCONNECT = [
  'https://rpc.walletconnect.org', 'https://rpc.walletconnect.com', 'wss://relay.walletconnect.org', 'wss://relay.walletconnect.com',
  'https://pulse.walletconnect.org', 'https://api.web3modal.org', 'https://api.web3modal.com',
  'https://verify.walletconnect.org', 'https://verify.walletconnect.com', 'https://echo.walletconnect.com',
];
const DOMAINS = { test: 'test.swapic.xyz', prod: 'swapic.xyz' };

export function sentryHost(dsn) {
  const u = new URL(dsn);
  return `${u.protocol}//${u.host}`;
}

export function cspFor(cfg, scriptHashes) {
  const connect = ["'self'", cfg.apiBase, cfg.icpHost, ...WALLETCONNECT, ...(cfg.sentryDsn ? [sentryHost(cfg.sentryDsn)] : [])];
  return [
    "default-src 'self'",
    `script-src 'self' ${scriptHashes.join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.reown.com",
    `connect-src ${connect.join(' ')}`,
    'frame-src https://verify.walletconnect.org https://verify.walletconnect.com',
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}

function* htmlFiles(dir) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) yield* htmlFiles(p);
    else if (n.endsWith('.html')) yield p;
  }
}

const NOT_ROUTES = new Set(['index.html', '404.html', '_not-found.html']);
/** Every <route>.html of the export (not index, 404 or _not-found, nothing under _next) moved to <route>/index.html (one
 *  already there is kept and the .html dropped), so each page has exactly one file. Returns the index files, relative to outDir. */
export function slashAliases(outDir) {
  const written = [];
  for (const f of [...htmlFiles(outDir)]) {
    const rel = relative(outDir, f);
    if (NOT_ROUTES.has(basename(f)) || rel.startsWith('_next')) continue;
    const target = join(dirname(f), basename(f, '.html'), 'index.html');
    mkdirSync(dirname(target), { recursive: true });
    if (existsSync(target)) unlinkSync(f);
    else renameSync(f, target);
    written.push(relative(outDir, target));
  }
  return written.sort();
}

/** sha256 of every inline <script> body the build wrote, deduplicated. */
export function inlineScriptHashes(outDir) {
  const set = new Set();
  for (const f of htmlFiles(outDir)) {
    for (const m of readFileSync(f, 'utf8').matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
      if (m[1].length) set.add(`'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`);
    }
  }
  return [...set].sort();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const env = process.argv[2];
  if (!(env in DOMAINS)) throw new Error('usage: ic-assets.mjs test|prod');
  const root = fileURLToPath(new URL('..', import.meta.url));
  const out = join(root, 'out');
  const { configFor } = await import(new URL('./config-json.mjs', import.meta.url));
  const cfg = configFor(env);
  const aliases = slashAliases(out);
  const csp = cspFor(cfg, inlineScriptHashes(out));
  const headers = {
    'Content-Security-Policy': csp,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Frame-Options': 'DENY',
  };
  const assets = [
    { match: '**/*', headers, allow_raw_access: false },
    { match: '_next/static/**/*', headers: { ...headers, 'Cache-Control': 'public, max-age=31536000, immutable' } },
    { match: '**/*.html', headers: { ...headers, 'Cache-Control': 'no-cache' } },
    { match: '.well-known', ignore: false },
  ];
  writeFileSync(join(out, '.ic-assets.json5'), JSON.stringify(assets, null, 2) + '\n');
  mkdirSync(join(out, '.well-known'), { recursive: true });
  writeFileSync(join(out, '.well-known', 'ic-domains'), DOMAINS[env] + '\n');
  console.log(`headers for ${env}: ${inlineScriptHashes(out).length} inline script hashes; ic-domains ${DOMAINS[env]}; ${aliases.length} trailing slash pages`);
}
