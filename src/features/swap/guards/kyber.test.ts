import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeFunctionData, encodeFunctionData, type Hex } from 'viem';
import type { ChainView } from '@/lib/icp';
import { KYBER_EXECUTOR, KYBER_ROUTER, STEP_ABI } from './abi';
import type { GuardError } from './errors';
import { readKyberSwap } from './plan';

// Two real KyberSwap builds of 2026-11-01 (Arbitrum WETH to USDC, built for the Arbitrum Runner; the services' samples,
// copied to tests/fixtures/real/kyber): one hands its input to a SushiSwap v2 style pool, one to KyberSwap's executor.
const WETH = '0x82af49447d8a07e3bd95bd0d56f35241523fbab1' as Hex;
const POOL = '0x57b85fef094e10b5eecdf350af688299e9553378' as Hex;
const ZERO = '0x0000000000000000000000000000000000000000' as Hex;
// the Arbitrum contracts the builds were made for (their Runner), and a canister, as the services' own test has them
const SOURCE: ChainView = {
  swapic: '0xF2E9d13Ba690c71cfF7788DE7273Ca7658d6D7C7', runner: '0xd9a6d4123BcF737A36e5f66D474891f15E8d2d3C',
  cctpReceiver: '0xcc7bcc7bcc7bcc7bcc7bcc7bcc7bcc7bcc7bcc7b', usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', tokenMessenger: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
};
const CANISTER = '0xcacacacacacacacacacacacacacacacacacacaca' as Hex;

const built = (shape: 'pool' | 'executor') => {
  const s = JSON.parse(readFileSync(`tests/fixtures/real/kyber/kyber_arb_weth_usdc_${shape}_2026_11_01.json`, 'utf8'));
  return { router: s.build.data.routerAddress as Hex, data: s.build.data.data as Hex };
};
const step = (target: Hex, data: Hex, over: Partial<{ token: Hex; writes: { at: number; minus: bigint }[] }> = {}) =>
  ({ target, data, token: WETH, min: 0n, writes: [], ...over });
type Execution = { callTarget: Hex; desc: { srcToken: Hex; srcReceivers: Hex[]; feeReceivers: Hex[]; feeAmounts: bigint[]; dstReceiver: Hex; permit: Hex } };
/** The pool build with one part changed, encoded again as KyberSwap would. */
const changed = (change: (ex: Execution) => void): Hex => {
  const { data } = built('pool');
  const ex = structuredClone((decodeFunctionData({ abi: STEP_ABI, data }).args as unknown as readonly [Execution])[0]);
  change(ex);
  return encodeFunctionData({ abi: STEP_ABI, functionName: 'swap', args: [ex as never] });
};
const rule = (f: () => unknown) => { try { f(); } catch (e) { return (e as GuardError).rule ?? String(e); } return 'passed'; };
const check = (data: Hex, over: Parameters<typeof step>[2] = {}, target: Hex = KYBER_ROUTER, canister: Hex | null = CANISTER) =>
  rule(() => readKyberSwap(step(target, data, over), SOURCE, canister));

describe('a KyberSwap step (option B, as the canister and the services read it)', () => {
  it('passes the route that hands its input straight to a v2 style pool', () => {
    const { router, data } = built('pool');
    expect(router.toLowerCase()).toBe(KYBER_ROUTER);
    const ex = (decodeFunctionData({ abi: STEP_ABI, data }).args as unknown as readonly [Execution])[0];
    expect(ex.desc.srcReceivers.map((r) => r.toLowerCase())).toEqual([POOL]);
    expect(ex.callTarget.toLowerCase()).toBe(KYBER_EXECUTOR);
    expect(rule(() => readKyberSwap(step(router, data), SOURCE, CANISTER))).toBe('passed');
  });
  it('passes the route that hands its input to KyberSwap\'s executor, as before', () => {
    const { router, data } = built('executor');
    const ex = (decodeFunctionData({ abi: STEP_ABI, data }).args as unknown as readonly [Execution])[0];
    expect(ex.desc.srcReceivers.map((r) => r.toLowerCase())).toEqual([KYBER_EXECUTOR]);
    expect(rule(() => readKyberSwap(step(router, data), SOURCE, CANISTER))).toBe('passed');
  });
  it('refuses a call that is not on KyberSwap\'s router', () => expect(check(built('pool').data, {}, SOURCE.swapic)).toBe('unknownStep'));
  it('refuses writes on the step and bytes that are not the canonical encoding', () => {
    expect(check(built('pool').data, { writes: [{ at: 4, minus: 0n }] })).toBe('stepNotCanonical');
    expect(check(`${built('pool').data}00` as Hex)).toBe('stepNotCanonical');
  });
  it('refuses selling another token than the step spends, or the zero address', () => {
    expect(check(built('pool').data, { token: SOURCE.usdc })).toBe('swapToken');
    expect(check(changed((ex) => { ex.desc.srcToken = ZERO; }), { token: ZERO })).toBe('swapToken');
  });
  it('refuses a callTarget other than KyberSwap\'s executor', () => expect(check(changed((ex) => { ex.callTarget = POOL; }))).toBe('swapExecutor'));
  it('refuses an input handed to no one, to the zero address or to ours, alone or beside a pool', () => {
    expect(check(changed((ex) => { ex.desc.srcReceivers = []; }))).toBe('swapSrcReceiver');
    for (const ours of [ZERO, SOURCE.swapic, SOURCE.runner, SOURCE.cctpReceiver, CANISTER]) {
      expect(check(changed((ex) => { ex.desc.srcReceivers = [ours]; }))).toBe('swapSrcReceiver');
      expect(check(changed((ex) => { ex.desc.srcReceivers = [POOL, ours.toLowerCase() as Hex]; }))).toBe('swapSrcReceiver');
    }
  });
  it('refuses fees and a permit', () => {
    expect(check(changed((ex) => { ex.desc.feeReceivers = [POOL]; ex.desc.feeAmounts = [1n]; }))).toBe('swapFees');
    expect(check(changed((ex) => { ex.desc.permit = '0x01'; }))).toBe('swapFees');
  });
  it('refuses an output paid to other than the Runner', () => expect(check(changed((ex) => { ex.desc.dstReceiver = POOL; }))).toBe('swapReceiver'));
  it('refuses when the canister\'s EVM address is not known (it could not tell ours from a pool)', () => expect(check(built('pool').data, {}, KYBER_ROUTER, null)).toBe('noAnchor'));
});
