// Usage: node scripts/shots/design.mjs <DesignExport>   e.g. SwapScreen
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const SCREEN = '/Users/jeff/appic/.worktrees/platform-v2-design-sync/screens/screen.html';
export const SIZES = [['desktop', 1440, 1000], ['phone', 390, 844]];

export async function shootDesign(name, outDir) {
  mkdirSync(outDir, { recursive: true });
  const b = await chromium.launch();
  for (const [kind, w, h] of SIZES) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    const errors = [];
    p.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
    await p.goto(`file://${SCREEN}?screen=${name}`);
    await p.waitForTimeout(2500);
    await p.screenshot({ path: `${outDir}/${name}-${kind}.png`, fullPage: true });
    if (errors.length) console.log(name, kind, 'page errors:', errors);
    await p.close();
  }
  await b.close();
}
