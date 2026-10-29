// Design note (signing and sending on EVM, plan 2 Task 1). Only the values this function returns reach a wallet.
// Must never happen: an order signed or sent that runs a step the person cannot see (a call to any contract with the
// Runner's money, a fixed transfer to anyone but the canister, a CCTP burn minted to someone other than the arrival the
// plan names, an Eco intent a foreign prover can claim or whose refund is locked far away, a swap paying anyone but the
// Runner); a pool route whose ref commits other terms than the ones on screen; a transaction to anything but the source
// chain's Swapic as the canister's get_config names it, or an approval to anyone but that Swapic (you pay gas) or Permit2
// (gasless, once); a signature over typed data for another chain, token, verifying contract, payer, amount, spender or
// order; an order whose payer, input or delivery differs from the screen; an anchor taken from the quoter itself
// (route.contracts, /v2/chains), or a signature made while get_config, get_flow_settings or evm_address cannot be read.
// How the design proves it: the order id is recomputed under the anchored Swapic and must equal route.orderId, the ABI
// order and the run(Order) calldata; every step is read as the canister's read_plan reads it (plan.ts: decoded strictly,
// rebuilt with the Runner's amounts at zero, compared byte for byte, writes exactly its shape's); the delivery read from
// the plan must be the screen's; a pool ref is recomputed with the canister's formula; gasless typed data is rebuilt here
// per door and must equal the quoter's field by field; tx.to, tx.value and an approval's spender are anchored; the
// order deadline is at least 30 s ahead. Tests: evm.test.ts and abi.test.ts, one tamper test per rule on real orders.
import { decodeAbiParameters, decodeFunctionData, getAddress, type Hex } from 'viem';
import type { Authorization, Door, Quote, Route, TypedDataJson } from '@/lib/api';
import type { SignableTypedData } from '@/lib/wallets';
import { chainNumber } from '@/lib/explorer';
import { ORDER_TUPLE, PERMIT2, SWAPIC_RUN_ABI, isNative, orderIdOf, orderValue, poolRefOf, sameAddress, sameToken, type OrderValue } from './abi';
import type { GuardContext } from './context';
import { decodeEnvelope, principalWord, sameEnvelope } from './envelope';
import { GuardError, must } from './errors';
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
  approval: { token: Hex; spender: Hex; amount: bigint } | null;
  sign: { door: Door; typedData: SignableTypedData[]; auth: Authorization } | null;
  tx: { to: Hex; data: Hex; value: bigint } | null;
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
  checkDelivery(i, r, o, plan, minOut, g);

  if (i.mode === 'gasless') {
    must(!!r.sign && !r.tx, 'gaslessShape');
    return { chainId, orderId: id, amountIn: i.amountIn, minOut, plan, approval: permit2Approval(i, r), sign: checkSign(i, r, o, id, chainId, swapic), tx: null };
  }
  must(!!r.tx && !r.sign, 'userPaysShape');
  return { chainId, orderId: id, amountIn: i.amountIn, minOut, plan, approval: swapicApproval(i, r, swapic), sign: null, tx: checkTx(i, r, id, chainId, swapic) };
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

function checkDelivery(i: EvmCheckInput, r: Route, o: OrderValue, plan: Plan, minOut: bigint, g: GuardContext): void {
  if (r.envelope) {
    // the quoter's decoded envelope, when it answers one, is the plan's own, word for word
    const j = r.envelope;
    const e = decodeEnvelope(j.hex as Hex);
    must(!!plan.envelope && sameEnvelope(e, plan.envelope) && e.action === j.action && sameAddress(e.recipient, j.recipient)
      && sameToken(e.tokenOut, j.tokenOut) && e.minOut === BigInt(j.minOut) && e.ref === lower(j.ref), 'envelopeJson');
  }
  if (r.pool) {
    // into the pool: the ref commits these terms (plan check C2), and the terms are the screen's
    must(poolRefOf(r.pool) === lower(o.ref), 'poolRef');
    if (r.pool.kind === 'stake') {
      must(!!i.stakeOwner && lower(r.pool.account) === lower(i.stakeOwner) && sameAddress(i.stakeOwner, i.payer), 'stakeOwner');
    } else {
      must(!i.stakeOwner && r.pool.account === i.recipient, 'recipient');
      must(!!r.pool.tokenOut && r.pool.tokenOut === i.toToken, 'tokenOut');
      must(BigInt(r.pool.minOut ?? '-1') === minOut, 'minOut');
    }
    // the USDC reaches the canister's own address on the pool chain, in that chain's USDC
    const pool = g.config.poolChain;
    const d = plan.delivery;
    must(!!g.canisterEvm && pool !== null && !!d && d.chainId === pool && sameAddress(d.recipient, g.canisterEvm) && sameAddress(d.token, g.config.chains.get(pool)?.usdc), 'poolDelivery');
    return;
  }
  must(!i.stakeOwner, 'stakeOwner');
  if (plan.envelope?.action === 'ckDeposit') {
    // the whole account: the shown principal, and no subaccount (the app only takes a principal, plan 1 Task 2)
    const e = plan.envelope;
    must(!i.recipient.includes('.') && e.principal === principalWord(i.recipient) && /^0x0{64}$/i.test(e.subaccount), 'recipient');
    must(sameAddress(e.recipient, i.payer), 'refundReceiver');
    return;
  }
  const d = plan.delivery;
  must(!!d, 'noDelivery');
  must(d!.chainId === chainNumber(i.quote.toChain), 'toChain');
  must(isEvmAddress(i.recipient) && sameAddress(d!.recipient, i.recipient), 'recipient');
  must(sameToken(d!.token, i.toToken), 'tokenOut');
  must(d!.minOut >= minOut, 'minOut');
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

function checkSign(i: EvmCheckInput, r: Route, o: OrderValue, id: Hex, chainId: number, swapic: Hex) {
  const s = r.sign!;
  must(s.door === s.auth.door, 'door');
  const td = s.typedData;
  const token = getAddress(i.fromToken);
  let mine: SignableTypedData[];
  if (s.door === 'auth3009') {
    must(td.length === 1 && s.auth.nonce === BigInt(id).toString() && s.auth.validBefore === o.deadline.toString(), 'typedData');
    mine = [{
      domain: { name: td[0]!.domain.name, version: td[0]!.domain.version, chainId, verifyingContract: token },
      types: { ReceiveWithAuthorization: [
        { name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' }, { name: 'validBefore', type: 'uint256' }, { name: 'nonce', type: 'bytes32' },
      ] },
      primaryType: 'ReceiveWithAuthorization',
      message: { from: getAddress(i.payer), to: swapic, value: i.amountIn, validAfter: 0n, validBefore: o.deadline, nonce: id },
    }];
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
        message: { owner: getAddress(i.payer), spender: swapic, value: i.amountIn, nonce: BigInt(str((td[0]!.message as { nonce: unknown }).nonce)), deadline: o.deadline },
      },
      {
        domain: { name: 'Swapic', version: '3', chainId, verifyingContract: swapic },
        types: { QuoteAcceptance: [
          { name: 'orderId', type: 'bytes32' }, { name: 'payer', type: 'address' }, { name: 'tokenIn', type: 'address' },
          { name: 'amountIn', type: 'uint256' }, { name: 'deadline', type: 'uint256' },
        ] },
        primaryType: 'QuoteAcceptance',
        message: { orderId: id, payer: getAddress(i.payer), tokenIn: token, amountIn: i.amountIn, deadline: o.deadline },
      },
    ];
  } else {
    must(td.length === 1, 'typedData');
    mine = [{
      domain: { name: 'Permit2', chainId, verifyingContract: PERMIT2 },
      types: {
        PermitWitnessTransferFrom: [
          { name: 'permitted', type: 'TokenPermissions' }, { name: 'spender', type: 'address' }, { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' }, { name: 'witness', type: 'OrderWitness' },
        ],
        TokenPermissions: [{ name: 'token', type: 'address' }, { name: 'amount', type: 'uint256' }],
        OrderWitness: [{ name: 'orderId', type: 'bytes32' }],
      },
      primaryType: 'PermitWitnessTransferFrom',
      message: { permitted: { token, amount: i.amountIn }, spender: swapic, nonce: BigInt(s.auth.nonce), deadline: BigInt(s.auth.deadline), witness: { orderId: id } },
    }];
  }
  must(td.every((t, k) => equalTyped(t, mine[k]!)), 'typedData');
  return { door: s.door, typedData: mine, auth: s.auth };
}

function permit2Approval(i: EvmCheckInput, r: Route) {
  const a = r.sign!.approval;
  if (!a) return null;
  must(r.sign!.door === 'permit2' && sameAddress(a.spender, PERMIT2) && sameToken(a.token, i.fromToken) && BigInt(a.amount) >= i.amountIn, 'approvalSpender');
  return { token: getAddress(a.token), spender: PERMIT2 as Hex, amount: BigInt(a.amount) };
}

function swapicApproval(i: EvmCheckInput, r: Route, swapic: Hex) {
  const a = r.approval;
  if (!a) return null;
  must(!isNative(i.fromToken), 'approvalOnNative');
  must(sameAddress(a.spender, swapic), 'approvalSpender');
  must(sameToken(a.token, i.fromToken) && BigInt(a.amount) === i.amountIn, 'approvalAmount');
  return { token: getAddress(a.token), spender: swapic, amount: i.amountIn };
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
