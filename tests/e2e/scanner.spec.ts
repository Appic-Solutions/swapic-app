import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

// Loaded with import(): Playwright compiles a TypeScript spec as CommonJS and would compile a static import of the
// ES module fake backend the same way, which Node refuses for a .mjs file. `before`: more routes, set before the page opens.
async function open(page: Page, path = '/scanner', scenario = 'default', before?: () => Promise<unknown>) {
  const { installFakeBackend, setE2eWallets } = await import('../fake/backend.mjs');
  await installFakeBackend(page, scenario);
  await before?.();
  await setE2eWallets(page, scenario);
  await page.goto(path);
}

/** A long list on `path` (the feed or a wallet search), `size` rows a page; returns the cursors asked, in order. A route
 *  set after the fake backend's wins (Playwright asks the newest first). */
async function paged(page: Page, path: string, size: number, total: number) {
  const base = JSON.parse(readFileSync('tests/fixtures/contract/scanner-search-tx.json', 'utf8')).items[0];
  const rows = Array.from({ length: total }, (_, i) => ({ ...base, id: `0x${(i + 1).toString(16).padStart(64, '0')}`, createdAt: base.createdAt - i * 60 }));
  const asked: (string | null)[] = [];
  await page.route((u) => u.pathname === path, (route) => {
    const cursor = new URL(route.request().url()).searchParams.get('cursor');
    asked.push(cursor);
    const from = cursor ? rows.findIndex((r) => r.id === cursor) + 1 : 0;
    const items = rows.slice(from, from + size);
    const nextCursor = from + size < rows.length ? items.at(-1).id : null;
    return route.fulfill({ json: path === '/v2/orders' ? { orders: items, nextCursor } : { items, nextCursor }, headers: { 'access-control-allow-origin': '*' } });
  });
  return asked;
}
const ROWS = '[data-testid=scanner-row], [data-testid=scanner-card]';

const PLACEHOLDER = 'Search address, principal, order ID or tx hash';

test.describe('Scanner', () => {
  test('numbers, the live feed, a wallet chip', async ({ page }) => {
    await open(page);
    await expect(page.getByText('Swaps, all time')).toBeVisible();
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
  test('a row opens its order in place; Back returns to the same chips', async ({ page }) => {
    await open(page, '/scanner', 'scanner');
    const box = page.getByPlaceholder(PLACEHOLDER);
    await box.fill('0xf00EBA8E5Fd231b526ADFAAa68B4d0ede72A89AC');
    await box.press('Enter');
    await expect(page.getByText('Orders for 1 wallet')).toBeVisible();
    const rows = page.locator('[data-testid=scanner-row], [data-testid=scanner-card]').filter({ visible: true });
    await expect(rows).toHaveCount(4);
    // the panel turns into the order page (motion row 63): the link changes so it can be shared
    await rows.first().click();
    await expect(page).toHaveURL(/\/scanner\?order=/);
    await expect(page.getByText('Timeline')).toBeVisible();
    await expect(page.getByText('Orders for 1 wallet')).toHaveCount(0);
    await page.getByRole('button', { name: 'Back', includeHidden: true }).filter({ visible: true }).click();
    await expect(page).toHaveURL(/\?q=0xf00eba8e5fd231b526adfaaa68b4d0ede72a89ac$/);
    await expect(page.getByText('Orders for 1 wallet')).toBeVisible();
    await expect(rows).toHaveCount(4);
    // Clear takes the chips away and the live feed comes back
    await page.getByText('Clear').click();
    await expect(page.getByText('Latest transactions')).toBeVisible();
    await expect(page).toHaveURL(/\/scanner$/);
  });
  test('a click on the Scanner tab goes back to the list', async ({ page }) => {
    await open(page, '/scanner', 'scanner');
    const rows = page.locator('[data-testid=scanner-row], [data-testid=scanner-card]').filter({ visible: true });
    await rows.first().click();
    await expect(page.getByText('Timeline')).toBeVisible();
    await page.getByTestId('tab-nav').locator('a[href="/scanner"]').click();
    await expect(page.getByText('Latest transactions')).toBeVisible();
    await expect(page).toHaveURL(/\/scanner$/);
    // on a link that does not change, a typed search and its "Nothing found" go too
    const box = page.getByPlaceholder(PLACEHOLDER);
    await box.fill('0x12ab9f00c3');
    await box.press('Enter');
    await expect(page.getByText(/Nothing found for/)).toBeVisible();
    await page.getByTestId('tab-nav').locator('a[href="/scanner"]').click();
    await expect(page.getByText(/Nothing found for/)).toHaveCount(0);
    await expect(rows).toHaveCount(4);
    await expect(box).toHaveValue('');
  });
  test('reduce motion: one view after each change', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, '/scanner', 'scanner');
    const rows = page.locator('[data-testid=scanner-row], [data-testid=scanner-card]').filter({ visible: true });
    await expect(rows).toHaveCount(4);
    await rows.nth(1).click();
    await expect(page.locator('p').filter({ hasText: /^Order$/ })).toHaveCount(1);
    await expect(page.getByText('Latest transactions')).toHaveCount(0);
    await page.getByRole('button', { name: 'Back', includeHidden: true }).filter({ visible: true }).click();
    await expect(page.getByText('Latest transactions')).toHaveCount(1);
    await expect(page.locator('p').filter({ hasText: /^Order$/ })).toHaveCount(0);
  });
  test('older rows load by themselves near the end of the list, never before, with no button', async ({ page }) => {
    let asked: (string | null)[] = [];
    await open(page, '/scanner', 'scanner', async () => { asked = await paged(page, '/v2/scanner/latest', 20, 50); });
    const rows = page.locator(ROWS).filter({ visible: true });
    await expect(rows).toHaveCount(20);
    await expect(page.getByRole('button', { name: /Show older|Show more/, includeHidden: true })).toHaveCount(0);
    await page.waitForTimeout(500);
    expect(asked.filter(Boolean)).toHaveLength(0);
    // the end of the list in view: the inner list on desktop, the page on phones
    await rows.last().scrollIntoViewIfNeeded();
    await expect(rows).toHaveCount(40);
    expect(asked.filter(Boolean)).toHaveLength(1);
    await rows.last().scrollIntoViewIfNeeded();
    await expect(rows).toHaveCount(50);
  });
  test('a wallet search pages the same way', async ({ page }) => {
    let asked: (string | null)[] = [];
    await open(page, '/scanner?q=0xf00eba8e5fd231b526adfaaa68b4d0ede72a89ac', 'scanner', async () => { asked = await paged(page, '/v2/orders', 50, 70); });
    const rows = page.locator(ROWS).filter({ visible: true });
    await expect(rows).toHaveCount(50);
    await expect(page.getByText('50+ found')).toBeVisible();
    await rows.last().scrollIntoViewIfNeeded();
    await expect(rows).toHaveCount(70);
    await expect(page.getByText('70 found')).toBeVisible();
    expect(asked.filter(Boolean)).toHaveLength(1);
  });
  test('the search button and a pasted hash search without Enter', async ({ page }) => {
    await open(page, '/scanner', 'scanner');
    const box = page.getByPlaceholder(PLACEHOLDER);
    await expect(page.getByRole('button', { name: 'Search', exact: true, includeHidden: true })).toHaveCount(0);
    await box.fill('0xf00EBA8E5Fd231b526ADFAAa68B4d0ede72A89AC');
    await page.getByRole('button', { name: 'Search', exact: true, includeHidden: true }).click();
    await expect(page.getByText('Orders for 1 wallet')).toBeVisible();
    await page.getByText('Clear').click();
    await expect(page.getByText('Latest transactions')).toBeVisible();
    // a whole transaction hash pasted: its order opens at once
    await box.evaluate((el, text) => {
      const data = new DataTransfer();
      data.setData('text/plain', text);
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    }, '0x278d9ce98715d455ab24565fd54356bad62b79be489524bddc5cdb672f741443');
    await expect(page).toHaveURL(/\/scanner\?order=0xc5ba/);
  });
  test('a refunded row says only the outcome; its order page says why', async ({ page }) => {
    await open(page, '/scanner', 'scanner');
    const row = page.locator(ROWS).filter({ visible: true }).filter({ hasText: '119.80 USDC refunded' });
    await expect(row).toHaveCount(1);
    await expect(row).not.toContainText('was returned');
    await row.click();
    await expect(page.getByText("This swap couldn't be filled, so 119.80 USDC was returned on Polygon.")).toBeVisible();
  });
  test('desktop: the panel fits the window and only its list scrolls', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop');
    await page.setViewportSize({ width: 1280, height: 580 });
    await open(page, '/scanner', 'scanner', () => paged(page, '/v2/scanner/latest', 20, 50));
    await expect(page.locator(ROWS).filter({ visible: true })).toHaveCount(20);
    const m = await page.evaluate(() => ({ page: document.scrollingElement!.scrollHeight - window.innerHeight }));
    expect(m.page).toBeLessThanOrEqual(0);
  });
  test('an order that ended while its page was open shows ended in the list on Back', async ({ page }) => {
    const pending = JSON.parse(readFileSync('tests/fixtures/contract/scanner-latest.json', 'utf8')).items[0];
    const delivered = { ...pending, outcome: 'delivered', stage: 'delivered', endedAt: pending.createdAt + 26, to: { ...pending.to, amount: '74400000' } };
    await open(page, '/scanner', 'scanner', async () => {
      // the feed keeps its old answer; the order's own lookup, asked again once its status ends, says delivered
      await page.route((u) => u.pathname === '/v2/scanner/search', (route) => route.fulfill({ json: { q: pending.id, match: 'order', items: [delivered], nextCursor: null }, headers: { 'access-control-allow-origin': '*' } }));
    });
    const row = page.locator(ROWS).filter({ visible: true }).filter({ hasText: '75.00 USDC' });
    await expect(row).toContainText('In progress');
    await row.click();
    await expect(page.getByText('Timeline')).toBeVisible();
    await expect(page.getByText(/^Delivered/).first()).toBeVisible();
    await page.getByRole('button', { name: 'Back', includeHidden: true }).filter({ visible: true }).click();
    await expect(row).toContainText('Delivered');
    await expect(row).not.toContainText('In progress');
  });
  test('desktop: the order page columns end at the same height', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop');
    await open(page, '/scanner?order=0x9fa14cca14851b2f429f8fa56929263b0039159bf7c2bdf4fe725f381ec6c227', 'scanner');
    await expect(page.getByText('Delivered 0.002403 ckBTC')).toBeVisible();
    // measured once the timeline has come in and its steps have opened (they arrive after the order's row)
    await expect.poll(async () => {
      const l = await page.getByTestId('col-left').boundingBox();
      const r = await page.getByTestId('col-right').boundingBox();
      return Math.abs(l!.y + l!.height - (r!.y + r!.height));
    }).toBeLessThanOrEqual(1);
  });
});
