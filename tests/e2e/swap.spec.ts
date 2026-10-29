import { expect, test, type Page } from '@playwright/test';

// Loaded with import(): Playwright compiles a TypeScript spec as CommonJS and would compile a static import of the
// ES module fake backend the same way, which Node refuses for a .mjs file.
async function openAt(page: Page, scenario: string, path: string) {
  const { installFakeBackend, setE2eWallets } = await import('../fake/backend.mjs');
  await installFakeBackend(page, scenario);
  await setE2eWallets(page, scenario);
  await page.goto(path);
}
const open = (page: Page, scenario: string) => openAt(page, scenario, '/');

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

test.describe('Swap, the shareable link', () => {
  const ARB_USDC = 'eip155:42161|0xaf88d065e77c8cc2239327c5edb3a432268e5831';
  const POL_WBTC = 'eip155:137|0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6';
  const bar = (k: string) => k.replace('|', '(\\||%7C)');
  test('picking tokens and an amount updates the address bar, without a history entry per change', async ({ page }) => {
    await open(page, 'default');
    const before = await page.evaluate(() => history.length);
    await pickTokens(page);
    await expect(page).toHaveURL(new RegExp(`\\?from=${bar(ARB_USDC)}&to=${bar(POL_WBTC)}&amount=5$`));
    expect(await page.evaluate(() => history.length)).toBe(before);
  });
  test('opening a link fills the panel and never a receiving address', async ({ page }) => {
    await openAt(page, 'default', `/?from=${ARB_USDC}&to=${POL_WBTC}&amount=5&send=0x000000000000000000000000000000000000dEaD`);
    await expect(page.getByTestId('swap-left').getByText('USDC', { exact: true })).toBeVisible();
    await expect(page.getByTestId('swap-left').getByText('WBTC', { exact: true })).toBeVisible();
    await expect(page.locator('input[type=number]')).toHaveValue('5');
    await expect(page.getByPlaceholder(/0x0f70e/)).toHaveValue('');
    await expect(button(page, 'Review swap')).toBeEnabled();
  });
  test('a token from a link that is not on the list shows its warning first', async ({ page }) => {
    await openAt(page, 'pasted', '/?from=eip155:8453|0x3f1b9c4e7d2a6058ac91e0b7d45f28c63a9e1d07');
    await expect(page.getByText('Not on our list.')).toBeVisible();
    await expect(page.getByPlaceholder('Search token')).toHaveValue('0x3f1b9c4e7d2a6058ac91e0b7d45f28c63a9e1d07');
  });
});
