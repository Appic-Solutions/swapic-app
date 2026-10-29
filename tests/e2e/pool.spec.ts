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

  test('withdraw 25% to an EVM chain: one signature, then the status page, then the pool page in place', async ({ page }) => {
    await open(page, '/pool/withdraw', 'withdraw');
    await page.getByText('25%', { exact: true }).click();
    await expect(button(page, 'Sign withdrawal')).toBeEnabled();
    await button(page, 'Sign withdrawal').click();
    await expect(page.getByText('Withdrawal signed')).toBeVisible({ timeout: 15_000 });
    // a step shows a check only when the payout record says it is done
    await expect(page.locator('svg path[d="m4.5 12.75 6 6 9-13.5"]')).toHaveCount(1);
    await button(page, 'Back to pool').click();
    // the same panel turns into the pool page (motion part 2) and the link follows it
    await expect(page.getByText('Swapic Pool')).toBeVisible();
    await expect(page.getByText('Withdrawal signed')).toHaveCount(0);
    await expect(page).toHaveURL(/\/pool$/);
  });

  test('while the wallet asks, the button says so (its glow); then the status page', async ({ page }) => {
    await open(page, '/pool/withdraw', 'withdraw');
    await page.evaluate(() => { (window as unknown as { __SWAPIC_E2E__: { delayMs?: number } }).__SWAPIC_E2E__.delayMs = 1500; });
    await page.getByText('25%', { exact: true }).click();
    await button(page, 'Sign withdrawal').click();
    await expect(page.getByText('Confirm in your wallet').filter({ visible: true })).toBeVisible();
    await expect(page.getByText('Withdrawal signed')).toBeVisible({ timeout: 15_000 });
  });

  test('a "no" in the wallet brings the button back with the cancelled line', async ({ page }) => {
    await open(page, '/pool/withdraw', 'withdraw');
    await page.evaluate(() => { (window as unknown as { __SWAPIC_E2E__: { rejectNext?: boolean } }).__SWAPIC_E2E__.rejectNext = true; });
    await page.getByText('25%', { exact: true }).click();
    await button(page, 'Sign withdrawal').click();
    await expect(page.getByText('You cancelled in your wallet.').filter({ visible: true })).toBeVisible();
    await expect(button(page, 'Sign withdrawal')).toBeEnabled();
    await expect(page.getByText('Withdrawal signed')).toHaveCount(0);
  });

  test('Stake and Stake From open in the same panel; the link follows; Back returns', async ({ page }) => {
    await open(page, '/pool', 'pool');
    await expect(page.getByText('Swapic Pool')).toBeVisible();
    await page.getByRole('link', { name: 'Stake', exact: true, includeHidden: true }).click();
    await expect(page.getByText('Added to your stake')).toBeVisible();
    await expect(page.getByText('Swapic Pool')).toHaveCount(0);
    await expect(page).toHaveURL(/\/pool\/stake$/);
    await page.locator('input[type=number]').fill('100');
    await page.getByText('From', { exact: true }).click();
    await expect(page.getByText('Stake From')).toBeVisible();
    // a picker keeps its parent's link
    await expect(page).toHaveURL(/\/pool\/stake$/);
    // the leaving view fades out (one Back once it has gone)
    await expect(page.getByText('Added to your stake')).toHaveCount(0);
    await button(page, 'Back').click();
    // the amount typed outlives the picker
    await expect(page.locator('input[type=number]')).toHaveValue('100');
    await expect(page.getByText('Stake From')).toHaveCount(0);
    await button(page, 'Back').click();
    await expect(page.getByText('Swapic Pool')).toBeVisible();
    await expect(page.getByText('Added to your stake')).toHaveCount(0);
    await expect(page).toHaveURL(/\/pool$/);
  });

  test('the browser\'s Back returns to the previous view, a refresh reopens the view, the Pool tab goes back to the pool page', async ({ page }) => {
    await open(page, '/pool', 'pool');
    await expect(page.getByText('Swapic Pool')).toBeVisible();
    await page.getByRole('link', { name: 'Stake', exact: true, includeHidden: true }).click();
    await expect(page).toHaveURL(/\/pool\/stake$/);
    await expect(page.getByText('Added to your stake')).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/pool$/);
    await expect(page.getByText('Swapic Pool')).toBeVisible();
    await expect(page.getByText('Added to your stake')).toHaveCount(0);
    await page.goForward();
    await expect(page.getByText('Added to your stake')).toBeVisible();
    await page.reload();
    await expect(page.getByText('Added to your stake')).toBeVisible();
    await expect(page).toHaveURL(/\/pool\/stake$/);
    // from the pool page loaded fresh: Withdraw in place, then a click on the Pool tab
    await page.goto('/pool');
    await expect(page.getByText('Swapic Pool')).toBeVisible();
    await page.getByRole('link', { name: 'Withdraw', exact: true, includeHidden: true }).click();
    await expect(page.getByText('You receive')).toBeVisible();
    await expect(page).toHaveURL(/\/pool\/withdraw$/);
    await page.getByTestId('tab-nav').locator('a[href="/pool"]').click();
    await expect(page.getByText('Swapic Pool')).toBeVisible();
    await expect(page.getByText('You receive')).toHaveCount(0);
    await expect(page).toHaveURL(/\/pool$/);
  });

  test('reduce motion: one view after each change', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, '/pool', 'pool');
    await expect(page.getByText('Swapic Pool')).toBeVisible();
    await page.getByRole('link', { name: 'Withdraw', exact: true, includeHidden: true }).click();
    await expect(page.getByText('You receive')).toHaveCount(1);
    await expect(page.getByText('Swapic Pool')).toHaveCount(0);
    await button(page, 'Back').click();
    await expect(page.getByText('Swapic Pool')).toHaveCount(1);
    await expect(page.getByText('You receive')).toHaveCount(0);
  });
});
