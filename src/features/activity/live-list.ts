'use client';
// A list that pages by cursor and stays fresh without spending its rate limit: History, the Scanner feed and the Scanner's
// wallet search. useInfiniteQuery on its own refetches EVERY loaded page on each interval (4 pages at 10 s would be 24 calls
// a minute, over the 20 a minute wallet lookup bucket, contract 1.6). Here the pages live in one infinite query that never
// refetches itself (staleTime Infinity), and a timer asks for the newest page only and merges it into page one (mergeHead).
// An older page is asked once, when the list is scrolled near its end (useNearEnd); one that fails (a 429) stops quietly,
// the rows shown stay, and the next scroll near the end tries again after a pause. An order that just ended (its own status
// or its steps say so, end-watch.ts) asks for the newest page at once (`ended`). A row's end is final: no answer that still
// says pending (a list a moment behind) ever turns an ended row back.
import * as React from 'react';
import { useInfiniteQuery, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query';
import { ApiError, type ActivityRow } from '@/lib/api';
import { listInterval, mergeRows } from './rows';

export interface RowsPage { rows: ActivityRow[]; nextCursor: string | null }
export type Pages = InfiniteData<RowsPage, string | undefined>;

/** After a page that failed, the next scroll near the end asks again only once this has passed. */
export const RETRY_PAUSE_MS = 15_000;
/** An older page loads once the end of the list is this close (px). */
export const NEAR_END_PX = 300;

const visible = () => typeof document === 'undefined' || document.visibilityState === 'visible';
const LIMITED = new Set(['rateLimited', 'rate_limited', 'edgeLimited']);
/** A rate limit answer is never asked again at once: that only spends more of the same limit. */
const limited = (e: unknown) => e instanceof ApiError && LIMITED.has(e.code);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const idOf = (r: ActivityRow) => r.id.toLowerCase();
/** The newer word on one row: an end is final, so a pending answer never replaces an ended row. */
const later = (fresh: ActivityRow, known: ActivityRow | undefined) => (known && known.outcome !== 'pending' && fresh.outcome === 'pending' ? known : fresh);

/** A row read elsewhere laid over the one loaded: its status, outcome, amounts, times and reason win, and a field it lacks
 *  (a Scanner search row has no `direction`, which only a wallet's own list knows) stays as the list had it. */
export function mergeRow(known: ActivityRow, fresh: ActivityRow): ActivityRow {
  const out: Record<string, unknown> = { ...known };
  for (const [k, v] of Object.entries(fresh)) if (v !== undefined) out[k] = v;
  return out as unknown as ActivityRow;
}

/** The pages with `row` laid over its place (where it is loaded, mergeRow), unless that would turn an ended row back. */
export function replaceRow(old: Pages, row: ActivityRow): Pages {
  const id = idOf(row);
  let hit = false;
  const pages = old.pages.map((p) => ({ ...p, rows: p.rows.map((r) => (idOf(r) === id ? ((hit = true), later(mergeRow(r, row), r)) : r)) }));
  return hit ? { ...old, pages } : old;
}

const LISTS = new Set(['history', 'scanner-latest', 'scanner-wallets']);
/** Writes a row just read elsewhere (the Scanner's order page) into every list that holds it, so Back shows it as it is. */
export function putRow(qc: QueryClient, row: ActivityRow) {
  qc.setQueriesData<Pages>({ predicate: (q) => LISTS.has(String(q.queryKey[0])) }, (old) => (old?.pages ? replaceRow(old, row) : old));
}

/**
 * The newest page merged into the pages already loaded: page one takes its rows (fresh versions win, rows it pushed out
 * stay) and keeps its own cursor, so the older pages still follow it. A fresh page that shares no row with the loaded ones
 * (more new rows than a page holds) leaves a gap of unknown rows: the list starts over from that page.
 */
export function mergeHead(old: Pages | undefined, head: RowsPage): Pages {
  if (!old?.pages.length) return { pages: [head], pageParams: [undefined] };
  const known = new Map(old.pages.flatMap((p) => p.rows.map((r) => [idOf(r), r] as const)));
  const joined = head.nextCursor === null || head.rows.some((r) => known.has(idOf(r)));
  if (!joined) return { pages: [head], pageParams: [undefined] };
  const [first, ...rest] = old.pages as [RowsPage, ...RowsPage[]];
  const fresh = head.rows.map((r) => later(r, known.get(idOf(r))));
  return { pages: [{ rows: mergeRows([fresh, first.rows]), nextCursor: first.nextCursor }, ...rest], pageParams: old.pageParams };
}

export interface LiveList {
  rows: ActivityRow[];
  /** The first page is on its way. */
  loading: boolean;
  /** The first page failed and nothing is shown (a failed refresh or older page keeps the rows). */
  failed: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  /** Asks for the next older page, unless a page is on its way, none is left, or the last one failed within RETRY_PAUSE_MS. */
  more: () => void;
  refetch: () => void;
  /**
   * An order ended (its status or its steps said so): the newest page is asked at once, and if it does not show that end
   * yet (or fails), `patch` writes what the status or the steps know into the row until the list catches up.
   */
  ended: (id: string, patch: (row: ActivityRow) => ActivityRow) => Promise<void>;
}

/** `live` and `idle`: the refresh period while a row is in progress, and otherwise (listInterval). */
export function useLiveList({ queryKey, fetchPage, enabled, live, idle }: {
  queryKey: readonly unknown[]; fetchPage: (cursor?: string) => Promise<RowsPage>; enabled: boolean; live: number; idle: number;
}): LiveList {
  const qc = useQueryClient();
  const q = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.nextCursor ?? undefined,
    enabled,
    // never refetched whole: only the newest page is asked again, below
    staleTime: Infinity,
    retry: (n, e) => n < 1 && !limited(e),
  });
  const rows = React.useMemo(() => mergeRows((q.data?.pages ?? []).map((p) => p.rows)), [q.data]);
  const now = React.useRef({ fetchPage, rows, live, idle, queryKey });
  now.current = { fetchPage, rows, live, idle, queryKey };
  const has = !!q.data;
  const keyText = JSON.stringify(queryKey);

  // the newest page, merged into page one; one call at a time (the timer and an order that ended share it). An older page on
  // its way writes the pages it started from: the merge waits for it, or the merge is lost.
  const pulling = React.useRef<{ key: string; run: Promise<boolean> } | null>(null);
  const pull = React.useCallback((): Promise<boolean> => {
    const key = now.current.queryKey;
    const text = JSON.stringify(key);
    if (pulling.current?.key === text) return pulling.current.run;
    const settle = async () => { while (qc.getQueryState(key)?.fetchStatus === 'fetching') await wait(200); };
    const run = (async () => {
      await settle();
      try {
        const head = await now.current.fetchPage();
        await settle();
        qc.setQueryData<Pages>(key, (old) => mergeHead(old, head));
        return true;
      } catch {
        // the rows shown stay; the next period asks again
        return false;
      }
    })().finally(() => { if (pulling.current?.run === run) pulling.current = null; });
    pulling.current = { key: text, run };
    return run;
  }, [qc]);

  // the refresh: the newest page every period while the tab shows (live while a row is in progress, else idle)
  React.useEffect(() => {
    if (!enabled || !has) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const key = now.current.queryKey;
    const period = () => listInterval(now.current.rows, now.current.live, now.current.idle);
    const tick = async () => {
      if (visible()) await pull();
      if (!stop) timer = setTimeout(() => void tick(), period());
    };
    // back on a list kept in the cache: asked at once if its rows are older than a period
    const age = Date.now() - (qc.getQueryState(key)?.dataUpdatedAt ?? 0);
    timer = setTimeout(() => void tick(), Math.max(period() - age, 0));
    return () => { stop = true; clearTimeout(timer); };
  }, [enabled, has, keyText, qc, pull]);

  const ended = React.useCallback(async (id: string, patch: (row: ActivityRow) => ActivityRow) => {
    const key = now.current.queryKey;
    await pull();
    const row = qc.getQueryData<Pages>(key)?.pages.flatMap((p) => p.rows).find((r) => idOf(r) === id.toLowerCase());
    if (row && row.outcome === 'pending') qc.setQueryData<Pages>(key, (old) => (old ? replaceRow(old, patch(row)) : old));
  }, [pull, qc]);

  const pausedUntil = React.useRef(0);
  const more = () => {
    if (!q.hasNextPage || q.isFetching || Date.now() < pausedUntil.current) return;
    void q.fetchNextPage({ cancelRefetch: false }).then((r) => { if (r.isError) pausedUntil.current = Date.now() + RETRY_PAUSE_MS; });
  };
  return {
    rows, loading: q.isLoading, failed: q.isError && !q.data, hasMore: !!q.hasNextPage, loadingMore: q.isFetchingNextPage, more,
    refetch: () => void q.refetch(), ended,
  };
}

/**
 * Calls `onNear` when the list is scrolled to within NEAR_END_PX of its end: its own scroll where it scrolls inside its
 * panel (desktop), the page's where it does not (phones). Passive scroll listeners only, never an IntersectionObserver: one
 * anywhere on the page keeps the background coins' animations on the main thread (measured 94 ms a frame against 3 ms).
 */
export function useNearEnd(box: HTMLElement | null, onNear: () => void) {
  const call = React.useRef(onNear);
  call.current = onNear;
  React.useEffect(() => {
    if (!box) return;
    const check = () => {
      // hidden at this size (the table on phones, the cards on desktop)
      if (box.clientHeight === 0) return;
      const inside = box.scrollHeight > box.clientHeight + 1 && getComputedStyle(box).overflowY !== 'visible';
      const left = inside ? box.scrollHeight - box.scrollTop - box.clientHeight : box.getBoundingClientRect().bottom - window.innerHeight;
      if (left < NEAR_END_PX) call.current();
    };
    box.addEventListener('scroll', check, { passive: true });
    window.addEventListener('scroll', check, { passive: true });
    return () => { box.removeEventListener('scroll', check); window.removeEventListener('scroll', check); };
  }, [box]);
}
