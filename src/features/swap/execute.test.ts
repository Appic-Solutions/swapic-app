import { describe, expect, it, vi } from 'vitest';
import { decodeFunctionData, erc20Abi, getAddress, maxUint256, recoverTypedDataAddress, toFunctionSelector, type Hex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { Principal } from '@icp-sdk/core/principal';
import { HttpFetchErrorCode, TransportError } from '@icp-sdk/core/agent';
import { SignerError } from '@icp-sdk/signer';
import type { Quote, Route } from '@/lib/api';
import { config } from '@/config';
import { ApiError } from '@/lib/api';
import type { IcpClient } from '@/lib/icp';
import { PoolErrorFailure } from '@/lib/icp';
import type { EvmSigner } from '@/lib/wallets';
import type { SignableTypedData } from '@/lib/wallets';
import type { UiToken } from '@/components/ui/token-types';
import { executeSwap, sendCheckedEvm, walletSteps, type ExecDeps, type ExecInput, payoutIsThisSwap } from './execute';
import { ATTACKER, GUARD, ICP_ME, PAYER, SWAPIC, clone, forge, load, maxToPermit2, permit2PayOf } from './guards/forge.fixture';
import { PERMIT2, SWAPIC_PERMIT2_ABI, orderIdOf, type OrderValue } from './guards/abi';
import { verifyEvmRoute } from './guards/evm';
import { ownSignature } from '@/lib/wallets/guard';
import { CKUSDC, ICP_FIXTURE, icpRoute } from './guards/icp.fixture';
import { cushioned } from './options';

const tok = (q: Quote, side: 'fromToken' | 'toToken', chain: string): UiToken => ({
  key: '', chain, chainId: Number(chain.split(':')[1]), chainName: '', chainLogo: '', chain_type: 'EVM', address: q[side].address.toLowerCase(),
  symbol: q[side].symbol, name: q[side].symbol, logo: '', decimals: q[side].decimals, priceUsd: null, verified: true,
});
const lower = (a: string) => a.toLowerCase() as `0x${string}`;
const getAddressOf = (a: string) => getAddress(a);

function signer(over: Partial<EvmSigner> = {}): EvmSigner {
  return {
    address: lower(PAYER), ensureChain: vi.fn(async () => {}), signTypedData: vi.fn(async () => `0x${'ab'.repeat(65)}` as const),
    sendTransaction: vi.fn(async () => `0x${'cd'.repeat(32)}` as const), waitForReceipt: vi.fn(async () => 'success' as const),
    maxFeePerGas: vi.fn(async () => 1n), payerOn: vi.fn(async () => 'plain' as const), allowanceOf: vi.fn(async () => 0n), ownSignature: vi.fn(async (_td, signature) => signature), ...over,
  };
}
function icp(over: Partial<IcpClient> = {}): IcpClient {
  return { getConfig: async () => GUARD.config, ecoProver: async () => GUARD.ecoProver, ckHelper: async () => GUARD.ckHelper, canisterEvmAddress: async () => GUARD.canisterEvm, ...over } as IcpClient;
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
    // a gasless order is not seen starting on chain here: Your swap gets its deadline
    expect(r).toEqual({ kind: 'started', activityId: route.orderId!.toLowerCase(), deadline: Number(route.order!.deadline) });
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
  const approved = (input: ExecInput) => (input.evm!.sendTransaction as ReturnType<typeof vi.fn>).mock.calls.map((c) => decodeFunctionData({ abi: erc20Abi, data: c[0].data }).args);
  it('gasless Permit2: sends the maximum to Permit2 as the quote asks it', async () => {
    const { deps, input, route } = setup('pol-wbtc-to-arb-usdc', 'gasless');
    route.sign!.approval!.amount = maxUint256.toString();
    expect((await executeSwap(input, deps)).kind).toBe('started');
    expect(approved(input)).toEqual([[getAddressOf(route.sign!.approval!.spender), maxUint256]]);
  });
  it('a token that refuses an approve over a live allowance: clears it, waits, then approves, all one step', async () => {
    const { deps, input, route } = setup('pol-wbtc-to-arb-usdc', 'gasless');
    route.sign!.approval!.amount = maxUint256.toString();
    route.sign!.approval!.resetFirst = true;
    const order: string[] = [];
    input.evm = signer({
      sendTransaction: vi.fn(async () => { order.push('send'); return `0x${'cd'.repeat(32)}` as const; }),
      waitForReceipt: vi.fn(async () => { order.push('receipt'); return 'success' as const; }),
      signTypedData: vi.fn(async () => { order.push('sign'); return `0x${'ab'.repeat(65)}` as const; }),
    });
    expect((await executeSwap(input, deps)).kind).toBe('started');
    expect(order).toEqual(['send', 'receipt', 'send', 'receipt', 'sign']);
    const spender = getAddressOf(route.sign!.approval!.spender);
    expect(approved(input)).toEqual([[spender, 0n], [spender, maxUint256]]);
    expect((input.onStep as ReturnType<typeof vi.fn>).mock.calls).toEqual([[0, 'wait'], [0, 'done'], [1, 'wait'], [1, 'done']]);
  });
  it('an approve says when the wallet asks and when its transaction waits for the network, twice for a token set to 0 first', async () => {
    const { deps, input, route } = setup('pol-wbtc-to-arb-usdc', 'gasless');
    route.sign!.approval!.resetFirst = true;
    const order: string[] = [];
    input.onApproval = vi.fn((i: number, on: 'wallet' | 'network') => { order.push(`${on}:${i}`); });
    input.evm = signer({
      sendTransaction: vi.fn(async () => { order.push('send'); return `0x${'cd'.repeat(32)}` as const; }),
      waitForReceipt: vi.fn(async () => { order.push('receipt'); return 'success' as const; }),
    });
    expect((await executeSwap(input, deps)).kind).toBe('started');
    expect(order).toEqual(['wallet:0', 'send', 'network:0', 'receipt', 'wallet:0', 'send', 'network:0', 'receipt']);
  });
  it('a clear that does not land stops there, nothing approved or signed', async () => {
    const { deps, input, route } = setup('pol-wbtc-to-arb-usdc', 'gasless');
    route.sign!.approval!.resetFirst = true;
    input.evm = signer({ waitForReceipt: vi.fn(async () => 'reverted' as const) });
    expect(await executeSwap(input, deps)).toEqual({ kind: 'failed', message: 'The approval did not go through. Try again.' });
    expect(input.evm.sendTransaction).toHaveBeenCalledTimes(1);
    expect(input.evm.signTypedData).not.toHaveBeenCalled();
  });
  it('gasless 2612: no approve, the permit then the acceptance signed, each in its slot of the submit', async () => {
    const { deps, input, route, q } = setup('pol-wbtc-to-arb-usdc', 'gasless');
    const o = route.order!;
    // what the quoter answers (order/mod.rs permit_2612, quote_acceptance), EIP712Domain and all
    const domainTypes = [{ name: 'name', type: 'string' }, { name: 'version', type: 'string' }, { name: 'chainId', type: 'uint256' }, { name: 'verifyingContract', type: 'address' }];
    route.sign = {
      door: 'permit2612',
      typedData: [
        {
          types: { EIP712Domain: domainTypes, Permit: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'nonce', type: 'uint256' }, { name: 'deadline', type: 'uint256' }] },
          primaryType: 'Permit',
          domain: { name: 'Arbitrum', version: '1', chainId: 137, verifyingContract: o.tokenIn },
          message: { owner: o.payer, spender: getAddressOf(SWAPIC), value: o.amountIn, nonce: '5', deadline: o.deadline },
        },
        {
          types: { EIP712Domain: domainTypes, QuoteAcceptance: [{ name: 'orderId', type: 'bytes32' }, { name: 'payer', type: 'address' }, { name: 'tokenIn', type: 'address' }, { name: 'amountIn', type: 'uint256' }, { name: 'deadline', type: 'uint256' }] },
          primaryType: 'QuoteAcceptance',
          domain: { name: 'Swapic', version: '3', chainId: 137, verifyingContract: getAddressOf(SWAPIC) },
          message: { orderId: route.orderId, payer: o.payer, tokenIn: o.tokenIn, amountIn: o.amountIn, deadline: o.deadline },
        },
      ],
      auth: { door: 'permit2612', validAfter: '0', validBefore: '0', nonce: '0', deadline: o.deadline },
    };
    // a real key, so viem must be able to encode each typed data as the wallet will
    const key = privateKeyToAccount(generatePrivateKey());
    const signed: { td: SignableTypedData; sig: Hex }[] = [];
    input.evm = signer({ signTypedData: vi.fn(async (td: SignableTypedData) => { const sig = await key.signTypedData(td as never); signed.push({ td, sig }); return sig; }) });
    expect(await executeSwap(input, deps)).toEqual({ kind: 'started', activityId: route.orderId!.toLowerCase(), deadline: Number(o.deadline) });
    expect(input.evm.sendTransaction).not.toHaveBeenCalled();
    expect(signed.map((s) => s.td.primaryType)).toEqual(['Permit', 'QuoteAcceptance']);
    for (const { td, sig } of signed) expect(await recoverTypedDataAddress({ ...td, signature: sig } as never)).toBe(key.address);
    expect(deps.submitGasless).toHaveBeenCalledWith({
      orderId: route.orderId!.toLowerCase(),
      auth: { door: 'permit2612', validAfter: '0', validBefore: '0', nonce: '0', deadline: o.deadline, signature: signed[0]!.sig, acceptance: signed[1]!.sig },
      signedAt: (q.quotedAt + 3) * 1000,
    });
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
  it('a built order a few dozen units under the list quote goes on quietly while it pays the cushioned minimum shown', async () => {
    // the list quote's least was 42 micro USDC higher: its network fee 53,464 against the built order's 53,506 (measured)
    const a = setup('pol-wbtc-to-arb-usdc', 'gasless');
    const built = BigInt(a.route.amountOutMin);
    a.input.shownMin = cushioned(built + 42n);
    expect(a.input.shownMin).toBeLessThan(built);
    expect((await executeSwap(a.input, a.deps)).kind).toBe('started');
    expect(a.input.evm!.signTypedData).toHaveBeenCalled();
    // one unit under the minimum on screen asks again, nothing signed
    const b = setup('pol-wbtc-to-arb-usdc', 'gasless');
    b.input.shownMin = built + 1n;
    expect((await executeSwap(b.input, b.deps)).kind).toBe('newPrice');
    expect(b.input.evm!.signTypedData).not.toHaveBeenCalled();
    expect(b.input.evm!.sendTransaction).not.toHaveBeenCalled();
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

describe('executeSwap, you pay gas: the swap is sent fresh and counts once the chain has it', () => {
  const SWAP_HASH = `0x${'5a'.repeat(32)}` as const;
  const APPROVE_HASH = `0x${'a1'.repeat(32)}` as const;
  /** The you pay gas run with a clock the approval's receipt moves (an approve mined slowly on Ethereum). */
  function slow(approvedAt: ((deadline: number) => number) | null, over: { swapReceipt?: EvmSigner['waitForReceipt'] } = {}) {
    const s = setup('arb-usdc-to-pol-wbtc', 'userPays');
    const deadline = Number(s.route.order!.deadline);
    let t = (s.q.quotedAt + 3) * 1000;
    s.deps.nowMs = () => t;
    // virtual timers: each turn the earliest sleep ends and the clock moves to it, so a receipt already there always wins
    // the race against a sleep, and a sleep left behind by a race never moves the clock past one still awaited
    const timers: { at: number; done: () => void }[] = [];
    s.deps.sleep = vi.fn((ms: number) => new Promise<void>((done) => {
      timers.push({ at: t + ms, done });
      setTimeout(() => {
        timers.sort((a, b) => a.at - b.at);
        const next = timers.shift();
        if (next) { t = Math.max(t, next.at); next.done(); }
      }, 0);
    }));
    const sent: { to: string; data: string }[] = [];
    s.input.evm = signer({
      sendTransaction: vi.fn(async (tx) => { sent.push(tx); return tx.to.toLowerCase() === SWAPIC ? SWAP_HASH : APPROVE_HASH; }),
      waitForReceipt: vi.fn(async (_c: number, hash: `0x${string}`, ms?: number) => {
        if (hash === APPROVE_HASH) { if (approvedAt) t = approvedAt(deadline) * 1000; return 'success' as const; }
        return over.swapReceipt ? over.swapReceipt(_c, hash, ms) : 'success' as const;
      }),
    });
    s.input.onSent = vi.fn();
    return { ...s, sent, deadline, swaps: () => sent.filter((x) => x.to.toLowerCase() === SWAPIC) };
  }
  /** The quoter's next answer: the same route built again with a later deadline (as a fresh named quote is), its least out changed by `minDelta`. */
  function nextQuote(q: Quote, route: Route, minDelta = 0n): { q: Quote; route: Route } {
    const fresh = forge(q, route, (o) => ({ ...o, deadline: o.deadline + 120n }), route.contracts!.source.swapic as `0x${string}`);
    fresh.amountOutMin = (BigInt(route.amountOutMin) + minDelta).toString();
    const q2 = clone(q);
    q2.quotedAt = q.quotedAt + 120;
    q2.userPays.routes = q2.userPays.routes.map((r) => (r.routeId === route.routeId ? fresh : r));
    return { q: q2, route: fresh };
  }

  it('the forged next quote is one the guard accepts (the test\'s own premise)', () => {
    const { q, route } = setup('arb-usdc-to-pol-wbtc', 'userPays');
    const n = nextQuote(q, route);
    const c = verifyEvmRoute({ quote: n.q, route: n.route, mode: 'userPays', payer: PAYER, recipient: PAYER, fromToken: q.fromToken.address, toToken: q.toToken.address, amountIn: BigInt(q.amountIn), guard: GUARD, nowSec: q.quotedAt + 120 });
    expect(c.deadline).toBe(BigInt(route.order!.deadline) + 120n);
  });
  it('time to spare: sends the reviewed order, waits for its receipt, and only then has it started', async () => {
    const s = slow(null);
    const r = await executeSwap(s.input, s.deps);
    expect(r).toEqual({ kind: 'started', activityId: s.route.orderId!.toLowerCase() });
    expect(s.deps.getQuote).toHaveBeenCalledTimes(1);
    expect(s.swaps()[0]!.data).toBe(s.route.tx!.data);
    expect(s.input.evm!.waitForReceipt).toHaveBeenLastCalledWith(42161, SWAP_HASH, expect.any(Number));
    expect(s.input.onSent).toHaveBeenCalledWith(1, SWAP_HASH);
    expect((s.input.onStep as ReturnType<typeof vi.fn>).mock.calls).toEqual([[0, 'wait'], [0, 'done'], [1, 'wait'], [1, 'done']]);
  });
  it('under 90 s left after the approval: asks the same named route again and sends the fresh order quietly when it gives more', async () => {
    // the approve mined 60 s before the order's deadline
    const s = slow((deadline) => deadline - 60);
    s.input.shownMin = BigInt(s.route.amountOutMin) - 1n;
    const n = nextQuote(s.q, s.route);
    s.deps.getQuote = vi.fn().mockResolvedValueOnce(s.q).mockResolvedValueOnce(n.q);
    const r = await executeSwap(s.input, s.deps);
    expect(r).toEqual({ kind: 'started', activityId: n.route.orderId!.toLowerCase() });
    // the same ask both times: the review's named query
    expect((s.deps.getQuote as ReturnType<typeof vi.fn>).mock.calls).toEqual([[s.input.query], [s.input.query]]);
    // one approval (never asked again for the fresh order), then the fresh order's run
    expect(s.sent).toHaveLength(2);
    expect(s.swaps()).toHaveLength(1);
    expect(s.swaps()[0]!.data).toBe(n.route.tx!.data);
    expect(s.swaps()[0]!.data).not.toBe(s.route.tx!.data);
  });
  it('the same least out as reviewed is sent quietly too', async () => {
    const s = slow((deadline) => deadline - 60);
    const n = nextQuote(s.q, s.route);
    s.deps.getQuote = vi.fn().mockResolvedValueOnce(s.q).mockResolvedValueOnce(n.q);
    expect((await executeSwap(s.input, s.deps)).kind).toBe('started');
    expect(s.swaps()[0]!.data).toBe(n.route.tx!.data);
  });
  it('under 90 s left and the fresh order gives less: back to Review with the new price, nothing sent', async () => {
    const s = slow((deadline) => deadline - 60);
    const n = nextQuote(s.q, s.route, -1n);
    s.deps.getQuote = vi.fn().mockResolvedValueOnce(s.q).mockResolvedValueOnce(n.q);
    const r = await executeSwap(s.input, s.deps);
    expect(r.kind).toBe('newPrice');
    expect((r as { option: { route: Route } }).option.route.orderId).toBe(n.route.orderId);
    expect(s.swaps()).toHaveLength(0);
    expect(s.input.onSent).not.toHaveBeenCalled();
  });
  it('the deadline already passed: an expired order is never sent; a fresh one is', async () => {
    // the quoter answers the same, now expired, order: refused by the same guard, only the approval went out
    const a = slow((deadline) => deadline + 5);
    expect(await executeSwap(a.input, a.deps)).toEqual({ kind: 'failed', message: 'This quote could not be checked. Get a new quote and try again.' });
    expect(a.swaps()).toHaveLength(0);
    // a fresh order with time left goes out instead
    const b = slow((deadline) => deadline + 5);
    const n = nextQuote(b.q, b.route);
    b.deps.getQuote = vi.fn().mockResolvedValueOnce(b.q).mockResolvedValueOnce(n.q);
    expect((await executeSwap(b.input, b.deps)).kind).toBe('started');
    expect(b.swaps().map((x) => x.data)).toEqual([n.route.tx!.data]);
  });
  it('a reverted swap: the step fails and the note says nothing was swapped', async () => {
    const s = slow(null, { swapReceipt: async () => 'reverted' });
    expect(await executeSwap(s.input, s.deps)).toEqual({ kind: 'failed', message: 'The transaction failed on the network. Your tokens stayed in your wallet. Try again.' });
    expect((s.input.onStep as ReturnType<typeof vi.fn>).mock.calls.at(-1)).toEqual([1, 'fail']);
  });
  it('a hash with no receipt by the deadline and a minute (a smart transaction that never landed): never sent', async () => {
    const s = slow(null, { swapReceipt: () => new Promise(() => {}) });
    expect(await executeSwap(s.input, s.deps)).toEqual({ kind: 'failed', message: 'The transaction was not confirmed in time. Your tokens stayed in your wallet. Try again.' });
    // looked for until the order's deadline plus 60 s, by this clock
    expect(s.deps.nowMs()).toBe((s.deadline + 60) * 1000);
    expect((s.input.onStep as ReturnType<typeof vi.fn>).mock.calls.at(-1)).toEqual([1, 'fail']);
  });
  it('the receipt read keeps failing to the end: the tracking decides, with the order\'s deadline', async () => {
    const s = slow(null, { swapReceipt: async () => { throw new Error('rpc down'); } });
    expect(await executeSwap(s.input, s.deps)).toEqual({ kind: 'started', activityId: s.route.orderId!.toLowerCase(), deadline: s.deadline });
  });
  it('a failed read, then the receipt: started as usual', async () => {
    let n = 0;
    const s = slow(null, { swapReceipt: async () => { if (n++ === 0) throw new Error('rpc blip'); return 'success'; } });
    expect(await executeSwap(s.input, s.deps)).toEqual({ kind: 'started', activityId: s.route.orderId!.toLowerCase() });
  });
  it('the stake (no fresh ask): under 30 s left it refuses and sends nothing; 30 s or more it sends', async () => {
    const s = slow(null);
    const checked = verifyEvmRoute({ quote: s.q, route: s.route, mode: 'userPays', payer: PAYER, recipient: PAYER, fromToken: s.q.fromToken.address, toToken: s.q.toToken.address, amountIn: BigInt(s.q.amountIn), guard: GUARD, nowSec: s.q.quotedAt });
    s.deps.nowMs = () => (s.deadline - 29) * 1000;
    expect(await sendCheckedEvm(checked, s.input.evm!, s.deps, s.input)).toEqual({ kind: 'failed', message: 'This quote expired. Get a new one.' });
    expect(s.swaps()).toHaveLength(0);
    const late = slow(null);
    late.deps.nowMs = () => (late.deadline - 31) * 1000;
    expect((await sendCheckedEvm(checked, late.input.evm!, late.deps, late.input)).kind).toBe('started');
    expect(late.swaps()).toHaveLength(1);
  });
});

describe('executeSwap, you pay gas through Permit2', () => {
  const USDC = '0xaf88d065e77c8cc2239327c5edb3a432268e5831';
  const SIG = `0x${'ab'.repeat(65)}` as const;
  const SWAP_HASH = `0x${'5a'.repeat(32)}` as const;
  /** A named route with the field, a payer Review swap read as able to sign, and a log of everything the wallet is asked. */
  function pay(first: boolean, name = 'arb-usdc-to-pol-wbtc') {
    const s = setup(name, 'userPays');
    s.route.permit2Pay = permit2PayOf(s.q, s.route, first ? maxToPermit2(s.q) : undefined);
    s.input.permit2 = true;
    s.input.onSent = vi.fn();
    const log: string[] = [];
    const sent: { to: string; data: Hex; value: bigint; chainId: number }[] = [];
    s.input.evm = signer({
      sendTransaction: vi.fn(async (tx) => { sent.push(tx); log.push(`send:${tx.to.toLowerCase()}`); return tx.to.toLowerCase() === SWAPIC ? SWAP_HASH : `0x${'cd'.repeat(32)}` as const; }),
      waitForReceipt: vi.fn(async () => { log.push('receipt'); return 'success' as const; }),
      signTypedData: vi.fn(async () => { log.push('sign'); return SIG; }),
    });
    return { ...s, log, sent };
  }
  const steps = (i: ExecInput) => (i.onStep as ReturnType<typeof vi.fn>).mock.calls;
  const approveArgs = (tx: { data: Hex }) => decodeFunctionData({ abi: erc20Abi, data: tx.data }).args;
  const runWithPermit2 = (tx: { data: Hex }) => decodeFunctionData({ abi: SWAPIC_PERMIT2_ABI, data: tx.data }).args;
  const refused = Object.assign(new Error('User rejected the request.'), { code: 4001 });

  it('the ABI is the deployed function (selector 0x21be144a, checked in the bytecode on all 10 chains)', () => {
    expect(toFunctionSelector(SWAPIC_PERMIT2_ABI[0])).toBe('0x21be144a');
  });
  it('first time: the maximum to Permit2 and its receipt, the signature, then runWithPermit2, each step lighting up in order', async () => {
    const s = pay(true);
    expect(await executeSwap(s.input, s.deps)).toEqual({ kind: 'started', activityId: s.route.orderId!.toLowerCase() });
    expect(s.log).toEqual([`send:${USDC}`, 'receipt', 'sign', `send:${SWAPIC}`, 'receipt']);
    expect(approveArgs(s.sent[0]!)).toEqual([getAddress(PERMIT2), maxUint256]);
    expect(steps(s.input)).toEqual([[0, 'wait'], [0, 'done'], [1, 'wait'], [1, 'done'], [2, 'wait'], [2, 'done']]);
    expect(s.input.onSent).toHaveBeenCalledWith(2, SWAP_HASH);
  });
  it('later swaps: the signature, then runWithPermit2, encoded from the checked order to the checked Swapic with no value', async () => {
    const s = pay(false);
    expect((await executeSwap(s.input, s.deps)).kind).toBe('started');
    expect(s.log).toEqual(['sign', `send:${SWAPIC}`, 'receipt']);
    expect(steps(s.input)).toEqual([[0, 'wait'], [0, 'done'], [1, 'wait'], [1, 'done']]);
    expect(s.input.onSent).toHaveBeenCalledWith(1, SWAP_HASH);
    const tx = s.sent[0]!;
    expect(tx).toMatchObject({ chainId: 42161, value: 0n });
    expect(tx.to.toLowerCase()).toBe(SWAPIC);
    expect(tx.data.slice(0, 10)).toBe('0x21be144a');
    const [order, auth] = runWithPermit2(tx);
    expect(orderIdOf(order as unknown as OrderValue, 42161, getAddress(SWAPIC))).toBe(s.route.orderId!.toLowerCase());
    expect(auth).toEqual({ nonce: BigInt(s.route.permit2Pay!.nonce), deadline: BigInt(s.route.order!.deadline), signature: SIG });
  });
  it('a token set to 0 first: clears, waits, approves, all one step, before the signature', async () => {
    const s = pay(true);
    s.route.permit2Pay!.approval!.resetFirst = true;
    expect((await executeSwap(s.input, s.deps)).kind).toBe('started');
    expect(s.log).toEqual([`send:${USDC}`, 'receipt', `send:${USDC}`, 'receipt', 'sign', `send:${SWAPIC}`, 'receipt']);
    expect([approveArgs(s.sent[0]!), approveArgs(s.sent[1]!)]).toEqual([[getAddress(PERMIT2), 0n], [getAddress(PERMIT2), maxUint256]]);
    expect(steps(s.input)).toEqual([[0, 'wait'], [0, 'done'], [1, 'wait'], [1, 'done'], [2, 'wait'], [2, 'done']]);
  });
  it('a real key signs the typed data and it recovers to the payer; the check accepts that signature and no other', async () => {
    const key = privateKeyToAccount(generatePrivateKey());
    const s = setup('arb-usdc-to-pol-wbtc', 'userPays');
    s.deps.sleep = vi.fn(() => new Promise<void>(() => {}));
    const route = forge(s.q, s.route, (o) => ({ ...o, payer: key.address }), s.route.contracts!.source.swapic as Hex);
    route.permit2Pay = permit2PayOf(s.q, route);
    s.q.userPays.routes = s.q.userPays.routes.map((r) => (r.routeId === route.routeId ? route : r));
    const signed: { td: SignableTypedData; sig: Hex }[] = [];
    const evm = signer({
      address: key.address,
      signTypedData: vi.fn(async (td: SignableTypedData) => { const sig = await key.signTypedData(td as never); signed.push({ td, sig }); return sig; }),
      ownSignature: (td, sig) => ownSignature(key.address, td, sig),
    });
    const r = await executeSwap({ ...s.input, query: { ...s.input.query, payer: key.address }, evm, permit2: true }, s.deps);
    expect(r).toEqual({ kind: 'started', activityId: route.orderId!.toLowerCase() });
    expect(await recoverTypedDataAddress({ ...signed[0]!.td, signature: signed[0]!.sig } as never)).toBe(key.address);
    const wrong = signer({ address: key.address, ownSignature: (td, sig) => ownSignature(key.address, td, sig) });
    expect(await executeSwap({ ...s.input, query: { ...s.input.query, payer: key.address }, evm: wrong, permit2: true }, s.deps)).toEqual({ kind: 'noPermit2', wallet: true });
    expect(wrong.sendTransaction).not.toHaveBeenCalled();
    // a device that answers its last byte as 0 or 1: the calldata carries the bytes Permit2's ecrecover takes
    let good: Hex = '0x';
    const low = signer({
      address: key.address,
      signTypedData: vi.fn(async (td: SignableTypedData) => { good = await key.signTypedData(td as never); return `${good.slice(0, 130)}${good.endsWith('1b') ? '00' : '01'}` as Hex; }),
      ownSignature: (td, sig) => ownSignature(key.address, td, sig),
    });
    expect((await executeSwap({ ...s.input, query: { ...s.input.query, payer: key.address }, evm: low, permit2: true }, s.deps)).kind).toBe('started');
    const tx = (low.sendTransaction as ReturnType<typeof vi.fn>).mock.calls[0]![0] as { data: Hex };
    expect(runWithPermit2(tx)[1].signature).toBe(good);
  });
  it('a "no" to the signature is a clean stop: the approve stays done, no swap sent', async () => {
    const s = pay(true);
    s.input.evm!.signTypedData = vi.fn(async () => { throw refused; });
    expect(await executeSwap(s.input, s.deps)).toEqual({ kind: 'rejected' });
    expect(s.log).toEqual([`send:${USDC}`, 'receipt']);
    expect(steps(s.input)).toEqual([[0, 'wait'], [0, 'done'], [1, 'wait']]);
  });
  it('a "no" to the approve is a clean stop too, nothing signed', async () => {
    const s = pay(true);
    s.input.evm!.sendTransaction = vi.fn(async () => { throw refused; });
    expect(await executeSwap(s.input, s.deps)).toEqual({ kind: 'rejected' });
    expect(s.input.evm!.signTypedData).not.toHaveBeenCalled();
  });
  it('a failed signature that is neither a no nor unsupported says so and stops there', async () => {
    const s = pay(false);
    s.input.evm!.signTypedData = vi.fn(async () => { throw new Error('boom'); });
    expect((await executeSwap(s.input, s.deps)).kind).toBe('failed');
    expect(s.log).toEqual([]);
    expect(steps(s.input).at(-1)).toEqual([0, 'fail']);
  });
  for (const [name, error] of [
    ['EIP-1193 4200', Object.assign(new Error('nope'), { code: 4200 })],
    ['JSON-RPC -32601', Object.assign(new Error('nope'), { code: -32601 })],
    ['WalletConnect\'s missing method', new Error('Missing or invalid. request() method: eth_signTypedData_v4.')],
  ] as const) {
    it(`a wallet with no way to sign (${name}): back to Review swap, no other popup, no swap sent`, async () => {
      const s = pay(true);
      s.input.evm!.signTypedData = vi.fn(async () => { throw error; });
      expect(await executeSwap(s.input, s.deps)).toEqual({ kind: 'noPermit2', wallet: true });
      expect(s.log).toEqual([`send:${USDC}`, 'receipt']);
    });
  }
  it('a signature that is not the key\'s (an account with no code yet): back to Review swap, no gas spent on it', async () => {
    const s = pay(false);
    s.input.evm!.ownSignature = vi.fn(async () => null);
    expect(await executeSwap(s.input, s.deps)).toEqual({ kind: 'noPermit2', wallet: true });
    expect(s.log).toEqual(['sign']);
  });
  describe('read before anything is asked', () => {
    const CHECK = { kind: 'tryAgain', message: "Couldn't check your wallet, try again." };
    it('code at the payer\'s address: back to Review swap before the approve, no gas spent, the wallet not marked as unable', async () => {
      const s = pay(true);
      s.input.evm!.payerOn = vi.fn(async () => 'code' as const);
      expect(await executeSwap(s.input, s.deps)).toEqual({ kind: 'noPermit2', wallet: false });
      expect(s.input.evm!.payerOn).toHaveBeenCalledWith(42161, expect.any(Number));
      expect(s.log).toEqual([]);
      expect(steps(s.input)).toEqual([]);
    });
    it('a session that names no typed data method: back to Review swap before the approve', async () => {
      const s = pay(true);
      s.input.evm!.payerOn = vi.fn(async () => 'noTypedData' as const);
      expect(await executeSwap(s.input, s.deps)).toEqual({ kind: 'noPermit2', wallet: true });
      expect(s.log).toEqual([]);
    });
    it('a code read that failed is no verdict on the wallet: try again, nothing asked, and the same run goes through once it reads', async () => {
      const s = pay(true);
      s.input.evm!.payerOn = vi.fn(async () => 'unread' as const);
      expect(await executeSwap(s.input, s.deps)).toEqual(CHECK);
      expect(s.log).toEqual([]);
      expect(steps(s.input)).toEqual([]);
      s.input.evm!.payerOn = vi.fn(async () => 'plain' as const);
      expect((await executeSwap(s.input, s.deps)).kind).toBe('started');
    });
    it('code that came with the approve: read again after it, nothing signed', async () => {
      const s = pay(true);
      s.input.evm!.payerOn = vi.fn().mockResolvedValueOnce('plain').mockResolvedValueOnce('code');
      expect(await executeSwap(s.input, s.deps)).toEqual({ kind: 'noPermit2', wallet: false });
      expect(s.log).toEqual([`send:${USDC}`, 'receipt']);
    });
    it('a read that fails after the approve: try again, nothing signed, the approve stays done and the next row is not left waiting as failed', async () => {
      const s = pay(true);
      s.input.evm!.payerOn = vi.fn().mockResolvedValueOnce('plain').mockResolvedValueOnce('unread');
      expect(await executeSwap(s.input, s.deps)).toEqual(CHECK);
      expect(s.log).toEqual([`send:${USDC}`, 'receipt']);
      expect(steps(s.input)).toEqual([[0, 'wait'], [0, 'done'], [1, 'wait']]);
    });
    it('no approve asked: one read is enough', async () => {
      const s = pay(false);
      expect((await executeSwap(s.input, s.deps)).kind).toBe('started');
      expect(s.input.evm!.payerOn).toHaveBeenCalledTimes(1);
      expect(s.input.evm!.allowanceOf).not.toHaveBeenCalled();
    });
    it('the allowance is read on chain, of Permit2, before the maximum is sent', async () => {
      const s = pay(true);
      expect((await executeSwap(s.input, s.deps)).kind).toBe('started');
      expect(s.input.evm!.allowanceOf).toHaveBeenCalledWith(42161, getAddress(USDC), getAddress(PERMIT2), expect.any(Number));
      expect(approveArgs(s.sent[0]!)).toEqual([getAddress(PERMIT2), maxUint256]);
    });
    it('short by one unit: the approve goes out', async () => {
      const s = pay(true);
      s.input.evm!.allowanceOf = vi.fn(async () => 4_999_999n);
      expect((await executeSwap(s.input, s.deps)).kind).toBe('started');
      expect(s.log[0]).toBe(`send:${USDC}`);
    });
    it('the chain says it already covers the amount (the quoter\'s read failed or lags): no approve, its row done, the rest in order', async () => {
      const s = pay(true);
      s.input.evm!.allowanceOf = vi.fn(async () => 5_000_000n);
      s.input.shown = { permit2: true, approval: true };
      expect((await executeSwap(s.input, s.deps)).kind).toBe('started');
      expect(s.log).toEqual(['sign', `send:${SWAPIC}`, 'receipt']);
      expect(steps(s.input)).toEqual([[0, 'done'], [1, 'wait'], [1, 'done'], [2, 'wait'], [2, 'done']]);
    });
    it('covered, and Review swap shows no approve: nothing goes back to it', async () => {
      const s = pay(true);
      s.input.evm!.allowanceOf = vi.fn(async () => maxUint256);
      s.input.shown = { permit2: true, approval: false };
      expect((await executeSwap(s.input, s.deps)).kind).toBe('started');
      expect(s.log).toEqual(['sign', `send:${SWAPIC}`, 'receipt']);
    });
    it('the allowance read fails: try again, nothing sent', async () => {
      const s = pay(true);
      s.input.evm!.allowanceOf = vi.fn(async () => null);
      expect(await executeSwap(s.input, s.deps)).toEqual(CHECK);
      expect(s.log).toEqual([]);
    });
  });
  it('a payer with code keeps today\'s exact approve and run(order), never the field', async () => {
    const s = pay(true);
    s.input.permit2 = false;
    expect(await executeSwap(s.input, s.deps)).toEqual({ kind: 'started', activityId: s.route.orderId!.toLowerCase() });
    expect(s.log).toEqual([`send:${USDC}`, 'receipt', `send:${SWAPIC}`, 'receipt']);
    expect(approveArgs(s.sent[0]!)).toEqual([getAddress(SWAPIC), 5_000_000n]);
    expect(s.sent[1]).toMatchObject({ data: s.route.tx!.data, value: 0n });
    expect(s.input.evm!.signTypedData).not.toHaveBeenCalled();
    expect(s.input.evm!.payerOn).not.toHaveBeenCalled();
    expect(s.input.evm!.allowanceOf).not.toHaveBeenCalled();
  });
  it('the allowance to Swapic already covers this swap, Permit2 would need an approve: today\'s run(order), one transaction', async () => {
    const s = pay(true);
    delete s.route.approval;
    expect((await executeSwap(s.input, s.deps)).kind).toBe('started');
    expect(s.log).toEqual([`send:${SWAPIC}`, 'receipt']);
    expect(s.sent[0]!.data).toBe(s.route.tx!.data);
    expect(s.input.evm!.signTypedData).not.toHaveBeenCalled();
  });
  it('no field keeps today\'s approve and run(order), whatever Review swap read of the payer', async () => {
    const s = pay(false);
    delete s.route.permit2Pay;
    expect((await executeSwap(s.input, s.deps)).kind).toBe('started');
    expect(s.log).toEqual([`send:${USDC}`, 'receipt', `send:${SWAPIC}`, 'receipt']);
    expect(approveArgs(s.sent[0]!)).toEqual([getAddress(SWAPIC), 5_000_000n]);
    expect(s.sent[1]!.data).toBe(s.route.tx!.data);
    expect(s.input.evm!.signTypedData).not.toHaveBeenCalled();
  });
  it('less out than on screen is still a new price, the Permit2 path or not', async () => {
    const s = pay(false);
    s.input.shownMin = BigInt(s.route.amountOutMin) + 1n;
    expect((await executeSwap(s.input, s.deps)).kind).toBe('newPrice');
    expect(s.log).toEqual([]);
  });
  it('a native input keeps run with its value, even with a field on the route', async () => {
    const s = pay(false, 'base-eth-to-arb-arb');
    expect((await executeSwap(s.input, s.deps)).kind).toBe('started');
    expect(s.sent).toHaveLength(1);
    expect(s.sent[0]).toMatchObject({ data: s.route.tx!.data, value: BigInt(s.q.amountIn) });
    expect(s.input.evm!.signTypedData).not.toHaveBeenCalled();
  });
  it('exactly one approval per path, with both on the route', async () => {
    const a = pay(true);
    expect(a.route.approval).toBeTruthy();
    await executeSwap(a.input, a.deps);
    expect(a.sent.filter((t) => t.to.toLowerCase() === USDC).map(approveArgs)).toEqual([[getAddress(PERMIT2), maxUint256]]);
    const b = pay(true);
    b.input.permit2 = false;
    await executeSwap(b.input, b.deps);
    expect(b.sent.filter((t) => t.to.toLowerCase() === USDC).map(approveArgs)).toEqual([[getAddress(SWAPIC), 5_000_000n]]);
    // the allowance of Permit2 covers it: no approval at all, the top level one is not sent in its place
    const c = pay(false);
    expect(c.route.approval).toBeTruthy();
    await executeSwap(c.input, c.deps);
    expect(c.sent.filter((t) => t.to.toLowerCase() === USDC)).toEqual([]);
  });
  describe('against the steps Review swap shows', () => {
    it('it shows no approve and the fresh route asks one: back to it, nothing asked', async () => {
      const s = pay(true);
      s.input.shown = { permit2: true, approval: false };
      const r = await executeSwap(s.input, s.deps);
      expect(r).toEqual({ kind: 'stepsChanged', quote: s.q, option: expect.objectContaining({ route: s.route }) });
      expect(s.log).toEqual([]);
    });
    it('it shows today\'s steps and the fresh route is through Permit2, or the other way round: back to it', async () => {
      const a = pay(false);
      a.input.shown = { permit2: false, approval: true };
      expect((await executeSwap(a.input, a.deps)).kind).toBe('stepsChanged');
      expect(a.log).toEqual([]);
      const b = pay(false);
      delete b.route.permit2Pay;
      b.input.shown = { permit2: true, approval: false };
      expect((await executeSwap(b.input, b.deps)).kind).toBe('stepsChanged');
      expect(b.log).toEqual([]);
    });
    it('it shows the approve, which went through before a cancel: its row is done, the others light up in order', async () => {
      const s = pay(false);
      s.input.shown = { permit2: true, approval: true };
      expect((await executeSwap(s.input, s.deps)).kind).toBe('started');
      expect(s.log).toEqual(['sign', `send:${SWAPIC}`, 'receipt']);
      expect(steps(s.input)).toEqual([[0, 'done'], [1, 'wait'], [1, 'done'], [2, 'wait'], [2, 'done']]);
    });
    it('today\'s path never looks at it', async () => {
      const s = setup('arb-usdc-to-pol-wbtc', 'userPays');
      s.input.shown = { permit2: false, approval: false };
      await executeSwap(s.input, s.deps);
      expect(s.input.evm!.sendTransaction).toHaveBeenCalledTimes(2);
      expect((s.input.onStep as ReturnType<typeof vi.fn>).mock.calls).toEqual([[0, 'wait'], [0, 'done'], [1, 'wait'], [1, 'done']]);
    });
  });
  describe('with little time left after the approve', () => {
    /** The approve mined 60 s before the order's deadline, and the quoter's next answer with `edit` on its route. */
    function late(edit: (fresh: Route, q2: Quote) => void) {
      const s = pay(true);
      const deadline = Number(s.route.order!.deadline);
      let t = (s.q.quotedAt + 3) * 1000;
      s.deps.nowMs = () => t;
      s.deps.sleep = vi.fn(() => new Promise<void>(() => {}));
      s.input.evm!.waitForReceipt = vi.fn(async (_c: number, hash: Hex) => { if (hash !== SWAP_HASH) t = (deadline - 60) * 1000; s.log.push('receipt'); return 'success' as const; });
      const fresh = forge(s.q, s.route, (o) => ({ ...o, deadline: o.deadline + 120n }), s.route.contracts!.source.swapic as Hex);
      const q2 = clone(s.q);
      q2.quotedAt = s.q.quotedAt + 120;
      q2.userPays.routes = q2.userPays.routes.map((r) => (r.routeId === fresh.routeId ? fresh : r));
      edit(fresh, q2);
      s.deps.getQuote = vi.fn().mockResolvedValueOnce(s.q).mockResolvedValueOnce(q2);
      return { ...s, fresh };
    }
    it('the fresh order is signed and sent; the fresh route\'s approve is covered by the one this run made, not asked again', async () => {
      const s = late((fresh, q2) => { fresh.permit2Pay = permit2PayOf(q2, fresh, maxToPermit2(q2)); });
      expect(await executeSwap(s.input, s.deps)).toEqual({ kind: 'started', activityId: s.fresh.orderId!.toLowerCase() });
      expect(s.log).toEqual([`send:${USDC}`, 'receipt', 'sign', `send:${SWAPIC}`, 'receipt']);
      const signedFor = (s.input.evm!.signTypedData as ReturnType<typeof vi.fn>).mock.calls[0]![0] as SignableTypedData;
      expect(signedFor.message).toMatchObject({ witness: { orderId: s.fresh.orderId!.toLowerCase() } });
      const [order] = runWithPermit2(s.sent.at(-1)!);
      expect(orderIdOf(order as unknown as OrderValue, 42161, getAddress(SWAPIC))).toBe(s.fresh.orderId!.toLowerCase());
    });
    it('compares with the chosen path\'s approval: the fresh route no longer has the field, its exact approve is not covered: back to Review swap', async () => {
      const s = late((fresh) => { delete fresh.permit2Pay; });
      expect((await executeSwap(s.input, s.deps)).kind).toBe('stepsChanged');
      expect(s.log).toEqual([`send:${USDC}`, 'receipt']);
    });
    it('the other path with no approve to ask is still a step the review never showed: back to it', async () => {
      const s = late((fresh) => { delete fresh.permit2Pay; delete fresh.approval; });
      expect((await executeSwap(s.input, s.deps)).kind).toBe('stepsChanged');
      expect(s.log).toEqual([`send:${USDC}`, 'receipt']);
    });
  });
  it('a signature that took the order\'s last seconds: never sent, a new quote asked for', async () => {
    const s = pay(false);
    let t = (s.q.quotedAt + 3) * 1000;
    s.deps.nowMs = () => t;
    s.input.evm!.signTypedData = vi.fn(async () => { t = (Number(s.route.order!.deadline) - 10) * 1000; return SIG; });
    expect(await executeSwap(s.input, s.deps)).toEqual({ kind: 'failed', message: 'This quote expired. Get a new one.' });
    expect(s.sent).toEqual([]);
    expect(steps(s.input).at(-1)).toEqual([0, 'fail']);
  });
  it('a reverted swap: the send step fails and the note says nothing was swapped', async () => {
    const s = pay(false);
    s.input.evm!.waitForReceipt = vi.fn(async () => 'reverted' as const);
    expect(await executeSwap(s.input, s.deps)).toEqual({ kind: 'failed', message: 'The transaction failed on the network. Your tokens stayed in your wallet. Try again.' });
    expect(steps(s.input).at(-1)).toEqual([1, 'fail']);
  });
});

describe('executeSwap, ICP', () => {
  const caller = { agent: {} as never, principal: Principal.fromText(ICP_ME) };
  const lost = () => new TypeError('fetch failed');
  it('takes a ck route through its own door, and never the pool\'s', async () => {
    const usdc = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
    const route = { ...icpRoute(), routeId: 'ckMinter', amountOut: '310000', amountOutMin: '310000', icpSwap: undefined } as Route;
    route.icpCkSwap = {
      canister: config.swapicCanisterId, approve: { ledger: ICP_FIXTURE.from.address, spender: config.swapicCanisterId, amount: '1010000' },
      terms: {
        tokenIn: ICP_FIXTURE.from.address, amountIn: '1000000', fromSubaccount: null, refundTo: null, deadlineNs: (ICP_FIXTURE.nowNs + 600_000_000_000n).toString(),
        dstChain: 1, recipient: ICP_FIXTURE.recipient, tokenOut: usdc, minOut: '310000', minUsdc: '1000000', networkFee: '670000',
      },
      expectedSale: '1000000', expectedOut: '310000', ledgerFees: '20000',
    };
    const swapFromIcpCk = vi.fn(async () => ({ id: 42n, status: { CkWithdrawn: null } }));
    const s = icpSetup({ swapFromIcpCk, swapFromIcp: vi.fn(async () => { throw new Error('the pool door'); }) }, route);
    const chains = new Map([[1, { swapic: ATTACKER, usdc: usdc as `0x${string}`, runner: ATTACKER, cctpReceiver: ATTACKER, tokenMessenger: ATTACKER }]]);
    const q = await s.deps.getQuote({} as never);
    s.deps.getQuote = vi.fn(async () => ({ ...q, toChain: 'eip155:1' }));
    s.icpc.getConfig = async () => ({ poolChain: 8453, chains, cctpDomains: new Map(), ecoPortal: null, solana: null });
    const out = await executeSwap({ ...s.input, pick: { mode: 'icpPull', routeId: 'ckMinter', tags: [] }, to: { ...s.input.to, address: usdc, chainId: 1 } }, s.deps);
    expect(out).toEqual({ kind: 'started', activityId: 'payout-42' });
    expect(swapFromIcpCk).toHaveBeenCalledTimes(1);
    expect(s.icpc.swapFromIcp).not.toHaveBeenCalled();
  });
  it('says the network fee in the wallet step of a ck route, never no fee', () => {
    const route = { ...icpRoute(), icpSwap: undefined, icpCkSwap: { terms: { networkFee: '670000' } } } as unknown as Route;
    const steps = walletSteps({ key: 'k', tags: [], mode: 'icpPull', route }, ICP_FIXTURE.from, 1_000_000n, { symbol: null, decimals: 8, priceUsd: null, held: null } as never);
    expect(steps[1]!.sub).toBe('$0.67 network fee comes out of the swap, and the ledger fees with it');
    expect(steps[1]!.sub).not.toMatch(/no gas/i);
  });
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
      payout: vi.fn(async () => ({ kind: { IcpSwap: null }, terms: { solana: [], recipient: ICP_FIXTURE.recipient, token_out: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', dst_chain: 8453n } }) as never),
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
        payout: vi.fn(async () => ({ kind: { IcpSwap: null }, terms: { solana: [], recipient: ICP_FIXTURE.recipient, token_out: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', dst_chain: 8453n } }) as never),
      });
      s.deps.getOrders = vi.fn(async () => ({ orders: [{ id: 'payout-41', createdAt: ICP_FIXTURE.nowMs / 1000, from: { amount: '1000000' } }], nextCursor: null }) as never);
      expect(await executeSwap(s.input, s.deps)).toEqual({ kind: 'started', activityId: 'payout-41' });
      expect(s.icpc.swapFromIcp).toHaveBeenCalledTimes(1);
    });
  }
  it('an ICP swap to a Solana address that cannot receive stops before the wallet is asked', async () => {
    const s = icpSetup({});
    s.input.to = { ...s.input.to, chain: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp' };
    s.input.recipient = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
    // a token mint: on the curve or not, nothing sent to it can be spent
    s.deps.solanaAccount = async () => ({ owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', executable: false, data: new Uint8Array(82) });
    expect(await executeSwap(s.input, s.deps)).toEqual({ kind: 'failed', message: 'This address cannot receive on Solana. Check it and try again.' });
    expect(s.icpc.approve).not.toHaveBeenCalled();
  });
  it('a lost answer finds its payout into Solana by the keys the payout names', () => {
    const WALLET = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
    const MINT = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';
    const terms = { recipient: '0x0000000000000000000000000000000000000000', token_out: '0x0000000000000000000000000000000000000000', dst_chain: 8453n };
    const paid = { ...terms, solana: [{ recipient: WALLET, mint_out: MINT }] as [{ recipient: string; mint_out: string }] };
    expect(payoutIsThisSwap(paid, WALLET, { address: MINT, chainId: 0 })).toBe(true);
    expect(payoutIsThisSwap(paid, MINT, { address: MINT, chainId: 0 })).toBe(false);
    expect(payoutIsThisSwap(paid, WALLET, { address: WALLET, chainId: 0 })).toBe(false);
  });
  it('an ICP signer saying no (ICRC-25 3001) returns rejected', async () => {
    const { deps, input } = icpSetup({ swapFromIcp: vi.fn(async () => { throw new SignerError({ code: 3001, message: 'The user has canceled the action' }); }) });
    expect(await executeSwap(input, deps)).toEqual({ kind: 'rejected' });
  });
  it('says the canister refusal in plain words', async () => {
    const { deps, input } = icpSetup({ swapFromIcp: vi.fn(async () => { throw new PoolErrorFailure({ NotAllowed: 'past five calls a minute' }); }) });
    expect(await executeSwap(input, deps)).toEqual({ kind: 'failed', message: 'Too many tries, wait a minute' });
  });
});
