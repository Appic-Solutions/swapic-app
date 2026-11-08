'use client';
// A History row in progress ends on screen as soon as its order does. The list (GET /v2/orders?wallets=, 20 a minute) is
// refreshed every 10 s at best, so the newest rows in progress also watch their own status (GET /v2/orders/{id}, or
// /v2/payouts/{n} for a payout, contract 5.8 and 5.10): every 3 s while the tab shows, at most WATCH_MAX rows at once. These
// count in the 240 a minute watcher reads bucket (contract 1.6), never in the wallet lookup one: 5 rows are 100 a minute.
// The moment a status says the order ended, the list asks for its newest page (LiveList.ended) and the row stops being
// watched. Its query key is useActivity's, so the swap screen and the order page share these answers.
import * as React from 'react';
import { useQueries } from '@tanstack/react-query';
import { getOrder, getPayout, type ActivityRow, type OrderStatusAnswer, type PayoutAnswer, type StepsAnswer } from '@/lib/api';

/** At most this many rows in progress watch their own status (the newest). */
export const WATCH_MAX = 5;
/** How often each of them asks. */
export const WATCH_MS = 3_000;

/** The newest rows in progress that have a status of their own (a stake or a withdrawal still being written has none). */
export function watchIds(rows: Pick<ActivityRow, 'id' | 'outcome' | 'createdAt'>[], max = WATCH_MAX): string[] {
  return rows
    .filter((r) => r.outcome === 'pending' && !r.id.startsWith('stake-') && !r.id.startsWith('withdraw-'))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, max)
    .map((r) => r.id);
}

/** What an ended status says about the row (until the list's own row, with its reason word, comes in). */
export function patchFromStatus(s: OrderStatusAnswer | PayoutAnswer, nowSec: number) {
  return (row: ActivityRow): ActivityRow => {
    const order = 'srcTx' in s ? s : null;
    return {
      ...row,
      outcome: s.outcome, stage: s.stage, onHold: s.onHold ?? row.onHold ?? null,
      refund: s.refund ?? row.refund,
      to: order?.amountOut ? { ...row.to, amount: order.amountOut } : row.to,
      endedAt: row.endedAt ?? order?.deliveredAt ?? nowSec,
      ...(order ? { deliveredAt: order.deliveredAt ?? row.deliveredAt ?? null, tookS: order.tookS ?? row.tookS ?? null } : {}),
    };
  };
}

/** What ended steps say about the row: the end, its reason word, what was delivered and when. */
export function patchFromSteps(a: StepsAnswer) {
  return (row: ActivityRow): ActivityRow => {
    const stop = a.steps.find((x) => x.step === 'refunded' && x.reason) ?? a.steps.find((x) => x.step === 'failed');
    const delivered = a.steps.find((x) => x.step === 'delivered' && x.state === 'done');
    const times = a.steps.map((x) => x.atMs).filter((t): t is number => t !== null);
    return {
      ...row,
      outcome: a.outcome, stage: a.outcome,
      reasonCode: stop?.reason ?? row.reasonCode,
      to: delivered?.amount ? { ...row.to, amount: delivered.amount } : row.to,
      endedAt: row.endedAt ?? (times.length ? Math.round(Math.max(...times) / 1000) : null),
      deliveredAt: a.deliveredAt ?? row.deliveredAt ?? null, tookS: a.tookS ?? row.tookS ?? null,
    };
  };
}

function useVisible() {
  const [shown, setShown] = React.useState(() => typeof document === 'undefined' || document.visibilityState === 'visible');
  React.useEffect(() => {
    const on = () => setShown(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  return shown;
}

/** Watches the newest rows in progress (watchIds) and calls `onEnd` once for each that a status says ended. */
export function useEndWatch(rows: ActivityRow[], onEnd: (id: string, patch: (row: ActivityRow) => ActivityRow) => void) {
  const shown = useVisible();
  const ids = watchIds(rows);
  const answers = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['activity', id] as const,
      queryFn: (): Promise<OrderStatusAnswer | PayoutAnswer> => (id.startsWith('payout-') ? getPayout(Number(id.slice('payout-'.length))) : getOrder(id)),
      refetchInterval: (q: { state: { data?: { outcome: string } } }) => (shown && (q.state.data?.outcome ?? 'pending') === 'pending' ? WATCH_MS : false),
      retry: false,
    })),
  });
  const told = React.useRef(new Set<string>());
  const call = React.useRef(onEnd);
  call.current = onEnd;
  const ends = answers.map((a, k) => (a.data && a.data.outcome !== 'pending' ? `${ids[k]}:${a.data.outcome}` : '')).join(',');
  React.useEffect(() => {
    answers.forEach((a, k) => {
      const id = ids[k]!;
      if (!a.data || a.data.outcome === 'pending' || told.current.has(id)) return;
      told.current.add(id);
      call.current(id, patchFromStatus(a.data, Math.floor(Date.now() / 1000)));
    });
    // `ends` names every answer that says an order ended
  }, [ends]);
}
