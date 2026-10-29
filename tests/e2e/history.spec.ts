import { expect, test, type Page } from '@playwright/test';

// Loaded with import(): Playwright compiles a TypeScript spec as CommonJS and would compile a static import of the
// ES module fake backend the same way, which Node refuses for a .mjs file.
async function open(page: Page, scenario: string) {
  const { installFakeBackend, setE2eWallets } = await import('../fake/backend.mjs');
  await installFakeBackend(page, scenario);
  await setE2eWallets(page, scenario);
  await page.goto('/history');
}

test.describe('History', () => {
  test('both wallets, the rows, a row opens its steps and goes to the Scanner', async ({ page }) => {
    await open(page, 'history');
    await expect(page.getByText('History', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('0xf00e…89ac').first()).toBeVisible();
    await expect(page.getByText('3yfhk…2qe').first()).toBeVisible();
    await expect(page.getByTestId('order-row')).toHaveCount(3);
    await page.getByText('View Details').first().click();
    // the first row's steps, fetched when it opens
    await expect(page.getByText('Sent on Base')).toBeVisible();
    await page.getByTestId('open-scanner').filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/scanner\?order=0xa123/);
  });
  test('the filter keeps the pool rows only', async ({ page }) => {
    await open(page, 'history');
    await page.getByRole('button', { name: /^Pool/, includeHidden: true }).click();
    await expect(page.getByTestId('order-row')).toHaveCount(1);
    await expect(page.getByText('Withdraw', { exact: true })).toBeVisible();
  });
  test('a refunded row says where the money went', async ({ page }) => {
    await open(page, 'history-refund');
    await expect(page.getByText('Refunded on Polygon')).toBeVisible();
    await expect(page.getByText('119.80 USDC').first()).toBeVisible();
  });
  test('no wallet and no rows show the designed empty states', async ({ page }) => {
    await open(page, 'no-wallet');
    await expect(page.getByText('Connect your wallet to see your history')).toBeVisible();
    await open(page, 'history-empty');
    await expect(page.getByText('No swaps yet')).toBeVisible();
  });
});
