import { describe, expect, it } from 'vitest';
import type { Hex } from 'viem';
import type { GuardError } from './errors';
import { MAX_MEMO_BYTES, decodeMemo, type MemoTerms } from './memo';
import { encodeMemo } from './memo.fixture';

const rule = (f: () => unknown) => { try { f(); } catch (e) { return (e as GuardError).rule ?? String(e); } return 'passed'; };
const stake: MemoTerms = { kind: 'stake', salt: `0x${'22'.repeat(32)}`, minUsdc: 2_000_000n, owner: { evm: '0xf00eba8e5fd231b526adfaaa68b4d0ede72a89ac' }, moveFee: 500n };
const swap: MemoTerms = {
  kind: 'swap', salt: `0x${'11'.repeat(32)}`, minUsdc: 1_000_000n, recipient: { owner: '2vxsx-fae', subaccount: `0x${'00'.repeat(31)}01` },
  tokenOut: 'xevnm-gaaaa-aaaar-qafnq-cai', minOut: 990_000n, premium: 1000n, icpFees: 20_000n,
};

describe('decodeMemo, as the canister decodes it', () => {
  it('reads back what was written, a stake and a swap', () => {
    expect(decodeMemo(encodeMemo(stake))).toEqual(stake);
    expect(decodeMemo(encodeMemo(swap))).toEqual(swap);
  });
  it('reads 32 zero subaccount bytes as none', () => {
    const t = { ...swap, recipient: { owner: '2vxsx-fae', subaccount: null } };
    expect(decodeMemo(encodeMemo(t))).toEqual(t);
  });
  it('refuses a byte left over, a byte missing, another version or kind, another owner tag', () => {
    const m = encodeMemo(stake);
    expect(rule(() => decodeMemo(`${m}00` as Hex))).toBe('memo');
    expect(rule(() => decodeMemo(m.slice(0, -2) as Hex))).toBe('memo');
    expect(rule(() => decodeMemo(`0x02${m.slice(4)}` as Hex))).toBe('memo');
    expect(rule(() => decodeMemo(`0x0102${m.slice(6)}` as Hex))).toBe('memo');
    const tagAt = 2 + 2 * (2 + 32 + 16);
    expect(rule(() => decodeMemo(`${m.slice(0, tagAt)}03${m.slice(tagAt + 2)}` as Hex))).toBe('memo');
  });
  it('refuses a principal of 0 or more than 29 bytes, and a memo past 256 bytes', () => {
    const m = encodeMemo(swap);
    const lenAt = 2 + 2 * (2 + 32 + 16);
    expect(rule(() => decodeMemo(`${m.slice(0, lenAt)}00${m.slice(lenAt + 2)}` as Hex))).toBe('memo');
    expect(rule(() => decodeMemo(`${m.slice(0, lenAt)}1e${m.slice(lenAt + 2)}` as Hex))).toBe('memo');
    expect(rule(() => decodeMemo(`0x${'01'.repeat(MAX_MEMO_BYTES + 1)}` as Hex))).toBe('memo');
    expect(rule(() => decodeMemo('0x' as Hex))).toBe('memo');
  });
});
