// The app's own Solana reads: a kept table comes back fresh within the minute, and a read the screen waits on is bounded.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readAccount, readTable, tableEntries, type AccountInfo } from './rpc';

const tableAccount = (entries: number): AccountInfo => ({ owner: 'x', executable: false, data: new Uint8Array(56 + 32 * entries) });

describe('readTable', () => {
  it('keeps a table for a minute, then reads it again: a table can grow', async () => {
    let now = 1_000;
    let entries = 2;
    const read = vi.fn(async () => tableAccount(entries));
    const tables = readTable(read, () => now);
    expect(await tables('grows')).toHaveLength(2);
    entries = 3;
    now += 59_000;
    expect(await tables('grows')).toHaveLength(2);
    expect(read).toHaveBeenCalledTimes(1);
    now += 1_000;
    expect(await tables('grows')).toHaveLength(3);
    expect(read).toHaveBeenCalledTimes(2);
  });
  it('answers null for a table that is not there, and keeps nothing', async () => {
    const read = vi.fn(async () => 'missing' as const);
    expect(await readTable(read)('gone')).toBeNull();
    expect(await readTable(read)('gone')).toBeNull();
    expect(read).toHaveBeenCalledTimes(2);
  });
  it('refuses data that is not a table', () => {
    expect(tableEntries(new Uint8Array(57))).toBeNull();
  });
});

describe('readAccount', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('gives up on a node that stalls: the screen never waits for ever', async () => {
    const seen: (AbortSignal | null | undefined)[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_: string, init: RequestInit) => {
      seen.push(init.signal);
      throw new DOMException('timed out', 'TimeoutError');
    }));
    expect(await readAccount('anything')).toBeNull();
    expect(seen[0]).toBeInstanceOf(AbortSignal);
  });
});
