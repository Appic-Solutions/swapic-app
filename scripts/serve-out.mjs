// Serves out/ on :3200 with the headers .ic-assets.json5 sets, for the CSP test only. Unknown paths answer index.html (as the asset canister does).
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
const out = new URL('../out', import.meta.url).pathname;
const rules = JSON.parse(readFileSync(join(out, '.ic-assets.json5'), 'utf8'));
const headers = rules[0].headers;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.txt': 'text/plain' };
createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let f = join(out, path);
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
  if (!existsSync(f) && existsSync(`${f}.html`)) f = `${f}.html`;
  if (!existsSync(f)) f = join(out, 'index.html');
  res.writeHead(200, { ...headers, 'content-type': TYPES[extname(f)] ?? 'application/octet-stream' });
  res.end(readFileSync(f));
}).listen(3200, () => console.log('serving out/ on http://localhost:3200'));
