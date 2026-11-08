import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

// Loaded with import(): Playwright compiles a TypeScript spec as CommonJS and would compile a static import of the
// ES module fake backend the same way, which Node refuses for a .mjs file. `before`: more routes, set before the page opens.
async function open(page: Page, scenario: string, before?: () => Promise<unknown>) {
  const { installFakeBackend, setE2eWallets } = await import('../fake/backend.mjs');
  await installFakeBackend(page, scenario);
  // an order's own status (the rows in progress watch it): still on its way, as the scenario's rows say
  await page.route((u) => /^\/v2\/orders\/[^/]+$/.test(u.pathname), (route) => route.fulfill({ json: statusOf(decodeURIComponent(new URL(route.request().url()).pathname.split('/')[3]!), false), headers: CORS }));
  await before?.();
  await setE2eWallets(page, scenario);
  await page.goto('/history');
}

const CORS = { 'access-control-allow-origin': '*' };
const contract = (f: string) => JSON.parse(readFileSync(`tests/fixtures/contract/${f}`, 'utf8'));
/** The pending swap of contract 5.11, and the same swap delivered. */
const PENDING = () => contract('scanner-latest.json').items[0];
const DELIVERED = () => { const p = PENDING(); return { ...p, outcome: 'delivered', stage: 'delivered', endedAt: p.createdAt + 26, deliveredAt: p.createdAt + 26, tookS: 26, to: { ...p.to, amount: '74400000' } }; };
/** Contract 5.8's status, for `id`: on its way, or delivered. */
const statusOf = (id: string, delivered: boolean) => ({ ...contract('order-status-delivered.json'), orderId: id, outcome: delivered ? 'delivered' : 'pending', stage: delivered ? 'delivered' : 'paying', amountOut: delivered ? '74400000' : null });
/** Contract 5.14's delivered steps, for the pending swap. */
const STEPS_DELIVERED = () => ({ ...contract('steps-delivered.json'), id: PENDING().id });

/** The wallets' rows as a long list, 50 a page; an older page answers 429 while `limited()` says so. Returns the cursors
 *  asked, in order. A route set after the fake backend's wins (Playwright asks the newest first). */
async function paged(page: Page, total: number, limited: () => boolean = () => false) {
  const base = JSON.parse(readFileSync('tests/fixtures/contract/scanner-search-tx.json', 'utf8')).items[0];
  const rows = Array.from({ length: total }, (_, i) => ({ ...base, id: `0x${(i + 1).toString(16).padStart(64, '0')}`, createdAt: base.createdAt - i * 60 }));
  const asked: (string | null)[] = [];
  await page.route((u) => u.pathname === '/v2/orders', (route) => {
    const cursor = new URL(route.request().url()).searchParams.get('cursor');
    asked.push(cursor);
    const headers = { 'access-control-allow-origin': '*' };
    if (cursor && limited()) return route.fulfill({ status: 429, json: { code: 'rateLimited', message: 'too many requests' }, headers });
    const from = cursor ? rows.findIndex((r) => r.id === cursor) + 1 : 0;
    const orders = rows.slice(from, from + 50);
    return route.fulfill({ json: { orders, nextCursor: from + 50 < rows.length ? orders.at(-1).id : null }, headers });
  });
  return asked;
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
    // Open in Scanner opens the order page in place (motion row 58): the History panel turns into it, Back returns
    await page.getByTestId('open-scanner').filter({ visible: true }).first().click();
    await expect(page.locator('p').filter({ hasText: /^Order$/ })).toHaveCount(1);
    await expect(page.getByText('Timeline')).toBeVisible();
    await expect(page).toHaveURL(/\/history$/);
    await page.getByRole('button', { name: 'Back', includeHidden: true }).filter({ visible: true }).click();
    await expect(page.getByTestId('order-row')).toHaveCount(3);
    // a click on the History tab while the order page shows goes back to the list
    await page.getByText('View Details').first().click();
    await page.getByTestId('open-scanner').filter({ visible: true }).first().click();
    await expect(page.getByText('Timeline')).toBeVisible();
    await page.getByTestId('tab-nav').locator('a[href="/history"]').click();
    await expect(page.getByTestId('order-row')).toHaveCount(3);
    await expect(page.getByText('Timeline')).toHaveCount(0);
  });
  test('reduce motion: one view after each change, and the filter still works', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, 'history');
    await expect(page.getByTestId('order-row')).toHaveCount(3);
    await page.getByRole('button', { name: /^Swaps/, includeHidden: true }).click();
    await expect(page.getByTestId('order-row')).toHaveCount(2);
    await page.getByText('View Details').first().click();
    await page.getByTestId('open-scanner').filter({ visible: true }).first().click();
    await expect(page.locator('p').filter({ hasText: /^Order$/ })).toHaveCount(1);
    await expect(page.locator('h1').filter({ hasText: /^History$/ })).toHaveCount(0);
  });
  test('the filter keeps the pool rows only', async ({ page }) => {
    await open(page, 'history');
    await page.getByRole('button', { name: /^Pool/, includeHidden: true }).click();
    await expect(page.getByTestId('order-row')).toHaveCount(1);
    await expect(page.getByText('Withdraw', { exact: true })).toBeVisible();
  });
  test('a refunded row says where the money went, and the order page says why', async ({ page }) => {
    await open(page, 'history-refund');
    await expect(page.getByText('Refunded on Polygon')).toBeVisible();
    await expect(page.getByText('119.80 USDC').first()).toBeVisible();
    await expect(page.getByTestId('order-row')).not.toContainText('was returned');
    await page.getByText('View Details').first().click();
    await page.getByTestId('open-scanner').filter({ visible: true }).first().click();
    await expect(page.getByText("This swap couldn't be filled, so 119.80 USDC was returned on Polygon.")).toBeVisible();
  });
  test('older rows load by themselves near the end of the list, with no button', async ({ page }) => {
    let asked: (string | null)[] = [];
    await open(page, 'history', async () => { asked = await paged(page, 80); });
    const rows = page.getByTestId('order-row');
    await expect(rows).toHaveCount(50);
    await expect(page.getByRole('button', { name: /Show older|Show more/, includeHidden: true })).toHaveCount(0);
    expect(asked.filter(Boolean)).toHaveLength(0);
    await rows.last().scrollIntoViewIfNeeded();
    await expect(rows).toHaveCount(80);
    expect(asked.filter(Boolean)).toHaveLength(1);
    // the older rows are not new arrivals: the list stays where it was scrolled
    await page.waitForTimeout(800);
    await expect(rows.nth(49)).toBeInViewport();
  });
  test('a 429 on an older page stops quietly and is asked again only after a pause', async ({ page }) => {
    let limited = true;
    let asked: (string | null)[] = [];
    await open(page, 'history', async () => { asked = await paged(page, 80, () => limited); });
    const rows = page.getByTestId('order-row');
    await expect(rows).toHaveCount(50);
    await rows.last().scrollIntoViewIfNeeded();
    await expect.poll(() => asked.filter(Boolean).length).toBe(1);
    await expect(page.getByTestId('loading-more')).toHaveCount(0);
    await expect(rows).toHaveCount(50);
    await expect(page.getByText("Couldn't load your history")).toHaveCount(0);
    // at once again: nothing is asked (the page clock is fixed in this scenario, so the pause is moved past by hand)
    await rows.first().scrollIntoViewIfNeeded();
    await rows.last().scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    expect(asked.filter(Boolean)).toHaveLength(1);
    limited = false;
    await page.clock.setFixedTime(new Date((1793408400 + 16) * 1000));
    await rows.first().scrollIntoViewIfNeeded();
    await rows.last().scrollIntoViewIfNeeded();
    await expect(rows).toHaveCount(80);
    expect(asked.filter(Boolean)).toHaveLength(2);
  });
  test('no wallet and no rows show the designed empty states', async ({ page }) => {
    await open(page, 'no-wallet');
    await expect(page.getByText('Connect your wallet to see your history')).toBeVisible();
    await open(page, 'history-empty');
    await expect(page.getByText('No swaps yet')).toBeVisible();
  });
  test('a row in progress ends on screen within about 3 s of its order, from its own status', async ({ page }) => {
    let done = false;
    await open(page, 'history', async () => {
      await page.route((u) => u.pathname === '/v2/orders', (route) => route.fulfill({ json: { orders: [done ? DELIVERED() : PENDING()], nextCursor: null }, headers: CORS }));
      await page.route((u) => /^\/v2\/orders\/[^/]+$/.test(u.pathname), (route) => route.fulfill({ json: statusOf(PENDING().id, done), headers: CORS }));
    });
    const row = page.getByTestId('order-row');
    await expect(row).toContainText('In progress');
    await page.waitForTimeout(1_000);
    done = true;
    // the list itself comes again only after 10 s: the row's own status (every 3 s) ends it first
    await expect(row).toContainText('Delivered', { timeout: 4_500 });
  });
  test('an open row whose steps say it ended ends at once, even before its status or the list do', async ({ page }) => {
    await open(page, 'history', async () => {
      await page.route((u) => u.pathname === '/v2/orders', (route) => route.fulfill({ json: { orders: [PENDING()], nextCursor: null }, headers: CORS }));
      await page.route((u) => /^\/v2\/orders\/[^/]+\/steps$/.test(u.pathname), (route) => route.fulfill({ json: STEPS_DELIVERED(), headers: CORS }));
    });
    const row = page.getByTestId('order-row');
    await expect(row).toContainText('In progress');
    await page.getByText('View Details').first().click();
    await expect(row).toContainText('Delivered', { timeout: 2_000 });
    // a list answer that still says in progress never turns it back
    await page.waitForTimeout(11_000);
    await expect(row).toContainText('Delivered');
  });
});
