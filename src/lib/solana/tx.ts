// A Solana transaction as the wire holds it, read by the guard. Every byte is read and a short or odd one is refused.
import { encode58 } from './base58';

export interface CompiledIx { program: string; accounts: number[]; data: Uint8Array }
export interface Lookup { table: string; writable: number[]; readonly: number[] }
export interface V0Message {
  requiredSignatures: number;
  readonlySigned: number;
  readonlyUnsigned: number;
  keys: string[];
  blockhash: string;
  instructions: CompiledIx[];
  lookups: Lookup[];
}

const VERSION_0 = 0x80;

export const fromBase64 = (text: string): Uint8Array => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
export const toBase64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));

class Reader {
  at = 0;
  constructor(readonly bytes: Uint8Array) {}
  byte(): number {
    const b = this.bytes[this.at];
    if (b === undefined) throw new Error('short');
    this.at++;
    return b;
  }
  take(n: number): Uint8Array {
    if (this.at + n > this.bytes.length) throw new Error('short');
    const out = this.bytes.slice(this.at, this.at + n);
    this.at += n;
    return out;
  }
  /** Solana's compact-u16. */
  compact(): number {
    let value = 0;
    for (let i = 0; i < 3; i++) {
      const b = this.byte();
      value |= (b & 0x7f) << (7 * i);
      if (!(b & 0x80)) return value;
    }
    throw new Error('compact');
  }
}

/** A v0 message, or null when it is anything else. */
export function decodeV0(bytes: Uint8Array): V0Message | null {
  try {
    const r = new Reader(bytes);
    if (r.byte() !== VERSION_0) return null;
    const requiredSignatures = r.byte();
    const readonlySigned = r.byte();
    const readonlyUnsigned = r.byte();
    const keys = Array.from({ length: r.compact() }, () => encode58(r.take(32)));
    if (keys.length === 0 || requiredSignatures === 0 || requiredSignatures > keys.length) return null;
    const blockhash = encode58(r.take(32));
    const raw = Array.from({ length: r.compact() }, () => {
      const programIndex = r.byte();
      const accounts = [...r.take(r.compact())];
      return { programIndex, accounts, data: r.take(r.compact()) };
    });
    const lookups = Array.from({ length: r.compact() }, () => ({
      table: encode58(r.take(32)),
      writable: [...r.take(r.compact())],
      readonly: [...r.take(r.compact())],
    }));
    if (r.at !== bytes.length) return null;
    // a program is always a static key: the chain refuses one from a lookup table
    const instructions = raw.map((ix) => {
      const program = keys[ix.programIndex];
      if (program === undefined) throw new Error('program');
      return { program, accounts: ix.accounts, data: ix.data };
    });
    return { requiredSignatures, readonlySigned, readonlyUnsigned, keys, blockhash, instructions, lookups };
  } catch {
    return null;
  }
}

/** A signed transaction: its signature slots and its message bytes, or null. */
export function decodeWire(wire: Uint8Array): { signatures: Uint8Array[]; message: Uint8Array } | null {
  try {
    const r = new Reader(wire);
    const signatures = Array.from({ length: r.compact() }, () => r.take(64));
    return { signatures, message: wire.slice(r.at) };
  } catch {
    return null;
  }
}

function compact(value: number): number[] {
  const out: number[] = [];
  let left = value;
  for (;;) {
    const b = left & 0x7f;
    left >>= 7;
    if (left === 0) { out.push(b); return out; }
    out.push(b | 0x80);
  }
}

/** A message with its empty signature slots, as a wallet takes it to sign. */
export function unsignedWire(message: Uint8Array, signatures: number): Uint8Array {
  const head = compact(signatures);
  const out = new Uint8Array(head.length + signatures * 64 + message.length);
  out.set(head, 0);
  out.set(message, head.length + signatures * 64);
  return out;
}

/** Every account index of a message resolved to its address: static keys, then writable and readonly loaded ones. */
export function resolveAccounts(m: V0Message, tables: ReadonlyMap<string, readonly string[]>): string[] | null {
  const writable: string[] = [];
  const readonly: string[] = [];
  for (const l of m.lookups) {
    const entries = tables.get(l.table);
    if (!entries) return null;
    for (const i of l.writable) { const a = entries[i]; if (a === undefined) return null; writable.push(a); }
    for (const i of l.readonly) { const a = entries[i]; if (a === undefined) return null; readonly.push(a); }
  }
  return [...m.keys, ...writable, ...readonly];
}
