import { describe, expect, it } from 'vitest';
import { hashTypedData, type Hex } from 'viem';
import type { Quote, Route, WithdrawQuoteAnswer, WithdrawalJson } from '@/lib/api';
import type { UiToken } from '@/components/ui/token-types';
import { poolRefOf } from '@/features/swap/guards/abi';
import { verifyEvmRoute, type CheckedEvmRoute } from '@/features/swap/guards/evm';
import { CANISTER, GUARD, PAYER, executable, forge, load } from '@/features/swap/guards/forge.fixture';
import type { PickedOption } from '@/features/swap/options';
import { evmStakeReview, evmStakeSteps, evmWithdrawReview, icpStakeReview, icpWithdrawReview } from './review';
import { checkWithdrawQuote, withdrawalTypedData } from './withdraw-sig';

const USDC_BASE: UiToken = { key: 'eip155:8453|usdc', chain: 'eip155:8453', chain_type: 'EVM', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', decimals: 6 } as UiToken;
const CKUSDC_TOKEN: UiToken = { key: 'icp|ckusdc', chain: 'icp:737ba355e855bd4b61279056603e0550', chain_type: 'ICP', address: 'xevnm-gaaaa-aaaar-qafnq-cai', symbol: 'ckUSDC', decimals: 6 } as UiToken;
const NATIVE = { symbol: 'ETH', decimals: 18, priceUsd: '3000' };

describe('Review stake from an EVM chain, on a route the real check accepts (a real Base order made into a stake)', () => {
  const q = load('base-usdc-to-base-eth');
  const base = executable(q, 'userPays')[0]!;
  const CKUSDC = 'xevnm-gaaaa-aaaar-qafnq-cai';
  const terms = { ref: '', salt: `0x${'55'.repeat(32)}`, kind: 'stake' as const, account: PAYER.toLowerCase(), premium: '0', icpFees: '0', rebalanceShare: '35827', candid: '0x' };
  const ref = poolRefOf(terms);
  const route: Route = { ...forge(q, base, (o) => ({ ...o, ref, steps: [], payout: { token: q.fromToken.address as Hex, recipient: CANISTER, minOut: BigInt(q.amountIn) } })), pool: { ...terms, ref }, envelope: undefined };
  const stakeQuote: Quote = { ...q, toChain: 'icp:737ba355e855bd4b61279056603e0550', toToken: { address: CKUSDC, symbol: 'ckUSDC', decimals: 6, verified: true } };
  const amount = BigInt(q.amountIn);
  const checked = verifyEvmRoute({
    quote: stakeQuote, route, mode: 'userPays', payer: PAYER, recipient: PAYER, fromToken: q.fromToken.address, toToken: CKUSDC,
    amountIn: amount, guard: GUARD, nowSec: q.quotedAt, stakeOwner: PAYER,
  });
  const option: PickedOption = { key: `userPays:${route.routeId}`, tags: ['Fastest'], mode: 'userPays', route };
  const r = evmStakeReview({ option, checked, from: USDC_BASE, amount, native: NATIVE });

  it('adds the checked minimum less the rebalancing share the order commits', () => {
    expect(r.added).toBe(checked.minOut - 35_827n);
    // this fixture's minimum (a real order's) less 35,827 micro USDC, in whole cents, never rounded up
    expect(r.addedText).toBe('408,660,260.76');
  });
  it('a display field the check does not bind changes nothing', () => {
    const shown = evmStakeReview({ option: { ...option, route: { ...route, amountOut: '999999999999' } }, checked, from: USDC_BASE, amount, native: NATIVE });
    expect(shown.added).toBe(r.added);
  });
  it('asks for the steps the checked route runs: an approval first only when it carries one', () => {
    expect(r.steps.length).toBe(checked.approval ? 2 : 1);
    expect(r.steps.at(-1)!.label).toBe(checked.sign ? 'Sign in your wallet (no gas)' : 'Confirm stake (you pay gas)');
  });
});

describe('the wallet steps of a checked stake route', () => {
  const option = { key: 'k', tags: ['Fastest'], mode: 'userPays', route: { fees: [], etaSeconds: 12 } } as unknown as PickedOption;
  const approval = { token: '0x1' as Hex, spender: '0x2' as Hex, amount: 1n };
  const sign = { door: 'permit2612', typedData: [], auth: {} } as unknown as CheckedEvmRoute['sign'];
  const of = (c: Partial<CheckedEvmRoute>) => evmStakeSteps({ approval: null, sign: null, tx: null, ...c } as CheckedEvmRoute, option, USDC_BASE, NATIVE).map((s) => s.label);
  it('gasless: one signature', () => expect(of({ sign })).toEqual(['Sign in your wallet (no gas)']));
  it('gasless with an approval: approve, then sign', () => expect(of({ sign, approval })).toEqual(['Approve USDC (once, you pay gas)', 'Sign in your wallet (no gas)']));
  it('you pay gas with an approval: approve, then confirm', () => expect(of({ approval, tx: { to: '0x3', data: '0x', value: 0n } })).toEqual(['Approve USDC (once, you pay gas)', 'Confirm stake (you pay gas)']));
});

describe('Review stake from ICP', () => {
  const r = icpStakeReview(100_000_000n, 10_000n, CKUSDC_TOKEN);
  it('adds the amount itself; the wallet pays two ledger fees', () => {
    expect(r.added).toBe(100_000_000n);
    expect(r.addedText).toBe('100.00');
    expect(r.feeText).toBe('$0.02');
  });
  it('asks twice: approve the ckUSDC, then confirm', () => expect(r.steps.map((s) => s.label)).toEqual(['Approve ckUSDC', 'Confirm stake']));
});

describe('Review withdrawal to an EVM chain, on the record the real check accepts', () => {
  const SWAPIC = '0xF0Ba68cBc87c31eCaA9654EB14daF3632eaCa406' as Hex;
  const ARB_USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
  const record: WithdrawalJson = {
    staker: PAYER, usdc: '5000000', maxShares: '4980000000000000000', rebalanceShare: '1000', networkFee: '50000',
    payout: { dstChain: 42161, recipient: PAYER, tokenOut: ARB_USDC, minOut: '4949000', deadlineNs: '1800000000000000000' }, nonce: '7',
  };
  const answer = (expectedOut: string, queue?: { etaAt: number }): WithdrawQuoteAnswer => {
    const td = withdrawalTypedData(record, 8453, SWAPIC);
    return {
      withdrawal: record, typedData: td as never, digest: hashTypedData(td as never), verifyingContract: SWAPIC,
      fees: { networkFee: record.networkFee, rebalanceShare: record.rebalanceShare, moveCost: '0', networkLines: [] },
      payout: { route: 'cctp', amount: expectedOut, expectedOut, minOut: record.payout.minOut },
      shares: { burn: '0', maxShares: record.maxShares, label: 'estimated' }, etaSeconds: 20, quotedAt: 1_799_999_000, expiresAt: 1_800_000_000,
      ...(queue ? { queue: { place: 2, etaAt: queue.etaAt } } : {}),
    } as WithdrawQuoteAnswer;
  };
  const check = (a: WithdrawQuoteAnswer) => checkWithdrawQuote({
    answer: a, staker: PAYER, usdc: 5_000_000n, dstChainId: 42161, dstUsdc: ARB_USDC.toLowerCase() as Hex, poolChain: 8453, swapic: SWAPIC,
    totalAssets: 8_420_550_000n, totalShares: 8_346_065_000_000_000_000_000n, nowSec: 1_799_999_000, used: () => false,
  });

  it('shows the amount, the least paid out and the fee from the record', () => {
    const r = evmWithdrawReview(check(answer('4949000')), 1_799_999_000);
    expect(r.minOut).toBe(4_949_000n);
    expect(r.getLabel).toBe('You get at least');
    expect(r.feeText).toBe('$0.05');
    expect(r.arrives).toBe('Right away');
    expect(r.queuedText).toBeNull();
  });
  it('never shows the quoter\'s expectedOut', () => {
    expect(evmWithdrawReview(check(answer('9999999')), 1_799_999_000).getText).toBe(evmWithdrawReview(check(answer('4949000')), 1_799_999_000).getText);
  });
  it('a payout that waits says so, with its minutes', () => {
    const r = evmWithdrawReview(check(answer('4949000', { etaAt: 1_799_999_000 + 2_400 })), 1_799_999_000);
    expect(r.arrives).toBe('In line, about 40 min');
    expect(r.queuedText).toBe('Your withdrawal waits in line and pays out in about 40 min.');
  });
});

describe('Review withdrawal from ICP', () => {
  it('pays ckUSDC on ICP less the ledger fee, one confirm', () => {
    const r = icpWithdrawReview(250_000_000n, 10_000n);
    expect(r.minOut).toBe(249_990_000n);
    expect(r.feeText).toBe('$0.01');
    expect(r.steps.map((s) => s.label)).toEqual(['Confirm withdrawal']);
  });
});
