// Design note (BSC design 7.1 to 7.4). An Across deposit read as the canister reads it (canister/types/src/swapic/across
// and canister/impl/src/relay/mod.rs across_delivery): the step decoded strictly, rebuilt from its fields with the amount
// the Runner writes at zero and every fixed field the identity deposit's, compared byte for byte; its arrival message
// rebuilt from the envelope and recipe it carries. On a you pay gas order the canister reads nothing, so these rules are
// the only check between the quoter and the person's money.
// Must never happen: a deposit to another SpokePool, or whose refund and speed-ups are not the payer's (AX5); one into
// another chain's token, or out of anything but the source's USDC (AX6); a recipient that is one of ours, or a message to
// anything but the destination's MulticallHandler into its Runner (AX7, AM1, AM2); an arrival that is not a sealed swap
// of this order (AM3) or not KyberSwap's (AM4); a fill window, exclusivity or quote time the SpokePool or a relayer could
// use against the person (AX8, AX9, AX12); a deposit that promises more than a relayer fills, or lets one keep more than
// the canister's bound (AX13, AX14).
import { decodeAbiParameters, decodeFunctionData, encodeAbiParameters, encodeFunctionData, pad, size, slice, type Hex } from 'viem';
import { KYBER_ROUTER, STEP_ABI, sameAddress, type OrderValue } from './abi';
import type { PlanContext } from './plan';
import type { AcrossPins, ChainView } from '@/lib/icp';
import { decodeEnvelope, type Envelope } from './envelope';
import { GuardError, must } from './errors';

/** KyberSwap's scaler, the one an arrival's recipe may name (canister/types/src/swapic/mod.rs KYBER_SCALER). */
export const KYBER_SCALER = '0x2f577a41bec1be1152aeea12e73b7391d15f655d' as const;
/** Where the Runner writes the whole stable delta: `swapTokenAmount` (design 7.1). */
export const SWAP_TOKEN_AMOUNT_AT = 228;
/** Where `makeCallWithBalance` writes the handler's balance: the amount word of `approve` and of `fill`. */
const BALANCE_AT = 36n;
/** The most `minGas` an arrival may name (D18). */
export const MAX_MIN_GAS = 2_000_000n;
/** AX8: the fill deadline lies 5 to 15 minutes after the order's deadline. */
export const FILL_AFTER_LEAST_S = 300n;
export const FILL_AFTER_MOST_S = 900n;
/** AX9: an exclusive relayer holds the deposit at most 5 minutes. */
export const MAX_EXCLUSIVITY_S = 300;
/** AX12: the SpokePool takes a quote time at most 30 minutes before the order's deadline. */
export const QUOTE_LIFE_S = 1_800n;

const ZERO = '0x0000000000000000000000000000000000000000';
const INSTRUCTIONS = [{
  type: 'tuple',
  components: [
    { name: 'calls', type: 'tuple[]', components: [{ name: 'target', type: 'address' }, { name: 'callData', type: 'bytes' }, { name: 'value', type: 'uint256' }] },
    { name: 'fallbackRecipient', type: 'address' },
  ],
}] as const;

type Step = OrderValue['steps'][number];
type Recipe = { target: Hex; data: Hex; scaler: Hex };
type DepositData = {
  inputToken: Hex; outputToken: Hex; outputAmount: bigint; depositor: Hex; recipient: Hex; destinationChainId: bigint;
  exclusiveRelayer: Hex; quoteTimestamp: number; fillDeadline: number; exclusivityParameter: number; message: Hex;
};
type SwapAndDeposit = {
  submissionFees: { amount: bigint; recipient: Hex }; depositData: DepositData; swapToken: Hex; exchange: Hex; transferType: number;
  swapTokenAmount: bigint; minExpectedInputTokenAmount: bigint; routerCalldata: Hex; enableProportionalAdjustment: boolean;
  spokePool: Hex; nonce: bigint;
};

/** One Across deposit as an order signs it: M (`minExpected`) deposited at least, F (`outputAmount`) promised for M. */
export interface AcrossDeposit {
  spokePool: Hex; inputToken: Hex; outputToken: Hex; outputAmount: bigint; minExpected: bigint; depositor: Hex; recipient: Hex;
  destination: number; exclusiveRelayer: Hex; quoteTimestamp: number; fillDeadline: number; exclusivity: number; message: Hex;
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const word = (a: string) => pad(a.toLowerCase() as Hex, { size: 32 }).toLowerCase() as Hex;
/** An address word: its top 12 bytes zero. */
function wordAddress(w: Hex): Hex {
  must(/^0x0{24}[0-9a-f]{40}$/i.test(w), 'stepNotCanonical');
  return slice(w, 12).toLowerCase() as Hex;
}

/** `swapAndBridge`'s calldata for `d` through `periphery`, `swapTokenAmount` zero for the Runner to write. */
export function acrossCalldata(d: AcrossDeposit, periphery: Hex): Hex {
  const data: SwapAndDeposit = {
    submissionFees: { amount: 0n, recipient: ZERO },
    depositData: {
      inputToken: d.inputToken, outputToken: word(d.outputToken), outputAmount: d.outputAmount, depositor: d.depositor,
      recipient: word(d.recipient), destinationChainId: BigInt(d.destination), exclusiveRelayer: word(d.exclusiveRelayer),
      quoteTimestamp: d.quoteTimestamp, fillDeadline: d.fillDeadline, exclusivityParameter: d.exclusivity, message: d.message,
    },
    swapToken: d.inputToken, exchange: d.inputToken, transferType: 0, swapTokenAmount: 0n, minExpectedInputTokenAmount: d.minExpected,
    routerCalldata: encodeFunctionData({ abi: STEP_ABI, functionName: 'balanceOf', args: [periphery] }),
    enableProportionalAdjustment: true, spokePool: d.spokePool, nonce: 0n,
  };
  return encodeFunctionData({ abi: STEP_ABI, functionName: 'swapAndBridge', args: [data as never] });
}

/** A step to the source's Across periphery read as its deposit (AX1 to AX4), or the refusal. */
export function readAcrossStep(step: Step, pins: AcrossPins): AcrossDeposit {
  must(sameAddress(step.target, pins.periphery), 'unknownStep');
  let call: SwapAndDeposit;
  try {
    const decoded = decodeFunctionData({ abi: STEP_ABI, data: step.data });
    must(decoded.functionName === 'swapAndBridge', 'unknownStep');
    call = (decoded.args as unknown as readonly [SwapAndDeposit])[0];
  } catch (e) {
    if (e instanceof GuardError) throw e;
    throw new GuardError('unknownStep');
  }
  const dd = call.depositData;
  must(dd.destinationChainId <= BigInt(Number.MAX_SAFE_INTEGER), 'stepNotCanonical');
  const d: AcrossDeposit = {
    spokePool: call.spokePool.toLowerCase() as Hex, inputToken: dd.inputToken.toLowerCase() as Hex, outputToken: wordAddress(dd.outputToken),
    outputAmount: dd.outputAmount, minExpected: call.minExpectedInputTokenAmount, depositor: dd.depositor.toLowerCase() as Hex,
    recipient: wordAddress(dd.recipient), destination: Number(dd.destinationChainId), exclusiveRelayer: wordAddress(dd.exclusiveRelayer),
    quoteTimestamp: dd.quoteTimestamp, fillDeadline: dd.fillDeadline, exclusivity: dd.exclusivityParameter, message: dd.message.toLowerCase() as Hex,
  };
  must(same(acrossCalldata(d, pins.periphery), step.data), 'stepNotCanonical');
  must(sameAddress(step.token, call.swapToken) && sameAddress(call.swapToken, call.exchange) && sameAddress(call.exchange, dd.inputToken), 'stepNotCanonical');
  must(step.min === d.minExpected && d.minExpected > 0n, 'stepNotCanonical');
  must(step.writes.length === 1 && step.writes[0]!.at === SWAP_TOKEN_AMOUNT_AT && step.writes[0]!.minus === 0n, 'stepNotCanonical');
  must(sameAddress(d.spokePool, pins.spokePool), 'acrossSpokePool');
  return d;
}

/** The arrival message (design 7.3): approve the Runner the handler's whole balance of `stable`, then `Runner.fill` with it. */
export function arrivalMessage(handler: Hex, stable: Hex, runner: Hex, envelope: Hex, recipe: Recipe): Hex {
  const replacement = [{ token: stable, offset: BALANCE_AT }];
  const call = (target: Hex, data: Hex) => ({
    target: handler,
    callData: encodeFunctionData({ abi: STEP_ABI, functionName: 'makeCallWithBalance', args: [target, data, 0n, replacement] }),
    value: 0n,
  });
  const approve = encodeFunctionData({ abi: STEP_ABI, functionName: 'approve', args: [runner, 0n] });
  const fill = encodeFunctionData({ abi: STEP_ABI, functionName: 'fill', args: [stable, 0n, envelope, recipe] });
  return encodeAbiParameters(INSTRUCTIONS, [{ calls: [call(stable, approve), call(runner, fill)], fallbackRecipient: ZERO }]).toLowerCase() as Hex;
}

/** AM1: the message read back as its envelope and recipe, rebuilt byte for byte. */
export function readArrival(message: Hex, handler: Hex, stable: Hex, runner: Hex): { envelope: Envelope; recipe: Recipe } {
  let envelopeHex: Hex;
  let recipe: Recipe;
  try {
    const [ins] = decodeAbiParameters(INSTRUCTIONS, message);
    must(ins.calls.length === 2, 'acrossMessage');
    const outer = decodeFunctionData({ abi: STEP_ABI, data: ins.calls[1]!.callData });
    must(outer.functionName === 'makeCallWithBalance', 'acrossMessage');
    const fill = decodeFunctionData({ abi: STEP_ABI, data: (outer.args as unknown as readonly [Hex, Hex])[1] });
    must(fill.functionName === 'fill', 'acrossMessage');
    const args = fill.args as readonly [Hex, bigint, Hex, Recipe];
    envelopeHex = args[2];
    recipe = { target: args[3].target, data: args[3].data, scaler: args[3].scaler };
  } catch {
    throw new GuardError('acrossMessage');
  }
  must(same(arrivalMessage(handler, stable, runner, envelopeHex, recipe), message), 'acrossMessage');
  return { envelope: decodeEnvelope(envelopeHex), recipe };
}

/** Where an Across order's money ends, and what comes back if it can't: read as the canister's across_delivery reads it. */
export interface AcrossRead {
  delivery: { chainId: number; recipient: Hex; token: Hex; minOut: bigint };
  envelope: Envelope | null;
  /** Not filled: the whole deposit, at least M, back to the payer on the source in its USDC. */
  notFilled: { chainId: number; token: Hex; min: bigint };
  /** The last swap fails: all of it, at least F, as the destination's USDC (only with an arrival swap). */
  lastSwapFails: { chainId: number; token: Hex; min: bigint } | null;
}

/** The rules of 7.4 on one deposit (AX5 to AX9, AX12 to AX14, AM1 to AM4), for an order whose last step it is. */
export function acrossDelivery(d: AcrossDeposit, o: OrderValue, ctx: PlanContext, readSwap: (step: Step, chain: ChainView) => Hex): AcrossRead {
  const source = ctx.config.chains.get(ctx.sourceChainId)!;
  const fee = ctx.config.acrossFee;
  must(!!fee, 'noAnchor');
  // AX5: the refund and every speed-up are the payer's
  must(sameAddress(d.depositor, ctx.payer), 'refundReceiver');
  // AX6: another chain the canister holds Across's pins for, the source's USDC in, its USDC out
  const dest = ctx.config.chains.get(d.destination);
  must(!!dest && d.destination !== ctx.sourceChainId && !!dest.across, 'acrossDestination');
  const pins = dest!.across!;
  must(sameAddress(d.inputToken, source.usdc) && sameAddress(d.outputToken, dest!.usdc), 'acrossToken');
  const ours = (a: string) => sameAddress(a, ZERO) || (!!ctx.canisterEvm && sameAddress(a, ctx.canisterEvm))
    || [dest!.swapic, dest!.runner, dest!.cctpReceiver, pins.periphery, pins.spokePool, pins.multicallHandler, pins.swapProxy].some((x) => sameAddress(a, x));
  const fill = BigInt(d.fillDeadline);
  let delivery: AcrossRead['delivery'];
  let envelope: Envelope | null = null;
  if (d.message === '0x') {
    // AX7: straight to the person
    must(!ours(d.recipient), 'recipient');
    delivery = { chainId: d.destination, recipient: d.recipient, token: dest!.usdc, minOut: d.outputAmount };
  } else {
    must(sameAddress(d.recipient, pins.multicallHandler), 'recipient');
    const arrival = readArrival(d.message, pins.multicallHandler, dest!.usdc, dest!.runner);
    const e = arrival.envelope;
    // AM2 and AM3: a sealed swap of this order, paying the person, by the fill deadline
    must(!ours(e.recipient), 'recipient');
    must(e.action === 'swap' && e.ref === o.ref.toLowerCase() && e.deadline === fill && !sameAddress(e.tokenOut, ZERO)
      && !sameAddress(e.tokenOut, d.outputToken) && e.minOut > 0n && e.minGas > 0n && e.minGas <= MAX_MIN_GAS
      && /^0x0{64}$/.test(e.principal) && /^0x0{64}$/.test(e.subaccount), 'acrossArrival');
    // AM4: KyberSwap's recipe, read as a swap step of the destination's USDC there, into the envelope's token
    must(sameAddress(arrival.recipe.target, KYBER_ROUTER) && sameAddress(arrival.recipe.scaler, KYBER_SCALER), 'acrossRecipe');
    const bought = readSwap({ target: arrival.recipe.target, data: arrival.recipe.data, token: dest!.usdc, min: 0n, writes: [] }, dest!);
    must(sameAddress(bought, e.tokenOut), 'acrossRecipe');
    envelope = e;
    delivery = { chainId: d.destination, recipient: e.recipient, token: e.tokenOut, minOut: e.minOut };
  }
  // AX8: the fill window after the order's deadline
  must(fill >= ctx.orderDeadline + FILL_AFTER_LEAST_S && fill <= ctx.orderDeadline + FILL_AFTER_MOST_S, 'acrossWindow');
  // AX9: no exclusivity, or a short one
  const exclusive = sameAddress(d.exclusiveRelayer, ZERO) ? d.exclusivity === 0 : d.exclusivity > 0 && d.exclusivity <= MAX_EXCLUSIVITY_S;
  must(exclusive, 'acrossExclusivity');
  // AX12: a quote time the SpokePool takes
  must(ctx.orderDeadline <= BigInt(d.quoteTimestamp) + QUOTE_LIFE_S, 'acrossQuoteTime');
  // AX13 and AX14: F between the least and the most a relayer keeps, in micro USD
  const million = 1_000_000n;
  const paid = usd6(d.outputAmount, dest!.usdcDecimals ?? 6) * million;
  const put = usd6(d.minExpected, source.usdcDecimals ?? 6);
  must(paid <= put * (million - BigInt(fee!.leastPpm)), 'acrossFee');
  const allowance = fee!.gasAllowanceUsd6.get(d.destination) ?? 0n;
  const floor = put * (million - BigInt(fee!.mostPpm)) - allowance * million;
  must(paid >= floor, 'acrossFee');
  return {
    delivery, envelope,
    notFilled: { chainId: ctx.sourceChainId, token: source.usdc, min: d.minExpected },
    lastSwapFails: envelope ? { chainId: d.destination, token: dest!.usdc, min: d.outputAmount } : null,
  };
}

/** A USDC amount of `decimals` in micro USD, rounded down (the canister's usdc_to_usd6). */
export const usd6 = (raw: bigint, decimals: number) => (decimals >= 6 ? raw / 10n ** BigInt(decimals - 6) : raw * 10n ** BigInt(6 - decimals));

/** The integrator suffix (design 7.6): `0x1dc0de` and the 2-byte id. */
export const integratorSuffix = (id: number) => `0x1dc0de${id.toString(16).padStart(4, '0')}` as Hex;

/** Whether `data`, whose run(order) part is `runLength` bytes, carries nothing after it, or exactly the suffix of the
 *  integrator the canister names. */
export function txTailAllowed(data: Hex, runLength: number, integrator: number | null | undefined): boolean {
  if (size(data) < runLength) return false;
  const tail = size(data) > runLength ? slice(data, runLength).toLowerCase() : '0x';
  return tail === '0x' || (integrator != null && tail === integratorSuffix(integrator));
}
