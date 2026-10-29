// Which fixture answers which path, per scenario. Real answers wherever one exists (plan rule 2).
import { readFileSync } from 'node:fs';
import { getAddress, hashTypedData } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
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

// A withdraw quote built from the request, in the shape of plan 3 Task 1's test helper answer(): the backend's fixed example
// record (pool_eip712 tests fixed()) with that staker and recipient, that usdc, maxShares = maxSharesFor at the contract 5.3
// price, deadlineNs and expiresAt 6 hours after the scenario clock (contract 5.15), tokenOut the chain's USDC from the derived
// get_config, a fresh random nonce, and the digest from viem (no real withdraw quote exists for a key the test holds); derived, manifest
const CFG = JSON.parse(readFileSync(new URL('../fixtures/derived/swapic-config.json', import.meta.url), 'utf8'));
const WITHDRAWAL_TYPES = {
  Withdrawal: [
    { name: 'staker', type: 'address' }, { name: 'usdc', type: 'uint256' }, { name: 'maxShares', type: 'uint256' },
    { name: 'rebalanceShare', type: 'uint256' }, { name: 'networkFee', type: 'uint256' }, { name: 'dstChain', type: 'uint64' },
    { name: 'recipient', type: 'address' }, { name: 'tokenOut', type: 'address' }, { name: 'minOut', type: 'uint256' },
    { name: 'deadline', type: 'uint64' }, { name: 'nonce', type: 'uint64' },
  ],
};
const POOL_A = 8_420_550_000n;
const POOL_S = 8_346_065_000_000_000_000_000n;
const ceilDiv = (a, b) => (a === 0n ? 0n : (a - 1n) / b + 1n);
const POOL_CLOCK = 1793408400; // contract 5.3 snapshotAt: the 5.5 account's queued withdrawal is 40 minutes out
const withdrawQuote = (queued) => (_u, req) => {
  const b = req.postDataJSON();
  const usdc = BigInt(b.usdc);
  const burn = ceilDiv(usdc * POOL_S, POOL_A);
  const maxShares = burn + ceilDiv(burn * 5n, 1000n);
  const networkFee = 50_000n;
  const rebalanceShare = 1_000n;
  const expectedOut = usdc - networkFee - rebalanceShare;
  const until = POOL_CLOCK + 6 * 3600;
  const dst = Number(b.dstChain.split(':')[1]);
  const record = {
    staker: b.staker, usdc: b.usdc, maxShares: String(maxShares), rebalanceShare: String(rebalanceShare), networkFee: String(networkFee),
    payout: { dstChain: dst, recipient: b.recipient, tokenOut: CFG.chains[String(dst)].usdc, minOut: String(expectedOut), deadlineNs: `${until}000000000` },
    nonce: String(1 + Math.floor(Math.random() * 2 ** 52)),
  };
  const swapic = getAddress(CFG.chains[String(CFG.poolChain)].swapic);
  const typedData = {
    domain: { name: 'Swapic Pool', version: '1', chainId: CFG.poolChain, verifyingContract: swapic }, types: WITHDRAWAL_TYPES, primaryType: 'Withdrawal',
    message: {
      staker: getAddress(record.staker), usdc, maxShares, rebalanceShare, networkFee, dstChain: BigInt(dst), recipient: getAddress(record.payout.recipient),
      tokenOut: getAddress(record.payout.tokenOut), minOut: expectedOut, deadline: BigInt(until), nonce: BigInt(record.nonce),
    },
  };
  const json = (o) => JSON.parse(JSON.stringify(o, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
  return { status: 200, json: {
    withdrawal: record, typedData: json(typedData), digest: hashTypedData(typedData), verifyingContract: swapic,
    fees: { networkFee: String(networkFee), rebalanceShare: String(rebalanceShare), moveCost: '0', networkLines: [] },
    payout: { route: 'cctp', amount: String(expectedOut), expectedOut: String(expectedOut), minOut: String(expectedOut) },
    shares: { burn: String(burn), maxShares: String(maxShares), label: 'estimated' }, etaSeconds: 20, quotedAt: POOL_CLOCK, expiresAt: until,
    queue: queued ? { place: 2, aheadUsdc: '1200000000', etaAt: POOL_CLOCK + 2400 } : null,
  } };
};
/** A throwaway key made in memory for the run: the e2e signer signs for real, so every withdraw signature rule runs. */
const withKey = () => { const key = generatePrivateKey(); return { evm: privateKeyToAccount(key).address, icp: '3yfhk-v3nwx-2xo3k-pjyl5-ugvqk-ywkpy-qaq7m-aocl5-iz5re-kxxtc-2qe', evmKey: key }; };
/** The 5.5 example account answered for whichever EVM address asks. */
const accountFor = (u) => {
  const a = JSON.parse(readFileSync(new URL('../fixtures/contract/account.json', import.meta.url), 'utf8'));
  return { status: 200, json: { ...a, account: decodeURIComponent(u.pathname.split('/').pop()).toLowerCase() } };
};

/** No stake: the 5.5 shape with zeros, for whichever address asks. */
const emptyAccount = (u) => ({ status: 200, json: { account: decodeURIComponent(u.pathname.split('/').pop()), shares: '0', valueUsdc: '0', staked: '0', withdrawn: '0', earned: '0', since: null, waiting: [] } });

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
  // plan 3 Task 9: withdraw with a key made for the run; the quote built from the request (derived, manifest)
  withdraw: { wallets: withKey, routes: { ...common, '/v2/pool/accounts/*': accountFor, 'POST /v2/withdraw/quote': withdrawQuote(false) }, clockAt: POOL_CLOCK },
  // the same, with the Base side short: the quote says it waits in line (contract 5.15's example); derived, manifest
  'withdraw-queued': { wallets: withKey, routes: { ...common, '/v2/pool/accounts/*': accountFor, 'POST /v2/withdraw/quote': withdrawQuote(true) }, clockAt: POOL_CLOCK },
  // the pool page at the contract 5.3 snapshot (the 5.5 account's queued withdrawal 40 min out): the EVM wallet holds the
  // 5.5 stake, the ICP wallet none (Task 8's both-stakes adds one); derived, manifest
  pool: { wallets: { evm: PAYER, icp: ICP }, routes: { ...common, '/v2/pool/accounts/*': (u) => (u.pathname.includes('/0x') ? accountFor(u) : emptyAccount(u)) }, clockAt: POOL_CLOCK },
  // no stake in either wallet (plan 3 Task 3): the 5.5 shape with zeros; derived, manifest
  'no-stake': { wallets: { evm: PAYER, icp: ICP }, routes: { ...common, '/v2/pool/accounts/*': emptyAccount }, clockAt: POOL_CLOCK },
  'submit-reverts': { wallets: { evm: PAYER, icp: ICP }, routes: { ...common, '/v2/quote': real('quote/arb-usdc-to-pol-wbtc.json'), 'POST /v2/orders': { status: 422, file: real('submit/reverts.json') } }, clockAt: 1792336073 },
};
