'use client';
// After signing: moved from the design's pool-screens.tsx WithdrawStatus (the live history step look: check, spinner,
// empty), driven by the payout's own record (GET /v2/payouts/{id}, contract 5.10) through useActivity.
import * as React from 'react';
import Box from '@/components/ui/box';
import BoxHeader from '@/components/ui/box-header';
import { Card } from '@/components/ui/card';
import ActionButton from '@/components/ui/action-button';
import Spinner from '@/components/ui/spinner';
import { CheckIcon } from '@/components/icons';
import type { PayoutAnswer } from '@/lib/api';
import { tokenAmountText } from '@/lib/copy/format';
import { chainName } from '@/lib/explorer';
import { cn } from '@/lib/cn';
import { useActivity } from '@/features/activity/track';

type Row = ['done' | 'wait' | 'todo', string, string];

/** The design's three rows from the payout record: signed, waiting in line (only while queued), paid out. */
export function withdrawRows(p: PayoutAnswer | undefined, nowSec: number): Row[] {
  const where = p ? chainName(`eip155:${p.terms.dstChain}`) : '';
  const amount = p ? BigInt(p.received ?? p.amount ?? p.terms.minOut) : null;
  const paid: Row = [p?.outcome === 'delivered' ? 'done' : 'todo', `Paid out to your ${where} wallet`, amount === null ? '' : `${tokenAmountText(amount, 6, 'USDC')} USDC`];
  const rows: Row[] = [['done', 'Withdrawal signed', 'One signature, no gas']];
  if (!p) return [...rows, ['wait', 'Waiting in line', 'Pays out by itself'], paid];
  if (p.outcome === 'refunded' || p.outcome === 'failed') return [...rows, ['done', 'Your stake is back', 'You can try again later']];
  if (p.stage === 'queued') {
    const etaAt = p.queue?.etaAt ?? null;
    const sub = etaAt === null ? 'Pays out by itself' : `Pays out in about ${Math.max(1, Math.round((etaAt - nowSec) / 60))} min`;
    return [...rows, ['wait', 'Waiting in line', sub], paid];
  }
  return [...rows, [p.outcome === 'delivered' ? 'done' : 'wait', paid[1], paid[2]]];
}

export function WithdrawStatus({ id, onBack }: { id: string; onBack: () => void }) {
  const { status } = useActivity(id);
  const steps = withdrawRows(status as PayoutAnswer | undefined, Math.floor(Date.now() / 1000));
  return (
    <Box className="flex flex-col gap-6 md:max-w-[537px]">
      <BoxHeader title="Withdrawal" onBack={onBack} />
      <Card className="cursor-auto flex-col items-start gap-5 hover:bg-[#000000]/0">
        {steps.map(([st, t, d], i) => (
          <div key={t} className="flex items-center gap-x-5">
            <div className={cn(
              'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
              st === 'done' ? 'bg-[#12B76A33] text-[#12b76a]' : st === 'wait' ? 'bg-blue-600/35' : 'bg-white/10',
              i < steps.length - 1 && 'after:absolute after:top-full after:h-[20px] after:w-[2px] after:bg-[#12B76A33]',
            )}>
              {st === 'done' ? <CheckIcon /> : st === 'wait' ? <Spinner /> : null}
            </div>
            <div>
              <p className={cn('text-base font-semibold', st === 'todo' ? 'text-[#898989]' : 'text-white')}>{t}</p>
              <p className="text-sm font-normal text-[#898989]">{d}</p>
            </div>
          </div>
        ))}
      </Card>
      <p className="text-center text-sm text-[#898989]">You can leave this page. The payout arrives in your wallet by itself.</p>
      <div className="w-full transition-transform duration-150 active:scale-[0.98]">
        <ActionButton isDisabled={false} onClick={onBack}>Back to pool</ActionButton>
      </div>
    </Box>
  );
}
