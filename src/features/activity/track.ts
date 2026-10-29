'use client';
import { useRef } from 'react';
import { useQuery, type Query } from '@tanstack/react-query';
import { ApiError, getOrder, getPayout, getSteps, type OrderStatusAnswer, type PayoutAnswer } from '@/lib/api';

/** Every 2 s for the first minute, then every 10 s, never while hidden, stop at an end (spec 7, my call). Contract 1.6 sized the
 *  watcher read bucket (240 a minute per IP) on exactly this: status and steps of one order, 60 a minute at most, two at once 120. */
export function useActivity(id: string | null) {
  const since = useRef(Date.now());
  const interval = (q: Query) => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return false;
    const d = q.state.data as { outcome?: string } | undefined;
    if (d?.outcome && d.outcome !== 'pending') return false;
    return Date.now() - since.current < 60_000 ? 2_000 : 10_000;
  };
  const isPayout = !!id && id.startsWith('payout-');
  const status = useQuery<OrderStatusAnswer | PayoutAnswer>({
    queryKey: ['activity', id],
    queryFn: () => (isPayout ? getPayout(Number(id!.slice('payout-'.length))) : getOrder(id!)),
    enabled: !!id && !id.startsWith('stake-') && !id.startsWith('withdraw-'),
    refetchInterval: interval as never,
    // a just started order may not be stored yet for a moment: keep asking
    retry: (n, e) => e instanceof ApiError && (e.code === 'unknownOrder' || e.code === 'notFound') && n < 30,
  });
  const steps = useQuery({ queryKey: ['steps', id], queryFn: () => getSteps(id!), enabled: !!id, refetchInterval: interval as never, retry: 3 });
  const done = !!status.data && (status.data as OrderStatusAnswer | PayoutAnswer).outcome !== 'pending';
  return { status: status.data, steps: steps.data, done };
}
