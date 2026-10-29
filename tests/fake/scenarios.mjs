// Which fixture answers which path, per scenario. Real answers wherever one exists (plan rule 2).
const real = (p) => `tests/fixtures/real/${p}`;
const contract = (p) => `tests/fixtures/contract/${p}`;
const PAYER = '0xf00EBA8E5Fd231b526ADFAAa68B4d0ede72A89AC';
const ICP = '3yfhk-v3nwx-2xo3k-pjyl5-ugvqk-ywkpy-qaq7m-aocl5-iz5re-kxxtc-2qe';
const WOOF = '0x3f1b9c4e7d2a6058ac91e0b7d45f28c63a9e1d07';

// A stake quote built from the request (no real one exists yet: plan 4 Task 5 records one on staging): the StakeQuote shape
// (services/quoter/src/api/answer/mod.rs, stake routes), one you pay gas route whose numbers follow the design's sample,
// a $0.18 network fee and the rebalancing share at 0.1% of the amount (fees.poolRebalancing, pool.rebalanceShare); derived, manifest
const stakeQuote = (_u, req) => {
  const b = req.postDataJSON();
  const amount = BigInt(b.amount);
  const network = 180_000n;
  const share = amount / 1000n;
  const min = amount > network ? amount - network : 0n;
  const route = {
    routeId: 'cctpFast', bridge: 'cctpFast', path: ['cctpFast'], rank: 1, slow: false, priceImpactPct: '0', etaSeconds: 12, etaSource: 'estimate',
    warnings: [], amountOut: String(min), amountOutMin: String(min), amountOutText: String(min), executable: true,
    fees: { network: String(network), bridge: '0', platform: '0', poolRebalancing: String(share) },
    pool: { ref: `0x${'00'.repeat(32)}`, salt: `0x${'55'.repeat(32)}`, kind: 'stake', account: b.owner.toLowerCase(), premium: '0', icpFees: '0', rebalanceShare: String(share), candid: '0x' },
  };
  return { status: 200, json: {
    quoteId: 'q-stake-e2e', fromChain: b.fromChain, fromToken: { address: b.fromToken, symbol: 'USDC', decimals: 6, verified: true }, amountIn: b.amount,
    owner: b.owner, quotedAt: 1792336073, expiresAt: 1792336113, unavailable: [],
    gasless: { allowed: false, whyNot: 'gaslessOff', routes: [] }, userPays: { allowed: true, routes: [route] },
  } };
};

const common = {
  '/v2/chains': contract('chains.json'),
  '/v2/tokens': (u) => ({ status: 200, file: contract(`tokens-${{ 'eip155:1': 1, 'eip155:137': 137, 'eip155:8453': 8453, 'eip155:42161': 42161 }[u.searchParams.get('chain')] ?? 0}.json`) }),
  // contract 5.1's example is Base; the Arbitrum answer is the same shape with Arbitrum's USDC (derived, manifest)
  '/v2/balances': (u) => ({ status: 200, file: u.searchParams.get('chain') === 'eip155:42161' ? 'tests/fixtures/derived/balances-42161.json' : contract('balances.json') }),
  '/v2/pool': contract('pool.json'),
  'POST /v2/stake/quote': stakeQuote,
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
  // a smart wallet (plan 2 Smart wallets): the default quote, the EVM wallet flagged as holding contract code
  'smart-wallet': { wallets: { evm: PAYER, icp: ICP, evmSmart: true }, routes: { ...common, '/v2/quote': real('quote/arb-usdc-to-pol-wbtc.json'), 'POST /v2/orders': real('submit/accepted.json') }, clockAt: 1792336073 },
  'no-wallet': { wallets: { evm: null, icp: null }, routes: { ...common, '/v2/quote': real('quote/arb-usdc-to-pol-wbtc.json') }, clockAt: 1792336073 },
  'permit2': { wallets: { evm: PAYER, icp: ICP }, routes: { ...common, '/v2/quote': real('quote/pol-wbtc-to-arb-usdc.json'), 'POST /v2/orders': real('submit/accepted.json') } },
  // a quote no route can carry (the quoter's 422 no_route, contract 1.4); derived, manifest
  'no-route': { wallets: { evm: PAYER, icp: ICP }, routes: { ...common, '/v2/quote': { status: 422, json: { code: 'no_route', message: 'no route could carry this swap: eco did not answer' } } }, clockAt: 1792336073 },
  // swaps from ICP held while a withdrawal waits in line (contract 5.15): today's quoter refusal; derived, manifest
  'icp-paused': { wallets: { evm: PAYER, icp: ICP }, routes: { ...common, '/v2/quote': { status: 422, json: { code: 'no_route', message: "no route could carry this swap: poolShort: the pool's Base pocket holds 0.00 USDC, below the payout" } } }, clockAt: 1792336073 },
  // the system halted: the quoter answers no route, naming the halt (errors.ts reads it as paused); derived, manifest
  paused: { wallets: { evm: PAYER, icp: ICP }, routes: { ...common, '/v2/quote': { status: 422, json: { code: 'no_route', message: 'no route could carry this swap: the canister is halted' } } }, clockAt: 1792336073 },
  // a pasted address on no list: GET /v2/tokens answers it unverified (TokensAnswer shape, the design's sample token); derived, manifest
  pasted: { wallets: { evm: PAYER, icp: ICP }, routes: { ...common, '/v2/tokens': (u) => (u.searchParams.get('q')?.toLowerCase() === WOOF
    ? { status: 200, json: { chain: u.searchParams.get('chain'), tokens: [{ address: WOOF, symbol: 'WOOF', name: 'Woof Token', decimals: 18, verified: false, class: 'unlisted' }] } }
    : common['/v2/tokens'](u)) }, clockAt: 1792336073 },
  'submit-reverts': { wallets: { evm: PAYER, icp: ICP }, routes: { ...common, '/v2/quote': real('quote/arb-usdc-to-pol-wbtc.json'), 'POST /v2/orders': { status: 422, file: real('submit/reverts.json') } }, clockAt: 1792336073 },
};
