'use client';
// History: moved from the design's history-screens.tsx HistoryPanel, wired to every connected wallet's rows (useHistory). A
// row opens with its steps (GET /v2/orders/{id}/steps), fetched once when opened and every 10 s while it is pending.
// Motion (approved 2026-10-29, part 2): one panel that changes in place (MorphFrame): "Open in Scanner" turns it into the
// order page, the row's tokens and status pill fly there and the nav highlight slides to Scanner; Back reverses. Rows fade
// up one after another once loaded, a new row opens at the top (the list glides back to its top so it shows whole), rows
// open by height, the filter's pill slides.
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { MorphFrame } from '@/components/motion/parts';
import { cn } from '@/lib/cn';
import { arriveTop, listItem, tw, useMounted } from '@/lib/motion';
import { useNavTab } from '@/lib/nav-tab';
import { orderView } from '@/features/activity/rows';
import { useLogoFor } from '@/features/activity/logos';
import { useActivity } from '@/features/activity/track';
import { OrderDetail } from '@/features/scanner/OrderDetail';
import { OrderRow } from '@/components/orders/OrderRow';
import { OrderRowSkeleton } from '@/components/orders/OrderRowSkeleton';
import { getSteps, type ActivityRow } from '@/lib/api';
import { stepViews } from '@/lib/copy/status';
import { useWalletMenu } from '@/lib/wallets/menu';
import { tokenMetaOf, type OrderView } from '@/features/activity/rows';
import { counts as countRows, filterRows, useHistory, type Filter } from './data';
import { Empty } from './Empty';
import { Filters } from './Filters';
import { WalletChips } from './WalletChips';

function HistoryRow({ order, raw, open, onToggle, onOpenScanner }: { order: OrderView; raw: ActivityRow; open: boolean; onToggle: () => void; onOpenScanner: () => void }) {
  const live = order.status === 'pending' || order.status === 'queued';
  const steps = useQuery({
    queryKey: ['steps', order.id],
    queryFn: () => getSteps(order.id),
    enabled: open,
    refetchInterval: () => (open && live && typeof document !== 'undefined' && document.visibilityState === 'visible' ? 10_000 : false),
  }).data;
  return (
    <OrderRow
      order={order}
      open={open}
      onToggle={onToggle}
      onOpenScanner={onOpenScanner}
      steps={steps ? stepViews(steps, { gasMode: raw.gasMode, refund: raw.refund, token: tokenMetaOf(raw) }) : undefined}
    />
  );
}

/** The Scanner's order page for a History row, in the History panel (its timeline from the order's steps). */
function OrderInPlace({ raw, onBack }: { raw: ActivityRow; onBack: () => void }) {
  const logo = useLogoFor();
  const { steps } = useActivity(raw.id);
  return (
    <OrderDetail
      order={orderView(raw, Math.floor(Date.now() / 1000), logo)}
      steps={steps ? stepViews(steps, { gasMode: raw.gasMode, refund: raw.refund, token: tokenMetaOf(raw) }) : undefined}
      loading={false}
      onBack={onBack}
    />
  );
}

// The History panel's size and layout as the in place frame's (motion part 2); the order page's size when a row opens it.
const HISTORY_FRAME = 'md:h-fit md:max-h-[760px] md:w-full md:max-w-[537px] md:overflow-y-hidden';
const HISTORY_VIEW = 'justify-start gap-y-6 md:max-h-[760px]';
const ORDER_FRAME = 'h-full md:h-fit md:w-full md:max-w-[537px] lg:max-w-[1060px] overflow-x-hidden';

export function HistoryPanel() {
  const [orderId, setOrderId] = React.useState<string | null>(null);
  const h = useHistory();
  const setNav = useNavTab((s) => s.set);
  const raw = orderId ? h.raw.find((r) => r.id === orderId) : undefined;
  // the order page shows the Scanner's page: the nav highlight moves there while it shows (motion row 58)
  React.useEffect(() => { setNav(raw ? 'Scanner' : null); }, [raw, setNav]);
  React.useEffect(() => () => setNav(null), [setNav]);
  return (
    <MorphFrame view={raw ? `order-${raw.id}` : 'list'} frameClass={raw ? ORDER_FRAME : HISTORY_FRAME} viewClass={raw ? undefined : HISTORY_VIEW}>
      {(v) => (v !== 'list' && raw ? <OrderInPlace raw={raw} onBack={() => setOrderId(null)} /> : <HistoryList h={h} onOpenScanner={setOrderId} />)}
    </MorphFrame>
  );
}

function HistoryList({ h, onOpenScanner }: { h: ReturnType<typeof useHistory>; onOpenScanner: (id: string) => void }) {
  const router = useRouter();
  const openMenu = useWalletMenu((s) => s.setOpen);
  const [filter, setFilter] = React.useState<Filter>('All');
  const [openId, setOpenId] = React.useState<string | null>(null);
  const mounted = useMounted();
  const list = React.useRef<HTMLDivElement>(null);
  const shown = filterRows(h.rows, filter);
  const connected = h.state !== 'nowallet';
  const rawOf = new Map(h.raw.map((r) => [r.id, r]));
  // a row that was not there on the last answer arrives at the top (motion row 56); the first answer marks all as seen
  const seen = React.useRef<Set<string> | null>(null);
  const [freshId, setFreshId] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (h.state !== 'ready') return;
    if (seen.current === null) { seen.current = new Set(h.rows.map((r) => r.id)); return; }
    const unseen = h.rows.filter((r) => !seen.current!.has(r.id));
    unseen.forEach((r) => seen.current!.add(r.id));
    if (unseen.length) {
      setFreshId(unseen[0]!.id);
      // fully visible: the list glides back to its top, so the new row never opens clipped at the panel edge
      list.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [h.state, h.rows]);
  return (
    <>
      <div className="flex w-full flex-wrap items-center justify-between gap-3 text-white">
        <h1 className="text-2xl font-bold md:text-3xl">History</h1>
        {connected && <WalletChips wallets={h.wallets} />}
      </div>
      {connected && h.state !== 'empty' && <Filters value={filter} onChange={setFilter} counts={countRows(h.rows)} />}
      <div ref={list} className={cn('flex w-full flex-col gap-y-4 md:min-h-0 md:flex-1 md:overflow-y-auto md:pr-1', h.state === 'loading' && tw.shimmerAll)}>
        {h.state === 'loading' && [0, 1, 2].map((i) => <OrderRowSkeleton key={i} />)}
        {h.state === 'nowallet' && (
          <Empty img="/images/wallet.svg" title="Connect your wallet to see your history" text="Connect an EVM or ICP wallet, or both. You'll see every swap, stake and withdrawal they made, in one list." action="Connect wallet" onAction={() => openMenu(true)} />
        )}
        {h.state === 'empty' && (
          <Empty img="/images/empty.png" title="No swaps yet" text="Your swaps, stakes and withdrawals show up here as soon as you make one, with every step and its transaction." action="Make a swap" onAction={() => router.push('/')} />
        )}
        {h.state === 'error' && (
          <Empty img="/images/empty.png" title="Couldn't load your history" text="The history service didn't answer. Your funds are safe; this only affects the list." action="Try again" onAction={() => void h.refetch()} />
        )}
        {h.state === 'ready' && (
          <>
            {shown.map((o, i) => (
              // shrink-0: an arriving row clips while it opens, and the scrolling list must not squeeze it
              <motion.div key={o.id} className="shrink-0" {...(freshId === o.id ? arriveTop(16) : mounted ? listItem(Math.min(i, 8)) : {})}>
                <HistoryRow order={o} raw={rawOf.get(o.id)!} open={openId === o.id} onToggle={() => setOpenId(openId === o.id ? null : o.id)} onOpenScanner={() => onOpenScanner(o.id)} />
              </motion.div>
            ))}
            {h.hasMore && (
              <button onClick={() => void h.more()} disabled={h.loadingMore} className={cn('mx-auto mb-1 flex items-center gap-x-1.5 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/20', tw.quick, tw.press)}>
                Show older
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
}
