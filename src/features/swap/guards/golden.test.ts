// The app's encoders against the canister's golden vectors (tests/fixtures/golden/interface.json, swapic-core 47a36c9),
// which were computed independently of the canister: the Order with its memo, the gasless doors, the memos and the
// withdrawal must come out byte for byte the same here.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { hashTypedData, keccak256, stringToBytes, toFunctionSelector, type Hex } from 'viem';
import type { OrderJson, WithdrawalJson } from '@/lib/api';
import { withdrawalTypedData } from '@/features/pool/withdraw-sig';
import { SWAPIC_RUN_ABI, orderAbi, orderIdOf, orderValue } from './abi';
import { doorTypedData } from './evm';
import { decodeMemo, memoRef, type MemoTerms } from './memo';
import { encodeMemo } from './memo.fixture';

const golden = JSON.parse(readFileSync('tests/fixtures/golden/interface.json', 'utf8'));
const g = golden.order;
const order = orderValue({ ...(g.value as Omit<OrderJson, 'abi'>), abi: '0x' });

describe('the Swapic Order with its memo (golden)', () => {
  it('encodes the ABI tuple byte for byte', () => expect(orderAbi(order)).toBe(g.abi_encode));
  it('hashes to the golden order id under Swapic v3', () => expect(orderIdOf(order, g.chain_id, g.swapic)).toBe(g.order_id));
  it('names its type as the golden type string', () => expect(keccak256(stringToBytes(g.type_string))).toBe(g.type_hash));
  it('calls run with the golden selector', () => expect(toFunctionSelector(SWAPIC_RUN_ABI[0])).toBe(g.selectors.run));
  it('carries the memo of the first golden memo, whose keccak is its ref', () => {
    expect(order.memo).toBe(golden.memos[0].bytes);
    expect(memoRef(order.memo)).toBe(order.ref);
  });
});

describe('the gasless doors (golden)', () => {
  const d = g.doors;
  it('ReceiveWithAuthorization (3009)', () => {
    const v = d.auth_3009.value;
    const td = doorTypedData.auth3009({
      tokenName: d.auth_3009.domain.name, tokenVersion: d.auth_3009.domain.version, chainId: d.auth_3009.domain.chainId,
      token: d.auth_3009.domain.verifyingContract, payer: v.from, swapic: v.to, amountIn: BigInt(v.value), deadline: BigInt(v.validBefore), orderId: v.nonce,
    });
    expect(hashTypedData(td as never)).toBe(d.auth_3009.digest);
  });
  it('Permit2 with the order witness', () => {
    const v = d.permit2.value;
    const td = doorTypedData.permit2({ chainId: d.permit2.domain.chainId, token: v.token, swapic: v.spender, amountIn: BigInt(v.amount), nonce: BigInt(v.nonce), deadline: BigInt(v.deadline), orderId: v.orderId });
    expect(hashTypedData(td as never)).toBe(d.permit2.digest);
  });
  it('QuoteAcceptance (2612)', () => {
    const v = d.acceptance_2612.value;
    const td = doorTypedData.acceptance({ chainId: d.acceptance_2612.domain.chainId, token: v.tokenIn, payer: v.payer, swapic: d.acceptance_2612.domain.verifyingContract, amountIn: BigInt(v.amountIn), deadline: BigInt(v.deadline), orderId: v.orderId });
    expect(hashTypedData(td as never)).toBe(d.acceptance_2612.digest);
  });
});

const termsOf = (t: Record<string, unknown>): MemoTerms => {
  const account = (a: { owner: string; subaccount: string | null }) => ({ owner: a.owner, subaccount: (a.subaccount ?? null) as Hex | null });
  if (t.kind === 'stake') {
    const owner = t.owner as { evm?: Hex; icp?: { owner: string; subaccount: string | null } };
    return { kind: 'stake', salt: t.salt as Hex, minUsdc: BigInt(t.min_usdc as number), owner: owner.evm ? { evm: owner.evm } : { icp: account(owner.icp!) }, moveFee: BigInt(t.move_fee as number) };
  }
  return {
    kind: 'swap', salt: t.salt as Hex, minUsdc: BigInt(t.min_usdc as number), recipient: account(t.recipient as { owner: string; subaccount: string | null }),
    tokenOut: t.token_out as string, minOut: BigInt(t.min_out as number), premium: BigInt(t.premium as number), icpFees: BigInt(t.icp_fees as number),
  };
};

describe('the pool memos (golden)', () => {
  for (const m of golden.memos as { about: string; terms: Record<string, unknown>; bytes: Hex; ref: Hex }[]) {
    it(`${m.about}: decodes to its terms, hashes to its ref, encodes back`, () => {
      const terms = termsOf(m.terms);
      const read = decodeMemo(m.bytes);
      expect({ ...read, ...('owner' in read && 'evm' in read.owner ? { owner: { evm: read.owner.evm.toLowerCase() as Hex } } : {}) })
        .toEqual({ ...terms, ...('owner' in terms && 'evm' in terms.owner ? { owner: { evm: terms.owner.evm.toLowerCase() as Hex } } : {}) });
      expect(memoRef(m.bytes)).toBe(m.ref);
      expect(encodeMemo(terms)).toBe(m.bytes);
    });
  }
});

describe('the withdrawal (golden)', () => {
  it('rebuilds the golden digest, its move fee signed as moveFee', () => {
    const w = golden.withdrawal;
    const v = w.value;
    const record: WithdrawalJson = {
      staker: v.staker, usdc: v.usdc, maxShares: v.maxShares, moveFee: v.moveFee, networkFee: v.networkFee,
      payout: { dstChain: v.dstChain, recipient: v.recipient, tokenOut: v.tokenOut, minOut: v.minOut, deadlineNs: (BigInt(v.deadline) * 1_000_000_000n).toString() },
      nonce: String(v.nonce),
    };
    const td = withdrawalTypedData(record, w.domain.chainId, w.domain.verifyingContract);
    expect(hashTypedData(td as never)).toBe(w.digest);
  });
});
