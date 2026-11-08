'use client';
// The Scanner: moved from the design's scanner-screens.tsx ScannerPanel (the approved static look), wired to data: the
// 24 hour tiles and the live feed every 10 s while visible, 5 s while a row is in progress (new ids slide in), search by
// wallet (chips; their rows from ONE GET /v2/orders call for all chips, every 30 s, 10 s while a row is in progress,
// contract 5.13 and 1.6), by order id or transaction hash (GET
// /v2/scanner/search, one row opens its order page), and "Nothing found" without any call for a text that is none of the
// four forms. The URL keeps the chips (`?q=a,b`) so a search can be shared.
// Motion (approved 2026-10-29, part 2): tiles lift on hover, chips pop in and out, the heading and the results or "Nothing
// found" cross fade, rows glide and a new one slides into the top; a row opens its order in place (ScannerPage's frame).
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { PanelBox } from '@/components/motion/parts';
import { ScannerIcon } from '@/components/icons';
import { ApiError, getOrders, getScannerLatest, getScannerStats, searchScanner, userMessage, type ActivityRow } from '@/lib/api';
import { T, fade, tw } from '@/lib/motion';
import { cn } from '@/lib/cn';
import { QUIET } from '@/components/ui/styles';
import { listInterval, mergeRows, orderView } from '@/features/activity/rows';
import { useLogoFor } from '@/features/activity/logos';
import { LiveDot } from './LiveDot';
import { NotFound } from './NotFound';
import { Results } from './Results';
import { SearchBox, type Chip } from './SearchBox';
import { classify } from './search';
import { scannerTiles } from './stats';
import { Tiles } from './Tiles';

const MAX_CHIPS = 20;
const visible = () => typeof document === 'undefined' || document.visibilityState === 'visible';

/** Chips from the link's `q` (comma separated wallets); anything else in it is dropped. */
export function chipsOf(q: string | null): Chip[] {
  const out: Chip[] = [];
  for (const part of (q ?? '').split(',')) {
    const c = classify(part);
    if ((c.kind === 'evm' || c.kind === 'icp') && !out.some((x) => x.value === c.value) && out.length < MAX_CHIPS) out.push({ kind: c.kind, value: c.value });
  }
  return out;
}

// The Scanner panel's size and layout outside an in place frame.
const SCANNER_BOX = 'gap-y-6 md:max-h-[800px] md:w-full md:max-w-[1204px] md:overflow-y-hidden md:pb-5';

const quiet = () => {};

/** The Scanner before the page has started (its Suspense fallback, the first paint of the static page): the list, part for part. */
export function ScannerLoading() {
  return (
    <PanelBox className={SCANNER_BOX}>
      <div className="w-full"><Tiles tiles={null} /></div>
      <section className="flex w-full flex-col gap-y-3 md:gap-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-x-2 text-lg font-medium text-white md:text-xl">
            <ScannerIcon width={24} height={24} />
            <div className="flex items-center gap-x-2">Latest transactions <LiveDot /></div>
          </div>
          <SearchBox chips={[]} text="" onText={quiet} onSubmit={quiet} onRemove={quiet} />
        </div>
        <div className="w-full"><Results orders={[]} loading onOpen={quiet} /></div>
      </section>
    </PanelBox>
  );
}

/**
 * `onOpen` opens one order (a row, or the one an id or hash search found); `onLink` hears the chips the panel writes into
 * the link, so the page keeps this panel (and its chip motion) instead of starting it again.
 */
export function ScannerPanel({ initialQ, onOpen, onLink }: { initialQ: string | null; onOpen: (row: ActivityRow) => void; onLink: (q: string) => void }) {
  const router = useRouter();
  const logo = useLogoFor();
  const [chips, setChips] = React.useState<Chip[]>(() => chipsOf(initialQ));
  // a shared link may also carry one id, hash or text (`?q=<text>`): it is searched as if typed
  const linked = initialQ && !initialQ.includes(',') && chipsOf(initialQ).length === 0 ? initialQ.trim() : '';
  const [text, setText] = React.useState(linked);
  const [notFound, setNotFound] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const searching = chips.length > 0;

  const stats = useQuery({ queryKey: ['scanner-stats'], queryFn: getScannerStats, refetchInterval: () => (visible() ? 10_000 : false) });
  const feed = useInfiniteQuery({
    queryKey: ['scanner-latest'],
    queryFn: ({ pageParam }) => getScannerLatest(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.nextCursor ?? undefined,
    refetchInterval: (q) => (visible() ? listInterval((q.state.data?.pages ?? []).flatMap((p) => p.items), 5_000, 10_000) : false),
    enabled: !searching,
  });
  const feedRows = mergeRows((feed.data?.pages ?? []).map((p) => p.items));
  const wallets = useQuery({
    queryKey: ['scanner-wallets', chips.map((c) => c.value).join(',')],
    queryFn: () => getOrders(chips.map((c) => c.value)),
    enabled: searching,
    refetchInterval: (q) => (visible() ? listInterval(q.state.data?.orders ?? [], 10_000, 30_000) : false),
  });

  // ids not seen before slide in; the first answer marks everything seen
  const seen = React.useRef<Set<string> | null>(null);
  const [freshId, setFreshId] = React.useState<string | undefined>(undefined);
  React.useEffect(() => {
    if (!feed.data) return;
    const items = feedRows;
    if (seen.current === null) { seen.current = new Set(items.map((r) => r.id)); return; }
    const unseen = items.filter((r) => !seen.current!.has(r.id));
    unseen.forEach((r) => seen.current!.add(r.id));
    if (unseen.length) setFreshId(unseen.sort((a, b) => b.createdAt - a.createdAt)[0]!.id);
  }, [feed.data]);

  const setChipsAndLink = (next: Chip[]) => {
    setChips(next);
    setNotFound(null);
    const q = next.map((c) => c.value).join(',');
    onLink(q);
    router.replace(q ? `/scanner?q=${q}` : '/scanner');
  };
  const onSubmit = async () => {
    const c = classify(text);
    setError(null);
    if (c.kind === 'none') { setNotFound(c.value); return; }
    if (c.kind === 'evm' || c.kind === 'icp') {
      if (!chips.some((x) => x.value === c.value) && chips.length < MAX_CHIPS) setChipsAndLink([...chips, { kind: c.kind, value: c.value }]);
      setText('');
      return;
    }
    try {
      const a = await searchScanner(c.value);
      const row = a.items[0];
      if (a.match === 'none' || !row) { setNotFound(a.q || c.value); return; }
      onOpen(row);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'badRequest') setNotFound(c.value);
      else setError(userMessage(e));
    }
  };

  const ran = React.useRef(false);
  React.useEffect(() => {
    if (linked && !ran.current) { ran.current = true; void onSubmit(); }
  });

  const now = Math.floor(Date.now() / 1000);
  const raw = searching ? mergeRows([wallets.data?.orders ?? []]) : feedRows;
  const orders = raw.map((r) => orderView(r, now, logo));
  const loading = searching ? wallets.isLoading : feed.isLoading;
  return (
    <PanelBox className={SCANNER_BOX}>
      <motion.div variants={fade} className="w-full"><Tiles tiles={stats.data ? scannerTiles(stats.data) : null} /></motion.div>
      <motion.section variants={fade} className="flex w-full flex-col gap-y-3 md:gap-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-x-2 text-lg font-medium text-white md:text-xl">
            <ScannerIcon width={24} height={24} />
            <AnimatePresence initial={false} mode="wait">
              <motion.div key={searching ? 'search' : 'live'} className="flex items-center gap-x-2" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: T.enter }} exit={{ opacity: 0, transition: T.exit }}>
                {searching ? (
                  <>
                    Orders for {chips.length === 1 ? '1 wallet' : `${chips.length} wallets`}
                    <span className="text-sm text-secondary">{orders.length} found</span>
                    <a onClick={() => setChipsAndLink([])} className="cursor-pointer text-sm text-secondary underline-offset-2 transition-colors hover:text-white hover:underline">Clear</a>
                  </>
                ) : (
                  <>Latest transactions <LiveDot /></>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
          <SearchBox chips={chips} text={text} onText={(t) => { setText(t); setNotFound(null); setError(null); }} onSubmit={() => void onSubmit()} onRemove={(c) => setChipsAndLink(chips.filter((x) => x.value !== c.value))} />
        </div>
        {error && <p className="text-xs text-warn">{error}</p>}
        {/* Results and "Nothing found" cross fade (out 180 ms, then in 250 ms). */}
        <AnimatePresence initial={false} mode="wait">
          <motion.div key={notFound !== null ? 'none' : 'results'} className="w-full" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: T.enter }} exit={{ opacity: 0, transition: T.exit }}>
            {notFound !== null ? (
              <NotFound query={notFound} />
            ) : (
              <Results orders={orders} loading={loading} freshId={freshId} onOpen={(o) => { const r = raw.find((x) => x.id === o.id); if (r) onOpen(r); }} />
            )}
          </motion.div>
        </AnimatePresence>
        {notFound === null && !searching && feed.hasNextPage && (
          <button onClick={() => void feed.fetchNextPage()} disabled={feed.isFetchingNextPage} className={cn(QUIET, 'mx-auto h-10 shrink-0 px-4 text-sm')}>
            Show older
          </button>
        )}
      </motion.section>
    </PanelBox>
  );
}
