import { describe, expect, it } from 'vitest';
import type { Route } from '@/lib/api';
import type { GuardError } from './errors';
import { verifyIcpSwap, type IcpCheckInput } from './icp';
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
