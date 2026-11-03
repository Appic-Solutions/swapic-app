// Hand written from services/quoter (swapic-backend simplify 8973626). Plan 4 Task 5 checks them
// against GET /openapi.json on staging. Amounts are decimal strings in smallest units.

/** api/mod.rs:142-177 */
export interface ChainInfo {
  chainId: string;
  name: string;
  nativeToken: { address: string; symbol: string; decimals: number };
  usdc: { address: string; decimals: number };
  gasless: boolean;
}

/** api/tokens.rs:38-87 */
export interface TokenAnswer {
  address: string; symbol: string; name: string; decimals: number;
  logo?: string; priceUsd?: string; verified: boolean; class: string;
}
export interface TokensAnswer { chain: string; tokens: TokenAnswer[]; nextCursor?: string; warning?: string }

/** api/mod.rs QuoteQuery (deny_unknown_fields, so send nothing else). Without `routeId` every route is priced only (reason
 *  `routeNotNamed`) and nothing is stored; with it, the route of that id (in `gasMode`) is the answer's only route, built
 *  and stored for the watcher (services 679b88e). */
export interface QuoteQuery {
  fromChain: string; fromToken: string; amount: string; toChain: string; toToken: string;
  recipient?: string; payer?: string; slippageBps?: number; includeSlow?: boolean; allRoutes?: boolean;
  routeId?: string; gasMode?: 'gasless' | 'userPays' | 'icpPull';
}

/** answer/mod.rs:21-36 */
export interface QuoteToken { address: string; symbol: string; decimals: number; verified: boolean }

/** answer/mod.rs:82-91 (never shown) */
export type Bridge = 'eco' | 'ecoCctp' | 'cctpFast' | 'cctpStandard' | 'pool' | 'ckMinter' | 'sameChain';

/** answer/mod.rs:139-164 */
export type Warning =
  | 'highPriceImpact' | 'severePriceImpact' | 'priceImpactUnknown' | 'bridgeFeeEstimated' | 'bridgeFeeUnknown'
  | 'arrivalSwapNotRunnable' | 'dynamicEcoUntested' | 'unverifiedToken' | 'symbolLooksLikeListed' | 'symbolNotAscii';

/** answer/mod.rs Fees, micro USDC each. `moveFee`: a stake's move to the pool's other side (Swapic's); network, bridge and
 *  platform never include it. */
export interface Fees {
  network: string; bridge: string; platform: string;
  premium?: string; icpFees?: string; moveFee?: string;
}

/** A pool route's terms as the quoter shows them (answer/mod.rs PoolTerms, micro USDC). Never trusted: the app reads the
 *  terms from the order's own memo, whose keccak is the order's ref (guards/memo.ts); only the presence of this object
 *  marks a route into the pool. */
export interface PoolTerms {
  ref: string; kind: 'swap' | 'stake'; account: string; tokenOut?: string; minOut?: string;
  minUsdc: string; premium: string; icpFees: string; moveFee: string; salt: string; memo: string;
}

/** answer/mod.rs:281-305: swap_from_icp's argument, sent as is */
export interface IcpSwapTermsAnswer {
  tokenIn: string; amountIn: string; fromSubaccount: string | null; refundTo: string | null;
  slippageBps: number; deadlineNs: string; plan: { order: string; gasLimit: number };
}
/** answer/mod.rs:311-334: shown only */
export interface IcpSwapPlanned {
  planned: string; expectedSale: string; saleFloor: string; premium: string; premiumBps: number;
  networkFee: string; leastPayout: string; delivery: string; dstChain: number; recipient: string;
  tokenOut: string; expectedOut: string; minOut: string; orderId: string;
}
/** answer/mod.rs:339-358 */
export interface IcpSwapAnswer {
  canister: string | null;
  approve: { ledger: string; spender: string | null; amount: string };
  terms: IcpSwapTermsAnswer;
  planned: IcpSwapPlanned;
}

/** The Swapic Order as JSON, its memo last (canister golden interface.json `order.value`). `memo` is `0x` on every order but a
 *  pool deposit's; a quoter older than the memo leaves it out, which reads as `0x`. */
export interface OrderJson {
  ref: string; payer: string; tokenIn: string; amountIn: string; deadline: string;
  steps: { target: string; data: string; token: string; min: string; writes: { at: number; minus: string }[] }[];
  payout: { token: string; recipient: string; minOut: string };
  memo?: string;
  abi: string;
}
/** order/mod.rs:383-398 */
export interface EnvelopeJson {
  version: number; ref: string; action: 'deliver' | 'swap' | 'ckDeposit'; deadline: number;
  recipient: string; tokenOut: string; minOut: string; principal: string; subaccount: string; minGas: number; hex: string;
}
/** answer/mod.rs:499-517 (never trusted: the app reads Swapic from get_config) */
export interface ChainContracts { chainId: string; swapic: string; runner: string; cctpReceiver: string }
export interface Contracts { source: ChainContracts; destination?: ChainContracts }
/** answer/mod.rs:519-565 */
export interface ApprovalRequest { token: string; spender: string; amount: string }
export interface Authorization { door: Door; validAfter: string; validBefore: string; nonce: string; deadline: string }
export type Door = 'auth3009' | 'permit2612' | 'permit2';
export interface TypedDataJson {
  types: Record<string, { name: string; type: string }[]>;
  primaryType: string;
  domain: { name?: string; version?: string; chainId: number; verifyingContract: string };
  message: Record<string, unknown>;
}
export interface SignRequest { door: Door; typedData: TypedDataJson[]; auth: Authorization; approval?: ApprovalRequest }
export interface TxRequest { chainId: string; to: string; data: string; value: string }

/** answer/mod.rs:404-497 */
export interface Route {
  routeId: string; bridge: Bridge; path: string[]; rank: number; slow: boolean;
  savesVsBestFastPct?: string; priceImpactPct: string | null; etaSeconds: number;
  etaSource: 'measured' | 'quoted' | 'estimate'; warnings: Warning[];
  amountOut: string; amountOutMin: string; amountOutText: string; fees: Fees; userGasUsd?: string;
  executable: boolean;
  pool?: PoolTerms; shares?: { expected: string; label: string }; icpSwap?: IcpSwapAnswer;
  reason?: string; reasonDetail?: string;
  order?: OrderJson; orderId?: string; envelope?: EnvelopeJson; contracts?: Contracts;
  sign?: SignRequest; tx?: TxRequest; approval?: ApprovalRequest;
}
/** answer/mod.rs:68-78 */
export interface Mode { allowed: boolean; whyNot?: string; routes: Route[] }
/** answer/mod.rs:38-66 */
export interface Quote {
  quoteId: string; fromChain: string; toChain: string; fromToken: QuoteToken; toToken: QuoteToken;
  amountIn: string; quotedAt: number; expiresAt: number; unavailable: string[];
  gasless: Mode; userPays: Mode; icpPull?: Mode;
}

/** api/mod.rs:506-528 */
export interface StakeRequest {
  fromChain: string; fromToken: string; amount: string; owner: string; payer: string; gasMode?: 'gasless' | 'userPays';
}
/** answer/mod.rs:1185-1202 */
export interface StakeQuote {
  quoteId: string; fromChain: string; fromToken: QuoteToken; amountIn: string; owner: string;
  quotedAt: number; expiresAt: number; unavailable: string[]; gasless: Mode; userPays: Mode;
}

/** api/mod.rs:630-652 */
export interface WithdrawRequest { staker: string; usdc: string; dstChain: string; recipient: string; tokenOut: string; slippageBps?: number }
/** The signed withdrawal record (canister golden interface.json `withdrawal`); `moveFee` is the record's `move_fee`. */
export interface WithdrawalJson {
  staker: string; usdc: string; maxShares: string; moveFee: string; networkFee: string;
  payout: { dstChain: number; recipient: string; tokenOut: string; minOut: string; deadlineNs: string };
  nonce: string;
}
/** answer/mod.rs:1256-1333 */
export interface WithdrawQuoteAnswer {
  withdrawal: WithdrawalJson; typedData: TypedDataJson; digest: string; verifyingContract: string;
  /** Shown only: the record's own `networkFee` and `moveFee` are what the check binds. */
  fees: { networkFee: string; moveFee: string };
  payout: { route: string; amount: string; expectedOut: string; minOut: string };
  shares: { burn: string; maxShares: string; label: string };
  etaSeconds: number; quotedAt: number; expiresAt: number;
  /** Contract 5.15 (Jeff, 2026-10-28): null, the Base side pays at once; an object, it waits in line once signed. `expiresAt` is
   *  quotedAt + 6 h unless the backend is sure the Base side pays at once (then + 10 minutes). `place`, `aheadUsdc`, `etaAt` are
   *  null when the backend cannot see the line; `etaAt` null: the app shows "In line" with no minutes.
   *  Optional only because today's quoter does not send it yet. */
  queue?: { place: number | null; aheadUsdc: string | null; etaAt: number | null } | null;
}

/** api/pool.rs:19-74 plus contract 5.3 `stats` */
export interface Pocket { free: string; reserved: string; inFlight: string }
export interface PoolStats { apy7dBps: number | null; apy30dBps: number | null; earned24h: string; snapshotAt: number }
export interface PoolAnswer {
  open: boolean; closedReason?: string; openForSwaps: boolean; base: Pocket; icp: Pocket;
  /** `sharePrice` is left out or null while no shares exist (a new, empty pool: staging 2026-10-31). */
  totalAssets: string; totalShares: string; sharePrice?: string | null; tvlCap: string; perSwapCap: string;
  premiumBps: number; ckusdcLedger: string; icpTokens: { ledger: string; icpswapPool: string }[];
  stats?: PoolStats | null;
  /** One move between the pool's two sides at live gas, at least the canister's least for its direction, micro USDC
   *  (api/pool.rs MoveFeesAnswer): what an ICP stake (`icpToBase`) and an ICP withdrawal (`baseToIcp`) pay Swapic as their
   *  `move_fee`. Null while the quoter has no price or gas reading: the app then offers neither. */
  moveFees?: { baseToIcp: string; icpToBase: string } | null;
}
/** contract 5.2. `points[].sharePrice` is null while no shares exist (before the first stake; staging answers so, recorded
 *  in tests/fixtures/real/staging/pool-history-30d.json). */
export type PoolRange = '1d' | '7d' | '30d' | '90d' | 'all';
export interface PoolHistory { range: PoolRange; stepSeconds: number; points: { t: number; sharePrice: string | null; totalAssets: string; earned: string }[] }
/** contract 5.4 */
export interface PoolActivityItem {
  id: string; kind: 'stake' | 'withdraw' | 'swap'; at: number; usdc: string; earned: string | null;
  chain: string | null; walletShort: string; from: { chain: string; symbol: string } | null; to: { chain: string; symbol: string } | null;
}
export interface PoolActivity { items: PoolActivityItem[]; nextCursor: string | null }
/** api/pool.rs:108-119 plus contract 5.5 */
/** `status`: contract 5.5 lists queued, waiting, signed, delivering, refunding. The app shows each as "in line", "on its way"
 *  or "refunding" and never fails on another word. `place` and `etaAt` are null while the backend's copy of the canister's
 *  log is stale: the app then shows "in line" with no minutes, never a guess. */
export interface WaitingPayout { payoutId: number; usdc: string; status: 'queued' | 'waiting' | 'signed' | 'delivering' | 'refunding' | (string & {}); place: number | null; etaAt: number | null }
export interface AccountAnswer {
  account: string; shares: string; valueUsdc: string;
  /** null while the backend's copy of the canister's log disagrees or is stale: the app hides "Earned" (contract 5.5). */
  staked?: string; withdrawn?: string; earned?: string | null; since?: number | null; waiting?: WaitingPayout[];
}
/** contract 5.6 */
export interface AccountHistory { account: string; range: PoolRange; stepSeconds: number; points: { t: number; valueUsdc: string }[] }
/** contract 5.1 */
export interface BalancesAnswer { chain: string; wallet: string; block: number; balances: { token: string; balance: string }[] }
