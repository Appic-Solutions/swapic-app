'use client';
// A list that pages by cursor and stays fresh without spending its rate limit: History, the Scanner feed and the Scanner's
// wallet search. useInfiniteQuery on its own refetches EVERY loaded page on each interval (4 pages at 10 s would be 24 calls
// a minute, over the 20 a minute wallet lookup bucket, contract 1.6). Here the pages live in one infinite query that never
// refetches itself (staleTime Infinity), and a timer asks for the newest page only and merges it into page one (mergeHead).
// An older page is asked once, when the list is scrolled near its end (useNearEnd); one that fails (a 429) stops quietly,
// the rows shown stay, and the next scroll near the end tries again after a pause.
import * as React from 'react';
import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
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

/**
 * The newest page merged into the pages already loaded: page one takes its rows (fresh versions win, rows it pushed out
 * stay) and keeps its own cursor, so the older pages still follow it. A fresh page that shares no row with the loaded ones
 * (more new rows than a page holds) leaves a gap of unknown rows: the list starts over from that page.
 */
export function mergeHead(old: Pages | undefined, head: RowsPage): Pages {
  if (!old?.pages.length) return { pages: [head], pageParams: [undefined] };
  const known = new Set(old.pages.flatMap((p) => p.rows.map((r) => r.id.toLowerCase())));
  const joined = head.nextCursor === null || head.rows.some((r) => known.has(r.id.toLowerCase()));
  if (!joined) return { pages: [head], pageParams: [undefined] };
  const [first, ...rest] = old.pages as [RowsPage, ...RowsPage[]];
  return { pages: [{ rows: mergeRows([head.rows, first.rows]), nextCursor: first.nextCursor }, ...rest], pageParams: old.pageParams };
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

  // the refresh: the newest page every period while the tab shows (live while a row is in progress, else idle)
  React.useEffect(() => {
    if (!enabled || !has) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const key = now.current.queryKey;
    const period = () => listInterval(now.current.rows, now.current.live, now.current.idle);
    // an older page on its way writes the pages it started from: merge after it, or this merge is lost
    const settle = async () => { while (!stop && qc.getQueryState(key)?.fetchStatus === 'fetching') await wait(200); };
    const tick = async () => {
      if (visible()) {
        await settle();
        try {
          const head = await now.current.fetchPage();
          await settle();
          if (!stop) qc.setQueryData<Pages>(key, (old) => mergeHead(old, head));
        } catch {
          // the rows shown stay; the next period asks again
        }
      }
      if (!stop) timer = setTimeout(() => void tick(), period());
    };
    // back on a list kept in the cache: asked at once if its rows are older than a period
    const age = Date.now() - (qc.getQueryState(key)?.dataUpdatedAt ?? 0);
    timer = setTimeout(() => void tick(), Math.max(period() - age, 0));
    return () => { stop = true; clearTimeout(timer); };
  }, [enabled, has, keyText, qc]);

  const pausedUntil = React.useRef(0);
  const more = () => {
    if (!q.hasNextPage || q.isFetching || Date.now() < pausedUntil.current) return;
    void q.fetchNextPage({ cancelRefetch: false }).then((r) => { if (r.isError) pausedUntil.current = Date.now() + RETRY_PAUSE_MS; });
  };
  return {
    rows, loading: q.isLoading, failed: q.isError && !q.data, hasMore: !!q.hasNextPage, loadingMore: q.isFetchingNextPage, more,
    refetch: () => void q.refetch(),
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
