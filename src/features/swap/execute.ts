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
import { encodeFunctionData, erc20Abi, type Hex } from 'viem';
import { ApiError, userMessage, type GaslessSubmit, type Quote, type QuoteQuery, getOrders as getOrdersFn, getQuote as getQuoteFn, submitGasless as submitFn } from '@/lib/api';
import { config } from '@/config';
import { PoolErrorFailure, poolErrorMessage, type IcpCaller, type IcpClient } from '@/lib/icp';
import { chainNumber } from '@/lib/explorer';
import { captureFailure } from '@/lib/sentry';
import type { EvmSigner } from '@/lib/wallets';
// the rejection rules only: the @/lib/wallets barrel creates AppKit at import, which unit tests cannot load
import { isLostSignerAnswer, isUserRejection } from '@/lib/wallets/rejection';
import { AgentError, ErrorKindEnum, HttpErrorCode, TimeoutWaitingForResponseErrorCode } from '@icp-sdk/core/agent';
import type { UiToken } from '@/components/ui/token-types';
import { formatAmount } from '@/lib/money';
import { gasText, networkFeeText, type NativeCoin } from './view';
import { sameAddress, sameToken } from './guards/abi';
import { loadGuardContext, type GuardContext } from './guards/context';
import { routeOffered, verifyEvmRoute, type CheckedEvmRoute } from './guards/evm';
import { verifyIcpCkSwap, verifyIcpSwap, type CheckedIcp } from './guards/icp';
import { GuardError, GUARD_MESSAGE } from './guards/errors';
import { minOutOf, namedOption, type PickedOption, type RoutePick } from './options';
import { settleLost } from './lost';

export type ExecOutcome =
  | { kind: 'started'; activityId: string }
  | { kind: 'newPrice'; quote: Quote; option: PickedOption }
  | { kind: 'rejected' }
  | { kind: 'failed'; message: string }
  | { kind: 'unknown'; message: string; resume: (() => Promise<ExecOutcome>) | null };

export interface ExecDeps { getQuote: typeof getQuoteFn; getOrders: typeof getOrdersFn; submitGasless: typeof submitFn; icp: IcpClient; nowMs(): number; sleep(ms: number): Promise<void> }
export interface ExecInput {
  /** The ask naming the picked route (namedQueryOf), and that route as picked. */
  query: QuoteQuery; pick: RoutePick; shownMin: bigint; amountIn: bigint;
  from: UiToken; to: UiToken; recipient: string;
  evm: EvmSigner | null; icpCaller: IcpCaller | null;
  onStep(index: number, state: 'wait' | 'done' | 'fail'): void;
  onNote?(text: string): void;
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

export async function executeSwap(i: ExecInput, d: ExecDeps): Promise<ExecOutcome> {
  let quote: Quote;
  let guard: GuardContext | undefined;
  try {
    // the quote and the canister's anchors, both fresh; anchors that cannot be read leave the check to refuse
    [quote, guard] = await Promise.all([d.getQuote(i.query), loadGuardContext(d.icp).catch(() => undefined)]);
  } catch (e) {
    return failed(userMessage(e));
  }
  const accept = (r: Parameters<typeof routeOffered>[1], mode: PickedOption['mode']) => routeOffered(quote, r, mode, { payer: i.query.payer, recipient: i.query.recipient, guard });
  const option = namedOption(quote, i.pick, accept);
  if (!option) return failed('No route found for this amount');
  const min = minOutOf(option);
  if (min < i.shownMin) return { kind: 'newPrice', quote, option };
  return option.mode === 'icpPull' ? runIcp(i, d, quote, option, guard) : runEvm(i, d, quote, option, guard);
}

async function runEvm(i: ExecInput, d: ExecDeps, quote: Quote, option: PickedOption, guard: GuardContext | undefined): Promise<ExecOutcome> {
  const evm = i.evm;
  if (!evm) return failed('Connect wallet');
  let checked: CheckedEvmRoute;
  try {
    checked = verifyEvmRoute({
      quote, route: option.route, mode: option.mode as 'gasless' | 'userPays', payer: evm.address, recipient: i.recipient,
      fromToken: i.from.address, toToken: i.to.address, amountIn: i.amountIn, guard, nowSec: Math.floor(d.nowMs() / 1000),
    });
  } catch (e) {
    return guardFailure(e);
  }
  return sendCheckedEvm(checked, evm, d, i);
}

/** Signs and sends a route that passed verifyEvmRoute in this run (the swap's and the stake's, plan 3 Task 4). */
export async function sendCheckedEvm(checked: CheckedEvmRoute, evm: EvmSigner, d: ExecDeps, i: Pick<ExecInput, 'onStep'>): Promise<ExecOutcome> {
  const chainId = checked.chainId;
  let step = 0;
  try {
    await evm.ensureChain(chainId);
    if (checked.approval) {
      i.onStep(step, 'wait');
      const hash = await evm.sendTransaction({
        chainId, to: checked.approval.token, value: 0n,
        data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [checked.approval.spender, checked.approval.amount] }),
      });
      if ((await evm.waitForReceipt(chainId, hash)) !== 'success') { i.onStep(step, 'fail'); return failed('The approval did not go through. Try again.'); }
      i.onStep(step++, 'done');
    }
    i.onStep(step, 'wait');
    if (checked.sign) {
      const sigs: Hex[] = [];
      for (const td of checked.sign.typedData) sigs.push(await evm.signTypedData(td));
      const a = checked.sign.auth;
      const body: GaslessSubmit = {
        orderId: checked.orderId,
        auth: { door: a.door, validAfter: a.validAfter, validBefore: a.validBefore, nonce: a.nonce, deadline: a.deadline, signature: sigs[0]!, acceptance: checked.sign.door === 'permit2612' ? sigs[1]! : '0x' },
        signedAt: d.nowMs(),
      };
      return await submit(i, d, body, step);
    }
    await evm.sendTransaction({ chainId, to: checked.tx!.to, data: checked.tx!.data, value: checked.tx!.value });
    i.onStep(step, 'done');
    return { kind: 'started', activityId: checked.orderId };
  } catch (e) {
    if (isUserRejection(e)) return { kind: 'rejected' };
    i.onStep(step, 'fail');
    return failed(userMessage(e));
  }
}

async function submit(i: Pick<ExecInput, 'onStep'>, d: ExecDeps, body: GaslessSubmit, step: number): Promise<ExecOutcome> {
  try {
    await d.submitGasless(body);
    i.onStep(step, 'done');
    return { kind: 'started', activityId: body.orderId };
  } catch (e) {
    if (lostAnswer(e)) {
      return { kind: 'unknown', message: 'We could not reach Swapic. Try again: your signature is sent as it is.', resume: () => submit(i, d, body, step) };
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
      recipientEvm: i.recipient as Hex, toToken: i.to.address, toChainId: chainNumber(quote.toChain),
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
  const once = { label: `Approve ${from.symbol} (once, you pay gas)`, sub: `Lets Swapic use your ${from.symbol}. Only the first time.` };
  if (option.mode === 'icpPull') {
    return [
      { label: `Approve ${from.symbol}`, sub: `Lets Swapic take ${formatAmount(amountIn, from.decimals)} ${from.symbol} from your wallet` },
      { label: 'Confirm swap', sub: option.route.icpCkSwap ? `${networkFeeText(option)} comes out of the swap, and the ledger fees with it` : 'No gas, only a small ledger fee' },
    ];
  }
  if (option.mode === 'gasless') {
    const sign = { label: 'Sign in your wallet (no gas)', sub: 'Swapic sends it and pays the gas' };
    return option.route.sign?.approval ? [once, sign] : [sign];
  }
  const g = gasText(option, native);
  const confirm = { label: 'Confirm swap (you pay gas)', sub: g.startsWith('~ ') ? `About ${g.slice(2).replace(', you pay it', '')}` : 'You pay the network fee' };
  return option.route.approval ? [once, confirm] : [confirm];
}
