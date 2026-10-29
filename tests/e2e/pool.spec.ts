import { expect, test, type Page } from '@playwright/test';

// Loaded with import(): Playwright compiles a TypeScript spec as CommonJS and would compile a static import of the
// ES module fake backend the same way, which Node refuses for a .mjs file.
async function open(page: Page, path: string, scenario = 'default') {
  const { installFakeBackend, setE2eWallets } = await import('../fake/backend.mjs');
  await installFakeBackend(page, scenario);
  await setE2eWallets(page, scenario);
  await page.goto(path);
}

// IdentityKit keeps its Radix dialog open and hides it with a class, so the page is aria-hidden: role queries need
// includeHidden. The panels draw their action button twice (desktop and phone layouts, one hidden by CSS): the shown one.
const button = (page: Page, name: string) => page.getByRole('button', { name, includeHidden: true }).filter({ visible: true });

test.describe('Pool', () => {
  test('the pool page shows the tiles and both wallets\' stake added into one', async ({ page }) => {
    await open(page, '/pool');
    await expect(page.getByText('Swapic Pool')).toBeVisible();
    await expect(page.getByText('APY, 7 days')).toBeVisible();
    await expect(page.getByText('4.2%').first()).toBeVisible();
    // the card's title (the chart's metric picker also reads Your stake)
    await expect(page.getByText('Your stake', { exact: true }).first()).toBeVisible();
    // the default scenario answers the 5.5 example for both wallets: $1,192.80 twice
    await expect(page.getByText('$2,385.60', { exact: true })).toBeVisible();
    await expect(page.getByText(/in line, about/).first()).toBeVisible();
  });

  test('stake above the room says how much fits, before any wallet step', async ({ page }) => {
    await open(page, '/pool/stake');
    await page.locator('input[type=number]').fill('2500');
    await expect(page.getByText('You can stake up to $1,579 right now.')).toBeVisible();
    await expect(button(page, 'Up to $1,579 right now')).toBeDisabled();
  });

  test('a smart wallet cannot stake from an EVM chain', async ({ page }) => {
    await open(page, '/pool/stake?amount=100', 'smart-wallet');
    await expect(page.getByText('The pool needs a regular wallet for now.')).toBeVisible();
    await expect(button(page, 'Stake 100 USDC')).toBeDisabled();
  });

  test('desktop: stake and withdraw columns end at the same height', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop');
    for (const [path, ready] of [['/pool/stake?amount=100', 'Stake 100 USDC'], ['/pool/withdraw?amount=100', 'Sign withdrawal']]) {
      await open(page, path!, 'pool');
      await expect(button(page, ready!)).toBeVisible();
      const l = await page.getByTestId('col-left').boundingBox();
      const r = await page.getByTestId('col-right').boundingBox();
      expect(Math.abs(l!.y + l!.height - (r!.y + r!.height))).toBeLessThanOrEqual(1);
    }
  });

  test('withdraw 25% to an EVM chain: one signature, then the status page', async ({ page }) => {
    await open(page, '/pool/withdraw', 'withdraw');
    await page.getByText('25%', { exact: true }).click();
    await expect(button(page, 'Sign withdrawal')).toBeEnabled();
    await button(page, 'Sign withdrawal').click();
    await expect(page.getByText('Withdrawal signed')).toBeVisible({ timeout: 15_000 });
    await expect(button(page, 'Back to pool')).toBeVisible();
  });
});
