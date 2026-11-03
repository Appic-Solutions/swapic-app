// Test only. Terms written as the canister's memo encoder writes them (canister/types/src/pool/memo), to build pool orders.
import { Principal } from '@icp-sdk/core/principal';
import { bytesToHex, concat, hexToBytes, numberToBytes, type Hex } from 'viem';
import type { PoolTerms } from '@/lib/api';
import type { MemoAccount, MemoTerms } from './memo';

const word = (v: bigint) => numberToBytes(v, { size: 16 });
const principal = (text: string) => {
  const b = Principal.fromText(text).toUint8Array();
  return concat([new Uint8Array([b.length]), b]);
};
const account = (a: MemoAccount) => concat([principal(a.owner), a.subaccount ? hexToBytes(a.subaccount) : new Uint8Array(32)]);

export function encodeMemo(t: MemoTerms): Hex {
  const head = [new Uint8Array([1, t.kind === 'swap' ? 0 : 1]), hexToBytes(t.salt), word(t.minUsdc)];
  const tail = t.kind === 'swap'
    ? [account(t.recipient), principal(t.tokenOut), word(t.minOut), word(t.premium), word(t.icpFees)]
    : ['evm' in t.owner ? concat([new Uint8Array([1]), hexToBytes(t.owner.evm)]) : concat([new Uint8Array([2]), account(t.owner.icp)]), word(t.moveFee)];
  return bytesToHex(concat([...head, ...tail]));
}

/** A route's `pool` as the quoter shows it, around a memo (shown only: the check reads the memo itself). */
export const poolTerms = (ref: Hex, memo: Hex, kind: 'swap' | 'stake'): PoolTerms => ({
  ref, kind, account: '', minUsdc: '0', premium: '0', icpFees: '0', moveFee: '0', salt: `0x${'00'.repeat(32)}`, memo,
});
