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

/** The token page's chain menu (beside the search box): open it, pick the chain by its number. */
async function pickChain(page: Page, id: string) {
  await page.locator('button[aria-label^="Chain:"]').filter({ visible: true }).click();
  await page.locator(`[data-chain-id="${id}"]`).click();
}

/** The amount field, a text input: a number box writes the phone's own decimal mark. */
const amountField = (page: Page) => page.locator('input[inputmode=decimal]');

async function pickTokens(page: Page) {
  await page.getByText('From', { exact: true }).click();
  await pickChain(page, '42161');
  await page.getByText('USDC', { exact: true }).first().click();
  await page.getByText('To', { exact: true }).click();
  await pickChain(page, '137');
  await page.getByText('WBTC', { exact: true }).first().click();
  await amountField(page).fill('5');
}

test.describe('Swap', () => {
  test('pick tokens, type an amount, see Gasless and one Fastest and Best price card, Review swap ready', async ({ page }, info) => {
    await open(page, 'default');
    await expect(button(page, 'Select tokens to swap')).toBeDisabled();
    await pickTokens(page);
    await expect(page.getByText('Gasless', { exact: true })).toBeVisible();
    await expect(page.getByText('0 gas fees')).toBeVisible();
    // phones and tablets show only the top route; the other card stays in the page, hidden by CSS
    for (const tag of ['Fastest', 'Best price']) {
      const shown = page.getByText(tag, { exact: true });
      if (info.project.name === 'phone') await expect(shown).toBeHidden();
      else await expect(shown).toBeVisible();
    }
    await expect(page.getByText('via Swapic')).toHaveCount(2);
    await expect(page.getByText('You pay gas')).toHaveCount(1);
    // only the You pay gas card has a fee row in the Swap list
    await expect(page.getByTestId('swap-routes').getByText('Fee', { exact: true })).toHaveCount(1);
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
    // Receive at, on the To card: the menu's Paste an address opens the field
    await page.getByRole('button', { name: 'Receive at: Your wallet', includeHidden: true }).click();
    await page.getByRole('button', { name: 'Paste an address', includeHidden: true }).click();
    await page.getByPlaceholder(/Enter EVM address/).fill('0x3A9c2E07b5F81dC4');
    await expect(button(page, 'Enter a valid address')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Receive at: New address', includeHidden: true })).toBeVisible();
  });

  test('Receive at: a pasted address shows short on the To card, and Your wallet takes the swap back to the wallet', async ({ page }) => {
    await open(page, 'default');
    await pickTokens(page);
    await page.getByRole('button', { name: 'Receive at: Your wallet', includeHidden: true }).click();
    await page.getByRole('button', { name: 'Paste an address', includeHidden: true }).click();
    await page.getByPlaceholder(/Enter EVM address/).fill('0x3a9c2e07b5f81dc4be00aa6f6b9d2e45ca1189ac');
    await page.getByRole('button', { name: 'Receive at: 0x3a9c…89ac', includeHidden: true }).click();
    await page.getByRole('button', { name: /^Your wallet/, includeHidden: true }).click();
    await expect(page.getByRole('button', { name: 'Receive at: Your wallet', includeHidden: true })).toBeVisible();
    await expect(button(page, 'Review swap')).toBeEnabled();
  });

  test('Receive at shows with both tokens, as the address field it opens (only a To token: none)', async ({ page }) => {
    await open(page, 'default');
    await page.getByText('To', { exact: true }).click();
    await pickChain(page, '137');
    await page.getByText('WBTC', { exact: true }).first().click();
    await expect(page.getByRole('button', { name: /^Receive at/, includeHidden: true })).toHaveCount(0);
    await page.getByText('From', { exact: true }).click();
    await pickChain(page, '42161');
    await page.getByText('USDC', { exact: true }).first().click();
    await page.getByRole('button', { name: 'Receive at: Your wallet', includeHidden: true }).click();
    await page.getByRole('button', { name: 'Paste an address', includeHidden: true }).click();
    await expect(page.getByPlaceholder(/Enter EVM address/)).toBeVisible();
  });

  test('a smart wallet crossing EVM chains is offered Paste an address alone, never a connect for the wallet it has', async ({ page }) => {
    await open(page, 'smart-wallet');
    await pickTokens(page);
    await page.getByRole('button', { name: 'Receive at: New address', includeHidden: true }).click();
    await expect(page.getByRole('button', { name: 'Paste an address', includeHidden: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Connect a wallet', includeHidden: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Your wallet/, includeHidden: true })).toHaveCount(0);
    await expect(page.getByText('You are using a smart wallet. Type the address that should receive on Polygon, and make sure it is yours there.')).toBeVisible();
  });

  test('a smart wallet types the address that receives on another chain (plan 2 Smart wallets)', async ({ page }) => {
    await open(page, 'smart-wallet');
    await pickTokens(page);
    await expect(page.getByText('You are using a smart wallet. Type the address that should receive on Polygon, and make sure it is yours there.')).toBeVisible();
    await expect(button(page, 'Enter a valid address')).toBeDisabled();
    await page.getByPlaceholder(/Enter EVM address/).fill('0xf00EBA8E5Fd231b526ADFAAa68B4d0ede72A89AC');
    await expect(button(page, 'Review swap')).toBeEnabled();
  });

  test('no wallet: indicative routes, and the button asks to connect', async ({ page }) => {
    await open(page, 'no-wallet');
    await pickTokens(page);
    await expect(button(page, 'Connect wallet')).toBeEnabled();
  });

  test('no ICP wallet: Connect wallet opens our own menu on the ICP wallets', async ({ page }) => {
    await open(page, 'no-wallet');
    await page.getByText('From', { exact: true }).click();
    await pickChain(page, '0');
    await page.getByText('ckUSDC', { exact: true }).first().click();
    await page.getByText('To', { exact: true }).click();
    await pickChain(page, '8453');
    await page.getByText('USDC', { exact: true }).first().click();
    await amountField(page).fill('5');
    // exact: the header's pill reads Connect Wallet
    await page.getByRole('button', { name: 'Connect wallet', exact: true, includeHidden: true }).filter({ visible: true }).click();
    await expect(page.getByText('Choose an ICP wallet', { exact: true })).toBeVisible();
    const menu = page.getByTestId('wallet-menu');
    for (const name of ['OISY', 'NFID', 'Internet Identity', 'Plug']) await expect(menu.getByText(name, { exact: true })).toBeVisible();
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
  });

  test('swaps from ICP paused while the pool refills (contract 5.15)', async ({ page }) => {
    await open(page, 'icp-paused');
    await page.getByText('From', { exact: true }).click();
    await pickChain(page, '0');
    await page.getByText('ckUSDC', { exact: true }).first().click();
    await page.getByText('To', { exact: true }).click();
    await pickChain(page, '8453');
    await page.getByText('USDC', { exact: true }).first().click();
    await amountField(page).fill('5');
    await expect(page.getByText('Swaps from ICP are paused for a few minutes while the pool refills. Try again soon.')).toBeVisible();
    await expect(button(page, 'Paused for now')).toBeDisabled();
  });

  test('over the canister\'s per swap cap: the line says the limit and the button how much fits', async ({ page }) => {
    await open(page, 'swap-cap');
    await pickTokens(page);
    // the quote answers after the 600 ms pause in typing
    await expect(page.getByText('Swaps are limited to $100 for now. Try a smaller amount.')).toBeVisible({ timeout: 15_000 });
    await expect(button(page, 'Up to $100 right now')).toBeDisabled();
    await expect(button(page, 'No route found')).toHaveCount(0);
    // the route column says the cap too, never "No routes found"
    await expect(page.getByText('Swaps are limited to $100 for now', { exact: true })).toBeVisible();
    await expect(page.getByText('No routes found')).toHaveCount(0);
    // the message sits under the dollar line, never on it (Jeff's screenshot, 2026-10-31)
    const line = await page.getByText('Swaps are limited to $100 for now. Try a smaller amount.').boundingBox();
    // the dollar line's row also holds the wallet balance (250 USDC in the fake wallet)
    const row = await page.getByText('250', { exact: true }).filter({ visible: true }).first().boundingBox();
    expect(line!.y).toBeGreaterThanOrEqual(row!.y + row!.height);
  });

  test('the route cards start open on phones (both), the picked one on desktop; the chevron closes them', async ({ page }, info) => {
    await open(page, 'default');
    await pickTokens(page);
    await expect(page.getByText('Gasless', { exact: true })).toBeVisible();
    // each card's details block (the one around its "You get at least" row)
    const details = page.getByTestId('swap-routes').getByText('You get at least', { exact: true }).locator('xpath=../../..');
    await expect(details).toHaveCount(2);
    if (info.project.name === 'phone') {
      await expect(details.nth(0)).toHaveCSS('opacity', '1');
      await expect(details.nth(1)).toHaveCSS('opacity', '1');
    } else {
      await expect(details.nth(0)).toHaveCSS('opacity', '1');
      await expect(details.nth(1)).toHaveCSS('opacity', '0');
    }
    // the chevron of the first card closes it
    await page.getByRole('button', { name: 'Hide details', includeHidden: true }).filter({ visible: true }).first().click();
    await expect(details.nth(0)).toHaveCSS('opacity', '0');
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
    await expect(amountField(page)).toHaveValue('5');
    await expect(page.getByPlaceholder(/Enter EVM address/)).toHaveValue('');
    await expect(button(page, 'Review swap')).toBeEnabled();
  });
  test('a token from a link that is not on the list shows its warning first', async ({ page }) => {
    await openAt(page, 'pasted', '/?from=eip155:8453|0x3f1b9c4e7d2a6058ac91e0b7d45f28c63a9e1d07');
    await expect(page.getByText('Unverified', { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('Search tokens on Base')).toHaveValue('0x3f1b9c4e7d2a6058ac91e0b7d45f28c63a9e1d07');
  });
});

test.describe('Swap, signing (the panel changes in place)', () => {
  // the panel titles (BoxHeader draws them as a paragraph; the Swap panel's button also reads Review swap)
  const title = (page: Page, text: string) => page.locator('p').filter({ hasText: new RegExp(`^${text}$`) });
  const reviewTitle = (page: Page) => title(page, 'Review swap');
  test('review, sign, delivered', async ({ page }) => {
    await open(page, 'default');
    await pickTokens(page);
    await button(page, 'Review swap').click();
    // the left side and the route card both say it; Review swap shows the fee on every route, gasless too
    await expect(page.getByText('You get at least').first()).toBeVisible();
    await expect(page.getByTestId('col-right').getByText('Fee', { exact: true })).toBeVisible();
    await button(page, 'Sign and swap').click();
    await expect(page.getByTestId('status-ring')).toHaveAttribute('data-phase', 'delivered', { timeout: 15_000 });
    await expect(page.getByText('Delivered', { exact: true }).first()).toBeVisible();
  });
  test('a "no" in the wallet keeps the review as it was', async ({ page }) => {
    await open(page, 'default');
    await page.evaluate(() => { window.__SWAPIC_E2E__!.rejectNext = true; });
    await pickTokens(page);
    await button(page, 'Review swap').click();
    await button(page, 'Sign and swap').click();
    await expect(page.getByText('You cancelled in your wallet.').filter({ visible: true })).toBeVisible();
    await expect(button(page, 'Sign and swap')).toBeEnabled();
    await expect(reviewTitle(page)).toHaveCount(1);
  });
  test('the recorded watcher refusal shows a plain sentence', async ({ page }) => {
    await open(page, 'submit-reverts');
    await pickTokens(page);
    await button(page, 'Review swap').click();
    await button(page, 'Sign and swap').click();
    await expect(page.getByText('This swap would fail right now. Get a new quote and try again.')).toBeVisible();
  });
  test('refunded: the calm end says where the USDC went', async ({ page }) => {
    await open(page, 'refunded');
    await pickTokens(page);
    await button(page, 'Review swap').click();
    await button(page, 'Sign and swap').click();
    await expect(page.getByTestId('status-ring')).toHaveAttribute('data-phase', 'refunded', { timeout: 15_000 });
    await expect(page.getByText('Refunded 119.80 USDC to 0xf00e…89ac on Polygon').first()).toBeVisible();
  });
  test('Your swap: the ring shows the chain the swap leaves from, inside the circle', async ({ page }) => {
    await open(page, 'progress');
    await pickTokens(page);
    await button(page, 'Review swap').click();
    await button(page, 'Sign and swap').click();
    const ring = page.getByTestId('status-ring');
    await expect(ring).toHaveAttribute('data-phase', 'progress', { timeout: 15_000 });
    const logo = ring.locator('img');
    await expect(logo).toHaveAttribute('src', '/images/logo/chains-logos/arbitrum.svg');
    await expect(logo).toHaveCSS('opacity', '1');
    const r = (await ring.boundingBox())!;
    const l = (await logo.boundingBox())!;
    // centred, and within the circle the stroke leaves (90 px, a 3 px stroke)
    expect(Math.abs(l.x + l.width / 2 - (r.x + r.width / 2))).toBeLessThanOrEqual(1);
    expect(Math.abs(l.y + l.height / 2 - (r.y + r.height / 2))).toBeLessThanOrEqual(1);
    expect(l.width).toBeLessThanOrEqual(r.width - 6);
    expect(l.height).toBeLessThanOrEqual(r.height - 6);
  });
  test('an order never seen starting by its deadline: Swap didn\'t start, nothing taken, Try again', async ({ page }) => {
    // the recorded quote's own time; its order ends 133 s later
    await page.clock.install({ time: new Date(1792336073 * 1000) });
    await open(page, 'not-started');
    await pickTokens(page);
    await button(page, 'Review swap').click();
    await button(page, 'Sign and swap').click();
    const ring = page.getByTestId('status-ring');
    await expect(ring).toHaveAttribute('data-phase', 'progress', { timeout: 15_000 });
    // past the deadline and the two minutes the tracking gets to see a start
    await page.clock.fastForward('05:00');
    await expect(ring).toHaveAttribute('data-phase', 'stopped', { timeout: 15_000 });
    await expect(page.getByText("Swap didn't start", { exact: true })).toBeVisible();
    await expect(page.getByText("Swapic couldn't send the swap to the network in time. Nothing left the wallet and no fee was charged.")).toBeVisible();
    await expect(button(page, 'Try again')).toBeVisible();
  });
  test('reduce motion: exactly one view after each change', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, 'default');
    await pickTokens(page);
    const swapTitle = page.getByRole('heading', { name: 'Swap', exact: true, includeHidden: true });
    const statusTitle = title(page, 'Your swap');
    await button(page, 'Review swap').click();
    await expect(reviewTitle(page)).toHaveCount(1);
    await expect(swapTitle).toHaveCount(0);
    await button(page, 'Back').click();
    await expect(swapTitle).toHaveCount(1);
    await expect(reviewTitle(page)).toHaveCount(0);
    await button(page, 'Review swap').click();
    await button(page, 'Sign and swap').click();
    await expect(statusTitle).toHaveCount(1, { timeout: 15_000 });
    await expect(reviewTitle(page)).toHaveCount(0);
    await button(page, 'Make another swap').click();
    await expect(swapTitle).toHaveCount(1);
    await expect(statusTitle).toHaveCount(0);
  });
});

test.describe('Swap, a gasless card that must approve Permit2 first', () => {
  test('Approve once, then sign, and its step on Review swap', async ({ page }) => {
    await open(page, 'needs-approval');
    await pickTokens(page);
    await expect(page.getByText('Approve once, then sign').filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText('0 gas fees')).toHaveCount(0);
    await button(page, 'Review swap').click();
    await expect(page.getByText('Approve USDC (once, you pay gas)')).toBeVisible();
    await expect(page.getByText('Only the first time')).toBeVisible();
  });
  test('no coin: blocked, the button asks for the coin', async ({ page }) => {
    await open(page, 'needs-approval-no-coin');
    await pickTokens(page);
    await expect(page.getByText('You need a little ETH to approve USDC once').filter({ visible: true }).first()).toBeVisible();
    await expect(button(page, 'Add ETH to continue')).toBeDisabled();
  });
});

test.describe('Swap, approve then confirm (you pay gas)', () => {
  test.skip(({ isMobile }) => isMobile, 'phones show only the top route, the gasless one here, so the you pay gas card cannot be picked');
  // the derived get_config's Swapic on Arbitrum and its USDC (tests/fixtures/derived/swapic-config.json), the amount typed
  const SWAPIC = '0xf0ba68cbc87c31ecaa9654eb14daf3632eaca406';
  const USDC = '0xaf88d065e77c8cc2239327c5edb3a432268e5831';
  const word = (data: string, k: number) => data.slice(10 + 64 * k, 10 + 64 * (k + 1));
  const steps = (page: Page) => page.locator('[data-step-state]').filter({ visible: true });
  async function toReview(page: Page) {
    await pickTokens(page);
    await page.getByText('Fastest', { exact: true }).filter({ visible: true }).first().click();
    await button(page, 'Review swap').click();
    await expect(page.getByText('Approve USDC (you pay gas)')).toBeVisible();
    await expect(page.getByText('Confirm swap (you pay gas)')).toBeVisible();
  }
  test('a "no" on the approval keeps the review and sends nothing', async ({ page }) => {
    await open(page, 'approve');
    await page.evaluate(() => { window.__SWAPIC_E2E__!.rejectNext = true; });
    await toReview(page);
    await button(page, 'Approve and swap').click();
    await expect(page.getByText('You cancelled in your wallet.').filter({ visible: true })).toBeVisible();
    await expect(button(page, 'Approve and swap')).toBeEnabled();
    await expect(steps(page).nth(0)).toHaveAttribute('data-step-state', 'todo');
    expect(await page.evaluate(() => window.__SWAPIC_E2E__!.sent ?? [])).toEqual([]);
  });
  test('the approval then the swap, each step lighting up in turn, to Delivered; the approval is exactly what the review shows', async ({ page }) => {
    await open(page, 'approve');
    await page.evaluate(() => { window.__SWAPIC_E2E__!.delayMs = 1200; });
    await toReview(page);
    await expect(page.getByText('5.00 USDC', { exact: true }).first()).toBeVisible();
    await button(page, 'Approve and swap').click();
    await expect(steps(page).nth(0)).toHaveAttribute('data-step-state', 'wait');
    await expect(steps(page).nth(1)).toHaveAttribute('data-step-state', 'todo');
    await expect(steps(page).nth(0)).toHaveAttribute('data-step-state', 'done');
    await expect(steps(page).nth(1)).toHaveAttribute('data-step-state', 'wait');
    await expect(page.getByTestId('status-ring')).toHaveAttribute('data-phase', 'delivered', { timeout: 15_000 });
    const sent = await page.evaluate(() => window.__SWAPIC_E2E__!.sent ?? []);
    expect(sent).toHaveLength(2);
    // the approval: approve(spender, amount) on USDC, spender the Swapic of get_config, amount the 5.00 USDC on screen
    expect(sent[0]!.to.toLowerCase()).toBe(USDC);
    expect(sent[0]!.data.slice(0, 10)).toBe('0x095ea7b3');
    expect(`0x${word(sent[0]!.data, 0).slice(24)}`).toBe(SWAPIC);
    expect(BigInt(`0x${word(sent[0]!.data, 1)}`)).toBe(5_000_000n);
    // the swap itself goes to that same Swapic
    expect(sent[1]!.to.toLowerCase()).toBe(SWAPIC);
  });
  test('an approval to anyone else is never offered (the guard)', async ({ page }) => {
    await open(page, 'approve-attacker');
    await pickTokens(page);
    // the Swap list is priced only: the guard reads the route once Review swap has it built, and refuses it there
    await page.getByText('Fastest', { exact: true }).filter({ visible: true }).first().click();
    await button(page, 'Review swap').click();
    await expect(page.getByText('This option is not available right now. Go back to pick another.')).toBeVisible();
    await expect(button(page, 'Approve and swap')).toBeDisabled();
    expect(await page.evaluate(() => window.__SWAPIC_E2E__!.sent ?? [])).toEqual([]);
  });
});

test.describe('Swap, you pay gas through Permit2', () => {
  const SWAPIC = '0xf0ba68cbc87c31ecaa9654eb14daf3632eaca406';
  const USDC = '0xaf88d065e77c8cc2239327c5edb3a432268e5831';
  const PERMIT2 = '0x000000000022d473030f116ddee9f6b43ac78ba3';
  const RUN_WITH_PERMIT2 = '0x21be144a';
  const MAX = (1n << 256n) - 1n;
  const word = (data: string, k: number) => data.slice(10 + 64 * k, 10 + 64 * (k + 1));
  const approved = (tx: { data: string }) => ({ selector: tx.data.slice(0, 10), spender: `0x${word(tx.data, 0).slice(24)}`, amount: BigInt(`0x${word(tx.data, 1)}`) });
  const steps = (page: Page) => page.locator('[data-step-state]').filter({ visible: true });
  const sent = (page: Page) => page.evaluate(() => window.__SWAPIC_E2E__!.sent ?? []);
  const signed = (page: Page) => page.evaluate(() => window.__SWAPIC_E2E__!.signed ?? []) as Promise<{ primaryType: string; message: { spender: string; permitted: { token: string; amount: string } } }[]>;
  async function toReview(page: Page) {
    await pickTokens(page);
    await button(page, 'Review swap').click();
  }
  /** The steps today's path shows: the exact approve, on every swap, and run(order). */
  async function expectTodaysPath(page: Page) {
    await expect(page.getByText('Approve USDC (you pay gas)')).toBeVisible();
    await expect(page.getByText('Lets Swapic use 5 USDC for this swap')).toBeVisible();
    await expect(page.getByText('Confirm swap (you pay gas)')).toBeVisible();
    await expect(page.getByText('Sign in your wallet (no gas)')).toHaveCount(0);
    await expect(page.getByText('Only the first time')).toHaveCount(0);
    await expect(button(page, 'Approve and swap')).toBeEnabled();
  }
  async function expectTodaysSends(page: Page) {
    const txs = await sent(page);
    expect(txs).toHaveLength(2);
    expect(txs[0]!.to.toLowerCase()).toBe(USDC);
    expect(approved(txs[0]!)).toEqual({ selector: '0x095ea7b3', spender: SWAPIC, amount: 5_000_000n });
    expect(txs[1]!.to.toLowerCase()).toBe(SWAPIC);
    expect(txs[1]!.data.slice(0, 10)).not.toBe(RUN_WITH_PERMIT2);
    expect(await signed(page)).toEqual([]);
  }

  test('first time: approve once, sign, confirm, each lighting up in turn, to Delivered', async ({ page }) => {
    await open(page, 'permit2-pay-first');
    await page.evaluate(() => { window.__SWAPIC_E2E__!.delayMs = 1200; });
    await toReview(page);
    await expect(page.getByText('Approve USDC (once, you pay gas)')).toBeVisible();
    await expect(page.getByText('Lets Swapic use your USDC. Only the first time.')).toBeVisible();
    await expect(page.getByText('Sign in your wallet (no gas)')).toBeVisible();
    await expect(page.getByText('Lets Swapic use 5 USDC for this swap')).toBeVisible();
    await expect(page.getByText('Confirm swap (you pay gas)')).toBeVisible();
    await expect(page.getByText('3 steps')).toBeVisible();
    await button(page, 'Approve and swap').click();
    await expect(steps(page).nth(0)).toHaveAttribute('data-step-state', 'wait');
    await expect(steps(page).nth(1)).toHaveAttribute('data-step-state', 'todo');
    await expect(steps(page).nth(0)).toHaveAttribute('data-step-state', 'done');
    await expect(steps(page).nth(1)).toHaveAttribute('data-step-state', 'wait');
    await expect(steps(page).nth(1)).toHaveAttribute('data-step-state', 'done');
    await expect(steps(page).nth(2)).toHaveAttribute('data-step-state', 'wait');
    await expect(page.getByTestId('status-ring')).toHaveAttribute('data-phase', 'delivered', { timeout: 15_000 });
    const txs = await sent(page);
    expect(txs).toHaveLength(2);
    // one approval: the maximum to Permit2, never Swapic's exact one on the same route
    expect(txs[0]!.to.toLowerCase()).toBe(USDC);
    expect(approved(txs[0]!)).toEqual({ selector: '0x095ea7b3', spender: PERMIT2, amount: MAX });
    expect(txs[1]!.to.toLowerCase()).toBe(SWAPIC);
    expect(txs[1]!.data.slice(0, 10)).toBe(RUN_WITH_PERMIT2);
    expect(txs[1]!.value).toBe('0');
    const typed = await signed(page);
    expect(typed).toHaveLength(1);
    expect(typed[0]!.primaryType).toBe('PermitWitnessTransferFrom');
    expect(typed[0]!.message.spender.toLowerCase()).toBe(SWAPIC);
    expect(typed[0]!.message.permitted).toMatchObject({ amount: '5000000' });
  });
  test('later swaps: sign, confirm, with no approve anywhere', async ({ page }) => {
    await open(page, 'permit2-pay-later');
    await toReview(page);
    await expect(page.getByText('Sign in your wallet (no gas)')).toBeVisible();
    await expect(page.getByText('2 steps')).toBeVisible();
    await expect(page.getByText(/^Approve USDC/)).toHaveCount(0);
    await button(page, 'Sign and swap').click();
    await expect(page.getByTestId('status-ring')).toHaveAttribute('data-phase', 'delivered', { timeout: 15_000 });
    const txs = await sent(page);
    expect(txs).toHaveLength(1);
    expect(txs[0]!.to.toLowerCase()).toBe(SWAPIC);
    expect(txs[0]!.data.slice(0, 10)).toBe(RUN_WITH_PERMIT2);
  });
  test('a token cleared first says the wallet asks twice, and sends 0 then the maximum', async ({ page }) => {
    await open(page, 'permit2-pay-reset');
    await toReview(page);
    const twice = page.getByText('Your wallet asks twice: first it sets your USDC approval to 0.');
    await expect(twice).toBeVisible();
    // readable in full, never cut off at the end of the line
    expect(await twice.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
    await button(page, 'Approve and swap').click();
    await expect(page.getByTestId('status-ring')).toHaveAttribute('data-phase', 'delivered', { timeout: 15_000 });
    const txs = await sent(page);
    expect(txs.slice(0, 2).map((t) => approved(t).amount)).toEqual([0n, MAX]);
    expect(txs.slice(0, 2).map((t) => approved(t).spender)).toEqual([PERMIT2, PERMIT2]);
    expect(txs).toHaveLength(3);
  });
  test('a "no" to the signature keeps the review and sends nothing', async ({ page }) => {
    await open(page, 'permit2-pay-later');
    await page.evaluate(() => { window.__SWAPIC_E2E__!.rejectNext = true; });
    await toReview(page);
    await button(page, 'Sign and swap').click();
    await expect(page.getByText('You cancelled in your wallet.').filter({ visible: true })).toBeVisible();
    await expect(button(page, 'Sign and swap')).toBeEnabled();
    await expect(steps(page).nth(0)).toHaveAttribute('data-step-state', 'todo');
    expect(await sent(page)).toEqual([]);
  });
  test('a wallet with no way to sign comes back to Review swap with today\'s steps, and goes through them', async ({ page }) => {
    await open(page, 'permit2-pay-cannot-sign');
    await toReview(page);
    await button(page, 'Sign and swap').click();
    await expect(page.getByText("Your wallet can't sign this, so the steps changed. Check them and try again.")).toBeVisible();
    await expectTodaysPath(page);
    expect(await sent(page)).toEqual([]);
    await button(page, 'Approve and swap').click();
    await expect(page.getByTestId('status-ring')).toHaveAttribute('data-phase', 'delivered', { timeout: 15_000 });
    await expectTodaysSends(page);
  });
  test('an address with code keeps today\'s approve and run(order), never a signature (an EIP-7702 delegation here)', async ({ page }) => {
    await open(page, 'permit2-pay-code');
    await toReview(page);
    await expectTodaysPath(page);
    await button(page, 'Approve and swap').click();
    await expect(page.getByTestId('status-ring')).toHaveAttribute('data-phase', 'delivered', { timeout: 15_000 });
    await expectTodaysSends(page);
  });
  test('a flagged smart wallet keeps today\'s approve and run(order) too', async ({ page }) => {
    await open(page, 'permit2-pay-smart');
    await pickTokens(page);
    await page.getByPlaceholder(/Enter EVM address/).fill('0xf00EBA8E5Fd231b526ADFAAa68B4d0ede72A89AC');
    await button(page, 'Review swap').click();
    await expectTodaysPath(page);
    await button(page, 'Approve and swap').click();
    await expect(page.getByTestId('status-ring')).toHaveAttribute('data-phase', 'delivered', { timeout: 15_000 });
    await expectTodaysSends(page);
  });
  test('until the named quote comes the wallet list claims no step, and nothing can be signed', async ({ page }) => {
    await open(page, 'permit2-pay-slow');
    await toReview(page);
    await expect(page.getByTestId('wallet-steps-waiting').filter({ visible: true })).toBeVisible();
    await expect(page.locator('[data-step-state]')).toHaveCount(0);
    await expect(page.getByText(/steps?$/)).toHaveCount(0);
    await expect(button(page, 'Getting your swap ready')).toBeDisabled();
    await expect(button(page, 'Confirm swap')).toHaveCount(0);
    await expect(page.getByText('Approve USDC (once, you pay gas)')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('wallet-steps-waiting')).toHaveCount(0);
    await expect(button(page, 'Approve and swap')).toBeEnabled();
  });
  const CHECK = "Couldn't check your wallet, try again.";
  const CANNOT = "Your wallet can't sign this, so the steps changed. Check them and try again.";
  const delivered = (page: Page) => expect(page.getByTestId('status-ring')).toHaveAttribute('data-phase', 'delivered', { timeout: 15_000 });
  test('a code read that fails shows today\'s steps for now, is never remembered, and is read again at the next refresh', async ({ page }) => {
    await open(page, 'permit2-pay-unread');
    await toReview(page);
    await expectTodaysPath(page);
    await page.evaluate(() => { window.__SWAPIC_E2E__!.evmCodeUnread = false; });
    await expect(page.getByText('Sign in your wallet (no gas)')).toBeVisible({ timeout: 30_000 });
    await expect(button(page, 'Sign and swap')).toBeEnabled();
  });
  test('a code read that fails at the click: try again, nothing sent, the same steps, and the same click goes through', async ({ page }) => {
    await open(page, 'permit2-pay-later');
    await toReview(page);
    await expect(button(page, 'Sign and swap')).toBeEnabled();
    await page.evaluate(() => { window.__SWAPIC_E2E__!.evmCodeUnread = true; });
    await button(page, 'Sign and swap').click();
    await expect(page.getByText(CHECK)).toBeVisible();
    await expect(page.getByText(CANNOT)).toHaveCount(0);
    expect(await sent(page)).toEqual([]);
    expect(await signed(page)).toEqual([]);
    await expect(steps(page).nth(0)).toHaveAttribute('data-step-state', 'todo');
    await expect(page.getByText('Sign in your wallet (no gas)')).toBeVisible();
    await page.evaluate(() => { window.__SWAPIC_E2E__!.evmCodeUnread = false; });
    await button(page, 'Sign and swap').click();
    await delivered(page);
    expect(await signed(page)).toHaveLength(1);
  });
  test('a code read too slow never holds the quote: today\'s steps after about 3 s, and the quote\'s timer started when it came', async ({ page }) => {
    await page.clock.install({ time: new Date(1792336073 * 1000) });
    await open(page, 'permit2-pay-slow-read');
    await toReview(page);
    await expectTodaysPath(page);
    const left = Number((await page.getByTestId('quote-timer').filter({ visible: true }).innerText()).match(/(\d+)\s*s/)![1]);
    expect(left).toBeLessThanOrEqual(18);
  });
  test('code at the address by the click: back to today\'s steps before the approve, no gas spent', async ({ page }) => {
    await open(page, 'permit2-pay-first');
    await toReview(page);
    await expect(page.getByText('Approve USDC (once, you pay gas)')).toBeVisible();
    await page.evaluate(() => { window.__SWAPIC_E2E__!.evmCode = true; });
    await button(page, 'Approve and swap').click();
    await expect(page.getByText(CANNOT)).toBeVisible();
    await expectTodaysPath(page);
    expect(await sent(page)).toEqual([]);
  });
  test('a session that names no typed data method has today\'s steps from the start, never a signature', async ({ page }) => {
    await open(page, 'permit2-pay-no-method');
    await toReview(page);
    await expectTodaysPath(page);
    await button(page, 'Approve and swap').click();
    await delivered(page);
    await expectTodaysSends(page);
  });
  test('after a cancel, a refresh with one step less starts the list over: an unsigned Sign row never shows done', async ({ page }) => {
    await open(page, 'permit2-pay-approved-later');
    await page.evaluate(() => { window.__SWAPIC_E2E__!.rejectSign = true; });
    await toReview(page);
    await button(page, 'Approve and swap').click();
    await expect(page.getByText('You cancelled in your wallet.').filter({ visible: true })).toBeVisible();
    await expect(steps(page).nth(0)).toHaveAttribute('data-step-state', 'done');
    await expect(steps(page).nth(1)).toHaveAttribute('data-step-state', 'todo');
    await expect(page.getByText('2 steps')).toBeVisible({ timeout: 30_000 });
    await expect(steps(page)).toHaveCount(2);
    await expect(steps(page).nth(0)).toHaveAttribute('data-step-state', 'todo');
    await expect(steps(page).nth(1)).toHaveAttribute('data-step-state', 'todo');
  });
  test('the maximum the quote names is already in place on chain: no approve, its row done, sign and send', async ({ page }) => {
    await open(page, 'permit2-pay-first');
    await toReview(page);
    await expect(page.getByText('Approve USDC (once, you pay gas)')).toBeVisible();
    await page.evaluate((max) => { window.__SWAPIC_E2E__!.permit2Allowance = max; }, MAX.toString());
    await button(page, 'Approve and swap').click();
    await delivered(page);
    const txs = await sent(page);
    expect(txs).toHaveLength(1);
    expect(txs[0]!.data.slice(0, 10)).toBe(RUN_WITH_PERMIT2);
  });
  test('the allowance cannot be read: try again, nothing sent', async ({ page }) => {
    await open(page, 'permit2-pay-first');
    await toReview(page);
    await expect(button(page, 'Approve and swap')).toBeEnabled();
    await page.evaluate(() => { window.__SWAPIC_E2E__!.allowanceUnread = true; });
    await button(page, 'Approve and swap').click();
    await expect(page.getByText(CHECK)).toBeVisible();
    expect(await sent(page)).toEqual([]);
    await expect(button(page, 'Approve and swap')).toBeEnabled();
  });
  test('a newly asked approve says the steps changed, with no word of a new price', async ({ page }) => {
    await open(page, 'permit2-pay-steps-change');
    await toReview(page);
    await expect(page.getByText('2 steps')).toBeVisible();
    await button(page, 'Sign and swap').click();
    await expect(page.getByText('The steps for this swap changed. Check them and try again.')).toBeVisible();
    await expect(page.getByText('3 steps')).toBeVisible();
    await expect(page.getByText(/The price moved/)).toHaveCount(0);
    await expect(page.getByText(/^was /)).toHaveCount(0);
    await expect(button(page, 'Accept new price')).toHaveCount(0);
    await expect(button(page, 'Approve and swap')).toBeEnabled();
    expect(await sent(page)).toEqual([]);
    expect(await signed(page)).toEqual([]);
  });
  test('the allowance to Swapic already covers the swap: today\'s run(order) alone, one transaction, nothing to sign', async ({ page }) => {
    await open(page, 'permit2-pay-swapic-covered');
    await toReview(page);
    await expect(page.getByText('1 step', { exact: true })).toBeVisible();
    await expect(page.getByText('Confirm swap (you pay gas)')).toBeVisible();
    await expect(page.getByText(/^Approve USDC/)).toHaveCount(0);
    await expect(page.getByText('Sign in your wallet (no gas)')).toHaveCount(0);
    await button(page, 'Confirm swap').click();
    await delivered(page);
    const txs = await sent(page);
    expect(txs).toHaveLength(1);
    expect(txs[0]!.to.toLowerCase()).toBe(SWAPIC);
    expect(txs[0]!.data.slice(0, 10)).not.toBe(RUN_WITH_PERMIT2);
    expect(await signed(page)).toEqual([]);
  });
});
