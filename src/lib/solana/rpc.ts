// The app's own reads of Solana, from the public node in the chain table (it joins the CSP): lookup tables, kept for a
// minute because they only ever grow, and whether an address can receive. A read that fails answers null: the guard refuses.
import { chainRow } from '@/lib/chains';
import { fromBase64 } from './tx';
import { encode58 } from './base58';
import { SOLANA_CHAIN } from '@/lib/explorer';

export interface AccountInfo { owner: string; executable: boolean; data: Uint8Array }
export type AccountRead = (address: string) => Promise<AccountInfo | 'missing' | null>;

/** A read the screen waits on: past this it answers null, and the guard refuses or says it cannot check. */
const READ_MS = 8_000;
const nodeUrl = () => chainRow(SOLANA_CHAIN)?.rpcHosts[0] ?? null;

export const readAccount: AccountRead = async (address) => {
  const url = nodeUrl();
  if (!url) return null;
  try {
    const reply = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(READ_MS),
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getAccountInfo', params: [address, { encoding: 'base64', commitment: 'confirmed' }] }),
    });
    if (!reply.ok) return null;
    const body = (await reply.json()) as { result?: { value: { owner: string; executable: boolean; data: [string, string] } | null } };
    if (!body.result) return null;
    const value = body.result.value;
    return value ? { owner: value.owner, executable: value.executable, data: fromBase64(value.data[0]) } : 'missing';
  } catch {
    return null;
  }
};

/** Where a lookup table's addresses start: its 56 byte header. */
const TABLE_HEADER = 56;
/** A table only grows: a route naming an entry newer than a kept copy is refused for at most this long. */
const TABLE_KEPT_MS = 60_000;
const kept = new Map<string, { entries: readonly string[]; at: number }>();

export function tableEntries(data: Uint8Array): string[] | null {
  if (data.length < TABLE_HEADER || (data.length - TABLE_HEADER) % 32 !== 0) return null;
  const out: string[] = [];
  for (let at = TABLE_HEADER; at < data.length; at += 32) out.push(encode58(data.slice(at, at + 32)));
  return out;
}

export type TableRead = (table: string) => Promise<readonly string[] | null>;
export const readTable = (read: AccountRead = readAccount, now: () => number = Date.now): TableRead => async (table) => {
  const have = kept.get(table);
  if (have && now() - have.at < TABLE_KEPT_MS) return have.entries;
  const account = await read(table);
  if (!account || account === 'missing') return null;
  const entries = tableEntries(account.data);
  if (entries) kept.set(table, { entries, at: now() });
  return entries;
};
