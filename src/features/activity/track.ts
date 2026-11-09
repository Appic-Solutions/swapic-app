'use client';
import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApiError, getOrder, getPayout, getSteps, type OrderStatusAnswer, type PayoutAnswer } from '@/lib/api';

/** How often a record is asked again: every 2 s for the first minute, then every 10 s, never after its end (spec 7, my
 *  call). Contract 1.6 sized the watcher read bucket (240 a minute per IP) on exactly this: status and steps of one order,
 *  60 a minute at most, two at once 120. A hidden tab is not looked at here: react-query skips a tick while the tab is
 *  hidden and the next tick after it comes back asks again. Answering false would cut the timer itself, and with no render
 *  to start it again the screen stays as it was (a read that landed while hidden left the steps running under Delivered). */
export function pollEvery(answer: { outcome?: string } | undefined, ageMs: number): number | false {
  if (answer?.outcome && answer.outcome !== 'pending') return false;
  return ageMs < 60_000 ? 2_000 : 10_000;
}

export function useActivity(id: string | null) {
  const since = useRef(Date.now());
  const isPayout = !!id && id.startsWith('payout-');
  const status = useQuery<OrderStatusAnswer | PayoutAnswer>({
    queryKey: ['activity', id],
    queryFn: () => (isPayout ? getPayout(Number(id!.slice('payout-'.length))) : getOrder(id!)),
    enabled: !!id && !id.startsWith('stake-') && !id.startsWith('withdraw-'),
    refetchInterval: (q) => pollEvery(q.state.data, Date.now() - since.current),
    // a just started order may not be stored yet for a moment: keep asking
    retry: (n, e) => e instanceof ApiError && (e.code === 'unknownOrder' || e.code === 'notFound') && n < 30,
  });
  const done = !!status.data && status.data.outcome !== 'pending';
  // the status ended: the steps read the watcher's copy of the canister's log, moments behind, so what they still lack comes
  // within seconds, at the first minute's pace however old the swap is
  const steps = useQuery({
    queryKey: ['steps', id],
    queryFn: () => getSteps(id!),
    enabled: !!id,
    refetchInterval: (q) => pollEvery(q.state.data, done ? 0 : Date.now() - since.current),
    retry: 3,
  });
  return { status: status.data, steps: steps.data, done };
}
