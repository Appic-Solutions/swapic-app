import { expect, test, type Page } from '@playwright/test';

// Loaded with import(): Playwright compiles a TypeScript spec as CommonJS and would compile a static import of the
// ES module fake backend the same way, which Node refuses for a .mjs file.
async function open(page: Page, scenario: string) {
  const { installFakeBackend, setE2eWallets } = await import('../fake/backend.mjs');
  await installFakeBackend(page, scenario);
  await setE2eWallets(page, scenario);
}

const TABS = ['Swap', 'Pool', 'History', 'Scanner'] as const;
// IdentityKit (1.0.14 live and 2.0.0 here) keeps its Radix dialog open and hides it with a class, so Radix marks the rest
// of the page aria-hidden: role queries need includeHidden. toBeVisible still checks what is drawn.
const HIDDEN_TOO = { includeHidden: true } as const;

test.describe('the shell', () => {
  test.beforeEach(async ({ page }) => open(page, 'default'));

  for (const [tab, path] of [['Swap', '/'], ['Pool', '/pool'], ['History', '/history'], ['Scanner', '/scanner']] as const) {
    test(`the ${tab} tab opens with the four tab nav`, async ({ page }, info) => {
      await page.goto(path);
      const nav = page.getByTestId('tab-nav');
      if (info.project.name === 'phone') {
        // phones show only the active tab's label (design Shell.tsx): four links, the active one named
        await expect(nav.getByRole('link', HIDDEN_TOO)).toHaveCount(4);
        await expect(nav.getByRole('link', { ...HIDDEN_TOO, name: tab, exact: true })).toBeVisible();
      } else {
        for (const t of TABS) await expect(nav.getByRole('link', { ...HIDDEN_TOO, name: t, exact: true })).toBeVisible();
      }
    });
  }

  test('an old link lands on its tab', async ({ page }) => {
    await page.goto('/positions');
    await expect(page).toHaveURL(/\/pool$/);
  });

  test('with both wallets, the menu shows each with its Disconnect', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Connected Wallets', { exact: true }).click();
    await expect(page.getByText('Your wallets', { exact: true })).toBeVisible();
    await expect(page.getByTestId('wallet-menu').getByRole('button', { ...HIDDEN_TOO, name: 'Disconnect', exact: true })).toHaveCount(2);
  });
});

test.describe('the wallet chooser', () => {
  test.beforeEach(async ({ page }) => open(page, 'no-wallet'));

  test('Connect Wallet offers the EVM list and the three ICP wallets', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Connect Wallet', { exact: true }).click();
    await expect(page.getByText('Connect a wallet', { exact: true })).toBeVisible();
    // scoped to our menu: IdentityKit's hidden signer list names OISY too
    const menu = page.getByTestId('wallet-menu');
    for (const name of ['EVM wallet', 'OISY', 'NFID', 'Internet Identity']) {
      await expect(menu.getByText(name, { exact: true })).toBeVisible();
    }
    await expect(menu.getByText('You can connect one EVM wallet and one ICP wallet at the same time.')).toBeVisible();
  });
});
