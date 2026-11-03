// From the contract file (sections 5.7-5.14) and the watcher's code named there. The watcher has no OpenAPI.

export type Outcome = 'pending' | 'delivered' | 'refunded' | 'failed';
export interface Side {
  chain: string | null; token: string | null; symbol: string | null; decimals: number | null;
  amount: string | null; amountMin: string | null; wallet: string | null; tx: string | null; block: number | null;
}
export interface Refund {
  chain: string | null; token: string | null; symbol: string | null; decimals: number | null;
  amount: string | null; receiver: string; tx: string | null; block: number | null;
}
/** contract 5.14's closed words; the backend may add one, which the app reads as `other`. `deliveredAsUsdc` (services
 *  77af0f9): on a `refunded` order, its arrival could not buy the token, so the recipient got the USDC itself. */
export type ReasonCode = 'expired' | 'timedOut' | 'priceMoved' | 'deliveredAsUsdc' | 'notFilled' | 'poolShort' | 'stopped' | 'other';
/** True while the canister holds the order's money for a person to resolve, as an orphan (watcher c00d864). An older
 *  watcher leaves it out, which reads as not held. */
export interface HoldFlag { onHold?: boolean | null }
/** contract 5.7. `reason` is the backend's own text and is never shown (it may name a rail, contract 6); the app reads `reasonCode`.
 *  A side whose `chain` is null is the Swapic Pool: every stake's `to` (an EVM stake's too), every withdrawal's `from`. */
/**
 * Chain times (services d5e49ff, 2026-11-01): `startedAt` the wallet's signing time (gasless) or the source transaction's
 * block time, `deliveredAt` the block time of the transaction that paid the recipient (the canister log's time for an
 * ICP payout), `tookS` = deliveredAt - startedAt (never below 0), all unix seconds or null; left out by a service older
 * than that. `createdAt` and `endedAt` are the watcher's own clock: every duration the app shows comes from the chain
 * times, the watcher's clock only for rows written before them.
 */
export interface ChainTimes { startedAt?: number | null; deliveredAt?: number | null; tookS?: number | null }
export interface ActivityRow extends ChainTimes, HoldFlag {
  id: string; kind: 'swap' | 'stake' | 'withdraw'; outcome: Outcome; stage: string;
  createdAt: number; endedAt: number | null; etaAt: number | null; gasMode: 'gasless' | 'userPays' | null;
  from: Side; to: Side; feeUsdc: string | null; payoutId: number | null; reason: string | null;
  reasonCode: ReasonCode | (string & {}) | null; refund: Refund | null;
  direction?: 'sent' | 'received' | 'self';
}
/** contract 5.8, plus today's fields (api/mod.rs:801-817) */
export interface OrderStatusAnswer extends ChainTimes, HoldFlag {
  orderId: string; status: string; srcTx: string | null; dstTx: string | null; amountOut: string | null;
  token: string | null; refunded: boolean; reason?: string; signedTxId?: number;
  pool?: { kind: string; status: string; arrived: string | null; paid: string | null; sharesMinted: string | null };
  outcome: Outcome; stage: string; fromChain: string; toChain: string; etaAt: number | null; refund: Refund | null;
}
/** contract 5.9 */
export interface OrdersPage { orders: ActivityRow[]; nextCursor: string | null }
/** contract 5.10, plus today's fields (withdraw/mod.rs:172-207) */
export interface PayoutAnswer extends HoldFlag {
  id: number; kind: string;
  terms: { dstChain: number; recipient: string; tokenOut: string; minOut: string; deadlineNs: string };
  amount: string | null; received: string | null; planned: string | null; status: string;
  orderId: string | null; txHash: string | null; signedTxId?: number; reason?: string;
  outcome: Outcome; stage: string;
  /** null fields while the backend's copy of the canister's log is stale (contract 5.15's rule): "In line" with no minutes */
  queue?: { place: number | null; aheadUsdc: string | null; etaAt: number | null } | null;
  /** an undone ICP swap names its receiver and its token (ckUSDC, or the token itself when the sale never happened) */
  refund?: Refund | null;
}
/** contract 5.11 */
export interface ScannerPage { items: ActivityRow[]; nextCursor: string | null }
/** contract 5.12 */
export interface ScannerStats {
  windowSeconds: number; swaps: number; swapsBefore: number; medianMs: number | null;
  delivered: number; refunded: number; failed: number; deliveredBps: number | null; volumeUsd: string; updatedAt: number;
}
/** contract 5.13 */
export interface SearchAnswer { q: string; match: 'wallet' | 'order' | 'tx' | 'none'; items: ActivityRow[]; nextCursor: string | null }
/** contract 5.14 */
export type StepName = 'signed' | 'sent' | 'onItsWay' | 'queued' | 'paidOut' | 'staked' | 'delivered' | 'refunded' | 'failed';
export interface StepRow {
  step: StepName; state: 'done' | 'wait' | 'fail' | 'todo'; chain: string | null; atMs: number | null;
  /** on `refunded` and `failed`: one closed word (contract 5.14), never the backend's text */
  tx: string | null; block: number | null; amount: string | null; token: string | null; reason: ReasonCode | (string & {}) | null;
}
export interface StepsAnswer extends ChainTimes { id: string; kind: 'swap' | 'stake' | 'withdraw'; outcome: Outcome; steps: StepRow[] }
/** api/mod.rs:195-221; numbers as decimal strings, signatures 0x hex, signedAt unix milliseconds */
export interface GaslessSubmit {
  orderId: string;
  auth: { door: 'auth3009' | 'permit2612' | 'permit2'; validAfter: string; validBefore: string; nonce: string; deadline: string; signature: string; acceptance: string };
  signedAt: number;
}
/** POST /v2/deposits/find (watcher find.rs): a paid transaction the history does not show, asked for by chain and hash.
 *  `queued`: it started an order of ours (or paid the pool) and is being filed; `filed`: done, `orders` filed from it;
 *  `nothing`: no order of ours in it (or no such transaction yet). `why` is the backend's own text and never shown. */
export interface FindAnswer { chain: string; tx: string; state: 'queued' | 'filed' | 'nothing' | (string & {}); orders: number | null; why: string | null }
/** withdraw/mod.rs:50-56 */
export interface WithdrawSubmit { withdrawal: import('./quoter-types').WithdrawalJson; signature: string }
