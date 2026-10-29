// Usage: node scripts/shots/app.mjs <route> <name> [scenario]   (needs `npm run dev:e2e` running)
// `click`: text of an element to click before the shot (a menu's open state).
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { installFakeBackend, setE2eWallets } from '../../tests/fake/backend.mjs';
import { SIZES } from './design.mjs';

export async function shootApp(route, name, scenario, outDir, click) {
  mkdirSync(outDir, { recursive: true });
  const b = await chromium.launch();
  for (const [kind, w, h] of SIZES) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await installFakeBackend(p, scenario);
    await setE2eWallets(p, scenario);
    await p.goto(`http://localhost:3100${route}`);
    await p.waitForTimeout(2500);
    if (click) {
      await p.getByText(click, { exact: true }).first().click();
      await p.waitForTimeout(800);
    }
    await p.screenshot({ path: `${outDir}/${name}-${kind}.png`, fullPage: true });
    await p.close();
  }
  await b.close();
}
