// Usage: npm run shots -- <DesignExport> <route> [scenario] [--click "<text>"]
// Writes .shots/compare/<DesignExport>-{desktop,phone}.png: design left, app right. Open them with the Read tool.
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { shootDesign } from './design.mjs';
import { shootApp } from './app.mjs';

const args = process.argv.slice(2);
const at = args.indexOf('--click');
const click = at >= 0 ? args.splice(at, 2)[1] : undefined;
const [name, route = '/', scenario = 'default'] = args;
if (!name) { console.log('usage: npm run shots -- <DesignExport> <route> [scenario]'); process.exit(1); }
const root = new URL('../../.shots/', import.meta.url).pathname;
await shootDesign(name, `${root}design`);
await shootApp(route, name, scenario, `${root}app`, click);
mkdirSync(`${root}compare`, { recursive: true });
const b = await chromium.launch();
for (const kind of ['desktop', 'phone']) {
  const img = (dir) => `data:image/png;base64,${readFileSync(`${root}${dir}/${name}-${kind}.png`).toString('base64')}`;
  const p = await b.newPage({ viewport: { width: kind === 'desktop' ? 2940 : 820, height: 1000 } });
  await p.setContent(`<body style="margin:0;background:#111;display:flex;gap:20px;align-items:flex-start">
    <img src="${img('design')}" style="width:${kind === 'desktop' ? 1440 : 390}px"><img src="${img('app')}" style="width:${kind === 'desktop' ? 1440 : 390}px"></body>`);
  await p.screenshot({ path: `${root}compare/${name}-${kind}.png`, fullPage: true });
  await p.close();
}
await b.close();
console.log(`compare: ${root}compare/${name}-desktop.png and -phone.png`);
