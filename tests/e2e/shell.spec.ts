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
/** The Header's wallet button: phones show only its icon, so it goes by its aria-label. */
const walletButton = (page: Page, name: string) => page.getByRole('button', { ...HIDDEN_TOO, name, exact: true }).filter({ visible: true });

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
    await walletButton(page, 'Connected Wallets').click();
    await expect(page.getByText('Your wallets', { exact: true })).toBeVisible();
    await expect(page.getByTestId('wallet-menu').getByRole('button', { ...HIDDEN_TOO, name: 'Disconnect', exact: true })).toHaveCount(2);
  });
});

// Plug's page script answers ICRC-94 discovery in the same tick with its fixed uuid (lib/wallets/plug.ts). This stand in
// does the same, records what IdentityKit sends it, and says no the way Plug does (ICRC-25 code 3000, "User rejected").
const FAKE_PLUG = () => {
  const sent: string[] = [];
  (window as unknown as { __plugSent: string[] }).__plugSent = sent;
  const detail = Object.freeze({
    uuid: '71edc834-bab2-4d59-8860-c36a01fee7b8', name: 'Plug Wallet', rdns: 'ooo.plugwallet', icon: 'data:image/png;base64,',
    sendMessage: async (m: { id: string; method: string }) => {
      sent.push(m.method);
      return { jsonrpc: '2.0', id: m.id, error: { code: 3000, message: 'User rejected' } };
    },
    dismiss: async () => {},
  });
  window.addEventListener('icrc94:requestProvider', () => window.dispatchEvent(new CustomEvent('icrc94:announceProvider', { detail })));
};

test.describe('the wallet chooser', () => {
  test.beforeEach(async ({ page }) => open(page, 'no-wallet'));

  test('Connect Wallet opens on two choices, ICP opens its own step with Plug, Back returns', async ({ page }) => {
    await page.goto('/');
    await walletButton(page, 'Connect Wallet').click();
    await expect(page.getByText('Connect a wallet', { exact: true })).toBeVisible();
    // scoped to our menu: IdentityKit's hidden signer list names OISY too
    const menu = page.getByTestId('wallet-menu');
    await expect(menu.getByText('EVM wallet', { exact: true })).toBeVisible();
    await expect(menu.getByText('ICP wallet', { exact: true })).toBeVisible();
    for (const name of ['OISY', 'NFID', 'Internet Identity', 'Plug']) await expect(menu.getByText(name, { exact: true })).toHaveCount(0);
    // the e2e build shows Solana, so the third section is there too
    await expect(menu.getByText('Solana wallet', { exact: true })).toBeVisible();
    await expect(menu.getByText('You can connect one wallet of each kind at the same time.')).toBeVisible();

    await menu.getByText('ICP wallet', { exact: true }).click();
    await expect(page.getByText('Choose an ICP wallet', { exact: true })).toBeVisible();
    for (const name of ['OISY', 'NFID', 'Internet Identity', 'Plug']) await expect(menu.getByText(name, { exact: true })).toBeVisible();
    await expect(menu.getByText('EVM wallet', { exact: true })).toHaveCount(0);
    // no Plug extension in this browser: its row opens Plug's site
    await expect(menu.getByRole('link', { ...HIDDEN_TOO, name: /Plug/ })).toHaveAttribute('href', 'https://plugwallet.ooo/');

    await page.getByRole('button', { ...HIDDEN_TOO, name: 'Back', exact: true }).click();
    await expect(menu.getByText('EVM wallet', { exact: true })).toBeVisible();
    await expect(menu.getByText('ICP wallet', { exact: true })).toBeVisible();
  });

  test('EVM wallet opens the EVM wallet list with its wallet view drawn (it was an empty window)', async ({ page }) => {
    await page.goto('/');
    await walletButton(page, 'Connect Wallet').click();
    await page.getByTestId('wallet-menu').getByText('EVM wallet', { exact: true }).click();
    // AppKit's list lives in shadow roots: its Connect view must be defined and take up room
    const connectViewHeight = () => page.evaluate(() => {
      let h = 0;
      const walk = (root: Document | ShadowRoot) => {
        for (const el of root.querySelectorAll('*')) {
          if (el.tagName.toLowerCase() === 'w3m-connect-view') h = el.getBoundingClientRect().height;
          if (el.shadowRoot) walk(el.shadowRoot);
        }
      };
      walk(document);
      return customElements.get('w3m-connect-view') ? h : -1;
    });
    await expect.poll(connectViewHeight, { timeout: 15_000 }).toBeGreaterThan(0);
  });

  test('without Plug, OISY still opens its own window (IdentityKit is not left waiting)', async ({ page }) => {
    await page.goto('/');
    await walletButton(page, 'Connect Wallet').click();
    const menu = page.getByTestId('wallet-menu');
    await menu.getByText('ICP wallet', { exact: true }).click();
    const popup = page.waitForEvent('popup');
    await menu.getByText('OISY', { exact: true }).click();
    expect((await popup).url()).toContain('oisy.com');
    await expect(menu.getByText('Check your wallet', { exact: true })).toBeVisible();
  });

  test('with Plug installed, Plug asks the extension, and its no ends "Check your wallet"', async ({ page }) => {
    await page.addInitScript(FAKE_PLUG);
    await page.goto('/');
    await walletButton(page, 'Connect Wallet').click();
    const menu = page.getByTestId('wallet-menu');
    await menu.getByText('ICP wallet', { exact: true }).click();
    await expect(menu.getByText('Not found in this browser. Get it at plugwallet.ooo')).toHaveCount(0);
    await menu.getByText('Plug', { exact: true }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __plugSent: string[] }).__plugSent)).not.toEqual([]);
    await expect(menu.getByText('ICP wallet', { exact: true })).toBeVisible();
    await expect(menu.getByText('Check your wallet', { exact: true })).toHaveCount(0);
  });
});
