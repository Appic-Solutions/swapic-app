import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// A swap out of Solana in the browser: the Rust-made message goes through the real guard and the fake wallet, to the door.
const g = JSON.parse(readFileSync('tests/fixtures/solana/guard.json', 'utf8'));
const SOLANA = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function bytes(text: string): number[] {
  let n = 0n;
  for (const c of text) n = n * 58n + BigInt(ALPHABET.indexOf(c));
  return Array.from({ length: 32 }, (_, i) => Number((n >> BigInt(8 * (31 - i))) & 255n));
}

/** The public Solana node the guard reads a lookup table from. */
async function fakeNode(page: Page) {
  await page.route('https://api.mainnet-beta.solana.com/**', async (route) => {
    const body = route.request().postDataJSON() as { params: [string] };
    const table = g.tables.find((t: { address: string }) => t.address === body.params[0]);
    const data = table ? Buffer.from([...new Array(56).fill(0), ...table.entries.flatMap(bytes)]).toString('base64') : null;
    await route.fulfill({
      status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, result: { value: data ? { owner: 'AddressLookupTab1e1111111111111111111111111', executable: false, data: [data, 'base64'] } : null } }),
    });
  });
}

async function open(page: Page, scenario: string) {
  const { installFakeBackend, setE2eWallets } = await import('../fake/backend.mjs');
  await installFakeBackend(page, scenario);
  await setE2eWallets(page, scenario);
  await fakeNode(page);
  await page.goto('/');
}
const pickChain = async (page: Page, id: string) => {
  await page.locator('button[aria-label^="Chain:"]').filter({ visible: true }).click();
  await page.locator(`[data-chain-id="${id}"]`).click();
};
async function pick(page: Page) {
  await page.getByText('From', { exact: true }).click();
  await pickChain(page, SOLANA);
  await page.getByText('USDC', { exact: true }).first().click();
  await page.getByText('To', { exact: true }).click();
  await pickChain(page, '8453');
  await page.getByText('USDC', { exact: true }).first().click();
  await page.locator('input[inputmode=decimal]').fill('1000');
}
const button = (page: Page, name: string) => page.getByRole('button', { name, includeHidden: true }).filter({ visible: true });

test.describe('Solana', () => {
  test('a gasless burn: checked, signed by the wallet, taken by the door', async ({ page }) => {
    await open(page, 'solana-out');
    await pick(page);
    await button(page, 'Review swap').click();
    const submit = page.waitForRequest((r) => r.url().endsWith('/v2/solana/submit') && r.method() === 'POST');
    await button(page, 'Sign and swap').click();
    const sent = (await submit).postDataJSON() as { orderId: string; tx: string };
    expect(sent.orderId).toBe(g.reference);
    const signed = await page.evaluate(() => window.__SWAPIC_E2E__!.solSigned ?? []);
    expect(signed).toHaveLength(1);
    expect(sent.tx).toBe(signed[0]);
  });

  test('a route that pays another address cannot be signed, and the wallet is never asked', async ({ page }) => {
    await open(page, 'solana-other-recipient');
    await pick(page);
    await button(page, 'Review swap').click();
    await expect(button(page, 'Sign and swap')).toBeDisabled({ timeout: 20_000 });
    expect(await page.evaluate(() => window.__SWAPIC_E2E__!.solSigned ?? [])).toEqual([]);
  });

  test('with no Solana wallet, Connect wallet comes first', async ({ page }) => {
    await open(page, 'solana-no-wallet');
    await pick(page);
    await expect(button(page, 'Connect wallet')).toBeVisible();
  });
});
