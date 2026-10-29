// Which fixture answers which path, per scenario. Real answers wherever one exists (plan rule 2).
const real = (p) => `tests/fixtures/real/${p}`;
const contract = (p) => `tests/fixtures/contract/${p}`;
const PAYER = '0xf00EBA8E5Fd231b526ADFAAa68B4d0ede72A89AC';
const ICP = '3yfhk-v3nwx-2xo3k-pjyl5-ugvqk-ywkpy-qaq7m-aocl5-iz5re-kxxtc-2qe';

const common = {
  '/v2/chains': contract('chains.json'),
  '/v2/tokens': (u) => ({ status: 200, file: contract(`tokens-${{ 'eip155:1': 1, 'eip155:137': 137, 'eip155:8453': 8453, 'eip155:42161': 42161 }[u.searchParams.get('chain')] ?? 0}.json`) }),
  // contract 5.1's example is Base; the Arbitrum answer is the same shape with Arbitrum's USDC (derived, manifest)
  '/v2/balances': (u) => ({ status: 200, file: u.searchParams.get('chain') === 'eip155:42161' ? 'tests/fixtures/derived/balances-42161.json' : contract('balances.json') }),
  '/v2/pool': contract('pool.json'),
  '/v2/pool/history': contract('pool-history-7d.json'),
  '/v2/pool/activity': contract('pool-activity.json'),
  '/v2/pool/accounts/*/history': contract('account-history.json'),
  '/v2/pool/accounts/*': contract('account.json'),
  '/v2/orders': contract('orders-page.json'),
  '/v2/orders/*/steps': contract('steps-delivered.json'),
  '/v2/orders/*': contract('order-status-delivered.json'),
  '/v2/payouts/*': contract('payout-queued.json'),
  '/v2/scanner/latest': contract('scanner-latest.json'),
  '/v2/scanner/stats': contract('scanner-stats.json'),
  '/v2/scanner/search': (u) => ({ status: 200, file: contract(u.searchParams.get('q')?.length === 66 ? 'scanner-search-tx.json' : 'scanner-search-none.json') }),
};

export const SCENARIOS = {
  default: { wallets: { evm: PAYER, icp: ICP }, routes: { ...common, '/v2/quote': real('quote/arb-usdc-to-pol-wbtc.json'), 'POST /v2/orders': real('submit/accepted.json') }, clockAt: 1792336073 },
  'no-wallet': { wallets: { evm: null, icp: null }, routes: { ...common, '/v2/quote': real('quote/arb-usdc-to-pol-wbtc.json') }, clockAt: 1792336073 },
  'permit2': { wallets: { evm: PAYER, icp: ICP }, routes: { ...common, '/v2/quote': real('quote/pol-wbtc-to-arb-usdc.json'), 'POST /v2/orders': real('submit/accepted.json') } },
  // a quote no route can carry (the quoter's 422 no_route, contract 1.4); derived, manifest
  'no-route': { wallets: { evm: PAYER, icp: ICP }, routes: { ...common, '/v2/quote': { status: 422, json: { code: 'no_route', message: 'no route could carry this swap: eco did not answer' } } }, clockAt: 1792336073 },
  // swaps from ICP held while a withdrawal waits in line (contract 5.15): today's quoter refusal; derived, manifest
  'icp-paused': { wallets: { evm: PAYER, icp: ICP }, routes: { ...common, '/v2/quote': { status: 422, json: { code: 'no_route', message: "no route could carry this swap: poolShort: the pool's Base pocket holds 0.00 USDC, below the payout" } } }, clockAt: 1792336073 },
  'submit-reverts': { wallets: { evm: PAYER, icp: ICP }, routes: { ...common, '/v2/quote': real('quote/arb-usdc-to-pol-wbtc.json'), 'POST /v2/orders': { status: 422, file: real('submit/reverts.json') } }, clockAt: 1792336073 },
};
