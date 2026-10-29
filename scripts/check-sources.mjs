// Prints every source the plans were written from whose hash changed since sources.lock.json.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const lockPath = new URL('../sources.lock.json', import.meta.url);
const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
let changed = 0;
for (const [file, want] of Object.entries(lock)) {
  let got = 'missing';
  try { got = createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 12); } catch {}
  if (got !== want) { changed++; console.log(`CHANGED ${want} -> ${got}  ${file}`); }
}
if (process.argv.includes('--accept')) {
  for (const file of Object.keys(lock)) {
    try { lock[file] = createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 12); } catch {}
  }
  writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
  console.log('sources.lock.json updated');
} else {
  console.log(changed ? `${changed} source(s) changed: read their diff before building on them` : 'sources unchanged');
}
