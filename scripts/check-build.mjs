// Fails when out/ holds an e2e fake (the fake modules use the string E2E-FAKE-MARKER at run time, so the minifier keeps it),
// or a deploy value still a placeholder (src/config/sites.json: the prod canister id before the canister exists).
// SWAPIC_ALLOW_PLACEHOLDERS=1 lets a build made before the deploy pass; never set it for the build that is deployed.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const out = new URL('../out', import.meta.url).pathname;
const allowPlaceholders = process.env.SWAPIC_ALLOW_PLACEHOLDERS === '1';
let bad = 0;
let placeholders = 0;
const walk = (d) => {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (!/\.(js|html)$/.test(n)) continue;
    const text = readFileSync(p, 'utf8');
    if (text.includes('E2E-FAKE-MARKER')) { bad++; console.log('e2e code in', p); }
    if (text.includes('-PLACEHOLDER')) { placeholders++; console.log('placeholder deploy value in', p); }
  }
};
walk(out);
// Pages that may never go. The asset canister keeps a broken trace at the address of a page deleted from it: it answers 404
// with no certificate the gateway accepts, so the visitor gets a raw 503 instead of the app (dfx 0.29.2's asset canister, proved
// on a local replica 2026-11-09: page deleted 503, page back 200, deleted again 503). These four were deleted from prod on
// 2026-11-02 and came back to clear it; deleting one breaks its address again.
for (const route of ['swap', 'bridge', 'advanced', 'auto-invest']) {
  if (!existsSync(join(out, route, 'index.html'))) { bad++; console.log('a page that may never go is missing:', route); }
}
if (bad) process.exit(1);
if (placeholders && !allowPlaceholders) {
  console.log('the build holds a placeholder deploy value: fill src/config/sites.json first (or SWAPIC_ALLOW_PLACEHOLDERS=1 for a build that is not deployed)');
  process.exit(1);
}
console.log(placeholders ? 'build holds no e2e code (placeholders allowed: not for deploy)' : 'build holds no e2e code and no placeholder');
