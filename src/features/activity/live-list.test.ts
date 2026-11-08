import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ActivityRow } from '@/lib/api';
import { mergeHead, replaceRow, type Pages } from './live-list';

const base: ActivityRow = JSON.parse(readFileSync('tests/fixtures/contract/scanner-latest.json', 'utf8')).items[0];
const row = (n: number, o: Partial<ActivityRow> = {}): ActivityRow => ({ ...base, id: `0x${n.toString(16).padStart(64, '0')}`, createdAt: 1_000_000 - n, ...o });
const ids = (p: Pages) => p.pages.map((x) => x.rows.map((r) => Number.parseInt(r.id.slice(2), 16)));

describe('mergeHead', () => {
  const loaded: Pages = { pages: [{ rows: [row(1), row(2), row(3)], nextCursor: 'c3' }, { rows: [row(4), row(5), row(6)], nextCursor: 'c6' }], pageParams: [undefined, 'c3'] };

  it('takes the first answer as page one', () => {
    expect(mergeHead(undefined, { rows: [row(1)], nextCursor: 'c1' })).toEqual({ pages: [{ rows: [row(1)], nextCursor: 'c1' }], pageParams: [undefined] });
  });

  it('merges new rows into page one, keeps the rows it pushed out, its cursor and the older pages', () => {
    const m = mergeHead(loaded, { rows: [row(0), row(1), row(2)], nextCursor: 'c2' });
    expect(ids(m)).toEqual([[0, 1, 2, 3], [4, 5, 6]]);
    expect(m.pages[0]!.nextCursor).toBe('c3');
    expect(m.pageParams).toEqual([undefined, 'c3']);
  });

  it('a fresh row wins over the one loaded before', () => {
    const m = mergeHead(loaded, { rows: [row(1, { outcome: 'delivered' }), row(2), row(3)], nextCursor: 'c3' });
    expect(m.pages[0]!.rows[0]!.outcome).toBe('delivered');
  });

  it('starts over from the fresh page when it shares no row with the loaded ones (a gap of unknown rows)', () => {
    const fresh = [101, 102, 103].map((n) => row(n, { createdAt: 2_000_000 - n }));
    const m = mergeHead(loaded, { rows: fresh, nextCursor: 'c103' });
    expect(ids(m)).toEqual([[101, 102, 103]]);
    expect(m.pageParams).toEqual([undefined]);
  });

  it('a fresh page that holds the whole list always joins', () => {
    expect(ids(mergeHead(loaded, { rows: [row(100, { createdAt: 2_000_000 })], nextCursor: null }))).toEqual([[100, 1, 2, 3], [4, 5, 6]]);
  });

  it('never turns an ended row back to pending (a list a moment behind)', () => {
    const ended: Pages = { pages: [{ rows: [row(1, { outcome: 'delivered' }), row(2)], nextCursor: 'c2' }], pageParams: [undefined] };
    const m = mergeHead(ended, { rows: [row(1), row(2)], nextCursor: 'c2' });
    expect(m.pages[0]!.rows.map((r) => r.outcome)).toEqual(['delivered', 'pending']);
  });
});

describe('replaceRow', () => {
  const loaded: Pages = { pages: [{ rows: [row(1), row(2)], nextCursor: 'c2' }, { rows: [row(3)], nextCursor: null }], pageParams: [undefined, 'c2'] };

  it('puts the row in its place, in whichever page holds it', () => {
    const m = replaceRow(loaded, row(3, { outcome: 'refunded' }));
    expect(m.pages[1]!.rows[0]!.outcome).toBe('refunded');
    expect(m.pages[0]!.rows.map((x) => x.outcome)).toEqual(['pending', 'pending']);
  });

  it('leaves the pages as they are for a row not loaded, and never turns an ended row back', () => {
    expect(replaceRow(loaded, row(9))).toBe(loaded);
    const ended = replaceRow(loaded, row(2, { outcome: 'delivered' }));
    expect(replaceRow(ended, row(2)).pages[0]!.rows[1]!.outcome).toBe('delivered');
  });
});
