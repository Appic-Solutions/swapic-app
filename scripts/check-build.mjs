// Fails when out/ holds an e2e fake (the fake modules use the string E2E-FAKE-MARKER at run time, so the minifier keeps it).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const out = new URL('../out', import.meta.url).pathname;
let bad = 0;
const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (/\.(js|html)$/.test(n) && readFileSync(p, 'utf8').includes('E2E-FAKE-MARKER')) { bad++; console.log('e2e code in', p); } } };
walk(out);
if (bad) process.exit(1);
console.log('build holds no e2e code');
