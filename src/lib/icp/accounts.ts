import { Principal } from '@icp-sdk/core/principal';
import type { IcpAccount } from './declarations/swapic.did';

export function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (!/^([0-9a-fA-F]{2})*$/.test(h)) throw new Error('not hex');
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(2 * i, 2 * i + 2), 16);
  return out;
}

export function bytesToHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

/** `principal` or `principal.subaccount_hex` (libraries/common/src/canister/pool/mod.rs:435-485). */
export function parseIcpAccount(text: string): IcpAccount {
  const [p, sub] = text.split('.');
  const owner = Principal.fromText(p ?? '');
  if (sub === undefined) return { owner, subaccount: [] };
  const bytes = hexToBytes(sub);
  if (bytes.length !== 32) throw new Error('a subaccount is 32 bytes');
  return { owner, subaccount: [bytes] };
}

export function icpAccountText(a: IcpAccount): string {
  const sub = a.subaccount[0];
  return sub ? `${a.owner.toText()}.${bytesToHex(sub as Uint8Array)}` : a.owner.toText();
}
