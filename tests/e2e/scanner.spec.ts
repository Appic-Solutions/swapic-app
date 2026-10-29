import { expect, test, type Page } from '@playwright/test';

// Loaded with import(): Playwright compiles a TypeScript spec as CommonJS and would compile a static import of the
// ES module fake backend the same way, which Node refuses for a .mjs file.
async function open(page: Page, path = '/scanner', scenario = 'default') {
  const { installFakeBackend, setE2eWallets } = await import('../fake/backend.mjs');
  await installFakeBackend(page, scenario);
  await setE2eWallets(page, scenario);
  await page.goto(path);
}

const PLACEHOLDER = 'Search address, principal, order ID or tx hash';

test.describe('Scanner', () => {
  test('numbers, the live feed, a wallet chip', async ({ page }) => {
    await open(page);
    await expect(page.getByText('Swaps, 24H')).toBeVisible();
    await expect(page.getByText('1,284')).toBeVisible();
    await expect(page.getByText('Latest transactions')).toBeVisible();
    const box = page.getByPlaceholder(PLACEHOLDER);
    await box.fill('0xf00EBA8E5Fd231b526ADFAAa68B4d0ede72A89AC');
    await box.press('Enter');
    await expect(page.getByText('Orders for 1 wallet')).toBeVisible();
    await expect(page).toHaveURL(/\?q=0xf00eba8e5fd231b526adfaaa68b4d0ede72a89ac$/);
  });
  test('a transaction hash opens its order; a partial text finds nothing without asking', async ({ page }) => {
    let searched = 0;
    page.on('request', (r) => { if (r.url().includes('/v2/scanner/search')) searched++; });
    await open(page);
    const box = page.getByPlaceholder(PLACEHOLDER);
    await box.fill('0x12ab9f00c3');
    await box.press('Enter');
    await expect(page.getByText(/Nothing found for/)).toBeVisible();
    expect(searched).toBe(0);
    await box.fill('0x278d9ce98715d455ab24565fd54356bad62b79be489524bddc5cdb672f741443');
    await box.press('Enter');
    await expect(page).toHaveURL(/\/scanner\?order=0xc5ba/);
    await expect(page.getByText('Timeline')).toBeVisible();
  });
  test('desktop: the order page columns end at the same height', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop');
    await open(page, '/scanner?order=0x9fa14cca14851b2f429f8fa56929263b0039159bf7c2bdf4fe725f381ec6c227', 'scanner');
    await expect(page.getByText('Delivered 0.002403 ckBTC')).toBeVisible();
    const l = await page.getByTestId('col-left').boundingBox();
    const r = await page.getByTestId('col-right').boundingBox();
    expect(Math.abs(l!.y + l!.height - (r!.y + r!.height))).toBeLessThanOrEqual(1);
  });
});
