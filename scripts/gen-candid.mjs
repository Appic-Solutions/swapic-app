// Regenerates the canister bindings from tools/candid/swapic.did (dfx 0.29.2 generate; checked
// 2026-10-28 to write agent-js compatible .did.js and .did.d.ts). Re-copy the did from the
// canister repo and run this after every canister interface change (the ICRC-21 upgrade included).
// dfx still writes `@dfinity/*` type imports; the app uses @icp-sdk/core, so they are rewritten here
// (docs: plans/2026-10-29-app-stack-upgrade.md). The .did.js imports nothing.
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const IMPORTS = {
  "from '@dfinity/principal'": "from '@icp-sdk/core/principal'",
  "from '@dfinity/agent'": "from '@icp-sdk/core/agent'",
  "from '@dfinity/candid'": "from '@icp-sdk/core/candid'",
};

execFileSync('dfx', ['generate', 'swapic'], { cwd: `${root}tools/candid`, stdio: 'inherit', env: { ...process.env, DFX_TELEMETRY: 'off' } });
for (const f of ['swapic.did.js', 'swapic.did.d.ts']) {
  let text = readFileSync(`${root}tools/candid/out/swapic/${f}`, 'utf8');
  for (const [from, to] of Object.entries(IMPORTS)) text = text.split(from).join(to);
  if (/@dfinity\//.test(text)) throw new Error(`${f} still imports @dfinity: add the path to IMPORTS`);
  writeFileSync(`${root}src/lib/icp/declarations/${f}`, text);
}
rmSync(`${root}tools/candid/out`, { recursive: true, force: true });
console.log('candid bindings written to src/lib/icp/declarations');
