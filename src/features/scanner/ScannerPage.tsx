'use client';
// The Scanner tab's body: `/scanner` (the feed and search), `/scanner?q=a,b` (wallet chips), `/scanner?order=<id>` (one
// order). It reads the link with useSearchParams, inside the page's Suspense (a static export needs one).
// Motion (approved 2026-10-29, part 2): one panel that changes in place (MorphFrame) between the list and an order, with the
// calm fade; Back reverses. The link still changes, so an order can be shared and the browser's back works; the page stays
// mounted, so the panel eases to its size, it is not a new page.
import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import BoxHeader from '@/components/ui/box-header';
import { MorphFrame, PanelBox } from '@/components/motion/parts';
import { searchScanner, type ActivityRow, type SearchAnswer } from '@/lib/api';
import { stepViews } from '@/lib/copy/status';
import { orderView, tokenMetaOf } from '@/features/activity/rows';
import { useLogoFor } from '@/features/activity/logos';
import { useActivity } from '@/features/activity/track';
import { NotFound } from './NotFound';
import { ORDER_FRAME, OrderDetail } from './OrderDetail';
import { SCANNER_SPACING, ScannerPanel } from './ScannerPanel';
import { FIT_SCANNER } from '@/features/activity/fit';
import { putRow } from '@/features/activity/live-list';
import { cn } from '@/lib/cn';
import { useNavReset } from '@/lib/nav-tab';

// The Scanner panel's size and layout as the in place frame's (motion part 2): it fits the window, so the list is the one
// scroll (FIT_SCANNER).
const SCANNER_FRAME = cn('md:w-full md:max-w-[1204px] md:overflow-y-hidden', FIT_SCANNER);
const SCANNER_VIEW = cn(SCANNER_SPACING, FIT_SCANNER);

const orderKey = (id: string) => ['scanner-order', id] as const;

function OrderPage({ id, onBack }: { id: string; onBack: () => void }) {
  const qc = useQueryClient();
  const logo = useLogoFor();
  // the row: an id lookup (contract 5.13), asked again once the order ends (its status comes from useActivity)
  const row = useQuery({ queryKey: orderKey(id), queryFn: () => searchScanner(id), staleTime: Infinity });
  const { steps, done } = useActivity(id);
  const wasDone = React.useRef(false);
  React.useEffect(() => {
    if (done && !wasDone.current && row.data && row.data.items[0]?.outcome === 'pending') void qc.invalidateQueries({ queryKey: orderKey(id) });
    wasDone.current = done;
  }, [done, row.data, qc, id]);
  const raw = row.data?.items[0] ?? null;
  // once the order ended, the lists behind this page (the feed, a wallet search, History) show it ended too, so Back does
  React.useEffect(() => { if (raw && raw.outcome !== 'pending') putRow(qc, raw); }, [raw, qc]);
  if (row.data && (row.data.match === 'none' || !raw)) {
    return (
      <PanelBox className="flex flex-col gap-6 md:w-full md:max-w-[1060px]">
        <BoxHeader title="Order" onBack={onBack} />
        <NotFound query={row.data.q || id} />
      </PanelBox>
    );
  }
  const view = raw ? orderView(raw, Math.floor(Date.now() / 1000), logo) : null;
  return (
    <OrderDetail
      order={view}
      steps={raw && steps ? stepViews(steps, { gasMode: raw.gasMode, refund: raw.refund, token: tokenMetaOf(raw), stage: raw.stage, toChain: raw.to.chain }) : undefined}
      loading={row.isLoading}
      onBack={onBack}
    />
  );
}

export function ScannerPage() {
  const params = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const order = params.get('order');
  const q = params.get('q') ?? '';
  // Back from an order returns to the chips the list had
  const listQ = React.useRef(q);
  if (!order) listQ.current = q;
  // the panel keeps its state while it writes its own chips into the link; a link from elsewhere starts it afresh
  const written = React.useRef(q);
  const panelQ = React.useRef(q);
  if (!order && q !== written.current) { written.current = q; panelQ.current = q; }
  // while an order shows, the list is gone: it comes back as a new panel with the chips it had
  if (order) panelQ.current = written.current = listQ.current;
  // a click on the Scanner tab starts the list afresh (the link it opens drops the order and the chips; this also clears a
  // typed search or "Nothing found" on a link that did not change)
  const [fresh, setFresh] = React.useState(0);
  useNavReset('Scanner', () => setFresh((n) => n + 1));
  const open = (row: ActivityRow) => {
    // the row the list just showed is the order's row: the order page draws it at once (its tokens and pill can fly
    // there) instead of a skeleton while the same row is asked again
    qc.setQueryData<SearchAnswer>(orderKey(row.id), (had) => had ?? { q: row.id, match: 'order', items: [row], nextCursor: null });
    router.push(`/scanner?order=${encodeURIComponent(row.id)}`);
  };
  const back = () => router.push(listQ.current ? `/scanner?q=${listQ.current}` : '/scanner');
  return (
    <MorphFrame view={order ? `order-${order}` : 'list'} calm frameClass={order ? ORDER_FRAME : SCANNER_FRAME} viewClass={order ? undefined : SCANNER_VIEW}>
      {() =>
        order ? (
          <OrderPage key={order} id={order} onBack={back} />
        ) : (
          <ScannerPanel key={`${panelQ.current}#${fresh}`} initialQ={panelQ.current || null} onOpen={open} onLink={(next) => { written.current = next; }} />
        )
      }
    </MorphFrame>
  );
}
