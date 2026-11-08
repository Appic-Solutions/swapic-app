'use client';
// The Scanner: moved from the design's scanner-screens.tsx ScannerPanel (the approved static look), wired to data: the
// 24 hour tiles and the live feed every 10 s while visible, 5 s while a row is in progress (new ids slide in), search by
// wallet (chips; their rows from ONE GET /v2/orders call for all chips, every 30 s, 10 s while a row is in progress,
// contract 5.13 and 1.6), by order id or transaction hash (GET
// /v2/scanner/search, one row opens its order page), and "Nothing found" without any call for a text that is none of the
// four forms. The URL keeps the chips (`?q=a,b`) so a search can be shared. Both lists refresh their newest page only and
// load an older page by themselves as they are scrolled near the end (useLiveList); on desktop the panel fits the window
// and the list is the one scroll.
// Motion (approved 2026-10-29, part 2): tiles lift on hover, chips pop in and out, the heading and the results or "Nothing
// found" cross fade, rows glide and a new one slides into the top; a row opens its order in place (ScannerPage's frame).
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { PanelBox } from '@/components/motion/parts';
import { useScrollFade } from '@/components/ui/use-scroll-fade';
import { ScannerIcon } from '@/components/icons';
import { ApiError, getOrders, getScannerLatest, getScannerStats, searchScanner, userMessage, type ActivityRow } from '@/lib/api';
import { T, fade } from '@/lib/motion';
import { cn } from '@/lib/cn';
import { orderView } from '@/features/activity/rows';
import { FIT_SCANNER } from '@/features/activity/fit';
import { useLiveList } from '@/features/activity/live-list';
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

// The Scanner panel's size and layout outside an in place frame: it fits the window (FIT_SCANNER), tighter on short windows.
export const SCANNER_SPACING = 'gap-y-6 md:pb-5 md:short:gap-y-4 md:short:p-6 md:short:pb-4 md:tiny:gap-y-3 md:tiny:p-5 md:tiny:pb-3';
const SCANNER_BOX = cn(SCANNER_SPACING, 'md:w-full md:max-w-[1204px] md:overflow-y-hidden', FIT_SCANNER);
// The section under the tiles: on desktop it takes the rest of the panel and its list scrolls inside it.
const SECTION = 'flex w-full flex-col gap-y-3 md:min-h-0 md:gap-y-4 md:short:gap-y-3 md:tiny:gap-y-2';

const quiet = () => {};

/** The Scanner before the page has started (its Suspense fallback, the first paint of the static page): the list, part for part. */
export function ScannerLoading() {
  return (
    <PanelBox className={SCANNER_BOX}>
      <div className="w-full tiny:hidden"><Tiles tiles={null} /></div>
      <section className={SECTION}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-x-2 text-lg font-medium text-white md:text-xl">
            <ScannerIcon width={24} height={24} />
            <div className="flex items-center gap-x-2">Latest transactions <LiveDot /></div>
          </div>
          <SearchBox chips={[]} text="" onText={quiet} onSubmit={quiet} onRemove={quiet} />
        </div>
        <div className="flex w-full flex-col md:min-h-0"><Results orders={[]} loading onOpen={quiet} /></div>
      </section>
    </PanelBox>
  );
}

/** "Nothing found" on a short window: it scrolls inside the panel, its edge fading, like the list it stands in for. */
function Scrolls({ children }: { children: React.ReactNode }) {
  const edge = useScrollFade<HTMLDivElement>();
  return <div ref={edge.ref} className={cn('no-scrollbar flex w-full flex-col md:min-h-0 md:overflow-y-auto', edge.fade)}>{children}</div>;
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
  // the feed (240 a minute bucket) and the wallets' rows (20 a minute, shared with History): the newest page every period,
  // older pages once, as the list nears its end
  const feed = useLiveList({
    queryKey: ['scanner-latest'],
    fetchPage: async (cursor) => { const p = await getScannerLatest(cursor); return { rows: p.items, nextCursor: p.nextCursor }; },
    enabled: !searching,
    live: 5_000,
    idle: 10_000,
  });
  const walletList = chips.map((c) => c.value);
  const wallets = useLiveList({
    queryKey: ['scanner-wallets', walletList.join(',')],
    fetchPage: async (cursor) => { const p = await getOrders(walletList, cursor); return { rows: p.orders, nextCursor: p.nextCursor }; },
    enabled: searching,
    live: 10_000,
    idle: 30_000,
  });
  const feedRows = feed.rows;

  // ids not seen before slide in; the first answer marks everything seen (older pages are not new: they never slide)
  const seen = React.useRef<Set<string> | null>(null);
  const newest = React.useRef(0);
  const [freshId, setFreshId] = React.useState<string | undefined>(undefined);
  React.useEffect(() => {
    if (!feedRows.length) return;
    if (seen.current === null) { seen.current = new Set(feedRows.map((r) => r.id)); newest.current = feedRows[0]!.createdAt; return; }
    const unseen = feedRows.filter((r) => !seen.current!.has(r.id));
    unseen.forEach((r) => seen.current!.add(r.id));
    const top = unseen.filter((r) => r.createdAt >= newest.current).sort((a, b) => b.createdAt - a.createdAt)[0];
    if (top) { newest.current = top.createdAt; setFreshId(top.id); }
  }, [feedRows]);

  const setChipsAndLink = (next: Chip[]) => {
    setChips(next);
    setNotFound(null);
    const q = next.map((c) => c.value).join(',');
    onLink(q);
    router.replace(q ? `/scanner?q=${q}` : '/scanner');
  };
  const onSubmit = async (typed: string = text) => {
    const c = classify(typed);
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
  const list = searching ? wallets : feed;
  const raw = list.rows;
  const orders = raw.map((r) => orderView(r, now, logo));
  return (
    <PanelBox className={SCANNER_BOX}>
      <motion.div variants={fade} className="w-full tiny:hidden"><Tiles tiles={stats.data ? scannerTiles(stats.data) : null} /></motion.div>
      <motion.section variants={fade} className={SECTION}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-x-2 text-lg font-medium text-white md:text-xl">
            <ScannerIcon width={24} height={24} />
            <AnimatePresence initial={false} mode="wait">
              <motion.div key={searching ? 'search' : 'live'} className="flex items-center gap-x-2" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: T.enter }} exit={{ opacity: 0, transition: T.exit }}>
                {searching ? (
                  <>
                    Orders for {chips.length === 1 ? '1 wallet' : `${chips.length} wallets`}
                    <span className="text-sm text-secondary">{orders.length}{wallets.hasMore ? '+' : ''} found</span>
                    <a onClick={() => setChipsAndLink([])} className="cursor-pointer text-sm text-secondary underline-offset-2 transition-colors hover:text-white hover:underline">Clear</a>
                  </>
                ) : (
                  <>Latest transactions <LiveDot /></>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
          <SearchBox chips={chips} text={text} onText={(t) => { setText(t); setNotFound(null); setError(null); }} onSubmit={(t) => void onSubmit(t)} onRemove={(c) => setChipsAndLink(chips.filter((x) => x.value !== c.value))} />
        </div>
        {error && <p className="text-xs text-warn">{error}</p>}
        {/* Results and "Nothing found" cross fade (out 180 ms, then in 250 ms). */}
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={notFound !== null ? 'none' : 'results'}
            className="flex w-full flex-col md:min-h-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: T.enter }}
            exit={{ opacity: 0, transition: T.exit }}
          >
            {notFound !== null ? (
              <Scrolls><NotFound query={notFound} /></Scrolls>
            ) : (
              <Results
                orders={orders}
                loading={list.loading}
                loadingMore={list.loadingMore}
                onNearEnd={list.more}
                freshId={freshId}
                onOpen={(o) => { const r = raw.find((x) => x.id === o.id); if (r) onOpen(r); }}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </motion.section>
    </PanelBox>
  );
}
