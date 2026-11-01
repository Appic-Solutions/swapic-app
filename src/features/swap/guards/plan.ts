// Design note: plan 2 Task 1. The canister's read_plan (canister/impl/src/relay/mod.rs:619-718) and read_step
// (canister/types/src/swapic/mod.rs:1065-1145): every step decoded strictly, rebuilt with the amounts the Runner
// writes at zero, compared byte for byte, its writes exactly its shape's; anything else refuses the whole order.
import { decodeAbiParameters, decodeFunctionData, encodeAbiParameters, encodeFunctionData, pad, size, type Hex } from 'viem';
import { ECO_ROUTE, KYBER_EXECUTOR, KYBER_ROUTER, STEP_ABI, sameAddress, type OrderValue } from './abi';
import type { GuardContext } from './context';
import type { ChainView } from '@/lib/icp';
import { decodeEnvelope, type Envelope } from './envelope';
import { GuardError, must } from './errors';

export interface PlanContext extends GuardContext { sourceChainId: number; payer: Hex; orderDeadline: bigint; nowSec: number }
export interface Delivery { chainId: number; recipient: Hex; token: Hex; minOut: bigint }
export interface Plan {
  fees: { to: Hex; amount: bigint }[];
  /** How the money leaves the source chain: stays (local), a CCTP burn (burn), an Eco intent (fill). */
  rail: 'local' | 'burn' | 'fill';
  delivery: Delivery | null;
  envelope: Envelope | null;
}

const ZERO = '0x0000000000000000000000000000000000000000';
// check_intent's caps (canister/impl/src/pool/eco/mod.rs:18-25)
const MAX_ROUTE_LIFE_S = 3_600n;
const MAX_REWARD_LIFE_S = 8n * 24n * 3_600n;
const MIN_REFUND_GAP_S = 3_600n;
// where the Runner writes an Eco step's amounts, by byte of the step's data (canister/types/src/swapic/mod.rs, eco_writes)
const ECO_ROUTE_AT = 0xa4;
const ECO_TOKEN_AMOUNT = 0x120;
const ECO_TRANSFER_AMOUNT = 0x224;
const ECO_APPROVE_AMOUNT = 0x244;
const ECO_FILL_AMOUNT = 0x324;

type Step = OrderValue['steps'][number];
type Write = { at: number; minus: bigint };
type Call = { target: Hex; data: Hex; value: bigint };
type Reward = { deadline: bigint; creator: Hex; prover: Hex; nativeAmount: bigint; tokens: readonly { token: Hex; amount: bigint }[] };
type EcoRoute = { salt: Hex; deadline: bigint; portal: Hex; nativeAmount: bigint; tokens: readonly { token: Hex; amount: bigint }[]; calls: readonly Call[] };
type KyberExecution = { callTarget: Hex; desc: { srcToken: Hex; srcReceivers: readonly Hex[]; feeReceivers: readonly Hex[]; dstReceiver: Hex; permit: Hex } };
type Read =
  | { kind: 'fee'; to: Hex; amount: bigint }
  | { kind: 'burn'; destination: number; envelope: Envelope; mintRecipient: Hex; caller: Hex; maxFee: bigint; min: bigint }
  | { kind: 'fill'; destination: number; token: Hex; deliver: Hex | null; envelope: Envelope | null; fee: bigint; min: bigint }
  | { kind: 'swap' };

const word = (a: string) => pad(a.toLowerCase() as Hex, { size: 32 }).toLowerCase();
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const sameWrites = (a: readonly Write[], b: Write[]) => a.length === b.length && a.every((w, i) => w.at === b[i]!.at && w.minus === b[i]!.minus);
const decode = (data: Hex) => {
  try { return decodeFunctionData({ abi: STEP_ABI, data }); } catch { throw new GuardError('unknownStep'); }
};
const ours = (ctx: PlanContext, chainId: number) => {
  const c = ctx.config.chains.get(chainId)!;
  return [c.swapic, c.runner, c.cctpReceiver].map((a) => a.toLowerCase());
};

/**
 * A KyberSwap step as the canister reads it (Jeff's option B, 2026-11-01; the canister's check_swap and the services'
 * shared check, swapic-backend-fe libraries/onchain/src/kyber, in its order): the step calls KyberSwap's router, decoded
 * strictly and encoded back to the same bytes, with no writes; it sells the token the step spends (never the zero
 * address); its callTarget is KyberSwap's executor; it hands its input to at least one receiver, none of them the zero
 * address, Swapic, the Runner or the CctpReceiver of that chain, or the canister's EVM address (a route through an old
 * v2 style pool hands it straight to the pool, and passes); it pays no fee and carries no permit; and it pays its output
 * to the chain's Runner. The input's amounts are not read: the Runner approves exactly the step's delta and reverts on
 * anything left of it. Refusals: swapExecutor (another callTarget), swapSrcReceiver (no receiver, or one that is zero
 * or ours), and the rules this guard had before.
 */
export function readKyberSwap(step: Step, source: ChainView, canisterEvm: Hex | null): void {
  const d = decode(step.data);
  must(d.functionName === 'swap', 'unknownStep');
  must(sameAddress(step.target, KYBER_ROUTER), 'unknownStep');
  const [ex] = d.args as readonly [KyberExecution];
  must(same(encodeFunctionData({ abi: STEP_ABI, functionName: 'swap', args: [ex as never] }), step.data) && step.writes.length === 0, 'stepNotCanonical');
  must(!sameAddress(step.token, ZERO) && sameAddress(ex.desc.srcToken, step.token), 'swapToken');
  must(sameAddress(ex.callTarget, KYBER_EXECUTOR), 'swapExecutor');
  must(!!canisterEvm, 'noAnchor');
  const refused = [ZERO, source.swapic, source.runner, source.cctpReceiver, canisterEvm!];
  must(ex.desc.srcReceivers.length > 0 && ex.desc.srcReceivers.every((r) => !refused.some((x) => sameAddress(r, x))), 'swapSrcReceiver');
  must(ex.desc.feeReceivers.length === 0 && ex.desc.permit === '0x', 'swapFees');
  must(sameAddress(ex.desc.dstReceiver, source.runner), 'swapReceiver');
}

function readStep(step: Step, ctx: PlanContext): Read {
  const source = ctx.config.chains.get(ctx.sourceChainId);
  must(!!source, 'noAnchor');
  const d = decode(step.data);
  switch (d.functionName) {
    case 'transfer': {
      must(sameAddress(step.target, source!.usdc), 'unknownStep');
      const [to, amount] = d.args as readonly [Hex, bigint];
      must(same(encodeFunctionData({ abi: STEP_ABI, functionName: 'transfer', args: [to, amount] }), step.data), 'stepNotCanonical');
      must(sameAddress(step.token, ZERO) && step.min === 0n && step.writes.length === 0, 'stepNotCanonical');
      must(!!ctx.canisterEvm && sameAddress(to, ctx.canisterEvm), 'feeNotToCanister');
      return { kind: 'fee', to, amount };
    }
    case 'depositForBurnWithHook': {
      must(sameAddress(step.target, source!.tokenMessenger), 'unknownStep');
      const a = d.args as readonly [bigint, number, Hex, Hex, Hex, bigint, number, Hex];
      must(same(encodeFunctionData({ abi: STEP_ABI, functionName: 'depositForBurnWithHook', args: [0n, a[1], a[2], a[3], a[4], a[5], a[6], a[7]] }), step.data), 'stepNotCanonical');
      must(sameAddress(step.token, source!.usdc) && sameWrites(step.writes, [{ at: 4, minus: 0n }]), 'stepNotCanonical');
      must(sameAddress(a[3], source!.usdc), 'burnToken');
      const destination = [...ctx.config.cctpDomains].find(([, domain]) => domain === a[1])?.[0];
      must(destination !== undefined && destination !== ctx.sourceChainId && ctx.config.chains.has(destination), 'burnDestination');
      return { kind: 'burn', destination: destination!, envelope: decodeEnvelope(a[7]), mintRecipient: a[2], caller: a[4], maxFee: a[5], min: step.min };
    }
    case 'publishAndFund':
      return readIntent(step, d.args as readonly [bigint, Hex, Reward, boolean], ctx);
    case 'swap':
      readKyberSwap(step, source!, ctx.canisterEvm);
      return { kind: 'swap' };
    default:
      throw new GuardError('unknownStep');
  }
}

function readIntent(step: Step, args: readonly [bigint, Hex, Reward, boolean], ctx: PlanContext): Read {
  const source = ctx.config.chains.get(ctx.sourceChainId)!;
  must(!!ctx.config.ecoPortal && sameAddress(step.target, ctx.config.ecoPortal), 'ecoPortal');
  const [destinationRaw, routeBytes, reward, allowPartial] = args;
  let route: EcoRoute;
  try { route = decodeAbiParameters(ECO_ROUTE, routeBytes)[0] as EcoRoute; } catch { throw new GuardError('ecoShape'); }
  must(!allowPartial && route.tokens.length === 1 && reward.tokens.length === 1, 'ecoShape');
  must(route.nativeAmount === 0n && reward.nativeAmount === 0n && route.calls.every((c) => c.value === 0n), 'ecoShape');
  const token = route.tokens[0]!.token;

  // the route's calls: a transfer to the recipient (Deliver), or an approval then the Runner's fill (Fill)
  let deliver: Hex | null = null;
  let envelope: Envelope | null = null;
  let zeroCalls: Call[];
  if (route.calls.length === 1) {
    const send = route.calls[0]!;
    const t = decode(send.data);
    must(sameAddress(send.target, token) && t.functionName === 'transfer', 'ecoShape');
    deliver = (t.args as readonly [Hex, bigint])[0];
    zeroCalls = [{ target: send.target, data: encodeFunctionData({ abi: STEP_ABI, functionName: 'transfer', args: [deliver, 0n] }), value: 0n }];
  } else if (route.calls.length === 2) {
    const [grant, fill] = route.calls as readonly [Call, Call];
    const g = decode(grant.data);
    const f = decode(fill.data);
    must(sameAddress(grant.target, token) && g.functionName === 'approve' && f.functionName === 'fill', 'ecoShape');
    const [spender] = g.args as readonly [Hex, bigint];
    const [fillToken, , env, recipe] = f.args as readonly [Hex, bigint, Hex, unknown];
    must(sameAddress(spender, fill.target) && sameAddress(fillToken, token), 'ecoShape');
    envelope = decodeEnvelope(env);
    zeroCalls = [
      { target: grant.target, data: encodeFunctionData({ abi: STEP_ABI, functionName: 'approve', args: [spender, 0n] }), value: 0n },
      { target: fill.target, data: encodeFunctionData({ abi: STEP_ABI, functionName: 'fill', args: [fillToken, 0n, env, recipe as never] }), value: 0n },
    ];
  } else {
    throw new GuardError('ecoShape');
  }

  // rebuilt with every amount zero: the same bytes; the Runner's writes exactly eco_writes
  const zeroRoute = encodeAbiParameters(ECO_ROUTE, [{ ...route, tokens: [{ token, amount: 0n }], calls: zeroCalls } as never]);
  const rebuilt = encodeFunctionData({
    abi: STEP_ABI, functionName: 'publishAndFund',
    args: [destinationRaw, zeroRoute, { deadline: reward.deadline, creator: reward.creator, prover: reward.prover, nativeAmount: 0n, tokens: [{ token: reward.tokens[0]!.token, amount: 0n }] }, false],
  });
  must(same(rebuilt, step.data) && sameAddress(step.token, source.usdc), 'stepNotCanonical');
  const fee = step.writes[1]?.minus;
  must(fee !== undefined, 'stepNotCanonical');
  const want: Write[] = [
    { at: ECO_ROUTE_AT + Math.ceil(size(zeroRoute) / 32) * 32 + 0xe0, minus: 0n },
    { at: ECO_ROUTE_AT + ECO_TOKEN_AMOUNT, minus: fee! },
    ...(deliver ? [{ at: ECO_ROUTE_AT + ECO_TRANSFER_AMOUNT, minus: fee! }] : [{ at: ECO_ROUTE_AT + ECO_APPROVE_AMOUNT, minus: fee! }, { at: ECO_ROUTE_AT + ECO_FILL_AMOUNT, minus: fee! }]),
  ];
  must(sameWrites(step.writes, want), 'stepNotCanonical');

  // check_intent: Eco's own prover and Portal, short deadlines
  must(!!ctx.ecoProver && sameAddress(reward.prover, ctx.ecoProver), 'ecoProver');
  must(sameAddress(route.portal, ctx.config.ecoPortal!), 'ecoPortal');
  const now = BigInt(ctx.nowSec);
  must(route.deadline >= ctx.orderDeadline && route.deadline <= now + MAX_ROUTE_LIFE_S, 'ecoDeadline');
  must(reward.deadline >= route.deadline + MIN_REFUND_GAP_S && reward.deadline <= now + MAX_REWARD_LIFE_S, 'ecoDeadline');

  // eco_parties: refunds the payer, carries the destination's USDC, rewards the source's USDC, pays no Swapic contract
  must(sameAddress(reward.creator, ctx.payer), 'refundReceiver');
  const destination = Number(destinationRaw);
  const dest = ctx.config.chains.get(destination);
  must(!!dest && destination !== ctx.sourceChainId, 'ecoDestination');
  must(sameAddress(token, dest!.usdc) && sameAddress(reward.tokens[0]!.token, source.usdc), 'ecoToken');
  const own = ours(ctx, destination);
  if (deliver) {
    must(!sameAddress(deliver, ZERO) && !own.includes(deliver.toLowerCase()), 'recipient');
  } else {
    must(sameAddress(route.calls[1]!.target, dest!.runner), 'ecoRunner');
    must(envelope!.action !== 'deliver' && !sameAddress(envelope!.recipient, ZERO) && !own.includes(envelope!.recipient.toLowerCase()), 'recipient');
  }
  return { kind: 'fill', destination, token, deliver, envelope, fee: fee!, min: step.min };
}

/** The order's plan as the canister reads it, or the refusal. */
export function readPlan(o: OrderValue, ctx: PlanContext): Plan {
  const reads = o.steps.map((s) => readStep(s, ctx));
  const fees = reads.flatMap((r) => (r.kind === 'fee' ? [{ to: r.to, amount: r.amount }] : []));
  const burns = reads.filter((r): r is Extract<Read, { kind: 'burn' }> => r.kind === 'burn');
  const intents = reads.filter((r): r is Extract<Read, { kind: 'fill' }> => r.kind === 'fill');
  must(burns.length + intents.length <= 1, 'twoRails');
  const payout: Delivery | null = sameAddress(o.payout.token, ZERO) ? null
    : { chainId: ctx.sourceChainId, recipient: o.payout.recipient, token: o.payout.token, minOut: o.payout.minOut };
  if (!burns.length && !intents.length) {
    must(!!payout, 'noRecipient');
    return { fees, rail: 'local', delivery: payout, envelope: null };
  }
  if (intents.length) {
    const i = intents[0]!;
    if (i.envelope) must(i.envelope.ref === o.ref.toLowerCase(), 'envelopeRef');
    const delivered: Delivery | null = i.deliver
      ? { chainId: i.destination, recipient: i.deliver, token: i.token, minOut: i.min > i.fee ? i.min - i.fee : 0n }
      : i.envelope!.action === 'swap' ? { chainId: i.destination, recipient: i.envelope!.recipient, token: i.envelope!.tokenOut, minOut: i.envelope!.minOut } : null;
    // an intent and a payout too are two deliveries: none is the order's (as the canister)
    return { fees, rail: 'fill', delivery: payout ? null : delivered, envelope: i.envelope };
  }
  // arrival_of (relay/mod.rs:421-490)
  const b = burns[0]!;
  const e = b.envelope;
  const dest = ctx.config.chains.get(b.destination)!;
  must(e.ref === o.ref.toLowerCase(), 'envelopeRef');
  must(!sameAddress(e.recipient, ZERO) && !ours(ctx, b.destination).includes(e.recipient.toLowerCase()), 'recipient');
  let delivered: Delivery | null = null;
  if (e.action === 'swap' || e.action === 'ckDeposit') {
    const receiver = word(dest.cctpReceiver);
    must(b.mintRecipient.toLowerCase() === receiver && b.caller.toLowerCase() === receiver, 'burnRecipient');
    must(e.minGas !== 0n, 'envelopeMinGas');
    if (e.action === 'swap') {
      must(e.minOut !== 0n && !sameAddress(e.tokenOut, ZERO), 'envelopeSwap');
      delivered = { chainId: b.destination, recipient: e.recipient, token: e.tokenOut, minOut: e.minOut };
    }
  } else {
    must(b.mintRecipient.toLowerCase() === word(e.recipient), 'burnRecipient');
    must(b.caller.toLowerCase() === word(ZERO) || (!!ctx.canisterEvm && b.caller.toLowerCase() === word(ctx.canisterEvm)), 'burnRecipient');
    delivered = { chainId: b.destination, recipient: e.recipient, token: dest.usdc, minOut: b.min > b.maxFee ? b.min - b.maxFee : 0n };
  }
  return { fees, rail: 'burn', delivery: payout ? null : delivered, envelope: e };
}
