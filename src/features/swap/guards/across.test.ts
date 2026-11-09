// The Across rules held to T0, the live test of 2026-11-08 (tests/fixtures/real/across/t0_2026_11_08.json): the order a
// person signed on Base, deposited through Across's periphery, filled on Arbitrum into the Runner and delivered as ARB.
// One tamper test per rule of BSC design 7.4, each a hostile quoter's edit of that real order.
import { readFileSync } from 'node:fs';
import { decodeFunctionData, encodeAbiParameters, encodeFunctionData, getAddress, toFunctionSelector, type Hex } from 'viem';
import { describe, expect, it } from 'vitest';
import type { ChainView, SwapicConfigView } from '@/lib/icp';
import type { Route } from '@/lib/api';
import { ORDER_TUPLE, SWAPIC_RUN_ABI, STEP_ABI, orderIdOf, type OrderValue } from './abi';
import { acrossCalldata, integratorSuffix, readAcrossStep, txTailAllowed, type AcrossDeposit } from './across';
import { readPlan, type PlanContext } from './plan';
import { checkFallbacks } from './evm';
import { verifyIcpSwap } from './icp';

const t0 = JSON.parse(readFileSync('tests/fixtures/real/across/t0_2026_11_08.json', 'utf8'));
const lower = (h: string) => h.toLowerCase() as Hex;
const ORDER = decodeFunctionData({ abi: SWAPIC_RUN_ABI, data: t0.run_data }).args[0] as unknown as OrderValue;
const OTHER = '0x7777777777777777777777777777777777777777' as Hex;
const PINS_BASE = { periphery: lower(t0.base.periphery), swapProxy: OTHER, spokePool: lower(t0.base.spoke_pool), multicallHandler: OTHER };
const PINS_ARB = { periphery: OTHER, swapProxy: OTHER, spokePool: lower(t0.arbitrum.spoke_pool), multicallHandler: lower(t0.arbitrum.multicall_handler) };

function chain(c: { swapic?: string; usdc: string; runner: string }, across: ChainView['across']): ChainView {
  return {
    swapic: lower(c.swapic ?? t0.base.swapic), usdc: lower(c.usdc), runner: lower(c.runner),
    cctpReceiver: '0x1111111111111111111111111111111111111111', tokenMessenger: '0x28b5a0e9c621a5badaa536219b3a228c8168cf5d', usdcDecimals: 6, across,
  };
}

function ctx(edit: (c: SwapicConfigView) => void = () => {}): PlanContext {
  const config: SwapicConfigView = {
    poolChain: 8453,
    chains: new Map([[8453, chain(t0.base, PINS_BASE)], [42161, chain(t0.arbitrum, PINS_ARB)]]),
    cctpDomains: new Map([[8453, 6], [42161, 3]]),
    ecoPortal: null,
    acrossFee: { leastPpm: 50, mostPpm: 3_000, gasAllowanceUsd6: new Map([[42161, 100_000n]]) },
    acrossIntegrator: 0x00ab,
  };
  edit(config);
  return { config, ecoProver: null, ckHelper: null, canisterEvm: lower(t0.canister), sourceChainId: 8453, payer: t0.payer, orderDeadline: ORDER.deadline, nowSec: Number(ORDER.deadline) - 60 };
}

const at = ORDER.steps.findIndex((s) => s.target.toLowerCase() === PINS_BASE.periphery);
const DEPOSIT = readAcrossStep(ORDER.steps[at]!, PINS_BASE);

/** T0's order with its deposit edited, the step rebuilt as a quoter would. */
const withDeposit = (edit: Partial<AcrossDeposit>): OrderValue => ({
  ...ORDER,
  steps: ORDER.steps.map((s, i) => (i === at ? { ...s, data: acrossCalldata({ ...DEPOSIT, ...edit }, PINS_BASE.periphery) } : s)),
});
const refusal = (o: OrderValue, c = ctx()) => {
  try { readPlan(o, c); return 'read'; } catch (e) { return (e as { rule?: string }).rule; }
};
/** A deadline as the envelope's word holds it, in hex. */
const deadlineWord = (n: bigint) => n.toString(16).padStart(64, '0');

describe('Across, read as the canister reads it', () => {
  it('reads swapAndBridge under its live selector', () => {
    const fn = STEP_ABI.find((x) => x.type === 'function' && x.name === 'swapAndBridge')!;
    expect(toFunctionSelector(fn as never)).toBe('0x110560ad');
  });

  it("reads T0's order as one deposit into the Runner, and what comes back if it can't finish", () => {
    const plan = readPlan(ORDER, ctx());
    expect(plan.rail).toBe('across');
    expect(plan.envelope?.action).toBe('swap');
    expect(plan.delivery).toMatchObject({ chainId: 42161, recipient: expect.stringMatching(/^0xf00eba8e/i), minOut: plan.envelope!.minOut });
    expect(plan.fallbacks).toEqual({
      notFilled: { chainId: 8453, token: lower(t0.base.usdc), min: 3_000_000n },
      lastSwapFails: { chainId: 42161, token: lower(t0.arbitrum.usdc), min: 2_930_727n },
    });
  });

  it('refuses a deposit off the pins or off the identity deposit (AX1 to AX4)', () => {
    expect(refusal(withDeposit({ spokePool: OTHER }))).toBe('acrossSpokePool');
    expect(refusal(ORDER, ctx((c) => { c.chains.get(8453)!.across = null; }))).toBe('unknownStep');
    expect(refusal(ORDER, ctx((c) => { c.acrossFee = null; }))).toBe('noAnchor');
    // a nonce, a signed amount: not the identity deposit
    const step = ORDER.steps[at]!;
    for (const [byte, value] of [[259, '01'], [419, '07']] as const) {
      const data = `${step.data.slice(0, 2 + 2 * byte)}${value}${step.data.slice(4 + 2 * byte)}` as Hex;
      const o = { ...ORDER, steps: ORDER.steps.map((s, i) => (i === at ? { ...s, data } : s)) };
      expect(refusal(o)).toBe('stepNotCanonical');
    }
    const o = { ...ORDER, steps: ORDER.steps.map((s, i) => (i === at ? { ...s, writes: [{ at: 228, minus: 1n }] } : s)) };
    expect(refusal(o)).toBe('stepNotCanonical');
  });

  it('refuses a refund or a speed-up that is not the payer\'s (AX5)', () => {
    expect(refusal(withDeposit({ depositor: OTHER }))).toBe('refundReceiver');
  });

  it('refuses another destination or token (AX6)', () => {
    expect(refusal(withDeposit({ destination: 10 }))).toBe('acrossDestination');
    expect(refusal(withDeposit({ destination: 8453 }))).toBe('acrossDestination');
    expect(refusal(withDeposit({ outputToken: OTHER }))).toBe('acrossToken');
    expect(refusal(withDeposit({ inputToken: OTHER }))).toBe('stepNotCanonical');
  });

  it('refuses a direct deposit to one of ours, and a message to anything but the handler into the Runner (AX7, AM1)', () => {
    expect(refusal(withDeposit({ message: '0x', recipient: lower(t0.arbitrum.runner) }))).toBe('recipient');
    expect(refusal(withDeposit({ message: '0x', recipient: PINS_ARB.spokePool }))).toBe('recipient');
    expect(refusal(withDeposit({ recipient: t0.payer }))).toBe('recipient');
    expect(refusal(withDeposit({ message: `${DEPOSIT.message}00` as Hex }))).toBe('acrossMessage');
    expect(refusal(ORDER, ctx((c) => { c.chains.get(42161)!.runner = OTHER; }))).toBe('acrossMessage');
  });

  it('reads a direct deposit as paid to its recipient, at least F', () => {
    const plan = readPlan(withDeposit({ message: '0x', recipient: t0.payer }), ctx());
    expect(plan.delivery).toEqual({ chainId: 42161, recipient: lower(t0.payer), token: lower(t0.arbitrum.usdc), minOut: 2_930_727n });
    expect(plan.fallbacks?.lastSwapFails).toBeNull();
  });

  it('reads a deposit to the canister on the pool chain with a memo as a pool deposit, and nothing else (AX7 c)', () => {
    // T0 filled on Arbitrum: that chain is the pool's here
    const pool = ctx((c) => { c.poolChain = 42161; });
    const toCanister = { message: '0x' as Hex, recipient: lower(t0.canister) };
    const memo = `0x${'ab'.repeat(40)}` as Hex;
    const plan = readPlan({ ...withDeposit(toCanister), memo }, pool);
    expect(plan.delivery).toEqual({ chainId: 42161, recipient: lower(t0.canister), token: lower(t0.arbitrum.usdc), minOut: 2_930_727n });
    expect(plan.fallbacks?.lastSwapFails).toBeNull();
    // no memo, another pool chain, or a message: one of ours, refused
    expect(refusal(withDeposit(toCanister), pool)).toBe('recipient');
    expect(refusal({ ...withDeposit(toCanister), memo }, ctx())).toBe('recipient');
    expect(refusal({ ...withDeposit({ recipient: lower(t0.canister) }), memo }, pool)).toBe('recipient');
  });

  it('refuses an arrival that is not a sealed swap of this order by the fill deadline (AM3)', () => {
    const fill = BigInt(DEPOSIT.fillDeadline);
    const moved = DEPOSIT.message.replace(deadlineWord(fill), deadlineWord(fill + 1n)) as Hex;
    expect(moved).not.toBe(DEPOSIT.message);
    expect(refusal(withDeposit({ message: moved }))).toBe('acrossArrival');
  });

  it('refuses a fill window, an exclusivity or a quote time a relayer could use (AX8, AX9, AX12)', () => {
    const d = Number(ORDER.deadline);
    // a direct deposit, so the arrival's own deadline does not answer first
    const direct = { message: '0x' as Hex, recipient: lower(t0.payer) };
    expect(refusal(withDeposit({ ...direct, fillDeadline: d + 299 }))).toBe('acrossWindow');
    expect(refusal(withDeposit({ ...direct, fillDeadline: d + 300 }))).toBe('read');
    expect(refusal(withDeposit({ ...direct, fillDeadline: d + 900 }))).toBe('read');
    expect(refusal(withDeposit({ ...direct, fillDeadline: d + 901 }))).toBe('acrossWindow');
    expect(refusal(withDeposit({ exclusivity: 301 }))).toBe('acrossExclusivity');
    expect(refusal(withDeposit({ exclusivity: 0 }))).toBe('acrossExclusivity');
    expect(refusal(withDeposit({ exclusiveRelayer: '0x0000000000000000000000000000000000000000' }))).toBe('acrossExclusivity');
    expect(refusal(withDeposit({ quoteTimestamp: d - 1_801 }))).toBe('acrossQuoteTime');
  });

  it('refuses F above what a relayer fills, or below what the canister lets one keep (AX13, AX14)', () => {
    expect(refusal(withDeposit({ outputAmount: 2_999_851n }))).toBe('acrossFee');
    expect(refusal(withDeposit({ outputAmount: 2_999_850n }))).toBe('read');
    // 3 USDC less 0.3 % and the $0.10 gas allowance: 2.891
    expect(refusal(withDeposit({ outputAmount: 2_890_999n }))).toBe('acrossFee');
    expect(refusal(withDeposit({ outputAmount: 2_891_000n }))).toBe('read');
    // an allowance above the whole floor still leaves no deposit promising nothing
    const roomy = ctx((c) => { c.acrossFee!.gasAllowanceUsd6.set(42161, 10_000_000n); });
    const direct = { message: '0x' as Hex, recipient: lower(t0.payer) };
    expect(refusal(withDeposit({ ...direct, outputAmount: 0n }), roomy)).toBe('acrossFee');
    expect(refusal(withDeposit({ ...direct, outputAmount: 1n }), roomy)).toBe('read');
  });

  it('refuses a deposit that is not the last step, or one paid out beside (AX10, AX11)', () => {
    const fee = { target: lower(t0.base.usdc), data: encodeFunctionData({ abi: STEP_ABI, functionName: 'transfer', args: [lower(t0.canister), 1n] }), token: '0x0000000000000000000000000000000000000000' as Hex, min: 0n, writes: [] };
    expect(refusal({ ...ORDER, steps: [...ORDER.steps, fee] })).toBe('acrossLast');
    expect(refusal({ ...ORDER, payout: { token: lower(t0.base.usdc), recipient: t0.payer, minOut: 1n } })).toBe('acrossPayout');
  });

  it('takes run(order) with nothing after it, or exactly the integrator suffix', () => {
    const run = encodeFunctionData({ abi: SWAPIC_RUN_ABI, functionName: 'run', args: [ORDER as never] });
    const length = (run.length - 2) / 2;
    expect(integratorSuffix(0x00ab)).toBe('0x1dc0de00ab');
    expect(txTailAllowed(run, length, 0x00ab)).toBe(true);
    expect(txTailAllowed(`${run}1dc0de00ab`, length, 0x00ab)).toBe(true);
    expect(txTailAllowed(`${run}1dc0de00ac`, length, 0x00ab)).toBe(false);
    expect(txTailAllowed(`${run}1dc0de00ab`, length, null)).toBe(false);
    expect(txTailAllowed(`${run}00`, length, 0x00ab)).toBe(false);
  });
});

describe('the fallbacks a Review screen shows', () => {
  const plan = readPlan(ORDER, ctx());
  const answer = (edit: (f: { when: string; chain: string; token: string; symbol: string; decimals: number; min: string }[]) => void = () => {}) => {
    const fallbacks = [
      { when: 'notFilled', chain: 'eip155:8453', token: t0.base.usdc, symbol: 'USDC', decimals: 6, min: '3000000' },
      { when: 'lastSwapFails', chain: 'eip155:42161', token: t0.arbitrum.usdc, symbol: 'USDC', decimals: 6, min: '2930727' },
    ];
    edit(fallbacks);
    return { fallbacks } as never;
  };
  const rule = (r: never, p = plan) => { try { checkFallbacks(r, p, ctx().config); return 'ok'; } catch (e) { return (e as { rule?: string }).rule; } };
  it("takes the answer's fallbacks only when each is the order's own chain, token and least", () => {
    expect(rule(answer())).toBe('ok');
    expect(rule(answer((f) => { f[0]!.min = '3000001'; }))).toBe('fallbacks');
    expect(rule(answer((f) => { f[1]!.chain = 'eip155:56'; }))).toBe('fallbacks');
    expect(rule(answer((f) => { f[0]!.token = OTHER; }))).toBe('fallbacks');
    expect(rule(answer((f) => { f.pop(); }))).toBe('fallbacks');
    expect(rule({ fallbacks: undefined } as never)).toBe('fallbacks');
    // the token is named and counted as the canister holds it, or the screen's number is off
    expect(rule(answer((f) => { f[1]!.decimals = 18; }))).toBe('fallbacks');
    expect(rule(answer((f) => { f[0]!.symbol = 'ETH'; }))).toBe('fallbacks');
  });
  it('takes none of those fallbacks on an order that is not an Across one', () => {
    const cctp = { ...plan, rail: 'burn', fallbacks: undefined } as never;
    expect(rule(answer(), cctp)).toBe('fallbacks');
    expect(rule({ fallbacks: [{ when: 'notSwapped', chain: 'eip155:42161', token: t0.arbitrum.usdc, symbol: 'USDC', decimals: 6, min: '1' }] } as never, cctp)).toBe('ok');
    expect(rule({ fallbacks: undefined } as never, cctp)).toBe('ok');
  });
});

// An ICP sale paid out through Across (BSC design 4.5), checked before anything is approved: T0's order made the
// canister's plan (the canister its payer and the deposit's depositor), its id under the pool chain's Swapic.
describe('an ICP payout plan through Across', () => {
  const CANISTER_ID = 'hfisl-ayaaa-aaaar-qch3q-cai';
  const CKUSDC = 'xevnm-gaaaa-aaaar-qafnq-cai';
  const NOW_NS = (ORDER.deadline - 600n) * 1_000_000_000n;
  const canister = lower(t0.canister);
  type Shown = { when: string; chain: string; token: string; symbol: string; decimals: number; min: string };
  const LAST_SWAP: Shown = { when: 'lastSwapFails', chain: 'eip155:42161', token: t0.arbitrum.usdc, symbol: 'USDC', decimals: 6, min: '2930727' };

  function icpPlanRoute(edit: Partial<AcrossDeposit> = {}, fallbacks: Shown[] = [LAST_SWAP]) {
    const order: OrderValue = { ...withDeposit({ depositor: canister, ...edit }), payer: canister };
    const delivery = readPlan(ORDER, ctx()).delivery!;
    const direct = edit.message === '0x';
    const minOut = direct ? DEPOSIT.outputAmount : delivery.minOut;
    const recipient = direct ? lower(edit.recipient!) : delivery.recipient;
    const token = direct ? lower(t0.arbitrum.usdc) : delivery.token;
    const route = {
      amountOutMin: minOut.toString(), fallbacks,
      icpSwap: {
        canister: CANISTER_ID,
        approve: { ledger: CKUSDC, spender: CANISTER_ID, amount: '1010000' },
        terms: {
          tokenIn: CKUSDC, amountIn: '1000000', fromSubaccount: null, refundTo: null, slippageBps: 100,
          deadlineNs: (NOW_NS + 600_000_000_000n).toString(), plan: { order: encodeAbiParameters([ORDER_TUPLE], [order as never]), gasLimit: 450000 },
        },
        planned: {
          planned: '990000', expectedSale: '1000000', saleFloor: '995000', premium: '1000', premiumBps: 10, networkFee: '9000', leastPayout: '985000',
          delivery: 'across', dstChain: 42161, recipient, tokenOut: token, expectedOut: minOut.toString(), minOut: minOut.toString(),
          orderId: orderIdOf(order, 8453, getAddress(t0.base.swapic)),
        },
      },
    } as unknown as Route;
    return { route, recipient, token };
  }
  const check = (r: ReturnType<typeof icpPlanRoute>) => {
    try {
      verifyIcpSwap({
        route: r.route, fromLedger: CKUSDC, amountIn: 1_000_000n, ledgerFee: 10_000n, recipientEvm: r.recipient, toToken: r.token,
        toChainId: 42161, canisterId: CANISTER_ID, guard: ctx(), nowNs: NOW_NS,
      });
      return 'passed';
    } catch (e) {
      return (e as { rule?: string }).rule ?? String(e);
    }
  };

  it('takes a plan into a swap on arrival, showing its last swap\'s fallback, the deposit\'s F', () => {
    expect(check(icpPlanRoute())).toBe('passed');
  });
  it('takes a plan straight to the recipient in USDC, showing no fallback', () => {
    expect(check(icpPlanRoute({ message: '0x', recipient: lower(t0.payer) }, []))).toBe('passed');
    expect(check(icpPlanRoute({ message: '0x', recipient: lower(t0.payer) }, [LAST_SWAP]))).toBe('fallbacks');
  });
  it('refuses a fallback that is not the deposit\'s own, or a way back on the pool chain', () => {
    expect(check(icpPlanRoute({}, [{ ...LAST_SWAP, min: '2930728' }]))).toBe('fallbacks');
    expect(check(icpPlanRoute({}, []))).toBe('fallbacks');
    const back: Shown = { when: 'notFilled', chain: 'eip155:8453', token: t0.base.usdc, symbol: 'USDC', decimals: 6, min: '3000000' };
    expect(check(icpPlanRoute({}, [LAST_SWAP, back]))).toBe('fallbacks');
  });
  it('refuses a deposit whose refund is not the canister\'s (AX5)', () => {
    expect(check(icpPlanRoute({ depositor: lower(t0.payer) }))).toBe('refundReceiver');
  });
});
