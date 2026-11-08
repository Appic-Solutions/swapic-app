// Design note (running a swap, plan 2 Task 7).
// Must never happen: anything signed or sent from a quote that did not pass Task 1 or 2 in the same run; a stale quote
// signed; a second approval or signature made by the app on its own after a lost answer (a second icrc2_approve after
// swap_from_icp may have pulled would let a retry pull twice); a sentence about money the data does not support after a
// lost ICP answer ("it started" when it did not, "nothing was taken" while the call could still run) (plan check M4); a
// person's "no" in the wallet treated as an error; a send while the wallet is on another chain.
// How the design proves it: a fresh quote of the picked route alone (asked by its id and mode, the only route the quoter
// builds and stores) and fresh canister anchors every run, that route picked again by id, mode and tag among the ones
// routeOffered allows, newPrice when the fresh minimum is below the shown one; Task 1 or 2 checks at the real clock and
// only checked values move on; ensureChain before every signature and send, an approval's receipt awaited; a lost
// gasless submit is offered again with the identical body; an ICP approval of exactly amount_in + fee, an equal live
// allowance reused, never topped up; a lost swap_from_icp answer judged from the ledger balance and the canister's payout
// record every 15 s, "nothing was taken" only after 6 minutes, no retry without the exact allowance and time left.
// A lost answer is any of: the API's network, edge or timeout codes, a TypeError, agent 5's AgentError of kind Transport
// or with TimeoutWaitingForResponseErrorCode or an HTTP 5xx, and an ICP signer's closed channel or network error
// (isLostSignerAnswer, ICRC-25 4001 and 4000), which is never a "no" (lead's ruling 2026-10-29). Tests: execute.test.ts.
// You pay gas through Permit2 (Jeff 2026-11-08). Must never happen: two approvals for one swap (the path's own is the only
// one verifyEvmRoute returns); gas spent on a signature Permit2 will refuse (a payer with code, read before the approve and
// again after it; a signature that is not its key's: the wallets folder's guard.ts); gas spent on a maximum approve already
// in place (the quoter's read can fail or lag: the chain is read first); a read that failed taken as a wallet that cannot
// sign (tryAgain: nothing sent, nothing remembered); a wallet step the person was not shown (another path, one more approve
// than Review swap shows: stepsChanged, nothing sent, never called a new price); a dead end for a wallet that cannot sign
// (noPermit2: back to Review swap with today's steps, where the person sees the new approve before any wallet asks for
// it). An injected wallet cannot say it has no typed data method without a popup, so one learns that at the signature,
// after the approve; a WalletConnect session says it first. `permit2` absent or false, no field, or a route with no
// approval: the code below runs exactly as it did, approve, then run(order).
import { encodeFunctionData, erc20Abi, type Hex } from 'viem';
import { submitSolana as submitSolanaFn } from '@/lib/api';
import { ApiError, userMessage, type GaslessSubmit, type Quote, type QuoteQuery, getOrders as getOrdersFn, getQuote as getQuoteFn, submitGasless as submitFn } from '@/lib/api';
import { config } from '@/config';
import { PoolErrorFailure, poolErrorMessage, type IcpCaller, type IcpClient } from '@/lib/icp';
import { chainKind, evmId, SOLANA_CHAIN } from '@/lib/explorer';
import { readAccount, readTable, type AccountRead, type TableRead } from '@/lib/solana/rpc';
import { decodeWire, toBase64 } from '@/lib/solana/tx';
import { captureFailure } from '@/lib/sentry';
import type { EvmSigner } from '@/lib/wallets';
import type { SolSigner } from '@/lib/wallets/sol-signer';
// the rejection rules only: the @/lib/wallets barrel creates AppKit at import, which unit tests cannot load
import { isLostSignerAnswer, isUnsupportedSign, isUserRejection } from '@/lib/wallets/rejection';
import { AgentError, ErrorKindEnum, HttpErrorCode, TimeoutWaitingForResponseErrorCode } from '@icp-sdk/core/agent';
import type { UiToken } from '@/components/ui/token-types';
import { formatAmount } from '@/lib/money';
import { gasText, networkFeeText, type NativeCoin } from './view';
import { SWAPIC_PERMIT2_ABI, sameAddress, sameToken } from './guards/abi';
import { loadGuardContext, type GuardContext } from './guards/context';
import { routeOffered, verifyEvmRoute, type CheckedEvmRoute } from './guards/evm';
import { verifyIcpCkSwap, verifyIcpSwap, type CheckedIcp } from './guards/icp';
import { canReceive, verifySolana, type CheckedSolana } from './guards/solana';
import { GuardError, GUARD_MESSAGE } from './guards/errors';
import { forPayer, minOutOf, namedOption, type PickedOption, type RoutePick } from './options';
import { settleLost } from './lost';

export type ExecOutcome =
  /** `deadline`: the sent order's deadline (unix seconds), given only while the app has not seen the order start on chain
   *  (a gasless submit, a receipt it could not read): past it with nothing seen, Your swap reads it as never started. */
  | { kind: 'started'; activityId: string; deadline?: number }
  | { kind: 'newPrice'; quote: Quote; option: PickedOption }
  | { kind: 'rejected' }
  | { kind: 'failed'; message: string }
  | { kind: 'unknown'; message: string; resume: (() => Promise<ExecOutcome>) | null }
  /** This payer cannot pay through Permit2: its address holds code on this chain, or (`wallet`, remembered for the visit) the
   *  wallet has no such method or its signature is not its key's. No swap was sent: Review swap comes back with today's steps. */
  | { kind: 'noPermit2'; wallet: boolean }
  /** What this run would ask is not what Review swap shows, at a price it still shows: back to it, with no word of a new price. */
  | { kind: 'stepsChanged'; quote: Quote; option: PickedOption }
  /** A read of the chain failed. It says nothing about the wallet: nothing was sent, and the same click can go through. */
  | { kind: 'tryAgain'; message: string };

export interface ExecDeps { submitSolana?: typeof submitSolanaFn; solanaTables?: TableRead; solanaAccount?: AccountRead; getQuote: typeof getQuoteFn; getOrders: typeof getOrdersFn; submitGasless: typeof submitFn; icp: IcpClient; nowMs(): number; sleep(ms: number): Promise<void> }
export interface ExecInput {
  /** The ask naming the picked route (namedQueryOf), and that route as picked. */
  query: QuoteQuery; pick: RoutePick; shownMin: bigint; amountIn: bigint;
  from: UiToken; to: UiToken; recipient: string;
  evm: EvmSigner | null; icpCaller: IcpCaller | null; sol?: SolSigner | null;
  onStep(index: number, state: 'wait' | 'done' | 'fail'): void;
  /** The wallet sent the step's transaction (its hash): from here the chain is awaited, not the wallet. */
  onSent?(index: number, hash: Hex): void;
  /** An approve step's own moments: the wallet asks for it ('wallet'), or it was sent and its receipt is awaited
   *  ('network'). A token that is set to 0 first goes through both twice. */
  onApproval?(index: number, on: 'wallet' | 'network'): void;
  onNote?(text: string): void;
  /** Review swap read this payer as able to sign through Permit2. Absent or false: a route's `permit2Pay` is not looked at. */
  permit2?: boolean;
  /** The Permit2 steps Review swap shows. A run that would ask another path or one more approve goes back to it. */
  shown?: { permit2: boolean; approval: boolean };
}

const failed = (message: string): ExecOutcome => ({ kind: 'failed', message });
const agentLost = (e: unknown) =>
  e instanceof AgentError
  && (e.kind === ErrorKindEnum.Transport || e.hasCode(TimeoutWaitingForResponseErrorCode) || (e.code instanceof HttpErrorCode && e.code.status >= 500));
const lostAnswer = (e: unknown) =>
  (e instanceof ApiError && (e.code === 'network' || e.code === 'edgeUnavailable' || e.code === 'timedOut'))
  || e instanceof TypeError || agentLost(e) || isLostSignerAnswer(e);
const guardFailure = (e: unknown): ExecOutcome => {
  if (e instanceof GuardError) { captureFailure(e, `guard:${e.rule}`); return failed(GUARD_MESSAGE); }
  return failed(userMessage(e));
};

type Fresh = { quote: Quote; option: PickedOption; guard: GuardContext | undefined };
/** Before sending with little time left: a fresh route checked in full (with what the review needs if it comes back). */
type Refreshed = { checked: CheckedEvmRoute; quote: Quote; option: PickedOption };

/** Ask again, before the swap, an order with less than this left (the wallet's confirm and the block still to come). */
const FRESH_BELOW_S = 90;
/** With no fresh ask possible, the least life an order is sent with (the guard's own rule, verifyEvmRoute MIN_LIFE_S). */
const MIN_SEND_S = 30;
/** How long past its deadline the swap's receipt is looked for: none by then means it never ran (Swapic refuses an order
 *  past its deadline, so one that lands later only reverts). */
const RECEIPT_GRACE_S = 60;
const LOOK_AGAIN_MS = 4_000;
/** Shared by the swap and the stake (sendCheckedEvm), so neither names one. */
const TX_REVERTED = 'The transaction failed on the network. Your tokens stayed in your wallet. Try again.';
const TX_NOT_CONFIRMED = 'The transaction was not confirmed in time. Your tokens stayed in your wallet. Try again.';
/** The API's own sentence for an expired quote (lib/api/errors.ts `expired`). */
const EXPIRED = 'This quote expired. Get a new one.';
/** A read of the chain, with the person waiting on a click. */
const SEND_READ_MS = 8_000;
const CANNOT_CHECK = "Couldn't check your wallet, try again.";
const cannotCheck: ExecOutcome = { kind: 'tryAgain', message: CANNOT_CHECK };

/** The picked route asked by name (the only route the quoter builds and stores) and the canister's anchors, both fresh;
 *  that route picked again among the ones routeOffered allows; less out than the review showed is a new price. */
async function freshRoute(i: ExecInput, d: ExecDeps): Promise<Fresh | ExecOutcome> {
  let quote: Quote;
  let guard: GuardContext | undefined;
  try {
    // anchors that cannot be read leave the check to refuse
    [quote, guard] = await Promise.all([d.getQuote(i.query), loadGuardContext(d.icp).catch(() => undefined)]);
  } catch (e) {
    return failed(userMessage(e));
  }
  const accept = (r: Parameters<typeof routeOffered>[1], mode: PickedOption['mode']) => routeOffered(quote, r, mode, { payer: i.query.payer, recipient: i.query.recipient, guard });
  const named = namedOption(quote, i.pick, accept);
  // inside Solana with no SOL and under the service's least: the one thing that helps is a little SOL
  if (!named && [...quote.gasless.routes, ...quote.userPays.routes].some((r) => r.reason === 'solanaBelowGasless')) return failed(ADD_SOL);
  if (!named) return failed('No route found for this amount');
  const option = forPayer(named, i.permit2 === true);
  // the screen's minimum sits a small cushion under the quote's (shownMinOf): a built order a few units lower is no news
  if (minOutOf(option) < i.shownMin) return { kind: 'newPrice', quote, option };
  return { quote, option, guard };
}

export async function executeSwap(i: ExecInput, d: ExecDeps): Promise<ExecOutcome> {
  const f = await freshRoute(i, d);
  if ('kind' in f) return f;
  if (f.option.route.solana) return runSolana(i, d, f);
  return f.option.mode === 'icpPull' ? runIcp(i, d, f.quote, f.option, f.guard) : runEvm(i, d, f);
}

const ADD_SOL = 'Add a little SOL to swap under $10 on Solana';
const CANNOT_RECEIVE = 'This address cannot receive on Solana. Check it and try again.';

/** Whether a recipient on Solana can be paid: a read that fails stops the run with nothing sent. */
async function solanaRecipient(i: ExecInput, d: ExecDeps): Promise<ExecOutcome | null> {
  if (i.to.chain !== SOLANA_CHAIN) return null;
  const ok = await canReceive(i.recipient, d.solanaAccount ?? readAccount);
  return ok === null ? cannotCheck : ok ? null : failed(CANNOT_RECEIVE);
}

/**
 * A route out of Solana. Only bytes verifySolana passed reach the wallet; what comes back must be that same message, or it is
 * not sent. A lost answer from the door is asked again with the identical body: the door answers a second submit the same.
 */
async function runSolana(i: ExecInput, d: ExecDeps, f: Fresh): Promise<ExecOutcome> {
  const sol = i.sol;
  if (!sol) return failed('Connect wallet');
  const refused = await solanaRecipient(i, d);
  if (refused) return refused;
  let checked: CheckedSolana;
  try {
    checked = await verifySolana({
      quote: f.quote, route: f.option.route, mode: f.option.mode as 'gasless' | 'userPays', user: sol.address, recipient: i.recipient,
      fromToken: i.from.address, toToken: i.to.address, amountIn: i.amountIn, shownMin: i.shownMin, guard: f.guard,
      tables: d.solanaTables ?? readTable(), nowSec: Math.floor(d.nowMs() / 1000),
    });
  } catch (e) {
    return guardFailure(e);
  }
  let signed: Uint8Array;
  try {
    i.onStep(0, 'wait');
    signed = await sol.signTransaction(checked.wire);
  } catch (e) {
    if (isUserRejection(e)) return { kind: 'rejected' };
    i.onStep(0, 'fail');
    return failed(userMessage(e));
  }
  const back = decodeWire(signed);
  const asked = decodeWire(checked.wire);
  if (!back || !asked || toBase64(back.message) !== toBase64(asked.message)) {
    i.onStep(0, 'fail');
    captureFailure(new GuardError('solanaWalletChanged'), 'guard:solanaWalletChanged');
    return failed('Your wallet changed the transaction, so it was not sent. Nothing moved. Try again.');
  }
  i.onStep(0, 'done');
  const body = checked.requestId ? { requestId: checked.requestId, tx: toBase64(signed) } : { orderId: checked.orderId, tx: toBase64(signed) };
  return submitSolanaOnce(i, d, body, checked);
}

async function submitSolanaOnce(i: ExecInput, d: ExecDeps, body: Parameters<typeof submitSolanaFn>[0], checked: CheckedSolana): Promise<ExecOutcome> {
  const send = d.submitSolana ?? submitSolanaFn;
  try {
    i.onStep(1, 'wait');
    const answer = await send(body);
    if (answer.status === 'failed') {
      i.onStep(1, 'fail');
      return failed('The swap did not land. Your tokens stayed in your wallet. Try again.');
    }
    i.onStep(1, 'done');
    return { kind: 'started', activityId: checked.orderId };
  } catch (e) {
    if (lostAnswer(e)) {
      return { kind: 'unknown', message: 'We could not reach Swapic. Try again: your signature is sent as it is.', resume: () => submitSolanaOnce(i, d, body, checked) };
    }
    i.onStep(1, 'fail');
    return failed(userMessage(e));
  }
}

/** What the payer's code and wallet say about signing through Permit2 as of now: the outcome that stops the run, or null. */
async function payerStop(evm: EvmSigner, chainId: number): Promise<ExecOutcome | null> {
  const read = await evm.payerOn(chainId, SEND_READ_MS);
  if (read === 'plain') return null;
  return read === 'unread' ? cannotCheck : { kind: 'noPermit2', wallet: read === 'noTypedData' };
}

/** Task 1 at the real clock: only what this returns reaches the wallet. */
function checkEvm(i: ExecInput, d: ExecDeps, f: Fresh, evm: EvmSigner): CheckedEvmRoute {
  return verifyEvmRoute({
    quote: f.quote, route: f.option.route, mode: f.option.mode as 'gasless' | 'userPays', payer: evm.address, recipient: i.recipient,
    fromToken: i.from.address, toToken: i.to.address, amountIn: i.amountIn, guard: f.guard, nowSec: Math.floor(d.nowMs() / 1000),
  });
}

async function runEvm(i: ExecInput, d: ExecDeps, f: Fresh): Promise<ExecOutcome> {
  const evm = i.evm;
  if (!evm) return failed('Connect wallet');
  const cannotReceive = await solanaRecipient(i, d);
  if (cannotReceive) return cannotReceive;
  let checked: CheckedEvmRoute;
  try {
    checked = checkEvm(i, d, f, evm);
  } catch (e) {
    return guardFailure(e);
  }
  // the same ask and the same checks again, for an order that ran short of time before its swap
  const refresh = async (): Promise<Refreshed | ExecOutcome> => {
    const g = await freshRoute(i, d);
    if ('kind' in g) return g;
    try {
      return { checked: checkEvm(i, d, g, evm), quote: g.quote, option: g.option };
    } catch (e) {
      return guardFailure(e);
    }
  };
  if (checked.permit2Pay) {
    // before any gas: a signature Permit2 would refuse is known now, not after the approve
    const stop = await payerStop(evm, checked.chainId);
    if (stop) return stop;
    // the quoter's read of the allowance can fail or lag and name a new maximum: the chain says whether it is owed
    if (checked.approval) {
      const allowed = await evm.allowanceOf(checked.chainId, checked.approval.token, checked.approval.spender, SEND_READ_MS);
      if (allowed === null) return cannotCheck;
      if (allowed >= checked.amountIn) checked = { ...checked, approval: null };
    }
  }
  // the Permit2 steps on screen against what this run would ask (today's path never comes here)
  const shown = i.shown;
  let startAt = 0;
  if (shown && (shown.permit2 || checked.permit2Pay)) {
    if (shown.permit2 !== !!checked.permit2Pay || (!shown.approval && checked.approval)) return { kind: 'stepsChanged', quote: f.quote, option: f.option };
    // the approve on screen is no longer asked (already in place): its row is done, the rest light up in order
    if (shown.approval && !checked.approval) { i.onStep(0, 'done'); startAt = 1; }
  }
  return sendCheckedEvm(checked, evm, d, i, refresh, startAt);
}

/** A fresh route's approval this run already made: the same token and spender, for as much or more. */
const covered = (made: CheckedEvmRoute['approval'], wanted: NonNullable<CheckedEvmRoute['approval']>) =>
  !!made && sameAddress(made.token, wanted.token) && sameAddress(made.spender, wanted.spender) && made.amount >= wanted.amount;

/**
 * Signs and sends a route that passed verifyEvmRoute in this run (the swap's and the stake's, plan 3 Task 4). Right before
 * the swap an order with under 90 s left is never sent as it is: `refresh` (the swap's) asks the same named route again and
 * checks it the same way, sent quietly when its least is at or above the screen's, a new price otherwise; without it (the stake) an order
 * under 30 s is refused. A sent transaction is the swap only once its receipt says so: reverted, or none by the deadline
 * and a minute, it never ran.
 */
export async function sendCheckedEvm(
  first: CheckedEvmRoute, evm: EvmSigner, d: ExecDeps, i: Pick<ExecInput, 'onStep' | 'onSent' | 'onApproval'>,
  refresh?: () => Promise<Refreshed | ExecOutcome>, startAt = 0,
): Promise<ExecOutcome> {
  let checked = first;
  const chainId = checked.chainId;
  let step = startAt;
  let approved: CheckedEvmRoute['approval'] = null;
  try {
    await evm.ensureChain(chainId);
    if (checked.approval) {
      const a = checked.approval;
      i.onStep(step, 'wait');
      // a token that refuses an approve over a live allowance has it cleared first, each receipt awaited
      for (const amount of a.resetFirst ? [0n, a.amount] : [a.amount]) {
        i.onApproval?.(step, 'wallet');
        const hash = await evm.sendTransaction({
          chainId, to: a.token, value: 0n,
          data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [a.spender, amount] }),
        });
        i.onApproval?.(step, 'network');
        if ((await evm.waitForReceipt(chainId, hash)) !== 'success') { i.onStep(step, 'fail'); return failed('The approval did not go through. Try again.'); }
      }
      approved = a;
      i.onStep(step++, 'done');
    }
    i.onStep(step, 'wait');
    const nowSec = Math.floor(d.nowMs() / 1000);
    if (checked.deadline < BigInt(nowSec + FRESH_BELOW_S)) {
      if (!refresh && checked.deadline < BigInt(nowSec + MIN_SEND_S)) { i.onStep(step, 'fail'); return failed(EXPIRED); }
      if (refresh) {
        const fresh = await refresh();
        if ('kind' in fresh) {
          if (fresh.kind !== 'newPrice') i.onStep(step, 'fail');
          return fresh;
        }
        // an approval this run did not make, or the other path, is a wallet step the review never showed: back to it, nothing sent
        if ((fresh.checked.approval && !covered(approved, fresh.checked.approval)) || !!fresh.checked.permit2Pay !== !!checked.permit2Pay) return { kind: 'stepsChanged', quote: fresh.quote, option: fresh.option };
        checked = fresh.checked;
      }
    }
    const deadline = Number(checked.deadline);
    if (checked.sign) {
      const sigs: Hex[] = [];
      for (const td of checked.sign.typedData) sigs.push(await evm.signTypedData(td));
      const a = checked.sign.auth;
      const body: GaslessSubmit = {
        orderId: checked.orderId,
        auth: { door: a.door, validAfter: a.validAfter, validBefore: a.validBefore, nonce: a.nonce, deadline: a.deadline, signature: sigs[0]!, acceptance: checked.sign.door === 'permit2612' ? sigs[1]! : '0x' },
        signedAt: d.nowMs(),
      };
      return await submit(i, d, body, step, deadline);
    }
    let tx = checked.tx!;
    if (checked.permit2Pay) {
      const p = checked.permit2Pay;
      // Permit2 reads a signature by the payer's code as it is now, and an approve went out since it was read
      if (approved) {
        const stop = await payerStop(evm, chainId);
        if (stop) return stop;
      }
      let answer: Hex;
      try {
        answer = await evm.signTypedData(p.typedData);
      } catch (e) {
        if (isUnsupportedSign(e)) return { kind: 'noPermit2', wallet: true };
        throw e;
      }
      const signature = await evm.ownSignature(p.typedData, answer);
      if (!signature) return { kind: 'noPermit2', wallet: true };
      // the time spent in the wallet came off the order, and a fresh order would need a new signature: asked for on Review swap
      if (checked.deadline < BigInt(Math.floor(d.nowMs() / 1000) + MIN_SEND_S)) { i.onStep(step, 'fail'); return failed(EXPIRED); }
      i.onStep(step++, 'done');
      i.onStep(step, 'wait');
      tx = { to: tx.to, value: 0n, data: encodeFunctionData({ abi: SWAPIC_PERMIT2_ABI, functionName: 'runWithPermit2', args: [p.order as never, { nonce: p.nonce, deadline: p.deadline, signature }] }) };
    }
    const hash = await evm.sendTransaction({ chainId, to: tx.to, data: tx.data, value: tx.value });
    i.onSent?.(step, hash);
    const seen = await receiptBy(evm, d, chainId, hash, (deadline + RECEIPT_GRACE_S) * 1000);
    if (seen === 'success') { i.onStep(step, 'done'); return { kind: 'started', activityId: checked.orderId }; }
    // the chain could not be read at the end: the tracking decides, as for a gasless order
    if (seen === 'unknown') return { kind: 'started', activityId: checked.orderId, deadline };
    i.onStep(step, 'fail');
    return failed(seen === 'reverted' ? TX_REVERTED : TX_NOT_CONFIRMED);
  } catch (e) {
    if (isUserRejection(e)) return { kind: 'rejected' };
    i.onStep(step, 'fail');
    return failed(userMessage(e));
  }
}

/** The receipt, looked for until `untilMs`: `none` when the chain showed none by then, `unknown` when the last look
 *  failed. The signer's own limit is a little later, so this clock decides. */
async function receiptBy(evm: EvmSigner, d: ExecDeps, chainId: number, hash: Hex, untilMs: number): Promise<'success' | 'reverted' | 'none' | 'unknown'> {
  let lost = false;
  for (;;) {
    const left = untilMs - d.nowMs();
    if (left <= 0) return lost ? 'unknown' : 'none';
    try {
      const seen = await Promise.race([evm.waitForReceipt(chainId, hash, left + 5_000), d.sleep(left).then(() => null)]);
      return seen ?? 'none';
    } catch {
      lost = true;
      await d.sleep(Math.min(LOOK_AGAIN_MS, Math.max(0, untilMs - d.nowMs())));
    }
  }
}

async function submit(i: Pick<ExecInput, 'onStep'>, d: ExecDeps, body: GaslessSubmit, step: number, deadline: number): Promise<ExecOutcome> {
  try {
    await d.submitGasless(body);
    i.onStep(step, 'done');
    return { kind: 'started', activityId: body.orderId, deadline };
  } catch (e) {
    if (lostAnswer(e)) {
      return { kind: 'unknown', message: 'We could not reach Swapic. Try again: your signature is sent as it is.', resume: () => submit(i, d, body, step, deadline) };
    }
    i.onStep(step, 'fail');
    return failed(userMessage(e));
  }
}

async function runIcp(i: ExecInput, d: ExecDeps, quote: Quote, option: PickedOption, guard: GuardContext | undefined): Promise<ExecOutcome> {
  const caller = i.icpCaller;
  if (!caller) return failed('Connect wallet');
  let checked: CheckedIcp;
  let fee: bigint;
  try {
    fee = await d.icp.ledgerFee(i.from.address);
    // the route names its own door: a ck route never goes through the pool's check, nor the pool's through this one
    const check = option.route.icpCkSwap ? verifyIcpCkSwap : verifyIcpSwap;
    checked = check({
      route: option.route, fromLedger: i.from.address, amountIn: i.amountIn, ledgerFee: fee,
      recipientEvm: i.recipient as Hex, toToken: i.to.address, toChainId: chainKind(quote.toChain)?.kind === 'evm' ? evmId(quote.toChain) : 0,
      ...(quote.toChain === SOLANA_CHAIN ? { recipientSolana: i.recipient } : {}),
      canisterId: config.swapicCanisterId, guard, nowNs: BigInt(d.nowMs()) * 1_000_000n,
    });
  } catch (e) {
    return guardFailure(e);
  }
  // validate before any canister call: it counts calls before it validates (5 a minute)
  const balance = await d.icp.balance(checked.ledger, caller.principal);
  if (balance < checked.amountIn + 2n * fee) return failed('Your wallet does not hold enough for this and its fees');
  try {
    i.onStep(0, 'wait');
    const allowance = await d.icp.allowance(checked.ledger, caller.principal);
    if (allowance !== checked.approveAmount) await d.icp.approve(caller, checked.ledger, checked.approveAmount);
    i.onStep(0, 'done');
  } catch (e) {
    if (isUserRejection(e)) return { kind: 'rejected' };
    i.onStep(0, 'fail');
    return failed(e instanceof PoolErrorFailure ? poolErrorMessage(e.err) : userMessage(e));
  }
  return callSwap(i, d, caller, checked);
}

async function callSwap(i: ExecInput, d: ExecDeps, caller: IcpCaller, checked: CheckedIcp): Promise<ExecOutcome> {
  // the ledger's own record before the call: a pull always takes amount_in + fee out of this balance
  const before = await d.icp.balance(checked.ledger, caller.principal).catch(() => null);
  const sentAtMs = d.nowMs();
  try {
    i.onStep(1, 'wait');
    const ok = checked.door === 'ck' ? await d.icp.swapFromIcpCk(caller, checked.terms) : await d.icp.swapFromIcp(caller, checked.terms);
    i.onStep(1, 'done');
    return { kind: 'started', activityId: `payout-${ok.id}` };
  } catch (e) {
    if (isUserRejection(e)) return { kind: 'rejected' };
    if (e instanceof PoolErrorFailure) { i.onStep(1, 'fail'); return failed(poolErrorMessage(e.err)); }
    return afterLostSwap(i, d, caller, checked, before, sentAtMs);
  }
}

const CANNOT_TELL: ExecOutcome = { kind: 'unknown', message: 'We cannot tell yet whether your swap started. Check History before you try again.', resume: null };

/** M4: the answer was lost. The balance (the pull's own record) and the canister's payout record decide, never the allowance alone. */
async function afterLostSwap(i: ExecInput, d: ExecDeps, caller: IcpCaller, checked: CheckedIcp, before: bigint | null, sentAtMs: number): Promise<ExecOutcome> {
  if (before === null) return CANNOT_TELL;
  i.onNote?.('We could not reach Swapic. Checking whether your swap started; this can take up to 6 minutes.');
  const seen = await settleLost(async () => {
    const now = await d.icp.balance(checked.ledger, caller.principal);
    return now + checked.amountIn <= before ? 'done' : now === before ? 'nothing' : 'unclear';
  }, d, d.nowMs());
  if (seen === 'done') {
    i.onStep(1, 'done');
    const id = await findPayout(i, d, caller, checked, sentAtMs).catch(() => null);
    return id === null ? { kind: 'unknown', message: 'Your swap started. It shows in History in a minute.', resume: null } : { kind: 'started', activityId: `payout-${id}` };
  }
  if (seen === 'nothing') {
    // the call can no longer run: nothing was taken
    const left = await d.icp.allowance(checked.ledger, caller.principal).catch(() => null);
    const timeLeft = checked.deadlineNs > BigInt(d.nowMs()) * 1_000_000n + 330_000_000_000n;
    if (left === checked.approveAmount && timeLeft) return { kind: 'unknown', message: 'Nothing was taken. Try again.', resume: () => callSwap(i, d, caller, checked) };
    i.onStep(1, 'fail');
    return failed('Nothing was taken. Get a new quote and try again.');
  }
  return CANNOT_TELL;
}

/** The payout the pull opened: History names it (one wallet lookup), the canister's own record confirms it is this swap. */
async function findPayout(i: ExecInput, d: ExecDeps, caller: IcpCaller, checked: CheckedIcp, sentAtMs: number): Promise<bigint | null> {
  const page = await d.getOrders([caller.principal.toText()]);
  for (const row of page.orders) {
    if (!row.id.startsWith('payout-') || row.createdAt < Math.floor(sentAtMs / 1000) - 60 || row.from.amount !== checked.amountIn.toString()) continue;
    const id = BigInt(row.id.slice('payout-'.length));
    const p = await d.icp.payout(id);
    if (p && 'IcpSwap' in p.kind && sameAddress(p.terms.recipient, i.recipient) && sameToken(p.terms.token_out, i.to.address) && p.terms.dst_chain === BigInt(i.to.chainId)) return id;
  }
  return null;
}

/** The review's "In your wallet" list, in the order of onStep indexes (review-screens.tsx:60-73). */
export function walletSteps(option: PickedOption, from: UiToken, amountIn: bigint, native: NativeCoin): { label: string; sub: string }[] {
  if (option.route.solana || from.chain_type === 'SOLANA') {
    // the wallet signs once, and Swapic sends it
    const sign = option.mode === 'gasless'
      ? { label: 'Sign in your wallet (no gas)', sub: 'Swapic sends it and pays the Solana fees' }
      : { label: 'Sign in your wallet', sub: 'You pay a small Solana network cost' };
    return [sign, { label: 'Swapic sends it', sub: 'It lands in a few seconds' }];
  }
  if (option.mode === 'icpPull') {
    return [
      { label: `Approve ${from.symbol}`, sub: `Lets Swapic take ${formatAmount(amountIn, from.decimals)} ${from.symbol} from your wallet` },
      { label: 'Confirm swap', sub: option.route.icpCkSwap ? `${networkFeeText(option)} comes out of the swap, and the ledger fees with it` : 'No gas, only a small ledger fee' },
    ];
  }
  // the one approve of Permit2, a wallet's first swap of this token (gasless, and You pay gas through Permit2)
  const once = (resetFirst?: boolean) => {
    const first = `Lets Swapic use your ${from.symbol}. Only the first time.`;
    return { label: `Approve ${from.symbol} (once, you pay gas)`, sub: resetFirst ? `${first} Your wallet asks twice: first it sets your ${from.symbol} approval to 0.` : first };
  };
  if (option.mode === 'gasless') {
    const sign = { label: 'Sign in your wallet (no gas)', sub: 'Swapic sends it and pays the gas' };
    const approval = option.route.sign?.approval;
    // before the named quote comes, the priced route's needsApproval says the same
    if (!approval && !option.route.needsApproval) return [sign];
    return [once(approval?.resetFirst), sign];
  }
  const g = gasText(option, native);
  const confirm = { label: 'Confirm swap (you pay gas)', sub: g.startsWith('~ ') ? `About ${g.slice(2).replace(', you pay it', '')}` : 'You pay the network fee' };
  const forThisSwap = `Lets Swapic use ${formatAmount(amountIn, from.decimals)} ${from.symbol} for this swap`;
  const permit2 = option.route.permit2Pay;
  if (permit2) {
    // through Permit2 (Jeff 2026-11-08): the maximum approve once per token, then a free signature for this amount on every swap
    const sign = { label: 'Sign in your wallet (no gas)', sub: forThisSwap };
    return permit2.approval ? [once(permit2.approval.resetFirst), sign, confirm] : [sign, confirm];
  }
  // the old path, a payer who cannot sign through Permit2 (a smart wallet) or a route with no such field: the exact amount
  // (Jeff 2026-11-06), so this step comes back on every swap
  const each = { label: `Approve ${from.symbol} (you pay gas)`, sub: forThisSwap };
  return option.route.approval ? [each, confirm] : [confirm];
}
