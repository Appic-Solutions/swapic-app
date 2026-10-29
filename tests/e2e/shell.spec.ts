import { expect, test } from '@playwright/test';
import { installFakeBackend, setE2eWallets } from '../fake/backend.mjs';

test.beforeEach(async ({ page }) => {
  await installFakeBackend(page, 'default');
  await setE2eWallets(page, 'default');
});

const TABS = ['Swap', 'Pool', 'History', 'Scanner'] as const;

for (const [tab, path] of [['Swap', '/'], ['Pool', '/pool'], ['History', '/history'], ['Scanner', '/scanner']] as const) {
  test(`the ${tab} tab opens with the four tab nav`, async ({ page }, info) => {
    await page.goto(path);
    const nav = page.getByTestId('tab-nav');
    if (info.project.name === 'phone') {
      // phones show only the active tab's label (design Shell.tsx): four links, the active one named
      await expect(nav.getByRole('link')).toHaveCount(4);
      await expect(nav.getByRole('link', { name: tab, exact: true })).toBeVisible();
    } else {
      for (const t of TABS) await expect(nav.getByRole('link', { name: t, exact: true })).toBeVisible();
    }
  });
}

test('an old link lands on its tab', async ({ page }) => {
  await page.goto('/positions');
  await expect(page).toHaveURL(/\/pool$/);
});
