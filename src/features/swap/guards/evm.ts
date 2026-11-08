// Design note (signing and sending on EVM, plan 2 Task 1). Only the values this function returns reach a wallet.
// Must never happen: an order signed or sent that runs a step the person cannot see (a call to any contract with the
// Runner's money, a fixed transfer to anyone but the canister, a CCTP burn minted to someone other than the arrival the
// plan names, a ck deposit into anything but the helper the canister names or for any account but the one shown, an Eco intent a foreign prover can claim or whose refund is locked far away, a swap paying anyone but the
// Runner); a pool route whose ref commits other terms than the ones on screen; a transaction to anything but the source
// chain's Swapic as the canister's get_config names it, or an approval to anyone but that Swapic (you pay gas, exactly the
// amount) or Permit2 (gasless, the maximum, on Permit2's door only); a signature over typed data for another chain, token, verifying contract, payer, amount, spender or
// order; an order whose payer, input or delivery differs from the screen; an anchor taken from the quoter itself
// (route.contracts, /v2/chains), or a signature made while get_config, get_flow_settings or evm_address cannot be read.
// How the design proves it: the order id is recomputed under the anchored Swapic and must equal route.orderId, the ABI
// order and the run(Order) calldata; every step is read as the canister's read_plan reads it (plan.ts: decoded strictly,
// rebuilt with the Runner's amounts at zero, compared byte for byte, writes exactly its shape's); the delivery read from
// the plan must be the screen's; a pool ref is recomputed with the canister's formula; gasless typed data is rebuilt here
// per door and must equal the quoter's field by field; tx.to, tx.value and an approval's spender are anchored; the
// order deadline is at least 30 s ahead. Tests: evm.test.ts and abi.test.ts, one tamper test per rule on real orders.
// Pool deposit terms (the order memo, the canister's interface 47a36c9). Must never happen: a deposit credited to terms the
// screen does not show (another owner or recipient, another token out, a lower least out, a bigger move fee); a deposit
// held by the canister because its memo asks for more USDC than the route delivers (min_usdc above the delivery), or
// because its move fee eats it; terms riding on an order that is not a pool deposit. How the design proves it: the terms
// are read from the order's own memo, never from the quoter's `pool` JSON: keccak256(memo) must be the order's ref (the
// ref the canister checks the arrival against), the memo decodes strictly as the canister decodes it (memo.ts), its kind
// is the screen's (a stake only with stakeOwner), a stake's owner is the paying EVM address, a swap's recipient is the
// shown principal with no subaccount, its token out the shown ledger and its least out the route's amountOutMin; min_usdc
// is at most the least USDC the plan delivers to the canister's own Base address, and a stake's move fee below it; any
// other order carries an empty memo. The memo is inside the EIP-712 struct hash, so the order id recomputed here binds it.
// Tests: memo.test.ts (the golden memos) and the pool tests in evm.test.ts.
// You pay gas through Permit2 (Jeff 2026-11-08). Must never happen: a signature over anything but this order's exact input to
// this chain's Swapic under Permit2's domain on this chain, or one that outlives the order; an approval of Permit2 for
// another token or below the maximum, the exact approval of Swapic sent on this path or the maximum of Permit2 on the other
// (two approvals for one swap); the transaction's order differing from the one checked. How the design proves it: the typed data
// is rebuilt here by the gasless Permit2 door's own builder from the order id, this chain and the anchored Swapic, with the
// field's nonce and the order's deadline, and must equal the quoter's field by field (an `owner`, or any other extra
// field, is refused; the owner is the order's payer, the witness binds it, and runWithPermit2 takes only msg.sender as the
// payer); what is signed is the rebuilt one; each path's approval is checked by its own rule and only the chosen path's is
// returned; run(order) stays checked in `tx`, and the order checked comes back for the calldata (execute.ts encodes it).
// A stake and a native input never take this path. Tests: the Permit2 tests in evm.test.ts, one per tampered field.
import { decodeAbiParameters, decodeFunctionData, getAddress, maxUint256, type Hex } from 'viem';
import type { ApprovalRequest, Authorization, Door, Quote, Route, TypedDataJson } from '@/lib/api';
import type { SignableTypedData } from '@/lib/wallets';
import { chainNumber } from '@/lib/explorer';
import { ORDER_TUPLE, PERMIT2, SWAPIC_RUN_ABI, isNative, orderIdOf, orderValue, sameAddress, sameToken, type OrderValue } from './abi';
import type { GuardContext } from './context';
import { decodeEnvelope, principalWord, sameEnvelope } from './envelope';
import { GuardError, must } from './errors';
import { decodeMemo, memoRef, type MemoTerms } from './memo';
import { readPlan, type Plan } from './plan';

export interface EvmCheckInput {
  quote: Quote; route: Route; mode: 'gasless' | 'userPays';
  payer: Hex; recipient: string; fromToken: string; toToken: string; amountIn: bigint;
  guard: GuardContext | undefined; nowSec: number;
  /** A stake into the pool (plan 3 Task 4): the owner the pool terms must name, the payer itself. */
  stakeOwner?: string;
}
export interface CheckedEvmRoute {
  chainId: number; orderId: Hex; amountIn: bigint; minOut: bigint; plan: Plan;
  /** The order's deadline, unix seconds: Swapic refuses to run it after this (Swapic.sol _open). */
  deadline: bigint;
  /** A pool deposit's terms, read from the order's memo and bound to its ref; null for any other order. */
  terms: MemoTerms | null;
  approval: { token: Hex; spender: Hex; amount: bigint; resetFirst: boolean } | null;
  sign: { door: Door; typedData: SignableTypedData[]; auth: Authorization } | null;
  tx: { to: Hex; data: Hex; value: bigint } | null;
  /** You pay gas through Permit2: what the wallet signs and the order the transaction carries, to `tx.to`, instead of `tx`.
   *  `approval` is then this path's, the maximum to Permit2 (Jeff 2026-11-08). */
  permit2Pay: { typedData: SignableTypedData; nonce: bigint; deadline: bigint; order: OrderValue } | null;
}

const lower = (h: string) => h.toLowerCase();
const isEvmAddress = (s: string) => /^0x[0-9a-fA-F]{40}$/.test(s);
const MIN_LIFE_S = 30;

export function verifyEvmRoute(i: EvmCheckInput): CheckedEvmRoute {
  const { quote: q, route: r } = i;
  must(!!i.guard, 'noAnchor');
  const g = i.guard!;
  must(r.executable && !!r.order && !!r.orderId, 'notExecutable');
  const chainId = chainNumber(q.fromChain);
  must(chainId > 0, 'notEvm');
  const anchor = g.config.chains.get(chainId);
  must(!!anchor, 'noAnchor');
  const swapic = getAddress(anchor!.swapic);

  // what the screen shows is what the quote is for
  must(sameToken(q.fromToken.address, i.fromToken) && sameToken(q.toToken.address, i.toToken), 'tokens');
  must(BigInt(q.amountIn) === i.amountIn, 'amountIn');

  // the order, and its id recomputed under the anchored Swapic
  const o = orderValue(r.order!);
  const id = orderIdOf(o, chainId, swapic);
  must(id === lower(r.orderId!), 'orderId');
  must(sameAddress(o.payer, i.payer), 'payer');
  must(sameToken(o.tokenIn, i.fromToken), 'tokenIn');
  must(o.amountIn === i.amountIn, 'amountIn');
  must(o.deadline > BigInt(i.nowSec + MIN_LIFE_S), 'expired');
  let abiOrder: OrderValue;
  try { abiOrder = decodeAbiParameters([ORDER_TUPLE], r.order!.abi as Hex)[0] as OrderValue; } catch { throw new GuardError('orderAbi'); }
  must(orderIdOf(abiOrder, chainId, swapic) === id, 'orderAbi');

  // every step as the canister reads it, then where the money ends, against the screen
  const plan = readPlan(o, { ...g, sourceChainId: chainId, payer: getAddress(i.payer), orderDeadline: o.deadline, nowSec: i.nowSec });
  const minOut = BigInt(r.amountOutMin);
  const terms = checkDelivery(i, r, o, plan, minOut, g);

  if (i.mode === 'gasless') {
    must(!!r.sign && !r.tx, 'gaslessShape');
    return { chainId, orderId: id, amountIn: i.amountIn, minOut, plan, deadline: o.deadline, terms, approval: gaslessApproval(i, r), sign: checkSign(i, r, o, id, chainId, swapic), tx: null, permit2Pay: null };
  }
  must(!!r.tx && !r.sign, 'userPaysShape');
  // both ways are checked whichever one runs; only the chosen one's approval goes on
  const tx = checkTx(i, r, id, chainId, swapic);
  const exact = swapicApproval(i, r, swapic);
  const viaPermit2 = r.permit2Pay && !i.stakeOwner && !isNative(i.fromToken) ? checkPermit2Pay(i, r.permit2Pay, o, id, chainId, swapic) : null;
  return { chainId, orderId: id, amountIn: i.amountIn, minOut, plan, deadline: o.deadline, terms, approval: viaPermit2 ? viaPermit2.approval : exact, sign: null, tx, permit2Pay: viaPermit2 && viaPermit2.pay };
}

/** Whether a quoted route may be a card (lead's call, 2026-10-28: decode, or do not offer). With a wallet, a recipient and the
 *  canister's anchors, an EVM route must pass the whole check as of its own quote time; ICP routes are checked by Task 2 before
 *  signing, and the canister reads every step of their plan. The full check runs again on a fresh quote before anything is signed. */
export function routeOffered(q: Quote, r: Route, mode: 'gasless' | 'userPays' | 'icpPull', who: { payer?: string; recipient?: string; guard?: GuardContext }): boolean {
  if (mode === 'icpPull' || !r.executable || !r.order || !who.payer || !who.recipient || !who.guard || !isEvmAddress(who.payer)) return true;
  try {
    verifyEvmRoute({
      quote: q, route: r, mode, payer: who.payer as Hex, recipient: who.recipient, fromToken: q.fromToken.address, toToken: q.toToken.address,
      amountIn: BigInt(q.amountIn), guard: who.guard, nowSec: q.quotedAt,
    });
    return true;
  } catch {
    // a refused check, or an answer that cannot even be parsed (a bad number, a bad address): not a card either way,
    // and never a crash of the panel; the check at signing time reports to Sentry (Task 7)
    return false;
  }
}

function checkDelivery(i: EvmCheckInput, r: Route, o: OrderValue, plan: Plan, minOut: bigint, g: GuardContext): MemoTerms | null {
  if (r.envelope) {
    // the quoter's decoded envelope, when it answers one, is the plan's own, word for word
    const j = r.envelope;
    const e = decodeEnvelope(j.hex as Hex);
    must(!!plan.envelope && sameEnvelope(e, plan.envelope) && e.action === j.action && sameAddress(e.recipient, j.recipient)
      && sameToken(e.tokenOut, j.tokenOut) && e.minOut === BigInt(j.minOut) && e.ref === lower(j.ref), 'envelopeJson');
  }
  if (r.pool || i.stakeOwner || o.memo !== '0x') {
    // into the pool: the order's memo is the deposit's terms, its keccak the ref the canister checks, its terms the screen's
    must(o.memo !== '0x' && memoRef(o.memo) === lower(o.ref), 'poolRef');
    const t = decodeMemo(o.memo);
    if (t.kind === 'stake') {
      must(!!i.stakeOwner && 'evm' in t.owner && sameAddress(t.owner.evm, i.stakeOwner) && sameAddress(i.stakeOwner, i.payer), 'stakeOwner');
    } else {
      must(!i.stakeOwner && t.recipient.subaccount === null && t.recipient.owner === i.recipient, 'recipient');
      must(t.tokenOut === i.toToken, 'tokenOut');
      must(t.minOut === minOut, 'minOut');
    }
    // the USDC reaches the canister's own address on the pool chain, in that chain's USDC
    const pool = g.config.poolChain;
    const d = plan.delivery;
    must(!!g.canisterEvm && pool !== null && !!d && d.chainId === pool && sameAddress(d.recipient, g.canisterEvm) && sameAddress(d.token, g.config.chains.get(pool)?.usdc), 'poolDelivery');
    // an arrival under min_usdc, or eaten by the move fee, would be held, not credited
    must(t.minUsdc > 0n && t.minUsdc <= d!.minOut, 'poolLeast');
    if (t.kind === 'stake') must(t.moveFee < t.minUsdc, 'moveFee');
    return t;
  }
  if (plan.ck) {
    // into the ck helper on this chain, nothing delivered beside it: the whole account, and at least what the screen shows
    must(!i.recipient.includes('.') && plan.ck.principal === principalWord(i.recipient).toLowerCase() && /^0x0{64}$/i.test(plan.ck.subaccount), 'recipient');
    must(plan.ck.min >= minOut, 'minOut');
    return null;
  }
  if (plan.envelope?.action === 'ckDeposit') {
    // the whole account: the shown principal, and no subaccount (the app only takes a principal, plan 1 Task 2)
    const e = plan.envelope;
    must(!i.recipient.includes('.') && e.principal === principalWord(i.recipient) && /^0x0{64}$/i.test(e.subaccount), 'recipient');
    must(sameAddress(e.recipient, i.payer), 'refundReceiver');
    return null;
  }
  const d = plan.delivery;
  must(!!d, 'noDelivery');
  must(d!.chainId === chainNumber(i.quote.toChain), 'toChain');
  must(isEvmAddress(i.recipient) && sameAddress(d!.recipient, i.recipient), 'recipient');
  must(sameToken(d!.token, i.toToken), 'tokenOut');
  must(d!.minOut >= minOut, 'minOut');
  return null;
}

const str = (v: unknown) => (typeof v === 'number' || typeof v === 'bigint' ? v.toString() : String(v));

/** The quoter's typed data must equal the one rebuilt here, field by field. */
function equalTyped(theirs: TypedDataJson, mine: SignableTypedData): boolean {
  if (theirs.primaryType !== mine.primaryType) return false;
  const d = theirs.domain as Record<string, unknown>;
  for (const [k, v] of Object.entries(mine.domain)) if (lower(str(d[k])) !== lower(str(v))) return false;
  if (Object.keys(d).length !== Object.keys(mine.domain).length) return false;
  const flat = (x: unknown, p = ''): [string, string][] =>
    x !== null && typeof x === 'object' ? Object.entries(x as object).flatMap(([k, v]) => flat(v, `${p}.${k}`)) : [[p, lower(str(x))]];
  const a = Object.fromEntries(flat(theirs.message));
  const b = Object.fromEntries(flat(mine.message));
  return Object.keys(a).length === Object.keys(b).length && Object.entries(b).every(([k, v]) => a[k] === v);
}

/** The gasless doors' typed data, as the contracts verify them (golden interface.json `doors`). */
export const doorTypedData = {
  auth3009(t: { tokenName?: string; tokenVersion?: string; chainId: number; token: Hex; payer: Hex; swapic: Hex; amountIn: bigint; deadline: bigint; orderId: Hex }): SignableTypedData {
    return {
      domain: { name: t.tokenName, version: t.tokenVersion, chainId: t.chainId, verifyingContract: t.token },
      types: { ReceiveWithAuthorization: [
        { name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' }, { name: 'validBefore', type: 'uint256' }, { name: 'nonce', type: 'bytes32' },
      ] },
      primaryType: 'ReceiveWithAuthorization',
      message: { from: t.payer, to: t.swapic, value: t.amountIn, validAfter: 0n, validBefore: t.deadline, nonce: t.orderId },
    };
  },
  permit2(t: { chainId: number; token: Hex; swapic: Hex; amountIn: bigint; nonce: bigint; deadline: bigint; orderId: Hex }): SignableTypedData {
    return {
      domain: { name: 'Permit2', chainId: t.chainId, verifyingContract: PERMIT2 },
      types: {
        PermitWitnessTransferFrom: [
          { name: 'permitted', type: 'TokenPermissions' }, { name: 'spender', type: 'address' }, { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' }, { name: 'witness', type: 'OrderWitness' },
        ],
        TokenPermissions: [{ name: 'token', type: 'address' }, { name: 'amount', type: 'uint256' }],
        OrderWitness: [{ name: 'orderId', type: 'bytes32' }],
      },
      primaryType: 'PermitWitnessTransferFrom',
      message: { permitted: { token: t.token, amount: t.amountIn }, spender: t.swapic, nonce: t.nonce, deadline: t.deadline, witness: { orderId: t.orderId } },
    };
  },
  acceptance(t: { chainId: number; token: Hex; payer: Hex; swapic: Hex; amountIn: bigint; deadline: bigint; orderId: Hex }): SignableTypedData {
    return {
      domain: { name: 'Swapic', version: '3', chainId: t.chainId, verifyingContract: t.swapic },
      types: { QuoteAcceptance: [
        { name: 'orderId', type: 'bytes32' }, { name: 'payer', type: 'address' }, { name: 'tokenIn', type: 'address' },
        { name: 'amountIn', type: 'uint256' }, { name: 'deadline', type: 'uint256' },
      ] },
      primaryType: 'QuoteAcceptance',
      message: { orderId: t.orderId, payer: t.payer, tokenIn: t.token, amountIn: t.amountIn, deadline: t.deadline },
    };
  },
};

function checkSign(i: EvmCheckInput, r: Route, o: OrderValue, id: Hex, chainId: number, swapic: Hex) {
  const s = r.sign!;
  must(s.door === s.auth.door, 'door');
  const td = s.typedData;
  const token = getAddress(i.fromToken);
  const payer = getAddress(i.payer);
  let mine: SignableTypedData[];
  if (s.door === 'auth3009') {
    must(td.length === 1 && s.auth.nonce === BigInt(id).toString() && s.auth.validBefore === o.deadline.toString(), 'typedData');
    mine = [doorTypedData.auth3009({ tokenName: td[0]!.domain.name, tokenVersion: td[0]!.domain.version, chainId, token, payer, swapic, amountIn: i.amountIn, deadline: o.deadline, orderId: id })];
  } else if (s.door === 'permit2612') {
    must(td.length === 2, 'typedData');
    mine = [
      {
        domain: { name: td[0]!.domain.name, version: td[0]!.domain.version, chainId, verifyingContract: token },
        types: { Permit: [
          { name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' },
          { name: 'nonce', type: 'uint256' }, { name: 'deadline', type: 'uint256' },
        ] },
        primaryType: 'Permit',
        // the token's own nonce cannot be read here; a wrong one only makes the permit fail (Swapic.sol:139-141 swallows it)
        message: { owner: payer, spender: swapic, value: i.amountIn, nonce: BigInt(str((td[0]!.message as { nonce: unknown }).nonce)), deadline: o.deadline },
      },
      doorTypedData.acceptance({ chainId, token, payer, swapic, amountIn: i.amountIn, deadline: o.deadline, orderId: id }),
    ];
  } else {
    must(td.length === 1, 'typedData');
    mine = [doorTypedData.permit2({ chainId, token, swapic, amountIn: i.amountIn, nonce: BigInt(s.auth.nonce), deadline: BigInt(s.auth.deadline), orderId: id })];
  }
  must(td.every((t, k) => equalTyped(t, mine[k]!)), 'typedData');
  return { door: s.door, typedData: mine, auth: s.auth };
}

/** An approval only ever to Permit2, for the token paid. */
function permit2Approval(i: EvmCheckInput, a: ApprovalRequest) {
  must(sameAddress(a.spender, PERMIT2) && sameToken(a.token, i.fromToken), 'approvalSpender');
  return { token: getAddress(a.token), spender: PERMIT2 as Hex, amount: BigInt(a.amount), resetFirst: a.resetFirst === true };
}

function gaslessApproval(i: EvmCheckInput, r: Route) {
  const a = r.sign!.approval;
  if (!a) return null;
  must(r.sign!.door === 'permit2', 'approvalSpender');
  const checked = permit2Approval(i, a);
  // the maximum (Jeff 2026-11-06); the exact amount still passes, so the app and the quoter can deploy in either order
  must(checked.amount === maxUint256 || checked.amount === i.amountIn, 'approvalAmount');
  return checked;
}

/** The field as the gasless Permit2 door's is checked: rebuilt from the order and the anchors, then equal field by field. */
function checkPermit2Pay(i: EvmCheckInput, p: NonNullable<Route['permit2Pay']>, o: OrderValue, id: Hex, chainId: number, swapic: Hex) {
  const nonce = BigInt(p.nonce);
  const deadline = BigInt(p.deadline);
  // valid exactly as long as the order it pays
  must(deadline === o.deadline, 'typedData');
  const typedData = doorTypedData.permit2({ chainId, token: getAddress(i.fromToken), swapic, amountIn: i.amountIn, nonce, deadline, orderId: id });
  must(equalTyped(p.typedData, typedData), 'typedData');
  const approval = p.approval ? permit2Approval(i, p.approval) : null;
  // always the maximum: this field never had a quoter that asked less, and "once" on screen must be true
  if (approval) must(approval.amount === maxUint256, 'approvalAmount');
  return { approval, pay: { typedData, nonce, deadline, order: o } };
}

function swapicApproval(i: EvmCheckInput, r: Route, swapic: Hex) {
  const a = r.approval;
  if (!a) return null;
  must(!isNative(i.fromToken), 'approvalOnNative');
  must(sameAddress(a.spender, swapic), 'approvalSpender');
  must(sameToken(a.token, i.fromToken) && BigInt(a.amount) === i.amountIn, 'approvalAmount');
  return { token: getAddress(a.token), spender: swapic, amount: i.amountIn, resetFirst: false };
}

function checkTx(i: EvmCheckInput, r: Route, id: Hex, chainId: number, swapic: Hex) {
  const t = r.tx!;
  must(sameAddress(t.to, swapic), 'txTo');
  must(t.chainId === i.quote.fromChain, 'txChain');
  must(BigInt(t.value) === (isNative(i.fromToken) ? i.amountIn : 0n), 'txValue');
  let decoded: OrderValue;
  try {
    decoded = decodeFunctionData({ abi: SWAPIC_RUN_ABI, data: t.data as Hex }).args[0] as OrderValue;
  } catch {
    throw new GuardError('txNotRun');
  }
  must(orderIdOf(decoded, chainId, swapic) === id, 'txOrder');
  return { to: swapic, data: t.data as Hex, value: BigInt(t.value) };
}
