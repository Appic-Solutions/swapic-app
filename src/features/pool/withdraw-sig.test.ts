import { describe, expect, it } from 'vitest';
import { bytesToHex, hashTypedData, hexToBytes, type Hex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type { WithdrawQuoteAnswer, WithdrawalJson } from '@/lib/api';
import { checkWithdrawQuote, normalizeSignature, withdrawalTypedData, type WithdrawCheckInput } from './withdraw-sig';

const SWAPIC = '0xF0Ba68cBc87c31eCaA9654EB14daF3632eaCa406' as Hex;
const STAKER = '0xf00EBA8E5Fd231b526ADFAAa68B4d0ede72A89AC' as Hex;
const ARB_USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
/** A record in the shape of the backend's fixed example; the pinned digest is the golden one (guards/golden.test.ts). */
const FIXED: WithdrawalJson = {
  staker: STAKER, usdc: '5000000', maxShares: '5000000000000000000', moveFee: '1000', networkFee: '50000',
  payout: { dstChain: 42161, recipient: STAKER, tokenOut: ARB_USDC, minOut: '4949000', deadlineNs: '1800000000000000000' }, nonce: '7',
};
// a pool where 5 USDC burns about 4.96 shares: A/S = 1.008924 USDC a share (contract 5.3 example)
const A = 8_420_550_000n;
const S = 8_346_065_000_000_000_000_000n;

function answer(record: WithdrawalJson): WithdrawQuoteAnswer {
  const td = withdrawalTypedData(record, 8453, SWAPIC);
  return {
    // viem 2.57 range-checks a uint64 when hashing: a record past u64 (the oversized nonce case) gets a zero digest, and the
    // check refuses its nonce before it hashes anything
    withdrawal: record, typedData: td as never, digest: (() => { try { return hashTypedData(td as never); } catch { return `0x${'00'.repeat(32)}` as Hex; } })(), verifyingContract: SWAPIC,
    fees: { networkFee: record.networkFee, moveFee: record.moveFee },
    payout: { route: 'cctp', amount: '4949000', expectedOut: '4949000', minOut: record.payout.minOut },
    shares: { burn: '0', maxShares: record.maxShares, label: 'estimated' }, etaSeconds: 20, quotedAt: 1_799_999_000, expiresAt: 1_800_000_000,
  };
}
const fit = (r: WithdrawalJson): WithdrawalJson => ({ ...r, maxShares: '4980000000000000000' });
function input(record: WithdrawalJson, over: Partial<WithdrawCheckInput> = {}): WithdrawCheckInput {
  return { answer: answer(record), staker: STAKER, usdc: 5_000_000n, dstChainId: 42161, dstUsdc: ARB_USDC.toLowerCase() as Hex, poolChain: 8453, swapic: SWAPIC, totalAssets: A, totalShares: S, nowSec: 1_799_999_000, used: () => false, ...over };
}
const rule = (f: () => unknown) => { try { f(); } catch (e) { return (e as { rule: string }).rule; } return 'passed'; };

describe('checkWithdrawQuote', () => {
  it('passes a quote that pays the staker what was asked', () => {
    const c = checkWithdrawQuote(input(fit(FIXED)));
    expect(c.candid.payout.deadline_ns).toBe(1_800_000_000_000_000_000n);
    expect(c.typedData.message.deadline).toBe(1_800_000_000n);
    expect(c.minOut).toBe(4_949_000n);
    expect(c.queued).toBe(false);
  });
  it('carries the queue the quote announces (a short Base side, Jeff 2026-10-28)', () => {
    const a = { ...answer(fit(FIXED)), queue: { place: 2, aheadUsdc: '1200000000', etaAt: 1_800_000_000 - 1_200 } };
    const c = checkWithdrawQuote({ ...input(fit(FIXED)), answer: a });
    expect(c).toMatchObject({ queued: true, queueEtaAt: 1_799_998_800 });
    const unknown = { ...answer(fit(FIXED)), queue: { place: null, aheadUsdc: null, etaAt: null } };
    expect(checkWithdrawQuote({ ...input(fit(FIXED)), answer: unknown })).toMatchObject({ queued: true, queueEtaAt: null });
  });
  it('refuses another recipient, chain, token, amount or staker', () => {
    expect(rule(() => checkWithdrawQuote(input({ ...fit(FIXED), payout: { ...FIXED.payout, recipient: '0x000000000000000000000000000000000000dEaD' } })))).toBe('recipient');
    expect(rule(() => checkWithdrawQuote(input(fit(FIXED), { dstChainId: 8453 })))).toBe('dstChain');
    // the quoter's record names Arbitrum USDC; the canister names another token for that chain: refused (plan check C4)
    expect(rule(() => checkWithdrawQuote(input(fit(FIXED), { dstUsdc: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' })))).toBe('tokenOut');
    expect(rule(() => checkWithdrawQuote(input(fit(FIXED), { dstUsdc: undefined })))).toBe('noAnchor');
    expect(rule(() => checkWithdrawQuote(input(fit(FIXED), { usdc: 4_000_000n })))).toBe('usdc');
    expect(rule(() => checkWithdrawQuote(input(fit(FIXED), { staker: '0x000000000000000000000000000000000000dEaD' })))).toBe('staker');
  });
  it('refuses another verifying contract, a digest that differs, a missing anchor', () => {
    const a = answer(fit(FIXED)); a.verifyingContract = '0x000000000000000000000000000000000000dEaD';
    expect(rule(() => checkWithdrawQuote({ ...input(fit(FIXED)), answer: a }))).toBe('verifyingContract');
    const b = answer(fit(FIXED)); b.digest = `0x${'00'.repeat(32)}`;
    expect(rule(() => checkWithdrawQuote({ ...input(fit(FIXED)), answer: b }))).toBe('digest');
    expect(rule(() => checkWithdrawQuote(input(fit(FIXED), { swapic: undefined })))).toBe('noAnchor');
  });
  it('takes the 6 hour deadline of a withdrawal that may wait; refuses one under 5 minutes and a used, zero or oversized nonce', () => {
    expect(rule(() => checkWithdrawQuote(input(fit(FIXED), { nowSec: 1_800_000_000 - 6 * 3_600 })))).toBe('passed');
    expect(rule(() => checkWithdrawQuote(input(fit(FIXED), { nowSec: 1_800_000_000 - 299 })))).toBe('deadline');
    expect(rule(() => checkWithdrawQuote(input(fit(FIXED), { used: (n) => n === '7' })))).toBe('nonce');
    expect(rule(() => checkWithdrawQuote(input({ ...fit(FIXED), nonce: '0' })))).toBe('nonce');
    expect(rule(() => checkWithdrawQuote(input({ ...fit(FIXED), nonce: '18446744073709551616' })))).toBe('nonce');
  });
  it('refuses maxShares below the burn or far above the quoter rule', () => {
    expect(rule(() => checkWithdrawQuote(input({ ...FIXED, maxShares: '1000' })))).toBe('maxShares');
    expect(rule(() => checkWithdrawQuote(input({ ...FIXED, maxShares: '6000000000000000000' })))).toBe('maxShares');
  });
  it('leaves room for the pool fee burned beside the withdrawal, and never believes one above a dollar', () => {
    // $5 out with a cent of pool fee: 1% more shares than the USDC's own, past the plain rule, inside the fee's
    const padded = { ...FIXED, maxShares: '5040000000000000000' };
    expect(rule(() => checkWithdrawQuote(input(padded)))).toBe('maxShares');
    const c = checkWithdrawQuote(input(padded, { poolFee: 10_000n }));
    expect(c.poolFee).toBe(10_000n);
    expect(rule(() => checkWithdrawQuote(input(padded, { poolFee: 1_000_001n })))).toBe('poolFee');
  });
});

describe('normalizeSignature', () => {
  const account = privateKeyToAccount(generatePrivateKey());
  const record = fit({ ...FIXED, staker: account.address, payout: { ...FIXED.payout, recipient: account.address } });
  const typed = withdrawalTypedData(record, 8453, SWAPIC);
  const N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
  it('keeps a canonical signature and recovers the staker', async () => {
    const sig = await account.signTypedData(typed as never);
    expect(bytesToHex(await normalizeSignature(sig, typed, account.address))).toBe(sig);
  });
  it('turns v 0 or 1 into 27 or 28, and a high s into the low one', async () => {
    const sig = hexToBytes(await account.signTypedData(typed as never));
    const v01 = sig.slice(); v01[64] = v01[64]! - 27;
    expect(bytesToHex(await normalizeSignature(bytesToHex(v01), typed, account.address))).toBe(bytesToHex(sig));
    const s = BigInt(bytesToHex(sig.slice(32, 64)));
    const high = new Uint8Array(65); high.set(sig.slice(0, 32)); high.set(hexToBytes(`0x${(N - s).toString(16).padStart(64, '0')}`), 32); high[64] = sig[64] === 27 ? 28 : 27;
    expect(bytesToHex(await normalizeSignature(bytesToHex(high), typed, account.address))).toBe(bytesToHex(sig));
  });
  it('refuses a signature from another key', async () => {
    const other = privateKeyToAccount(generatePrivateKey());
    await expect(normalizeSignature(await other.signTypedData(typed as never), typed, account.address)).rejects.toMatchObject({ rule: 'signer' });
  });
});
