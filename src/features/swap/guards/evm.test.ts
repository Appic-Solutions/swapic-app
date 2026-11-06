import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { concat, decodeAbiParameters, decodeFunctionData, encodeAbiParameters, encodeFunctionData, maxUint256, pad, type Hex } from 'viem';
import type { Quote, Route } from '@/lib/api';
import { ECO_ROUTE, STEP_ABI, orderValue, type OrderValue } from './abi';
import { decodeEnvelope, principalWord } from './envelope';
import type { GuardError } from './errors';
import { routeOffered, verifyEvmRoute, type EvmCheckInput } from './evm';
import { ATTACKER, CANISTER, GUARD, ICP_ME, PAYER, clone, executable, forge, load } from './forge.fixture';
import { memoRef, type MemoTerms } from './memo';
import { readPlan } from './plan';
import { encodeMemo, poolTerms } from './memo.fixture';

function input(q: Quote, route: Route, mode: 'gasless' | 'userPays', over: Partial<EvmCheckInput> = {}): EvmCheckInput {
  const env = route.envelope;
  const recipient = env && env.action !== 'ckDeposit' ? env.recipient : PAYER;
  return {
    quote: q, route, mode, payer: PAYER, recipient, fromToken: q.fromToken.address, toToken: q.toToken.address,
    amountIn: BigInt(q.amountIn), guard: GUARD, nowSec: q.quotedAt, ...over,
  };
}
const rule = (f: () => unknown) => { try { f(); } catch (e) { return (e as GuardError).rule ?? String(e); } return 'passed'; };
const fn = (s: { data: Hex }) => { try { return decodeFunctionData({ abi: STEP_ABI, data: s.data }).functionName; } catch { return '?'; } };
/** Rewrite every step of one kind with changed arguments. */
const rewrite = (name: string, change: (args: unknown[]) => unknown[]) => (o: OrderValue): OrderValue => ({
  ...o,
  steps: o.steps.map((s) => (fn(s) !== name ? s : {
    ...s, data: encodeFunctionData({ abi: STEP_ABI, functionName: name as never, args: change([...(decodeFunctionData({ abi: STEP_ABI, data: s.data }).args as readonly unknown[])]) as never }),
  })),
});
const REAL = ['arb-usdc-to-pol-wbtc', 'eth-usdc-to-base-usdc', 'arb-usdc-to-base-eth', 'base-usdc-to-base-eth', 'base-eth-to-arb-arb', 'pol-wbtc-to-arb-usdc'];

describe('verifyEvmRoute on real mainnet quotes', () => {
  for (const name of REAL) {
    const q = load(name);
    for (const mode of ['gasless', 'userPays'] as const) {
      for (const r of executable(q, mode)) {
        it(`${name} ${mode} ${r.routeId}: every step read, the order id recomputed, the delivery as shown`, () => {
          const c = verifyEvmRoute(input(q, r, mode));
          expect(c.orderId).toBe(r.orderId!.toLowerCase());
          expect(c.minOut).toBe(BigInt(r.amountOutMin));
          expect(c.amountIn).toBe(BigInt(q.amountIn));
          expect(c.plan.delivery!.minOut).toBe(BigInt(r.amountOutMin));
          // the envelope the plan carries is the one the quoter shows
          if (r.envelope) expect(c.plan.envelope).toEqual(decodeEnvelope(r.envelope.hex as Hex));
        });
      }
    }
  }
  it('reads the ck deposit shape of the fork quote (EVM to ICP, the fork\'s own contracts and canister)', () => {
    const q = load('base-usdc-to-ckusdc.fork');
    const r = executable(q, 'gasless')[0]!;
    const f = r.contracts!.source;
    const forkCanister = decodeFunctionData({ abi: STEP_ABI, data: r.order!.steps[0]!.data as Hex }).args[0] as Hex; // the fee step's receiver, 0x…cA11
    const lowered = (a: string) => a.toLowerCase() as Hex;
    const guard = {
      ...GUARD, canisterEvm: forkCanister,
      config: { ...GUARD.config, chains: new Map([...GUARD.config.chains].map(([id, c]) => [id, { ...c, swapic: lowered(f.swapic), runner: lowered(f.runner), cctpReceiver: lowered(f.cctpReceiver) }])) },
    };
    const principal = decodeEnvelope(r.envelope!.hex as Hex).principalText!;
    const fork = (over: Partial<EvmCheckInput>) => rule(() => verifyEvmRoute(input(q, r, 'gasless', { guard, payer: r.order!.payer as Hex, recipient: principal, ...over })));
    expect(fork({})).toBe('passed');
    expect(fork({ recipient: ICP_ME })).toBe('recipient');
  });
});

describe('a direct ck deposit, the quoter\'s own order for USDC on Ethereum (a fork quote, EVM to ckUSDC)', () => {
  const q = load('eth-usdc-to-ckusdc.fork');
  const r = executable(q, 'userPays')[0]!;
  const f = r.contracts!.source;
  const lowered = (a: string) => a.toLowerCase() as Hex;
  const guard = { ...GUARD, config: { ...GUARD.config, chains: new Map([...GUARD.config.chains].map(([id, c]) => [id, { ...c, swapic: lowered(f.swapic), runner: lowered(f.runner), cctpReceiver: lowered(f.cctpReceiver) }])) } };
  const payer = r.order!.payer as Hex;
  const check = (route: Route, over: Partial<EvmCheckInput> = {}) => rule(() => verifyEvmRoute(input(q, route, 'userPays', { guard, payer, recipient: ICP_ME, ...over })));
  const forged = (edit: (o: OrderValue) => OrderValue) => forge(q, r, edit, f.swapic as Hex);
  it('reads the step, the account and the least, with nothing delivered on any EVM chain', () => {
    const c = verifyEvmRoute(input(q, r, 'userPays', { guard, payer, recipient: ICP_ME }));
    expect(c.plan.rail).toBe('ck');
    expect(c.plan.delivery).toBeNull();
    expect(c.plan.envelope).toBeNull();
    expect(c.plan.ck!.principal).toBe(principalWord(ICP_ME).toLowerCase());
    expect(c.plan.ck!.min).toBe(BigInt(r.amountOutMin));
  });
  it('refuses another helper, whatever the quoter says', () => {
    expect(check(forged((o) => ({ ...o, steps: o.steps.map((s) => ({ ...s, target: ATTACKER })) })))).toBe('ckHelper');
    expect(check(r, { guard: { ...guard, ckHelper: ATTACKER } })).toBe('ckHelper');
    expect(check(r, { guard: { ...guard, ckHelper: null } })).toBe('ckHelper');
  });
  it('refuses another account, and a subaccount the screen does not show', () => {
    expect(check(r, { recipient: 'aaaaa-aa' })).toBe('recipient');
    expect(check(forged(rewrite('depositErc20', (a) => [a[0], a[1], pad('0x01', { size: 32 }), a[3]])))).toBe('recipient');
    expect(check(forged(rewrite('depositErc20', (a) => [a[0], a[1], a[2], pad('0x01', { size: 32 })])))).toBe('recipient');
  });
  it('refuses an amount of its own, a write elsewhere, and another token', () => {
    expect(check(forged(rewrite('depositErc20', (a) => [a[0], 1n, a[2], a[3]])))).toBe('stepNotCanonical');
    expect(check(forged((o) => ({ ...o, steps: o.steps.map((s) => ({ ...s, writes: [] })) })))).toBe('stepNotCanonical');
    expect(check(forged((o) => ({ ...o, steps: o.steps.map((s) => ({ ...s, writes: [{ at: 68, minus: 0n }] })) })))).toBe('stepNotCanonical');
    expect(check(forged(rewrite('depositErc20', (a) => [ATTACKER, a[1], a[2], a[3]])))).toBe('stepNotCanonical');
    expect(check(forged((o) => ({ ...o, steps: o.steps.map((s) => ({ ...s, min: 0n })) })))).toBe('stepNotCanonical');
  });
  it('refuses a least under what the screen shows', () => {
    expect(check(forged((o) => ({ ...o, steps: o.steps.map((s) => ({ ...s, min: s.min - 1n })) })))).toBe('minOut');
  });
  it('refuses a payout beside it, a second deposit, and a step after it', () => {
    expect(check(forged((o) => ({ ...o, payout: { token: f.swapic as Hex, recipient: ATTACKER, minOut: 1n } })))).toBe('twoRails');
    expect(check(forged((o) => ({ ...o, steps: [o.steps[0]!, o.steps[0]!] })))).toBe('twoRails');
    const fee = { target: guard.config.chains.get(1)!.usdc, data: encodeFunctionData({ abi: STEP_ABI, functionName: 'transfer', args: [CANISTER, 1n] }), token: '0x0000000000000000000000000000000000000000' as Hex, min: 0n, writes: [] };
    expect(check(forged((o) => ({ ...o, steps: [o.steps[0]!, fee] })))).toBe('twoRails');
  });
  it('reads a real KyberSwap step before it, paying the Runner', () => {
    const k = JSON.parse(readFileSync('tests/fixtures/real/kyber-eth-weth-usdc.json', 'utf8'));
    const swap = { target: k.routerAddress as Hex, data: k.data as Hex, token: k.params.tokenIn as Hex, min: BigInt(k.amountIn), writes: [] };
    const ctx = { ...guard, sourceChainId: 1, payer, orderDeadline: 0n, nowSec: 0 };
    const o = orderValue(r.order!);
    const plan = readPlan({ ...o, tokenIn: k.params.tokenIn, steps: [swap, o.steps[0]!] }, ctx);
    expect(plan.rail).toBe('ck');
    expect(plan.ck!.min).toBe(o.steps[0]!.min);
    expect(() => readPlan({ ...o, steps: [o.steps[0]!, swap] }, ctx)).toThrow();
  });
});

describe('a hostile quoter cannot slip a step past the check (plan check C1)', () => {
  const q = load('arb-usdc-to-pol-wbtc');
  const u = executable(q, 'userPays')[0]!;
  const USDC = q.fromToken.address as Hex;
  const check = (r: Route) => rule(() => verifyEvmRoute(input(q, r, 'userPays')));
  it('the helper alone changes nothing', () => expect(check(forge(q, u, (o) => o))).toBe('passed'));
  it('refuses an attacker contract that carries the genuine envelope in its calldata', () => {
    expect(check(forge(q, u, (o) => ({ ...o, steps: [{ target: ATTACKER, data: concat(['0x12345678', u.envelope!.hex as Hex]), token: USDC, min: 0n, writes: [] }, ...o.steps] })))).toBe('unknownStep');
  });
  it('refuses a fixed transfer to anyone but the canister (a zero token transfer step)', () => {
    const steal = encodeFunctionData({ abi: STEP_ABI, functionName: 'transfer', args: [ATTACKER, 1_000n] });
    expect(check(forge(q, u, (o) => ({ ...o, steps: [{ target: USDC, data: steal, token: '0x0000000000000000000000000000000000000000', min: 0n, writes: [] }, ...o.steps] })))).toBe('feeNotToCanister');
  });
  it('refuses a CCTP burn minted to the attacker', () => {
    expect(check(forge(q, u, rewrite('depositForBurnWithHook', (a) => { a[2] = pad(ATTACKER, { size: 32 }); return a; })))).toBe('burnRecipient');
  });
  it('refuses a burn whose amount is fixed instead of written by the Runner', () => {
    expect(check(forge(q, u, (o) => ({ ...o, steps: o.steps.map((s) => (fn(s) === 'depositForBurnWithHook' ? { ...s, writes: [] } : s)) })))).toBe('stepNotCanonical');
  });
});

describe('Eco and KyberSwap steps are anchored (plan check C1, C3)', () => {
  const q = load('eth-usdc-to-base-usdc');
  const e = executable(q, 'userPays').find((r) => r.routeId === 'eco')!;
  const check = (r: Route) => rule(() => verifyEvmRoute(input(q, r, 'userPays')));
  type EcoRoute = { deadline: bigint; portal: Hex };
  const eco = (change: (reward: Record<string, unknown>, route: EcoRoute) => void) => forge(q, e, rewrite('publishAndFund', (a) => {
    const route = { ...decodeAbiParameters(ECO_ROUTE, a[1] as Hex)[0] } as unknown as EcoRoute;
    const reward = { ...(a[2] as Record<string, unknown>) };
    change(reward, route);
    return [a[0], encodeAbiParameters(ECO_ROUTE, [route as never]), reward, a[3]];
  }));
  it('the rebuilt intent alone changes nothing', () => expect(check(eco(() => {}))).toBe('passed'));
  it('refuses a prover other than Eco\'s', () => expect(check(eco((w) => { w.prover = ATTACKER; }))).toBe('ecoProver'));
  it('refuses a refund locked far away', () => expect(check(eco((w) => { w.deadline = 4_102_444_800n; }))).toBe('ecoDeadline'));
  it('refuses a route filled on another Portal', () => expect(check(eco((_w, r) => { r.portal = ATTACKER; }))).toBe('ecoPortal'));
  it('refuses a refund to anyone but the payer', () => expect(check(eco((w) => { w.creator = ATTACKER; }))).toBe('refundReceiver'));
  it('refuses a KyberSwap swap that pays anyone but the Runner', () => {
    const sq = load('base-usdc-to-base-eth');
    const k = executable(sq, 'userPays')[0]!;
    const r = forge(sq, k, rewrite('swap', (a) => { const ex = clone(a[0]) as { desc: { dstReceiver: Hex } }; ex.desc.dstReceiver = ATTACKER; return [ex]; }));
    expect(rule(() => verifyEvmRoute(input(sq, r, 'userPays')))).toBe('swapReceiver');
  });
});

describe('pool routes: the order memo commits the terms on screen, its keccak the ref', () => {
  const q = load('base-usdc-to-base-eth');
  const base = executable(q, 'userPays')[0]!;
  const ICP = 'icp:737ba355e855bd4b61279056603e0550';
  const CKBTC = 'mxzaz-hqaaa-aaaar-qaada-cai';
  const terms: MemoTerms = {
    kind: 'swap', salt: `0x${'44'.repeat(32)}`, minUsdc: BigInt(q.amountIn), recipient: { owner: ICP_ME, subaccount: null },
    tokenOut: CKBTC, minOut: 240_300n, premium: 1000n, icpFees: 10_000n,
  };
  const poolQuote: Quote = { ...q, toChain: ICP, toToken: { address: CKBTC, symbol: 'ckBTC', decimals: 8, verified: true } };
  /** A real Base order made into a pool order: no steps, the Base USDC paid to `to`, the memo given, its ref `ref`. */
  const route = (t: MemoTerms = terms, o: { to?: Hex; ref?: Hex; memo?: Hex } = {}): Route => {
    const memo = o.memo ?? encodeMemo(t);
    const ref = o.ref ?? memoRef(memo);
    return {
      ...forge(q, base, (v) => ({ ...v, ref, memo, steps: [], payout: { token: q.fromToken.address as Hex, recipient: o.to ?? CANISTER, minOut: BigInt(q.amountIn) } })),
      pool: poolTerms(ref, memo, t.kind), amountOutMin: '240300', envelope: undefined,
    };
  };
  const check = (r: Route) => rule(() => verifyEvmRoute(input(poolQuote, r, 'userPays', { recipient: ICP_ME, toToken: CKBTC })));
  it('passes when the memo holds exactly the terms on screen', () => expect(check(route())).toBe('passed'));
  it('returns the terms it checked', () => expect(verifyEvmRoute(input(poolQuote, route(), 'userPays', { recipient: ICP_ME, toToken: CKBTC })).terms).toEqual(terms));
  it('refuses a ref that is not the memo\'s keccak', () => expect(check(route(terms, { ref: `0x${'00'.repeat(32)}` }))).toBe('poolRef'));
  it('refuses a pool route with no memo', () => expect(check(route(terms, { memo: '0x', ref: memoRef(encodeMemo(terms)) }))).toBe('poolRef'));
  it('refuses a memo that does not decode', () => {
    const bad = `${encodeMemo(terms)}00` as Hex;
    expect(check(route(terms, { memo: bad }))).toBe('memo');
  });
  it('refuses terms for another account, a subaccount, another token, another least', () => {
    expect(check(route({ ...terms, recipient: { owner: '2vxsx-fae', subaccount: null } }))).toBe('recipient');
    expect(check(route({ ...terms, recipient: { owner: ICP_ME, subaccount: `0x${'01'.repeat(32)}` } }))).toBe('recipient');
    expect(check(route({ ...terms, tokenOut: 'xevnm-gaaaa-aaaar-qafnq-cai' }))).toBe('tokenOut');
    expect(check(route({ ...terms, minOut: 1n }))).toBe('minOut');
  });
  it('refuses the USDC paid anywhere but the canister', () => expect(check(route(terms, { to: ATTACKER }))).toBe('poolDelivery'));
  it('refuses a least USDC above what the plan delivers (the canister would hold the deposit)', () => {
    expect(check(route({ ...terms, minUsdc: BigInt(q.amountIn) + 1n }))).toBe('poolLeast');
    expect(check(route({ ...terms, minUsdc: 0n }))).toBe('poolLeast');
  });
  it('refuses a memo on an order that is not a pool deposit', () => {
    const swap = executable(q, 'userPays')[0]!;
    const withMemo = forge(q, swap, (v) => ({ ...v, memo: encodeMemo(terms) }));
    expect(rule(() => verifyEvmRoute(input(q, { ...withMemo, pool: undefined }, 'userPays')))).toBe('poolRef');
  });
});

describe('the gasless doors, the transaction, the screen', () => {
  const q = load('arb-usdc-to-pol-wbtc');
  const g = executable(q, 'gasless')[0]!;
  const u = executable(q, 'userPays')[0]!;
  it('never reads route.contracts', () => {
    const r = clone(g); r.contracts!.source.swapic = '0x000000000000000000000000000000000000dead';
    expect(rule(() => verifyEvmRoute(input(q, r, 'gasless')))).toBe('passed');
  });
  it('refuses without the canister anchors', () => expect(rule(() => verifyEvmRoute(input(q, g, 'gasless', { guard: undefined })))).toBe('noAnchor'));
  it('refuses another tx.to', () => { const r = clone(u); r.tx!.to = ATTACKER; expect(rule(() => verifyEvmRoute(input(q, r, 'userPays')))).toBe('txTo'); });
  it('refuses another approval spender', () => { const r = clone(u); r.approval!.spender = ATTACKER; expect(rule(() => verifyEvmRoute(input(q, r, 'userPays')))).toBe('approvalSpender'); });
  it('refuses a 3009 authorisation to someone else, or on another chain', () => {
    const a = clone(g); (a.sign!.typedData[0]!.message as Record<string, string>).to = ATTACKER;
    expect(rule(() => verifyEvmRoute(input(q, a, 'gasless')))).toBe('typedData');
    const b = clone(g); b.sign!.typedData[0]!.domain.chainId = 1;
    expect(rule(() => verifyEvmRoute(input(q, b, 'gasless')))).toBe('typedData');
  });
  it('refuses an order for another payer or amount, a near deadline, a route that cannot run', () => {
    expect(rule(() => verifyEvmRoute(input(q, g, 'gasless', { payer: ATTACKER })))).toBe('payer');
    expect(rule(() => verifyEvmRoute(input(q, g, 'gasless', { amountIn: 4_000_000n })))).toBe('amountIn');
    const r = clone(g); r.order!.amountIn = '4000000';
    expect(rule(() => verifyEvmRoute(input(q, r, 'gasless')))).toBe('orderId');
    expect(rule(() => verifyEvmRoute(input(q, g, 'gasless', { nowSec: Number(g.order!.deadline) - 10 })))).toBe('expired');
    expect(rule(() => verifyEvmRoute(input(q, q.gasless.routes.find((x) => !x.executable)!, 'gasless')))).toBe('notExecutable');
  });
  it('refuses an envelope paying someone else, in its JSON or on the screen', () => {
    const a = clone(g); a.envelope!.recipient = ATTACKER;
    expect(rule(() => verifyEvmRoute(input(q, a, 'gasless', { recipient: g.envelope!.recipient })))).toBe('envelopeJson');
    expect(rule(() => verifyEvmRoute(input(q, g, 'gasless', { recipient: ATTACKER })))).toBe('recipient');
  });
  it('refuses a Permit2 witness for another order', () => {
    const p = load('pol-wbtc-to-arb-usdc');
    const r = clone(executable(p, 'gasless')[0]!);
    (r.sign!.typedData[0]!.message as { witness: { orderId: string } }).witness.orderId = `0x${'00'.repeat(32)}`;
    expect(rule(() => verifyEvmRoute(input(p, r, 'gasless')))).toBe('typedData');
  });
  describe('the approvals: the maximum to Permit2 on its door only, You pay gas exact', () => {
    const p = load('pol-wbtc-to-arb-usdc');
    const permit2 = () => { const r = clone(executable(p, 'gasless')[0]!); expect(r.sign!.door).toBe('permit2'); return r; };
    const exact = BigInt(p.amountIn);
    const amounted = (amount: bigint) => { const r = permit2(); r.sign!.approval!.amount = amount.toString(); return r; };
    it('takes the maximum, and the exact amount a quoter not yet deployed asks', () => {
      expect(verifyEvmRoute(input(p, amounted(maxUint256), 'gasless')).approval).toMatchObject({ amount: maxUint256, resetFirst: false });
      expect(verifyEvmRoute(input(p, amounted(exact), 'gasless')).approval!.amount).toBe(exact);
    });
    it('refuses any other amount', () => {
      expect(rule(() => verifyEvmRoute(input(p, amounted(exact + 1n), 'gasless')))).toBe('approvalAmount');
      expect(rule(() => verifyEvmRoute(input(p, amounted(exact - 1n), 'gasless')))).toBe('approvalAmount');
      expect(rule(() => verifyEvmRoute(input(p, amounted(maxUint256 - 1n), 'gasless')))).toBe('approvalAmount');
    });
    it('refuses the maximum to anyone but Permit2, on another token, or on another door', () => {
      const spender = amounted(maxUint256); spender.sign!.approval!.spender = ATTACKER;
      expect(rule(() => verifyEvmRoute(input(p, spender, 'gasless')))).toBe('approvalSpender');
      const token = amounted(maxUint256); token.sign!.approval!.token = ATTACKER;
      expect(rule(() => verifyEvmRoute(input(p, token, 'gasless')))).toBe('approvalSpender');
      for (const door of ['permit2612', 'auth3009'] as const) {
        const other = amounted(maxUint256); other.sign!.door = door; other.sign!.auth.door = door;
        expect(rule(() => verifyEvmRoute(input(p, other, 'gasless')))).toBe('approvalSpender');
      }
    });
    it('carries the quoter\'s reset to Permit2, the spender still pinned', () => {
      const r = amounted(maxUint256); r.sign!.approval!.resetFirst = true;
      expect(verifyEvmRoute(input(p, r, 'gasless')).approval).toMatchObject({ amount: maxUint256, resetFirst: true });
    });
    it('holds You pay gas to the exact amount, and never carries a reset there', () => {
      const r = clone(u); r.approval!.amount = maxUint256.toString();
      expect(rule(() => verifyEvmRoute(input(q, r, 'userPays')))).toBe('approvalAmount');
      const reset = clone(u); reset.approval!.resetFirst = true;
      expect(verifyEvmRoute(input(q, reset, 'userPays')).approval).toMatchObject({ amount: BigInt(q.amountIn), resetFirst: false });
    });
  });
  it('offers a card only when its route reads; ICP routes and the not yet known are offered', () => {
    const bad = forge(q, u, (o) => ({ ...o, steps: [{ target: ATTACKER, data: '0x12345678', token: q.fromToken.address as Hex, min: 0n, writes: [] }, ...o.steps] }));
    const who = { payer: PAYER, recipient: u.envelope!.recipient, guard: GUARD };
    expect(routeOffered(q, u, 'userPays', who)).toBe(true);
    expect(routeOffered(q, bad, 'userPays', who)).toBe(false);
    expect(routeOffered(q, bad, 'userPays', { ...who, guard: undefined })).toBe(true);
    expect(routeOffered(q, bad, 'icpPull', who)).toBe(true);
  });
});

describe('verifyEvmRoute, stake (a real Base order made into a stake, its memo and ref recomputed)', () => {
  const q = load('base-usdc-to-base-eth');
  const base = executable(q, 'userPays')[0]!;
  const CKUSDC = 'xevnm-gaaaa-aaaar-qafnq-cai';
  const terms: MemoTerms = { kind: 'stake', salt: `0x${'55'.repeat(32)}`, minUsdc: BigInt(q.amountIn), owner: { evm: PAYER }, moveFee: 35_827n };
  const stakeQuote: Quote = { ...q, toChain: 'icp:737ba355e855bd4b61279056603e0550', toToken: { address: CKUSDC, symbol: 'ckUSDC', decimals: 6, verified: true } };
  const route = (t: MemoTerms = terms, to: Hex = CANISTER): Route => {
    const memo = encodeMemo(t);
    const ref = memoRef(memo);
    return { ...forge(q, base, (o) => ({ ...o, ref, memo, steps: [], payout: { token: q.fromToken.address as Hex, recipient: to, minOut: BigInt(q.amountIn) } })), pool: poolTerms(ref, memo, 'stake'), envelope: undefined };
  };
  const check = (r: Route, over: Partial<EvmCheckInput> = {}) => rule(() => verifyEvmRoute(input(stakeQuote, r, 'userPays', { recipient: PAYER, toToken: CKUSDC, stakeOwner: PAYER, ...over })));
  it('passes when the shares go to the payer and the USDC to the canister', () => expect(check(route())).toBe('passed'));
  it('refuses shares minted to someone else, even when the memo commits them', () => expect(check(route({ ...terms, owner: { evm: ATTACKER } }))).toBe('stakeOwner'));
  it('refuses shares minted to an ICP account from an EVM stake', () => expect(check(route({ ...terms, owner: { icp: { owner: ICP_ME, subaccount: null } } }))).toBe('stakeOwner'));
  it('refuses a move fee that eats the deposit', () => expect(check(route({ ...terms, moveFee: terms.minUsdc }))).toBe('moveFee'));
  it('refuses swap terms on a stake, and stake terms on a swap', () => {
    expect(check(route({ kind: 'swap', salt: terms.salt, minUsdc: terms.minUsdc, recipient: { owner: ICP_ME, subaccount: null }, tokenOut: CKUSDC, minOut: 1n, premium: 0n, icpFees: 0n }))).toBe('recipient');
    expect(check(route(), { stakeOwner: undefined })).toBe('stakeOwner');
  });
  it('refuses the USDC sent anywhere but the canister', () => expect(check(route(terms, ATTACKER))).toBe('poolDelivery'));
});
