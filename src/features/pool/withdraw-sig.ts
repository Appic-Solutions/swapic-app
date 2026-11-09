// Design note (withdraw to EVM, plan 3 Task 1).
// Must never happen: a signature over anything but the record that is sent; a record that pays anyone but the staker, on
// another chain, in anything but that chain's USDC as the canister's get_config names it (never the quoter's chain list,
// plan check C4), or takes more USDC than asked; a verifying contract or chain id that is not Swapic on the pool chain as
// get_config names it; a deadline under 5 minutes ahead, signed in anything but seconds or sent in anything but
// nanoseconds; a nonce that is zero, past u64 or already used by this browser; a signature with v other than 27 or 28 or
// a high s (the canister requires both); a second withdrawal created by a retry.
// How the design proves it: checkWithdrawQuote checks every field of the quoter's record against the person's pick
// (staker = the connected address = the recipient; dstChain; tokenOut = get_config's USDC for that chain; usdc = the
// amount asked; minOut > 0 and equal to payout.minOut; the deadline 5 minutes to a day ahead; maxShares between the burn
// and the quoter's rule plus 1%; the nonce non zero, within u64, unused here) and REBUILDS the typed data itself
// ("Swapic Pool" v1, the pool chain, the anchored Swapic, the deadline floored to seconds); its digest must equal the
// quote's, and the encoding is pinned by the backend's fixed example digest. The quoter's typedData is never passed to the
// wallet. normalizeSignature turns v 0 or 1 into 27 or 28 and a high s into n - s with v flipped, then recovers the signer
// from the rebuilt typed data and requires the staker. The record sent (candid or POST /v2/withdraw JSON) is built from
// the same checked record. Tests: withdraw-sig.test.ts.
import { getAddress, hashTypedData, hexToBytes, bytesToHex, recoverTypedDataAddress, type Hex } from 'viem';
import type { WithdrawQuoteAnswer, WithdrawalJson } from '@/lib/api';
import type { EvmWithdrawal } from '@/lib/icp';
import type { SignableTypedData } from '@/lib/wallets';
import { maxSharesFor, sharesToBurn } from '@/lib/money';
import { GuardError, must } from '@/features/swap/guards/errors';

const U64_MAX = 18_446_744_073_709_551_615n;
const N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const MIN_AHEAD_S = 300;
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export const WITHDRAWAL_TYPES = {
  Withdrawal: [
    { name: 'staker', type: 'address' }, { name: 'usdc', type: 'uint256' }, { name: 'maxShares', type: 'uint256' },
    { name: 'moveFee', type: 'uint256' }, { name: 'networkFee', type: 'uint256' }, { name: 'dstChain', type: 'uint64' },
    { name: 'recipient', type: 'address' }, { name: 'tokenOut', type: 'address' }, { name: 'minOut', type: 'uint256' },
    { name: 'deadline', type: 'uint64' }, { name: 'nonce', type: 'uint64' },
  ],
};

/** "Swapic Pool" v1 (golden interface.json `withdrawal`): the deadline signed in seconds, floored from the record's nanoseconds. */
export function withdrawalTypedData(r: WithdrawalJson, chainId: number, swapic: Hex): SignableTypedData {
  return {
    domain: { name: 'Swapic Pool', version: '1', chainId, verifyingContract: getAddress(swapic) },
    types: WITHDRAWAL_TYPES,
    primaryType: 'Withdrawal',
    message: {
      staker: getAddress(r.staker), usdc: BigInt(r.usdc), maxShares: BigInt(r.maxShares), moveFee: BigInt(r.moveFee),
      networkFee: BigInt(r.networkFee), dstChain: BigInt(r.payout.dstChain), recipient: getAddress(r.payout.recipient),
      tokenOut: getAddress(r.payout.tokenOut), minOut: BigInt(r.payout.minOut), deadline: BigInt(r.payout.deadlineNs) / 1_000_000_000n, nonce: BigInt(r.nonce),
    },
  };
}

/** The canister's ceiling on the pool fee (types MAX_POOL_FEE): a quoter asking more is not believed. */
export const MAX_POOL_FEE = 1_000_000n;

export interface WithdrawCheckInput {
  answer: WithdrawQuoteAnswer; staker: Hex; usdc: bigint; dstChainId: number;
  /** the destination chain's USDC from get_config (`cfg.chains.get(dstChainId)?.usdc`), never from /v2/chains (plan check C4) */
  dstUsdc: Hex | undefined;
  poolChain: number | null; swapic: Hex | undefined; totalAssets: bigint; totalShares: bigint;
  nowSec: number; used: (nonce: string) => boolean;
  /** The pool fee whose shares are burned beside the withdrawal's (poolFeeOf): within the canister's dollar ceiling. */
  poolFee?: bigint;
}
export interface CheckedWithdraw {
  record: WithdrawalJson; candid: EvmWithdrawal; typedData: SignableTypedData; digest: Hex;
  minOut: bigint; expectedOut: bigint; feeUsdc: bigint; poolFee: bigint; etaSeconds: number;
  queued: boolean; queueEtaAt: number | null;
}

export function checkWithdrawQuote(i: WithdrawCheckInput): CheckedWithdraw {
  must(!!i.swapic && i.poolChain !== null && !!i.dstUsdc, 'noAnchor');
  const a = i.answer;
  const r = a.withdrawal;
  must(same(a.verifyingContract, i.swapic!), 'verifyingContract');
  must(same(r.staker, i.staker), 'staker');
  must(BigInt(r.usdc) === i.usdc, 'usdc');
  must(same(r.payout.recipient, i.staker), 'recipient');
  must(r.payout.dstChain === i.dstChainId, 'dstChain');
  must(same(r.payout.tokenOut, i.dstUsdc!), 'tokenOut');
  const minOut = BigInt(r.payout.minOut);
  must(minOut > 0n && minOut === BigInt(a.payout.minOut), 'minOut');
  const fee = BigInt(r.networkFee) + BigInt(r.moveFee);
  must(fee < i.usdc, 'fees');
  // at least 5 minutes ahead (the canister's floor); at most a day: the quoter signs 6 hours out for a withdrawal that may wait
  const deadlineS = BigInt(r.payout.deadlineNs) / 1_000_000_000n;
  must(deadlineS >= BigInt(i.nowSec + MIN_AHEAD_S) && deadlineS <= BigInt(i.nowSec + 86_400), 'deadline');
  must(/^\d{1,20}$/.test(r.nonce) && BigInt(r.nonce) > 0n && BigInt(r.nonce) <= U64_MAX && !i.used(r.nonce), 'nonce');
  const burn = sharesToBurn(i.usdc, i.totalAssets, i.totalShares);
  const poolFee = i.poolFee ?? 0n;
  must(poolFee >= 0n && poolFee <= MAX_POOL_FEE, 'poolFee');
  const most = maxSharesFor(i.usdc + poolFee, i.totalAssets, i.totalShares);
  const maxShares = BigInt(r.maxShares);
  must(maxShares >= burn && maxShares <= (most * 101n) / 100n, 'maxShares');

  const typedData = withdrawalTypedData(r, i.poolChain!, i.swapic!);
  const digest = hashTypedData(typedData as never);
  must(digest === a.digest.toLowerCase(), 'digest');

  return {
    record: r, typedData, digest, minOut, expectedOut: BigInt(a.payout.expectedOut), feeUsdc: fee, poolFee, etaSeconds: a.etaSeconds,
    queued: !!a.queue, queueEtaAt: a.queue?.etaAt ?? null,
    candid: {
      staker: r.staker, usdc: i.usdc, max_shares: maxShares, move_fee: BigInt(r.moveFee), network_fee: BigInt(r.networkFee),
      payout: { dst_chain: BigInt(r.payout.dstChain), recipient: r.payout.recipient, token_out: r.payout.tokenOut, min_out: minOut, deadline_ns: BigInt(r.payout.deadlineNs) },
      nonce: BigInt(r.nonce),
    },
  };
}

/** v 27 or 28, low s; then the signer recovered from the rebuilt typed data must be the staker. */
export async function normalizeSignature(sig: Hex, typed: SignableTypedData, staker: Hex): Promise<Uint8Array> {
  const b = hexToBytes(sig);
  if (b.length !== 65) throw new GuardError('signatureLength');
  let v = b[64]!;
  if (v === 0 || v === 1) v += 27;
  if (v !== 27 && v !== 28) throw new GuardError('signatureV');
  let s = BigInt(bytesToHex(b.slice(32, 64)));
  if (s > N / 2n) {
    s = N - s;
    v = v === 27 ? 28 : 27;
  }
  const out = new Uint8Array(65);
  out.set(b.slice(0, 32), 0);
  out.set(hexToBytes(`0x${s.toString(16).padStart(64, '0')}`), 32);
  out[64] = v;
  const signer = await recoverTypedDataAddress({ domain: typed.domain, types: typed.types, primaryType: typed.primaryType, message: typed.message, signature: bytesToHex(out) } as never);
  if (!same(signer, staker)) throw new GuardError('signer');
  return out;
}
