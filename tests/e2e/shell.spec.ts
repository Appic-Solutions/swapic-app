import { expect, test } from '@playwright/test';

// Loaded with import(): Playwright compiles a TypeScript spec as CommonJS and would compile a static import of the
// ES module fake backend the same way, which Node refuses for a .mjs file.
test.beforeEach(async ({ page }) => {
  const { installFakeBackend, setE2eWallets } = await import('../fake/backend.mjs');
  await installFakeBackend(page, 'default');
  await setE2eWallets(page, 'default');
});

const TABS = ['Swap', 'Pool', 'History', 'Scanner'] as const;
// IdentityKit (1.0.14 live and 2.0.0 here) keeps its Radix dialog open and hides it with a class, so Radix marks the rest
// of the page aria-hidden: role queries need includeHidden. toBeVisible still checks what is drawn.
const LINK = { includeHidden: true } as const;

for (const [tab, path] of [['Swap', '/'], ['Pool', '/pool'], ['History', '/history'], ['Scanner', '/scanner']] as const) {
  test(`the ${tab} tab opens with the four tab nav`, async ({ page }, info) => {
    await page.goto(path);
    const nav = page.getByTestId('tab-nav');
    if (info.project.name === 'phone') {
      // phones show only the active tab's label (design Shell.tsx): four links, the active one named
      await expect(nav.getByRole('link', LINK)).toHaveCount(4);
      await expect(nav.getByRole('link', { ...LINK, name: tab, exact: true })).toBeVisible();
    } else {
      for (const t of TABS) await expect(nav.getByRole('link', { ...LINK, name: t, exact: true })).toBeVisible();
    }
  });
}

test('an old link lands on its tab', async ({ page }) => {
  await page.goto('/positions');
  await expect(page).toHaveURL(/\/pool$/);
});
