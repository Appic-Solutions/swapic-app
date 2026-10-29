// Usage: node scripts/shots/app.mjs <route> <name> [scenario]   (needs `npm run dev:e2e` running)
// `click`: text of an element (or a list, clicked in order) to click before the shot (a menu's open state). `at`: shoot this many ms after load (a passing state).
// `fill`: `<placeholder>=<text>` typed into a field before the shot.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { installFakeBackend, setE2eWallets } from '../../tests/fake/backend.mjs';
import { SIZES } from './design.mjs';

export async function shootApp(route, name, scenario, outDir, click, at = 2500, fill) {
  mkdirSync(outDir, { recursive: true });
  const b = await chromium.launch();
  for (const [kind, w, h] of SIZES) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await installFakeBackend(p, scenario);
    await setE2eWallets(p, scenario);
    await p.goto(`http://localhost:3100${route}`);
    await p.waitForTimeout(at);
    for (const c of [click ?? []].flat()) {
      // the panels draw their action button twice (one per layout): click the one on screen
      await p.getByText(c, { exact: true }).filter({ visible: true }).first().click();
      await p.waitForTimeout(800);
    }
    if (fill) {
      // `<placeholder>=<text>`: type into a field (a search box) before the shot
      const [ph, ...text] = fill.split('=');
      await p.getByPlaceholder(ph).fill(text.join('='));
      await p.waitForTimeout(1500);
    }
    await p.screenshot({ path: `${outDir}/${name}-${kind}.png`, fullPage: true });
    await p.close();
  }
  await b.close();
}
