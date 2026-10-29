import { expect, test, type Page } from '@playwright/test';

// Loaded with import(): Playwright compiles a TypeScript spec as CommonJS and would compile a static import of the
// ES module fake backend the same way, which Node refuses for a .mjs file.
async function open(page: Page, scenario: string) {
  const { installFakeBackend, setE2eWallets } = await import('../fake/backend.mjs');
  await installFakeBackend(page, scenario);
  await setE2eWallets(page, scenario);
  await page.goto('/');
}

// IdentityKit keeps its Radix dialog open and hides it with a class, so the page is aria-hidden: role queries need
// includeHidden. The design draws the action button twice (desktop and phone layouts, one hidden by CSS): the shown one.
const button = (page: Page, name: string) => page.getByRole('button', { name, includeHidden: true }).filter({ visible: true });

async function pickTokens(page: Page) {
  await page.getByText('From', { exact: true }).click();
  await page.locator('[data-chain-id="42161"]').click();
  await page.getByText('USDC', { exact: true }).first().click();
  await page.getByText('To', { exact: true }).click();
  await page.locator('[data-chain-id="137"]').click();
  await page.getByText('WBTC', { exact: true }).first().click();
  await page.locator('input[type=number]').fill('5');
}

test.describe('Swap', () => {
  test('pick tokens, type an amount, see Gasless and one Fastest and Best price card, Review swap ready', async ({ page }) => {
    await open(page, 'default');
    await expect(button(page, 'Select tokens to swap')).toBeDisabled();
    await pickTokens(page);
    await expect(page.getByText('Gasless', { exact: true })).toBeVisible();
    await expect(page.getByText('Fastest', { exact: true })).toBeVisible();
    await expect(page.getByText('Best price', { exact: true })).toBeVisible();
    await expect(page.getByText('via Swapic')).toHaveCount(2);
    await expect(page.getByText('You pay gas')).toHaveCount(1);
    await expect(button(page, 'Review swap')).toBeEnabled();
  });

  test('desktop: the panel columns end at the same height', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop');
    await open(page, 'default');
    await pickTokens(page);
    await expect(page.getByText('Gasless', { exact: true })).toBeVisible();
    const left = await page.getByTestId('swap-left').boundingBox();
    const right = await page.getByTestId('swap-routes').boundingBox();
    expect(Math.abs(left!.y + left!.height - (right!.y + right!.height))).toBeLessThanOrEqual(1);
  });

  test('a bad Send To Wallet address blocks the swap', async ({ page }) => {
    await open(page, 'default');
    await pickTokens(page);
    // the wallet toggle beside the button: one per layout, the visible one
    await page.locator('.min-w-12').locator('visible=true').first().click();
    await page.getByPlaceholder(/0x0f70e/).fill('0x3A9c2E07b5F81dC4');
    await expect(button(page, 'Enter Valid Address')).toBeDisabled();
  });

  test('a smart wallet types the address that receives on another chain (plan 2 Smart wallets)', async ({ page }) => {
    await open(page, 'smart-wallet');
    await pickTokens(page);
    await expect(page.getByText('You are using a smart wallet. Type the address that should receive on Polygon, and make sure it is yours there.')).toBeVisible();
    await expect(button(page, 'Enter Valid Address')).toBeDisabled();
    await page.getByPlaceholder(/0x0f70e/).fill('0xf00EBA8E5Fd231b526ADFAAa68B4d0ede72A89AC');
    await expect(button(page, 'Review swap')).toBeEnabled();
  });

  test('no wallet: indicative routes, and the button asks to connect', async ({ page }) => {
    await open(page, 'no-wallet');
    await pickTokens(page);
    await expect(button(page, 'Connect wallet')).toBeEnabled();
  });

  test('swaps from ICP paused while the pool refills (contract 5.15)', async ({ page }) => {
    await open(page, 'icp-paused');
    await page.getByText('From', { exact: true }).click();
    await page.locator('[data-chain-id="0"]').click();
    await page.getByText('ckUSDC', { exact: true }).first().click();
    await page.getByText('To', { exact: true }).click();
    await page.locator('[data-chain-id="8453"]').click();
    await page.getByText('USDC', { exact: true }).first().click();
    await page.locator('input[type=number]').fill('5');
    await expect(page.getByText('Swaps from ICP are paused for a few minutes while the pool refills. Try again soon.')).toBeVisible();
    await expect(button(page, 'Paused for now')).toBeDisabled();
  });

  test('no route: the empty card and the button say so', async ({ page }) => {
    await open(page, 'no-route');
    await pickTokens(page);
    await expect(page.getByText('No routes found')).toBeVisible();
    await expect(button(page, 'No route found')).toBeDisabled();
  });
});
