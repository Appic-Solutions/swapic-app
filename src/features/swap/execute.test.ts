import { describe, expect, it, vi } from 'vitest';
import { decodeFunctionData, erc20Abi, getAddress, maxUint256, recoverTypedDataAddress, type Hex } from 'viem';
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
import { executeSwap, sendCheckedEvm, walletSteps, type ExecDeps, type ExecInput } from './execute';
import { ATTACKER, GUARD, ICP_ME, PAYER, SWAPIC, clone, forge, load } from './guards/forge.fixture';
import { verifyEvmRoute } from './guards/evm';
import { CKUSDC, ICP_FIXTURE, icpRoute } from './guards/icp.fixture';

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
    maxFeePerGas: vi.fn(async () => 1n), ...over,
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
    expect(s.input.onSent).toHaveBeenCalledWith(1);
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
    s.icpc.getConfig = async () => ({ poolChain: 8453, chains, cctpDomains: new Map(), ecoPortal: null });
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
