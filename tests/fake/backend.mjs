// The fake backend: Playwright intercepts every call to the e2e API host and answers from fixtures.
// Unknown paths fail the test loudly (404 with the path), so nothing silently hits the network.
import { readFileSync } from 'node:fs';
import { SCENARIOS } from './scenarios.mjs';

const ROOT = new URL('../../', import.meta.url).pathname;
const API = 'https://api.e2e.swapic.invalid';

const match = (pattern, path) => new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]+')}$`).test(path);

export async function installFakeBackend(page, scenario = 'default') {
  const s = SCENARIOS[scenario];
  if (!s) throw new Error(`unknown scenario ${scenario}`);
  if (s.clockAt) await page.clock.setFixedTime(new Date(s.clockAt * 1000));
  await page.route(`${API}/**`, async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') {
      // the CORS preflight of a JSON POST, answered as the edge does (contract 1.5)
      return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '600' } });
    }
    const url = new URL(req.url());
    const key = req.method() === 'GET' ? url.pathname : `${req.method()} ${url.pathname}`;
    const hit = Object.entries(s.routes).find(([p]) => match(p, key) || match(p, url.pathname) && req.method() === 'GET');
    if (!hit) return route.fulfill({ status: 404, json: { code: 'notFound', message: `fake backend has no ${key}` } });
    const v = typeof hit[1] === 'function' ? await hit[1](url, req) : typeof hit[1] === 'string' ? { status: 200, file: hit[1] } : hit[1];
    const body = v.file ? readFileSync(ROOT + v.file, 'utf8') : JSON.stringify(v.json);
    return route.fulfill({ status: v.status, contentType: 'application/json', body, headers: { 'access-control-allow-origin': '*' } });
  });
}

export async function setE2eWallets(page, scenario = 'default') {
  const { wallets } = SCENARIOS[scenario];
  await page.addInitScript((w) => { window.__SWAPIC_E2E__ = w; }, typeof wallets === 'function' ? wallets() : wallets);
}
