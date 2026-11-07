// The pool's money flows. Design note (stake from ICP, plan 3 Task 5).
// Must never happen: an approval to anyone but the Swapic canister, or for more than amount + fee; a stake_icp whose owner
// is not the paying account (contract section 2: owner = Icp { owner: caller, subaccount: from_subaccount }); a call made
// before the pool is known open, the amount known under the room and the balance known to cover the amount and two fees
// (the canister counts the call against 5 a minute first); a second approval after a lost answer.
// How the design proves it: executeStakeIcp builds owner from the caller's own principal with no subaccount and
// from_subaccount empty; its move_fee is the one Review stake showed (the quoter's price, below the amount); it checks
// open, room and balance from fresh reads first; the approval is IcpClient.approve (spender
// fixed) for exactly amount + fee, reusing a live allowance of exactly that amount. After a lost answer (plan check M4) it
// judges from the records, never from the allowance alone: the caller's shares (pool_account) and ckUSDC balance read right
// before the call; then every 15 s (settleLost) shares grown or the balance down by the amount means the stake went in
// (landing); both unchanged reads as "nothing was taken" only after 6 minutes, then resume calls stake_icp again without
// approving if the exact allowance is still there; anything else says plainly it cannot tell, with no retry. Unavailable
// from the canister means its pull's answer was lost on its side: the screen shows the stake as pending and polls
// pool_account. A lost answer is anything but a PoolErrorFailure or a real "no" (isUserRejection: an ICP signer's closed
// channel, ICRC-25 4001, is a lost answer, never a no). Tests: flows.test.ts.
// Design note (withdraw on ICP, plan 3 Task 7).
// Must never happen: shares burned that the owner did not ask for; a payout to anyone but the caller; a retry after a lost
// answer that withdraws twice.
// How the design proves it: executeWithdrawIcp computes usdc and max_shares with planIcpWithdraw (all of it, or the amount
// with the quoter's 0.5% room, capped at the owned shares); to = the caller's default account, from empty (the caller's
// default account owns the shares, contract section 2); token_out = ckUSDC; move_fee the one Review withdrawal showed;
// min_out = usdc - move_fee - 2 * fee (the canister takes the move fee and every ledger fee out of usdc, can.did
// withdraw_icp). ShortShares: read account and pool again and retry once (spec 11).
// A lost answer is never retried (plan check M4): the owner's shares (pool_account) are read every 15 s with settleLost;
// fewer shares means it went through; the same shares read as "it did not go through" only after 6 minutes, when the call
// can no longer run; anything else says plainly it cannot tell. Unavailable with shares burned means the canister's timer
// finishes the payout, shown as started. The ICP side being short is refused, never queued (the canister answers Closed
// with its "pocket is short" reason, or a Ledger failure): "Not enough ckUSDC on ICP right now. Try a smaller amount or
// later." (Jeff, 2026-10-28). Tests: flows.test.ts.
// Design note (stake from EVM, plan 3 Task 4).
// Must never happen: the stake's shares minted to anyone but the paying wallet (Jeff's owner rule, contract section 2); an
// order whose memo commits other terms than the ones checked (another owner, another move fee: plan check C2);
// anything signed or sent without plan 2's checks, or with a step the canister would not read (plan check C1); a stake
// above the room under the cap started at all.
// How the design proves it: the stake quote is asked with owner = payer = the connected EVM address; verifyEvmRoute's stake
// branch (plan 2 Task 1) holds it: with stakeOwner set, the order's memo must hash to its ref and hold stake terms owned
// by the payer, its move fee below its least USDC, every step is read as the canister's read_plan reads it, and the plan
// must deliver the pool chain's USDC to the canister's own EVM address there (poolDelivery); the anchors are read fresh with
// loadGuardContext in the same run; the room tvlCap - totalAssets is checked before the quote (StakePanel), and an amount
// over it never reaches a wallet; the signing and sending is plan 2's sendCheckedEvm, unchanged. Tests: the stake tests in
// src/features/swap/guards/evm.test.ts, on a real Base order made into a stake with its ref recomputed (plan 2's forge).
// Design note (sending the withdrawal, plan 3 Task 6).
// Must never happen: a record sent that differs from the one signed; a payout in anything but the destination chain's USDC
// as the canister names it; a fresh quote or nonce sent after a lost answer (a second withdrawal); a withdrawal started
// while the pool is closed.
// How the design proves it: executeWithdrawEvm reads get_config in the same run and asks the quote for, and checks it
// against, cfg.chains.get(dst).usdc (plan check C4; the Receive on list from /v2/chains only names the chain); it signs
// checked.typedData (withdraw-sig.ts) and sends checked.candid with the normalized signature to withdraw_evm from the
// anonymous agent (the signature proves the staker); the nonce goes into usedNonces right after the signature; on a lost
// answer (anything but a PoolErrorFailure) it posts { withdrawal: checked.record, signature } to POST /v2/withdraw once (the
// same record and signature; the canister takes one nonce per staker once, so if the first call landed this one is
// refused and nothing doubles); a refused from the watcher after a lost canister answer says "Your withdrawal may have gone
// through. It shows in Your stake in a minute." ShortShares asks one new quote and one new signature, shown to the person
// (spec 11: retry once with fresh numbers). The wallet moves to the pool chain before signing (the domain names it).
import { bytesToHex } from 'viem';
import { ApiError, userMessage, type PoolAnswer, type Quote, type StakeQuote, type StakeRequest, postStakeQuote, postWithdraw as postWithdrawFn, postWithdrawQuote as postWithdrawQuoteFn } from '@/lib/api';
import { PoolErrorFailure, poolErrorMessage, stakeRoom as roomAfterCap, type IcpCaller, type IcpClient } from '@/lib/icp';
import { Principal } from '@icp-sdk/core/principal';
import { ICP_CHAIN } from '@/config';
import { chainNumber } from '@/lib/explorer';
import type { UiToken } from '@/components/ui/token-types';
import { formatUsd, formatUsdWhole, planIcpWithdraw } from '@/lib/money';
import { tokenAmountText } from '@/lib/copy/format';
import { captureFailure } from '@/lib/sentry';
import type { EvmSigner } from '@/lib/wallets';
// the rejection rules only: the @/lib/wallets barrel creates AppKit at import, which unit tests cannot load
import { isUserRejection } from '@/lib/wallets/rejection';
import { sendCheckedEvm, type ExecDeps, type ExecInput, type ExecOutcome } from '@/features/swap/execute';
import { verifyEvmRoute } from '@/features/swap/guards/evm';
import { loadGuardContext, type GuardContext } from '@/features/swap/guards/context';
import type { CheckedEvmRoute } from '@/features/swap/guards/evm';
import { GuardError, GUARD_MESSAGE } from '@/features/swap/guards/errors';
import type { PickedOption } from '@/features/swap/options';
import { etaText } from '@/features/swap/view';
import { checkWithdrawQuote, normalizeSignature, type CheckedWithdraw } from './withdraw-sig';
import type { usedNonces } from './used-nonces';
import { realClock, settleLost, type Clock } from '@/features/swap/lost';

/** The paused pool (lead's call, 2026-10-28, as the canister: stakes and withdrawals are both refused while closed). */
export const POOL_PAUSED = 'The pool is paused right now. Staking and withdrawing are off for now; your stake stays in the pool.';

export function stakeRoom(p: PoolAnswer): bigint {
  const room = BigInt(p.tvlCap) - BigInt(p.totalAssets);
  return room > 0n ? room : 0n;
}

/** The ckUSDC ledger (the pool's ICP side). */
export const CKUSDC = 'xevnm-gaaaa-aaaar-qafnq-cai';

/** Gasless when allowed, else the fastest you pay gas route; executable routes only. */
export function pickStakeOption(q: StakeQuote): PickedOption | undefined {
  const g = q.gasless.allowed ? q.gasless.routes.filter((r) => r.executable).sort((a, b) => a.rank - b.rank)[0] : undefined;
  if (g) return { key: `gasless:${g.routeId}`, tags: ['Gasless'], mode: 'gasless', route: g };
  const u = q.userPays.routes.filter((r) => r.executable).sort((a, b) => a.etaSeconds - b.etaSeconds)[0];
  return u ? { key: `userPays:${u.routeId}`, tags: ['Fastest'], mode: 'userPays', route: u } : undefined;
}

/** USDC in words, two decimals: "1.43 USDC". */
export const usdcText = (micro: bigint) => `${tokenAmountText(micro, 6, 'USDC')} USDC`;

/** A checked stake's numbers: Added to your stake is the least USDC the order delivers less the move fee its memo commits
 *  (shares are minted on the rest); the fee is the route's gas and carriers plus that move fee, one line in USDC. */
export function stakeView(o: PickedOption, checked: CheckedEvmRoute): { added: bigint; addedText: string; moveFee: bigint; feeText: string; readyText: string } {
  const moveFee = checked.terms?.kind === 'stake' ? checked.terms.moveFee : 0n;
  const added = checked.minOut > moveFee ? checked.minOut - moveFee : 0n;
  const f = o.route.fees;
  const fee = BigInt(f.network) + BigInt(f.bridge) + BigInt(f.platform) + moveFee;
  return { added, addedText: formatUsd(added).slice(1), moveFee, feeText: usdcText(fee), readyText: etaText(o.route.etaSeconds) };
}

/** The move fee an ICP stake (one ICP to Base move) or an ICP withdrawal (one Base to ICP move) pays Swapic, micro USDC,
 *  as the quoter prices it; null while it does not (the app then offers neither). */
export function icpMoveFee(pool: PoolAnswer | undefined, kind: 'stake' | 'withdraw'): bigint | null {
  const raw = kind === 'stake' ? pool?.moveFees?.icpToBase : pool?.moveFees?.baseToIcp;
  return typeof raw === 'string' && /^\d{1,30}$/.test(raw) ? BigInt(raw) : null;
}

/**
 * The stake route read as the canister reads it (verifyEvmRoute's stake branch, the owner and the payer the connected
 * address): Review stake draws its numbers and wallet steps from this, and executeStakeEvm signs only what it returns.
 * Throws GuardError.
 */
export function checkStakeRoute(i: { quote: StakeQuote; option: PickedOption; from: UiToken; amount: bigint; owner: `0x${string}`; guard: GuardContext | undefined; nowSec: number }): CheckedEvmRoute {
  return verifyEvmRoute({
    quote: asQuote(i.quote), route: i.option.route, mode: i.option.mode as 'gasless' | 'userPays', payer: i.owner, recipient: i.owner,
    fromToken: i.from.address, toToken: CKUSDC, amountIn: i.amount, guard: i.guard, nowSec: i.nowSec, stakeOwner: i.owner,
  });
}

/**
 * Stake's live check: the route read against the amount its own quote was asked for (the request), never the amount being
 * typed while a new quote is on its way, so a quote is never refused for an amount it was not asked for. Returns the
 * checked route or the plain sentence of why not.
 */
export function stakeCheckOf(i: { quote: StakeQuote; option: PickedOption; requested: StakeRequest; from: UiToken; guard: GuardContext | undefined; nowSec: number }):
  { checked: CheckedEvmRoute; error: null } | { checked: null; error: string } {
  try {
    const owner = i.requested.owner as `0x${string}`;
    return { checked: checkStakeRoute({ quote: i.quote, option: i.option, from: i.from, amount: BigInt(i.requested.amount), owner, guard: i.guard, nowSec: i.nowSec }), error: null };
  } catch (e) {
    return { checked: null, error: e instanceof GuardError ? GUARD_MESSAGE : userMessage(e) };
  }
}

/** The stake answer has no toChain/toToken (always into the pool, ckUSDC on ICP: api/mod.rs:563-564); the check reads them. */
const asQuote = (q: StakeQuote): Quote => ({ ...q, toChain: ICP_CHAIN, toToken: { address: CKUSDC, symbol: 'ckUSDC', decimals: 6, verified: true } });

export async function executeStakeEvm(
  i: {
    from: UiToken; amount: bigint; evm: EvmSigner; shownAdded: bigint; onStep(index: number, state: 'wait' | 'done' | 'fail'): void;
    /** Review stake showed an approval step (or not): a fresh route that differs comes back as new terms, never signed. */
    shownApproval?: boolean;
  } & Pick<ExecInput, 'onSent' | 'onApproval'>,
  d: ExecDeps & { postStakeQuote: typeof postStakeQuote },
): Promise<ExecOutcome> {
  let q: StakeQuote;
  try {
    q = await d.postStakeQuote({ fromChain: i.from.chain, fromToken: i.from.address, amount: i.amount.toString(), owner: i.evm.address, payer: i.evm.address });
  } catch (e) {
    return { kind: 'failed', message: userMessage(e) };
  }
  const option = pickStakeOption(q);
  if (!option) return { kind: 'failed', message: 'No route found for this amount' };
  try {
    // the canister's anchors, fresh (get_config, Eco's prover, its EVM address); every step read as the canister reads it
    const guard = await loadGuardContext(d.icp);
    const checked = checkStakeRoute({ quote: q, option, from: i.from, amount: i.amount, owner: i.evm.address, guard, nowSec: Math.floor(d.nowMs() / 1000) });
    // less added than shown, or other wallet steps than shown: new terms, never signed
    if (stakeView(option, checked).added < i.shownAdded) return { kind: 'newPrice', quote: asQuote(q), option };
    if (i.shownApproval !== undefined && !!checked.approval !== i.shownApproval) return { kind: 'newPrice', quote: asQuote(q), option };
    return await sendCheckedEvm(checked, i.evm, d, i);
  } catch (e) {
    if (e instanceof GuardError) { captureFailure(e, `guard:${e.rule}`); return { kind: 'failed', message: GUARD_MESSAGE }; }
    return { kind: 'failed', message: userMessage(e) };
  }
}

type IcpStakeInput = { amount: bigint; moveFee: bigint; caller: IcpCaller; onStep(index: number, state: 'wait' | 'done' | 'fail'): void };

export async function executeStakeIcp(i: IcpStakeInput, icp: IcpClient, clock: Clock = realClock): Promise<ExecOutcome | StakeLanding> {
  if (i.moveFee >= i.amount) return { kind: 'failed', message: 'Amount too small to cover the fee' };
  const [pool, fee] = await Promise.all([icp.poolState(), icp.ledgerFee(CKUSDC)]);
  if (!pool.open) return { kind: 'failed', message: POOL_PAUSED };
  const room = pool.tvlCap > pool.totalAssets ? pool.tvlCap - pool.totalAssets : 0n;
  if (i.amount > room) return { kind: 'failed', message: `You can stake up to ${formatUsdWhole(room)} right now` };
  if ((await icp.balance(CKUSDC, i.caller.principal)) < i.amount + 2n * fee) return { kind: 'failed', message: 'Your wallet does not hold enough for this and its fees' };
  const approveAmount = i.amount + fee;
  try {
    i.onStep(0, 'wait');
    if ((await icp.allowance(CKUSDC, i.caller.principal)) !== approveAmount) await icp.approve(i.caller, CKUSDC, approveAmount);
    i.onStep(0, 'done');
  } catch (e) {
    if (isUserRejection(e)) return { kind: 'rejected' };
    i.onStep(0, 'fail');
    return { kind: 'failed', message: userMessage(e) };
  }
  return callStake(i, icp, approveAmount, clock);
}

/** A stake whose pull answer was lost on the canister's side: it is on its way; `sharesBefore` is the owner's shares read
 *  right before the call (null when that read failed), so the screen checks it in only once pool_account shows more. */
export interface StakeLanding { kind: 'landing'; sharesBefore: bigint | null }

async function callStake(i: IcpStakeInput, icp: IcpClient, approveAmount: bigint, clock: Clock): Promise<ExecOutcome | StakeLanding> {
  // the records before the call: the canister's shares for this owner, the ledger's balance (a pull takes amount + fee)
  const owner = { Icp: { owner: i.caller.principal, subaccount: [] as [] } };
  const [sharesBefore, balanceBefore] = await Promise.all([
    icp.poolAccount(owner).then((a) => a.shares).catch(() => null),
    icp.balance(CKUSDC, i.caller.principal).catch(() => null),
  ]);
  try {
    i.onStep(1, 'wait');
    await icp.stakeIcp(i.caller, { owner: { Icp: { owner: i.caller.principal, subaccount: [] } }, from_subaccount: [], amount: i.amount, move_fee: i.moveFee });
    i.onStep(1, 'done');
    return { kind: 'started', activityId: 'stake' };
  } catch (e) {
    if (isUserRejection(e)) return { kind: 'rejected' };
    if (e instanceof PoolErrorFailure) {
      if ('Unavailable' in e.err) return { kind: 'landing', sharesBefore };
      i.onStep(1, 'fail');
      if ('AboveTvlCap' in e.err) return { kind: 'failed', message: `You can stake up to ${formatUsdWhole(roomAfterCap(e.err.AboveTvlCap, i.amount))} right now` };
      return { kind: 'failed', message: poolErrorMessage(e.err) };
    }
    // the answer was lost (plan check M4): the records decide; "nothing was taken" waits until the call can no longer run
    const cannotTell = { kind: 'unknown' as const, message: 'We cannot tell yet whether your stake went in. Check Your stake before you try again.', resume: null };
    if (sharesBefore === null || balanceBefore === null) return cannotTell;
    const seen = await settleLost(async () => {
      const [shares, balance] = await Promise.all([icp.poolAccount(owner).then((a) => a.shares), icp.balance(CKUSDC, i.caller.principal)]);
      if (shares > sharesBefore || balance + i.amount <= balanceBefore) return 'done';
      return shares === sharesBefore && balance === balanceBefore ? 'nothing' : 'unclear';
    }, clock, clock.nowMs());
    if (seen === 'done') return { kind: 'landing', sharesBefore };
    if (seen === 'unclear') return cannotTell;
    const left = await icp.allowance(CKUSDC, i.caller.principal).catch(() => null);
    if (left === approveAmount) return { kind: 'unknown', message: 'Nothing was taken. Try again.', resume: () => callStake(i, icp, approveAmount, clock) as Promise<ExecOutcome> };
    i.onStep(1, 'fail');
    return { kind: 'failed', message: 'Nothing was taken. Try again.' };
  }
}

export async function executeWithdrawIcp(
  i: { wanted: bigint; moveFee: bigint; caller: IcpCaller; onStep(index: number, state: 'wait' | 'done' | 'fail'): void },
  icp: IcpClient,
  clock: Clock = realClock,
  retried = false,
): Promise<ExecOutcome> {
  const [pool, fee] = await Promise.all([icp.poolState(), icp.ledgerFee(CKUSDC)]);
  if (!pool.open) return { kind: 'failed', message: POOL_PAUSED };
  const owner = { Icp: { owner: i.caller.principal, subaccount: [] as [] } };
  const holding = await icp.poolAccount(owner);
  if (holding.shares === 0n) return { kind: 'failed', message: 'This wallet holds no stake' };
  const plan = planIcpWithdraw(i.wanted, holding, pool.totalAssets, pool.totalShares);
  const costs = i.moveFee + 2n * fee;
  if (plan.usdc <= costs) return { kind: 'failed', message: 'Amount too small to cover the fee' };
  const minOut = plan.usdc - costs;
  try {
    i.onStep(0, 'wait');
    await icp.withdrawIcp(i.caller, { to: { owner: i.caller.principal, subaccount: [] }, from: [], usdc: plan.usdc, max_shares: plan.maxShares, min_out: minOut, token_out: Principal.fromText(CKUSDC), move_fee: i.moveFee });
    i.onStep(0, 'done');
    return { kind: 'started', activityId: 'withdraw' };
  } catch (e) {
    if (isUserRejection(e)) return { kind: 'rejected' };
    if (e instanceof PoolErrorFailure) {
      if ('ShortShares' in e.err && !retried) return executeWithdrawIcp(i, icp, clock, true);
      if ('Unavailable' in e.err) return { kind: 'started', activityId: 'withdraw' };
      i.onStep(0, 'fail');
      // the ICP side is short: the canister's Closed reason names it (pool/icp POCKET_SHORT), or its ledger call failed
      if ('Ledger' in e.err || ('Closed' in e.err && /short|free/i.test(e.err.Closed))) {
        return { kind: 'failed', message: 'Not enough ckUSDC on ICP right now. Try a smaller amount or later.' };
      }
      return { kind: 'failed', message: poolErrorMessage(e.err) };
    }
    // the answer was lost (plan check M4): the canister's shares decide; never retried by the app
    const seen = await settleLost(async () => {
      const now = (await icp.poolAccount(owner)).shares;
      return now < holding.shares ? 'done' : now === holding.shares ? 'nothing' : 'unclear';
    }, clock, clock.nowMs());
    if (seen === 'done') return { kind: 'started', activityId: 'withdraw' };
    if (seen === 'nothing') { i.onStep(0, 'fail'); return { kind: 'failed', message: 'Your withdrawal did not go through. Nothing changed. Try again.' }; }
    return { kind: 'unknown', message: 'We cannot tell yet whether your withdrawal went through. Check Your stake before you try again.', resume: null };
  }
}

type WithdrawDeps = { icp: IcpClient; postWithdrawQuote: typeof postWithdrawQuoteFn; postWithdraw: typeof postWithdrawFn; nowMs(): number; used: typeof usedNonces };

/** The fresh record pays less than Review withdrawal showed: nothing was signed; the review shows these terms instead. */
export interface WithdrawNewTerms { kind: 'newTerms'; checked: CheckedWithdraw }

export async function executeWithdrawEvm(
  i: {
    usdc: bigint; dstChain: string; evm: EvmSigner; onStep(index: number, state: 'wait' | 'done' | 'fail'): void;
    /** The least the review showed (the checked record's minOut): a fresh record under it is never signed. */
    shownMinOut?: bigint;
  },
  d: WithdrawDeps,
  retried = false,
): Promise<ExecOutcome | WithdrawNewTerms> {
  const [pool, cfg] = await Promise.all([d.icp.poolState(), d.icp.getConfig()]);
  if (!pool.open) return { kind: 'failed', message: POOL_PAUSED };
  let checked: CheckedWithdraw;
  try {
    // the token is the canister's: the destination chain's USDC from get_config, never the quoter's chain list (plan check C4)
    const dstUsdc = cfg.chains.get(chainNumber(i.dstChain))?.usdc;
    if (!dstUsdc) throw new GuardError('noAnchor');
    const answer = await d.postWithdrawQuote({ staker: i.evm.address, usdc: i.usdc.toString(), dstChain: i.dstChain, recipient: i.evm.address, tokenOut: dstUsdc });
    checked = checkWithdrawQuote({
      answer, staker: i.evm.address, usdc: i.usdc, dstChainId: chainNumber(i.dstChain), dstUsdc,
      poolChain: cfg.poolChain, swapic: cfg.poolChain === null ? undefined : cfg.chains.get(cfg.poolChain)?.swapic,
      totalAssets: pool.totalAssets, totalShares: pool.totalShares, nowSec: Math.floor(d.nowMs() / 1000), used: d.used.has,
    });
  } catch (e) {
    if (e instanceof GuardError) { captureFailure(e, `guard:${e.rule}`); return { kind: 'failed', message: GUARD_MESSAGE }; }
    return { kind: 'failed', message: userMessage(e) };
  }
  if (i.shownMinOut !== undefined && checked.minOut < i.shownMinOut) return { kind: 'newTerms', checked };
  let signature: Uint8Array;
  try {
    i.onStep(0, 'wait');
    await i.evm.ensureChain(cfg.poolChain!);
    signature = await normalizeSignature(await i.evm.signTypedData(checked.typedData), checked.typedData, i.evm.address);
    d.used.add(checked.record.nonce);
    i.onStep(0, 'done');
  } catch (e) {
    if (isUserRejection(e)) return { kind: 'rejected' };
    i.onStep(0, 'fail');
    return { kind: 'failed', message: e instanceof GuardError ? GUARD_MESSAGE : userMessage(e) };
  }
  try {
    const ok = await d.icp.withdrawEvm(checked.candid, signature);
    return { kind: 'started', activityId: `payout-${ok.id}` };
  } catch (e) {
    if (e instanceof PoolErrorFailure) {
      if ('ShortShares' in e.err && !retried) return executeWithdrawEvm(i, d, true);
      return { kind: 'failed', message: poolErrorMessage(e.err) };
    }
    // the canister did not answer: the watcher's door forwards the same record (same nonce: never a second withdrawal)
    try {
      const ok = await d.postWithdraw({ withdrawal: checked.record, signature: bytesToHex(signature) });
      return { kind: 'started', activityId: `payout-${ok.id}` };
    } catch (e2) {
      if (e2 instanceof ApiError && e2.code === 'refused') return { kind: 'unknown', message: 'Your withdrawal may have gone through. It shows in Your stake in a minute.', resume: null };
      return { kind: 'unknown', message: 'We could not reach Swapic. Check Your stake before trying again.', resume: null };
    }
  }
}
