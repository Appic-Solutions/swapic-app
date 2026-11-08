// The addresses Solana derives, as the wire crate derives them: the app computes them itself and never takes them from the quoter.
import { sha256 } from '@noble/hashes/sha256';
import { decode58, encode58 } from './base58';
import { isOnCurve } from '@/lib/validation';

export const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
export const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
export const ATA_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
export const SYSTEM_PROGRAM = '11111111111111111111111111111111';
export const COMPUTE_BUDGET = 'ComputeBudget111111111111111111111111111111';
export const JUPITER = 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4';
export const JUPITER_Z = '61DFfeTKM7trxYcPQCM78bJ794ddZprZpAwAnLiwTpYH';
export const JUPITER_SPONSOR = 'gasTzr94Pmp4Gf8vknQnqxeYxdgwFjbgdJa4msYRpnB';
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const WSOL_MINT = 'So11111111111111111111111111111111111111112';
export const SHARDS = 4;
/** The first bytes of Circle's delivery hook (the wire crate's `FORWARD_MAGIC`). */
export const FORWARD_MAGIC = new TextEncoder().encode('cctp-forward');

const key = (text: string) => {
  const bytes = decode58(text);
  if (!bytes || bytes.length !== 32) throw new Error(`not a key: ${text}`);
  return bytes;
};
const MARK = new TextEncoder().encode('ProgramDerivedAddress');

export function findProgramAddress(seeds: Uint8Array[], program: string): string {
  const id = key(program);
  for (let bump = 255; bump >= 0; bump--) {
    const parts = [...seeds, Uint8Array.of(bump), id, MARK];
    const all = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const p of parts) { all.set(p, at); at += p.length; }
    const hash = sha256(all);
    if (!isOnCurve(hash)) return encode58(hash);
  }
  throw new Error('no program address');
}

export const ataOf = (owner: string, mint: string, tokenProgram = TOKEN_PROGRAM) =>
  findProgramAddress([key(owner), key(tokenProgram), key(mint)], ATA_PROGRAM);

const utf8 = (s: string) => new TextEncoder().encode(s);

/** Each shard's `auth` and `vault`: a swap arrival must name one pair of them. */
export function shardsOf(program: string): { auth: string; vault: string }[] {
  return Array.from({ length: SHARDS }, (_, i) => {
    const auth = findProgramAddress([utf8('auth'), Uint8Array.of(i)], program);
    return { auth, vault: ataOf(auth, USDC_MINT) };
  });
}
