import { describe, expect, it } from 'vitest';
import type { Route } from '@/lib/api';
import type { GuardError } from './errors';
import { verifyIcpCkSwap, verifyIcpSwap, type IcpCheckInput } from './icp';
import { CKUSDC, ICP_FIXTURE, SWAPIC_CANISTER, icpRoute } from './icp.fixture';
import { ATTACKER } from './forge.fixture';

const NOW_NS = ICP_FIXTURE.nowNs;
function input(route: Route, over: Partial<IcpCheckInput> = {}): IcpCheckInput {
  return {
    route, fromLedger: CKUSDC, amountIn: 1_000_000n, ledgerFee: 10_000n, recipientEvm: ICP_FIXTURE.recipient,
    toToken: ICP_FIXTURE.quote.toToken.address, toChainId: 8453, canisterId: SWAPIC_CANISTER, guard: ICP_FIXTURE.guard, nowNs: NOW_NS, ...over,
  };
}
const rule = (f: () => unknown) => { try { f(); } catch (e) { return (e as GuardError).rule ?? String(e); } return 'passed'; };

describe('verifyIcpSwap', () => {
  it('passes the plan and approves exactly amount plus fee', () => {
    const c = verifyIcpSwap(input(icpRoute()));
    expect(c.approveAmount).toBe(1_010_000n);
    expect(c.minOut).toBe(BigInt(icpRoute().icpSwap!.planned.minOut));
    expect(c.terms.plan.gas_limit).toBe(450_000n);
    expect(c.terms.refund_to).toEqual([]);
  });
  it('refuses another spender, a larger approval, another ledger', () => {
    const a = icpRoute(); a.icpSwap!.approve.spender = 'ryjl3-tyaaa-aaaaa-aaaba-cai';
    expect(rule(() => verifyIcpSwap(input(a)))).toBe('approveSpender');
    const b = icpRoute(); b.icpSwap!.approve.amount = '1010001';
    expect(rule(() => verifyIcpSwap(input(b)))).toBe('approveAmount');
    expect(rule(() => verifyIcpSwap(input(icpRoute(), { fromLedger: 'mxzaz-hqaaa-aaaar-qaada-cai' })))).toBe('tokenIn');
  });
  it('refuses a plan for someone else, another order, or without the anchors', () => {
    expect(rule(() => verifyIcpSwap(input(icpRoute(), { recipientEvm: ATTACKER })))).toBe('recipient');
    const c = icpRoute(); c.icpSwap!.planned.orderId = `0x${'00'.repeat(32)}`;
    expect(rule(() => verifyIcpSwap(input(c)))).toBe('planOrder');
    expect(rule(() => verifyIcpSwap(input(icpRoute(), { guard: undefined })))).toBe('noAnchor');
  });
  it('reads every step of the plan: a step the canister cannot read, or a payout to someone else, is refused', () => {
    const extra = icpRoute((o) => ({ ...o, steps: [{ target: ATTACKER, data: '0x12345678', token: o.tokenIn, min: 0n, writes: [] }, ...o.steps] }));
    expect(rule(() => verifyIcpSwap(input(extra)))).toBe('unknownStep');
    const elsewhere = icpRoute((o) => ({ ...o, payout: { ...o.payout, recipient: ATTACKER } }));
    expect(rule(() => verifyIcpSwap(input(elsewhere)))).toBe('planPayout');
  });
  it('refuses a deadline the canister would refuse, and slippage past 500', () => {
    const late = icpRoute(); late.icpSwap!.terms.deadlineNs = (NOW_NS + 200_000_000_000n).toString();
    expect(rule(() => verifyIcpSwap(input(late)))).toBe('deadline');
    const slip = icpRoute(); slip.icpSwap!.terms.slippageBps = 501;
    expect(rule(() => verifyIcpSwap(input(slip)))).toBe('slippage');
  });
  it('refuses a refund to anyone but the caller', () => {
    const r = icpRoute(); r.icpSwap!.terms.refundTo = 'ryjl3-tyaaa-aaaaa-aaaba-cai';
    expect(rule(() => verifyIcpSwap(input(r)))).toBe('refundTo');
  });
});

const ETH_USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const ckGuard = { ...ICP_FIXTURE.guard, config: { ...ICP_FIXTURE.guard.config, chains: new Map([[1, { ...ICP_FIXTURE.guard.config.chains.values().next().value!, usdc: ETH_USDC as `0x${string}` }]]) } };

/** A ck minter route out of ICP in the shape of answer/mod.rs IcpCkSwapAnswer: 1 ckUSDC, $0.67 of network fee, two ledger fees. */
function ckRoute(): Route {
  const route = { ...icpRoute(), amountOutMin: '310000', icpSwap: undefined } as Route;
  route.icpCkSwap = {
    canister: SWAPIC_CANISTER,
    approve: { ledger: CKUSDC, spender: SWAPIC_CANISTER, amount: '1010000' },
    terms: {
      tokenIn: CKUSDC, amountIn: '1000000', fromSubaccount: null, refundTo: null,
      deadlineNs: (NOW_NS + 600_000_000_000n).toString(), dstChain: 1, recipient: ICP_FIXTURE.recipient, tokenOut: ETH_USDC,
      minOut: '310000', minUsdc: '1000000', networkFee: '670000',
    },
    expectedSale: '1000000', expectedOut: '310000', ledgerFees: '20000',
  };
  return route;
}
const ckInput = (route: Route, over: Partial<IcpCheckInput> = {}) => input(route, { toToken: ETH_USDC, toChainId: 1, guard: ckGuard, ...over });

describe('verifyIcpCkSwap', () => {
  it('passes the terms as the door takes them, approving exactly amount plus fee', () => {
    const c = verifyIcpCkSwap(ckInput(ckRoute()));
    expect(c.door).toBe('ck');
    expect(c.approveAmount).toBe(1_010_000n);
    expect(c.minOut).toBe(310_000n);
    expect(c.terms.dst_chain).toBe(1n);
    expect(c.terms.min_usdc).toBe(1_000_000n);
    expect(c.terms.network_fee).toBe(670_000n);
    expect(c.terms.refund_to).toEqual([]);
    expect(c.terms.from_subaccount).toEqual([]);
  });
  it('holds one door to a route: neither check takes the other route', () => {
    expect(rule(() => verifyIcpCkSwap(ckInput(icpRoute())))).toBe('notIcpCkSwap');
    expect(rule(() => verifyIcpCkSwap(ckInput({ ...ckRoute(), icpSwap: icpRoute().icpSwap })))).toBe('notIcpCkSwap');
    expect(rule(() => verifyIcpSwap(input(ckRoute())))).toBe('notIcpSwap');
  });
  it('refuses another spender, a larger approval, another ledger, or no anchor', () => {
    const a = ckRoute(); a.icpCkSwap!.approve.spender = 'ryjl3-tyaaa-aaaaa-aaaba-cai';
    expect(rule(() => verifyIcpCkSwap(ckInput(a)))).toBe('approveSpender');
    const b = ckRoute(); b.icpCkSwap!.approve.amount = '1010001';
    expect(rule(() => verifyIcpCkSwap(ckInput(b)))).toBe('approveAmount');
    expect(rule(() => verifyIcpCkSwap(ckInput(ckRoute(), { fromLedger: 'mxzaz-hqaaa-aaaar-qaada-cai' })))).toBe('tokenIn');
    expect(rule(() => verifyIcpCkSwap(ckInput(ckRoute(), { guard: undefined })))).toBe('noAnchor');
  });
  it('refuses a payout to someone else, in another token, or on another chain', () => {
    expect(rule(() => verifyIcpCkSwap(ckInput(ckRoute(), { recipientEvm: ATTACKER })))).toBe('recipient');
    const token = ckRoute(); token.icpCkSwap!.terms.tokenOut = ATTACKER;
    expect(rule(() => verifyIcpCkSwap(ckInput(token, { toToken: ATTACKER })))).toBe('tokenOut');
    const chain = ckRoute(); chain.icpCkSwap!.terms.dstChain = 8453;
    expect(rule(() => verifyIcpCkSwap(ckInput(chain)))).toBe('dstChain');
  });
  it('refuses less than the screen shows, and a floor that cannot pay the minimum', () => {
    const shown = ckRoute(); shown.amountOutMin = '310001';
    expect(rule(() => verifyIcpCkSwap(ckInput(shown)))).toBe('minOut');
    const floor = ckRoute(); floor.icpCkSwap!.terms.minUsdc = '999999';
    expect(rule(() => verifyIcpCkSwap(ckInput(floor)))).toBe('minUsdc');
  });
  it('refuses a deadline the canister would refuse, and a refund to anyone but the caller', () => {
    const late = ckRoute(); late.icpCkSwap!.terms.deadlineNs = (NOW_NS + 200_000_000_000n).toString();
    expect(rule(() => verifyIcpCkSwap(ckInput(late)))).toBe('deadline');
    const refund = ckRoute(); refund.icpCkSwap!.terms.refundTo = 'aaaaa-aa';
    expect(rule(() => verifyIcpCkSwap(ckInput(refund)))).toBe('refundTo');
  });
});
