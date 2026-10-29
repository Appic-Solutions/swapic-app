'use client';
// The Scanner: moved from the design's scanner-screens.tsx ScannerPanel (the approved static look), wired to data: the
// 24 hour tiles and the live feed every 10 s while visible (new ids slide in), search by wallet (chips; their rows from ONE
// GET /v2/orders call for all chips, every 30 s, contract 5.13 and 1.6), by order id or transaction hash (GET
// /v2/scanner/search, one row opens its order page), and "Nothing found" without any call for a text that is none of the
// four forms. The URL keeps the chips (`?q=a,b`) so a search can be shared.
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import Box from '@/components/ui/box';
import { ManageSearchIcon } from '@/components/icons';
import { ApiError, getOrders, getScannerLatest, getScannerStats, searchScanner, userMessage } from '@/lib/api';
import { mergeRows, orderView } from '@/features/activity/rows';
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

export function ScannerPanel({ initialQ }: { initialQ: string | null }) {
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
    refetchInterval: () => (visible() ? 10_000 : false),
    enabled: !searching,
  });
  const feedRows = mergeRows((feed.data?.pages ?? []).map((p) => p.items));
  const wallets = useQuery({
    queryKey: ['scanner-wallets', chips.map((c) => c.value).join(',')],
    queryFn: () => getOrders(chips.map((c) => c.value)),
    enabled: searching,
    refetchInterval: () => (visible() ? 30_000 : false),
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
    router.replace(next.length ? `/scanner?q=${next.map((c) => c.value).join(',')}` : '/scanner');
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
      router.push(`/scanner?order=${encodeURIComponent(row.id)}`);
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
    <Box className="gap-y-6 md:max-h-[800px] md:w-full md:max-w-[1204px] md:overflow-y-hidden md:pb-5">
      <Tiles tiles={stats.data ? scannerTiles(stats.data) : null} />
      <section className="flex w-full flex-col gap-y-3 md:gap-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-x-2 text-lg font-medium text-white md:text-xl">
            <ManageSearchIcon width={24} height={24} />
            {searching ? (
              <>
                Orders for {chips.length === 1 ? '1 wallet' : `${chips.length} wallets`}
                <span className="text-sm text-[#898989]">{orders.length} found</span>
                <a onClick={() => setChipsAndLink([])} className="cursor-pointer text-sm text-[#898989] underline-offset-2 transition-colors hover:text-white hover:underline">Clear</a>
              </>
            ) : (
              <>Latest transactions <LiveDot /></>
            )}
          </div>
          <SearchBox chips={chips} text={text} onText={(t) => { setText(t); setNotFound(null); setError(null); }} onSubmit={() => void onSubmit()} onRemove={(c) => setChipsAndLink(chips.filter((x) => x.value !== c.value))} />
        </div>
        {error && <p className="text-xs text-yellow-600">{error}</p>}
        {notFound !== null ? <NotFound query={notFound} /> : <Results orders={orders} loading={loading} onOpen={(o) => router.push(`/scanner?order=${encodeURIComponent(o.id)}`)} freshId={freshId} />}
        {notFound === null && !searching && feed.hasNextPage && (
          <button onClick={() => void feed.fetchNextPage()} disabled={feed.isFetchingNextPage} className="mx-auto mb-1 flex items-center gap-x-1.5 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white/80 transition-colors hover:bg-white/20 active:scale-95">
            Show older
          </button>
        )}
      </section>
    </Box>
  );
}
