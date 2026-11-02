// A pool deposit's terms as its order's `memo` carries them, read as the canister reads them (swapic-core
// canister/types/src/pool/memo, golden vectors in tests/fixtures/golden/interface.json): `ref = keccak256(memo)`.
// Version 1, packed, every integer big endian: version 0x01 | kind (0 swap, 1 stake) | salt 32 | min_usdc 16; then a
// swap: recipient (an account) | token_out (a principal) | min_out 16 | premium 16 | icp_fees 16; a stake: owner (0x01
// and a 20 byte address, or 0x02 and an account) | move_fee 16. An account is a principal then its 32 subaccount bytes
// (zeros: none); a principal is its length (1 to 29) then its bytes. At most 256 bytes, every byte read.
import { Principal } from '@icp-sdk/core/principal';
import { bytesToHex, hexToBytes, keccak256, type Hex } from 'viem';
import { GuardError } from './errors';

export const MAX_MEMO_BYTES = 256;
const MAX_PRINCIPAL_BYTES = 29;

/** An ICP account as the memo holds it; `subaccount` null for the default (32 zero bytes). */
export interface MemoAccount { owner: string; subaccount: Hex | null }
export type MemoTerms =
  | { kind: 'swap'; salt: Hex; minUsdc: bigint; recipient: MemoAccount; tokenOut: string; minOut: bigint; premium: bigint; icpFees: bigint }
  | { kind: 'stake'; salt: Hex; minUsdc: bigint; owner: { evm: Hex } | { icp: MemoAccount }; moveFee: bigint };

export const memoRef = (memo: Hex): Hex => keccak256(memo).toLowerCase() as Hex;

/** The terms a memo holds, or GuardError('memo'). */
export function decodeMemo(memo: Hex): MemoTerms {
  let b: Uint8Array;
  try { b = hexToBytes(memo); } catch { throw new GuardError('memo'); }
  if (b.length > MAX_MEMO_BYTES) throw new GuardError('memo');
  let at = 0;
  const take = (n: number) => {
    if (at + n > b.length) throw new GuardError('memo');
    const out = b.slice(at, at + n);
    at += n;
    return out;
  };
  const byte = () => take(1)[0]!;
  const word = () => BigInt(bytesToHex(take(16)));
  const principal = () => {
    const len = byte();
    if (len === 0 || len > MAX_PRINCIPAL_BYTES) throw new GuardError('memo');
    return Principal.fromUint8Array(take(len)).toText();
  };
  const account = (): MemoAccount => {
    const owner = principal();
    const sub = take(32);
    return { owner, subaccount: sub.every((x) => x === 0) ? null : bytesToHex(sub) };
  };
  if (byte() !== 1) throw new GuardError('memo');
  const kind = byte();
  const salt = bytesToHex(take(32));
  const minUsdc = word();
  let terms: MemoTerms;
  if (kind === 0) {
    const recipient = account();
    const tokenOut = principal();
    terms = { kind: 'swap', salt, minUsdc, recipient, tokenOut, minOut: word(), premium: word(), icpFees: word() };
  } else if (kind === 1) {
    const tag = byte();
    const owner = tag === 1 ? { evm: bytesToHex(take(20)) } : tag === 2 ? { icp: account() } : null;
    if (!owner) throw new GuardError('memo');
    terms = { kind: 'stake', salt, minUsdc, owner, moveFee: word() };
  } else {
    throw new GuardError('memo');
  }
  if (at !== b.length) throw new GuardError('memo');
  return terms;
}
