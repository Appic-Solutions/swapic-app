import { Principal } from '@icp-sdk/core/principal';
import { bytesToHex, getAddress, hexToBigInt, hexToBytes, size, slice, type Hex } from 'viem';
import { GuardError } from './errors';

export interface Envelope {
  version: bigint; ref: Hex; action: 'deliver' | 'swap' | 'ckDeposit'; deadline: bigint;
  recipient: Hex; tokenOut: Hex; minOut: bigint; principal: Hex; subaccount: Hex; minGas: bigint;
  /** The ICP principal a ck deposit pays, read back from its word; null otherwise. */
  principalText: string | null;
}
const ACTIONS = ['deliver', 'swap', 'ckDeposit'] as const;

/** 10 static words, 320 bytes (libraries/onchain/src/swapic/envelope.rs:1-3, 50-63); action codes 0, 1, 2. */
export function decodeEnvelope(hex: Hex): Envelope {
  if (size(hex) !== 320) throw new GuardError('envelopeSize');
  const w = (i: number) => slice(hex, 32 * i, 32 * (i + 1));
  if (hexToBigInt(w(0)) !== 3n) throw new GuardError('envelopeVersion');
  const action = ACTIONS[Number(hexToBigInt(w(2)))];
  if (!action) throw new GuardError('envelopeAction');
  const principal = w(7).toLowerCase() as Hex;
  return {
    version: 3n, ref: w(1).toLowerCase() as Hex, action, deadline: hexToBigInt(w(3)),
    recipient: getAddress(slice(w(4), 12)), tokenOut: getAddress(slice(w(5), 12)), minOut: hexToBigInt(w(6)),
    principal, subaccount: w(8).toLowerCase() as Hex, minGas: hexToBigInt(w(9)),
    principalText: action === 'ckDeposit' ? principalFromWord(principal) : null,
  };
}

/** Every word equal (the decode is exact, so equal fields mean equal bytes). */
export const sameEnvelope = (a: Envelope, b: Envelope) =>
  a.ref === b.ref && a.action === b.action && a.deadline === b.deadline && a.recipient === b.recipient && a.tokenOut === b.tokenOut
  && a.minOut === b.minOut && a.principal === b.principal && a.subaccount === b.subaccount && a.minGas === b.minGas;

/** The ck deposit's principal word: its length byte, then its bytes, right padded (platform-v2 principal_to_hex.ts:7). */
export function principalWord(principal: string): Hex {
  const b = Principal.fromText(principal).toUint8Array();
  const out = new Uint8Array(32);
  out[0] = b.length;
  out.set(b, 1);
  return bytesToHex(out);
}

function principalFromWord(word: Hex): string | null {
  const b = hexToBytes(word);
  const n = b[0] ?? 0;
  if (n === 0 || n > 29 || b.slice(1 + n).some((x) => x !== 0)) return null;
  try { return Principal.fromUint8Array(b.slice(1, 1 + n)).toText(); } catch { return null; }
}
