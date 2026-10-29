'use client';
// The Scanner tab's body: `/scanner` (the feed and search), `/scanner?q=a,b` (wallet chips), `/scanner?order=<id>` (one
// order). It reads the link with useSearchParams, inside the page's Suspense (a static export needs one).
import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@/components/ui/box';
import BoxHeader from '@/components/ui/box-header';
import { searchScanner } from '@/lib/api';
import { stepViews } from '@/lib/copy/status';
import { orderView, tokenMetaOf } from '@/features/activity/rows';
import { useLogoFor } from '@/features/activity/logos';
import { useActivity } from '@/features/activity/track';
import { NotFound } from './NotFound';
import { OrderDetail } from './OrderDetail';
import { ScannerPanel } from './ScannerPanel';

function OrderPage({ id }: { id: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const logo = useLogoFor();
  // the row: an id lookup (contract 5.13), asked again once the order ends (its status comes from useActivity)
  const row = useQuery({ queryKey: ['scanner-order', id], queryFn: () => searchScanner(id), staleTime: Infinity });
  const { steps, done } = useActivity(id);
  const wasDone = React.useRef(false);
  React.useEffect(() => {
    if (done && !wasDone.current && row.data && row.data.items[0]?.outcome === 'pending') void qc.invalidateQueries({ queryKey: ['scanner-order', id] });
    wasDone.current = done;
  }, [done, row.data, qc, id]);
  const raw = row.data?.items[0] ?? null;
  const back = () => router.push('/scanner');
  if (row.data && (row.data.match === 'none' || !raw)) {
    return (
      <Box className="flex flex-col gap-6 md:w-full md:max-w-[1060px]">
        <BoxHeader title="Order" onBack={back} />
        <NotFound query={row.data.q || id} />
      </Box>
    );
  }
  const view = raw ? orderView(raw, Math.floor(Date.now() / 1000), logo) : null;
  return (
    <OrderDetail
      order={view}
      steps={raw && steps ? stepViews(steps, { gasMode: raw.gasMode, refund: raw.refund, token: tokenMetaOf(raw) }) : undefined}
      loading={row.isLoading}
      onBack={back}
    />
  );
}

export function ScannerPage() {
  const params = useSearchParams();
  const order = params.get('order');
  if (order) return <OrderPage key={order} id={order} />;
  return <ScannerPanel key={params.get('q') ?? ''} initialQ={params.get('q')} />;
}
