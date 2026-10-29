// Runs against `npm run build:test` served with its own headers (playwright.csp.config.ts). It talks to the real staging API host
// (GET only: chains, tokens, pool, scanner) and to the wallets' public hosts; nothing is signed.
import { expect, test } from '@playwright/test';

test('every tab and both wallet menus load with no CSP violation and no trace header to the API', async ({ page }) => {
  const violations: string[] = [];
  const traced: string[] = [];
  await page.exposeFunction('reportCsp', (v: string) => violations.push(v));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => (window as unknown as { reportCsp(v: string): void }).reportCsp(`${e.violatedDirective} ${e.blockedURI}`));
  });
  page.on('console', (m) => { if (/Content Security Policy/i.test(m.text())) violations.push(m.text()); });
  // the EVM wallet list really loaded (AppKit asks Reown's API for it), so a pass is not an empty one
  let walletList = false;
  page.on('request', (r) => { if (r.url().startsWith('https://api.web3modal.org')) walletList = true; });
  page.on('request', (r) => {
    if (r.url().startsWith('https://api-test.swapic.xyz') && (r.headers()['sentry-trace'] || r.headers()['baggage'])) traced.push(r.url());
  });
  for (const path of ['/', '/pool', '/pool/stake', '/pool/withdraw', '/history', '/scanner']) {
    await page.goto(path);
    await page.waitForTimeout(3000);
  }
  // the Header's menu (the app's own rows; IdentityKit keeps its own hidden dialog with the same names, so scope to the menu)
  await page.goto('/');
  await page.getByText('Connect Wallet', { exact: true }).filter({ visible: true }).click();
  await page.getByTestId('wallet-menu').getByText('EVM wallet', { exact: true }).click();
  await page.waitForTimeout(4000);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await page.getByText('Connect Wallet', { exact: true }).filter({ visible: true }).click();
  await page.getByTestId('wallet-menu').getByText('OISY', { exact: true }).click();
  await page.waitForTimeout(2000);
  expect(walletList).toBe(true);
  expect(violations).toEqual([]);
  expect(traced).toEqual([]);
});
