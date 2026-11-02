import { describe, expect, it, vi } from 'vitest';
import { Principal } from '@icp-sdk/core/principal';
import { HttpFetchErrorCode, TransportError } from '@icp-sdk/core/agent';
import { SignerError } from '@icp-sdk/signer';
import type { Quote } from '@/lib/api';
import { ApiError } from '@/lib/api';
import type { IcpClient } from '@/lib/icp';
import { PoolErrorFailure } from '@/lib/icp';
import type { EvmSigner } from '@/lib/wallets';
import type { UiToken } from '@/components/ui/token-types';
import { executeSwap, type ExecDeps, type ExecInput } from './execute';
import { GUARD, ICP_ME, PAYER, SWAPIC, load } from './guards/forge.fixture';
import { CKUSDC, ICP_FIXTURE, icpRoute } from './guards/icp.fixture';

const tok = (q: Quote, side: 'fromToken' | 'toToken', chain: string): UiToken => ({
  key: '', chain, chainId: Number(chain.split(':')[1]), chainName: '', chainLogo: '', chain_type: 'EVM', address: q[side].address.toLowerCase(),
  symbol: q[side].symbol, name: q[side].symbol, logo: '', decimals: q[side].decimals, priceUsd: null, verified: true,
});
const lower = (a: string) => a.toLowerCase() as `0x${string}`;

function signer(over: Partial<EvmSigner> = {}): EvmSigner {
  return {
    address: lower(PAYER), ensureChain: vi.fn(async () => {}), signTypedData: vi.fn(async () => `0x${'ab'.repeat(65)}` as const),
    sendTransaction: vi.fn(async () => `0x${'cd'.repeat(32)}` as const), waitForReceipt: vi.fn(async () => 'success' as const),
    maxFeePerGas: vi.fn(async () => 1n), ...over,
  };
}
function icp(over: Partial<IcpClient> = {}): IcpClient {
  return { getConfig: async () => GUARD.config, ecoProver: async () => GUARD.ecoProver, canisterEvmAddress: async () => GUARD.canisterEvm, ...over } as IcpClient;
}
/** A clock the test moves: every sleep moves it on. */
function clockAt(ms: number) {
  let t = ms;
  return { nowMs: () => t, sleep: vi.fn(async (d: number) => { t += d; }) };
}
function setup(name: string, mode: 'gasless' | 'userPays', over: { deps?: Partial<ExecDeps>; input?: Partial<ExecInput> } = {}) {
  const q = load(name);
  const route = q[mode].routes.find((r) => r.executable)!;
  const deps: ExecDeps = {
    getQuote: vi.fn(async () => q), getOrders: vi.fn(), submitGasless: vi.fn(async () => ({ orderId: route.orderId!, status: 'submitted' as const })),
    icp: icp(), ...clockAt((q.quotedAt + 3) * 1000), ...over.deps,
  };
  const input: ExecInput = {
    query: { fromChain: q.fromChain, fromToken: q.fromToken.address, amount: q.amountIn, toChain: q.toChain, toToken: q.toToken.address, payer: PAYER, recipient: route.envelope?.recipient ?? PAYER, allRoutes: true },
    pick: { mode, routeId: route.routeId, tags: [mode === 'gasless' ? 'Gasless' : 'Fastest'] }, shownMin: BigInt(route.amountOutMin), amountIn: BigInt(q.amountIn),
    from: tok(q, 'fromToken', q.fromChain), to: tok(q, 'toToken', q.toChain), recipient: route.envelope?.recipient ?? PAYER,
    evm: signer(), icpCaller: null, onStep: vi.fn(), ...over.input,
  };
  return { q, route, deps, input };
}

describe('executeSwap, EVM', () => {
  it('gasless 3009: signs the rebuilt typed data and posts the exact submit body', async () => {
    const { route, deps, input, q } = setup('arb-usdc-to-pol-wbtc', 'gasless');
    const r = await executeSwap(input, deps);
    expect(r).toEqual({ kind: 'started', activityId: route.orderId!.toLowerCase() });
    expect(input.evm!.ensureChain).toHaveBeenCalledWith(42161);
    expect(deps.submitGasless).toHaveBeenCalledWith({
      orderId: route.orderId!.toLowerCase(),
      auth: { ...route.sign!.auth, signature: `0x${'ab'.repeat(65)}`, acceptance: '0x' },
      signedAt: (q.quotedAt + 3) * 1000,
    });
  });
  it('gasless Permit2: sends the one time approval and waits for it before signing', async () => {
    const { input, deps } = setup('pol-wbtc-to-arb-usdc', 'gasless');
    const order: string[] = [];
    input.evm = signer({
      sendTransaction: vi.fn(async (tx) => { order.push(`send:${tx.to.toLowerCase()}`); return `0x${'cd'.repeat(32)}` as const; }),
      waitForReceipt: vi.fn(async () => { order.push('receipt'); return 'success' as const; }),
      signTypedData: vi.fn(async () => { order.push('sign'); return `0x${'ab'.repeat(65)}` as const; }),
    });
    await executeSwap(input, deps);
    expect(order).toEqual(['send:0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6', 'receipt', 'sign']);
  });
  it('you pay gas: approves Swapic, then sends run(order) to Swapic', async () => {
    const { input, deps, route } = setup('arb-usdc-to-pol-wbtc', 'userPays');
    await executeSwap(input, deps);
    const sends = (input.evm!.sendTransaction as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
    expect(sends[0].to.toLowerCase()).toBe('0xaf88d065e77c8cc2239327c5edb3a432268e5831');
    expect(sends[1]).toMatchObject({ chainId: 42161, data: route.tx!.data, value: 0n });
    expect(sends[1].to.toLowerCase()).toBe(SWAPIC);
  });
  it('stops with newPrice when the fresh minimum is lower, signing nothing (Review Focus 4)', async () => {
    const { input, deps } = setup('arb-usdc-to-pol-wbtc', 'gasless', { input: { shownMin: 999_999n } });
    expect((await executeSwap(input, deps)).kind).toBe('newPrice');
    expect(input.evm!.signTypedData).not.toHaveBeenCalled();
  });
  it('a wallet "no" returns rejected; a check that fails at signing time returns the guard sentence', async () => {
    const a = setup('arb-usdc-to-pol-wbtc', 'gasless');
    a.input.evm = signer({ signTypedData: vi.fn(async () => { throw Object.assign(new Error('User rejected the request.'), { code: 4001 }); }) });
    expect(await executeSwap(a.input, a.deps)).toEqual({ kind: 'rejected' });
    const message = 'This quote could not be checked. Get a new quote and try again.';
    const late = setup('arb-usdc-to-pol-wbtc', 'gasless');
    late.deps.nowMs = () => (late.q.quotedAt + 3_600) * 1000; // the order's deadline has passed
    expect(await executeSwap(late.input, late.deps)).toEqual({ kind: 'failed', message });
    const blind = setup('arb-usdc-to-pol-wbtc', 'gasless', { deps: { icp: icp({ getConfig: async () => { throw new Error('canister unreachable'); } }) } });
    expect(await executeSwap(blind.input, blind.deps)).toEqual({ kind: 'failed', message });
    expect(late.input.evm!.signTypedData).not.toHaveBeenCalled();
    expect(blind.input.evm!.signTypedData).not.toHaveBeenCalled();
  });
  it('a lost submit answer is resumed with the identical body (Review Focus 3)', async () => {
    const { input, deps } = setup('arb-usdc-to-pol-wbtc', 'gasless');
    deps.submitGasless = vi.fn().mockRejectedValueOnce(new ApiError(0, 'network', 'x', '/v2/orders')).mockResolvedValueOnce({ orderId: '0x', status: 'submitted' });
    const r = await executeSwap(input, deps);
    expect(r.kind).toBe('unknown');
    await (r as { resume: () => Promise<unknown> }).resume();
    const calls = (deps.submitGasless as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[1]![0]).toEqual(calls[0]![0]);
    expect(input.evm!.signTypedData).toHaveBeenCalledTimes(1);
  });
  it('a submit lost inside the agent (agent 5 TransportError) is resumed too, never signed again', async () => {
    const { input, deps } = setup('arb-usdc-to-pol-wbtc', 'gasless');
    deps.submitGasless = vi.fn().mockRejectedValueOnce(TransportError.fromCode(new HttpFetchErrorCode(new TypeError('fetch failed'))));
    expect((await executeSwap(input, deps)).kind).toBe('unknown');
    expect(input.evm!.signTypedData).toHaveBeenCalledTimes(1);
  });
});

describe('executeSwap, ICP', () => {
  const caller = { agent: {} as never, principal: Principal.fromText(ICP_ME) };
  const lost = () => new TypeError('fetch failed');
  function icpSetup(client: Partial<IcpClient>, route = icpRoute()) {
    const q = { ...ICP_FIXTURE.quote, gasless: { allowed: false, routes: [] }, userPays: { allowed: false, routes: [] }, icpPull: { allowed: true, routes: [route] } };
    const icpc = icp({
      ledgerFee: async () => 10_000n, balance: async () => 5_000_000n, allowance: async () => 0n, approve: vi.fn(async () => 1n),
      swapFromIcp: vi.fn(async () => ({ id: 41n, status: { Signed: 7n } })), ...client,
    });
    const clock = clockAt(ICP_FIXTURE.nowMs);
    const deps: ExecDeps = { getQuote: vi.fn(async () => q), getOrders: vi.fn(), submitGasless: vi.fn(), icp: icpc, ...clock };
    const input: ExecInput = {
      query: {} as never, pick: { mode: 'icpPull', routeId: 'pool', tags: ['Gasless'] }, shownMin: BigInt(route.amountOutMin), amountIn: 1_000_000n,
      from: { ...ICP_FIXTURE.from }, to: { ...ICP_FIXTURE.to }, recipient: ICP_FIXTURE.recipient, evm: null, icpCaller: caller, onStep: vi.fn(), onNote: vi.fn(),
    };
    return { deps, input, icpc, clock };
  }
  it('approves exactly amount plus fee, then calls swap_from_icp', async () => {
    const { deps, input, icpc } = icpSetup({});
    expect(await executeSwap(input, deps)).toEqual({ kind: 'started', activityId: 'payout-41' });
    expect(icpc.approve).toHaveBeenCalledWith(caller, CKUSDC, 1_010_000n);
  });
  it('reuses a live allowance of exactly that amount, never approving twice', async () => {
    const { deps, input, icpc } = icpSetup({ allowance: async () => 1_010_000n });
    await executeSwap(input, deps);
    expect(icpc.approve).not.toHaveBeenCalled();
  });
  it('lost answer, pulled: the balance fell by the amount; History and the canister name the payout', async () => {
    const s = icpSetup({
      swapFromIcp: vi.fn(async () => { throw lost(); }),
      balance: vi.fn().mockResolvedValueOnce(5_000_000n).mockResolvedValueOnce(4_990_000n).mockResolvedValue(3_980_000n),
      payout: vi.fn(async () => ({ kind: { IcpSwap: null }, terms: { recipient: ICP_FIXTURE.recipient, token_out: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', dst_chain: 8453n } }) as never),
    });
    s.deps.getOrders = vi.fn(async () => ({ orders: [{ id: 'payout-41', createdAt: ICP_FIXTURE.nowMs / 1000, from: { amount: '1000000' } }], nextCursor: null }) as never);
    expect(await executeSwap(s.input, s.deps)).toEqual({ kind: 'started', activityId: 'payout-41' });
    expect(s.icpc.payout).toHaveBeenCalledWith(41n);
  });
  it('lost answer, an approval that ran out: zero allowance is not "pulled"; nothing was taken, said only after 6 minutes', async () => {
    const s = icpSetup({ swapFromIcp: vi.fn(async () => { throw lost(); }), balance: async () => 4_990_000n, allowance: async () => 0n });
    expect(await executeSwap(s.input, s.deps)).toEqual({ kind: 'failed', message: 'Nothing was taken. Get a new quote and try again.' });
    expect(s.clock.nowMs() - ICP_FIXTURE.nowMs).toBeGreaterThanOrEqual(360_000);
    expect(s.icpc.swapFromIcp).toHaveBeenCalledTimes(1);
  });
  it('lost answer, still allowed after 6 minutes with time left: resume calls swap_from_icp again without approving', async () => {
    const route = icpRoute();
    route.icpSwap!.terms.deadlineNs = (ICP_FIXTURE.nowNs + 1_800_000_000_000n).toString();
    const s = icpSetup({
      swapFromIcp: vi.fn().mockRejectedValueOnce(lost()).mockResolvedValueOnce({ id: 42n, status: { Signed: 1n } }),
      balance: async () => 4_990_000n, allowance: vi.fn().mockResolvedValueOnce(0n).mockResolvedValue(1_010_000n),
    }, route);
    const r = await executeSwap(s.input, s.deps);
    expect(r).toMatchObject({ kind: 'unknown', message: 'Nothing was taken. Try again.' });
    expect(await (r as { resume: () => Promise<unknown> }).resume()).toEqual({ kind: 'started', activityId: 'payout-42' });
    expect(s.icpc.approve).toHaveBeenCalledTimes(1);
  });
  it('lost answer, the balance moved some other way: says it cannot tell, no retry', async () => {
    const s = icpSetup({ swapFromIcp: vi.fn(async () => { throw lost(); }), balance: vi.fn().mockResolvedValueOnce(5_000_000n).mockResolvedValueOnce(4_990_000n).mockResolvedValue(4_995_000n) });
    expect(await executeSwap(s.input, s.deps)).toEqual({ kind: 'unknown', message: 'We cannot tell yet whether your swap started. Check History before you try again.', resume: null });
  });
  // agent 5 wraps a failed fetch in TransportError, and a signer whose channel closed answers ICRC-25 4001: both are lost
  // answers, so the records decide (stack note, lead's ruling 2026-10-29), never "rejected" and never a plain failure
  for (const [name, error] of [
    ['agent 5 TransportError', () => TransportError.fromCode(new HttpFetchErrorCode(new TypeError('fetch failed')))],
    ['a closed signer channel (ICRC-25 4001)', () => new SignerError({ code: 4001, message: 'The transport channel was closed unexpectedly' })],
  ] as const) {
    it(`lost answer as ${name}: read from the records, the payout named`, async () => {
      const s = icpSetup({
        swapFromIcp: vi.fn(async () => { throw error(); }),
        balance: vi.fn().mockResolvedValueOnce(5_000_000n).mockResolvedValueOnce(4_990_000n).mockResolvedValue(3_980_000n),
        payout: vi.fn(async () => ({ kind: { IcpSwap: null }, terms: { recipient: ICP_FIXTURE.recipient, token_out: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', dst_chain: 8453n } }) as never),
      });
      s.deps.getOrders = vi.fn(async () => ({ orders: [{ id: 'payout-41', createdAt: ICP_FIXTURE.nowMs / 1000, from: { amount: '1000000' } }], nextCursor: null }) as never);
      expect(await executeSwap(s.input, s.deps)).toEqual({ kind: 'started', activityId: 'payout-41' });
      expect(s.icpc.swapFromIcp).toHaveBeenCalledTimes(1);
    });
  }
  it('an ICP signer saying no (ICRC-25 3001) returns rejected', async () => {
    const { deps, input } = icpSetup({ swapFromIcp: vi.fn(async () => { throw new SignerError({ code: 3001, message: 'The user has canceled the action' }); }) });
    expect(await executeSwap(input, deps)).toEqual({ kind: 'rejected' });
  });
  it('says the canister refusal in plain words', async () => {
    const { deps, input } = icpSetup({ swapFromIcp: vi.fn(async () => { throw new PoolErrorFailure({ NotAllowed: 'past five calls a minute' }); }) });
    expect(await executeSwap(input, deps)).toEqual({ kind: 'failed', message: 'Too many tries, wait a minute' });
  });
});
