'use client';
// After signing: moved from the design's pool-screens.tsx WithdrawStatus (the live history step look: check, spinner,
// empty), driven by the payout's own record (GET /v2/payouts/{id}, contract 5.10) through useActivity.
// Motion (approved 2026-10-29, part 2): one view of the Pool's in place panel. A step's check draws itself in when the
// record says it is done (on opening, or later when the payout lands), the lines between the steps fill from the top, and
// the waiting step lights up. Nothing runs ahead of the record: a step not done shows no check.
import * as React from 'react';
import { motion } from 'motion/react';
import BoxHeader from '@/components/ui/box-header';
import { DrawCheck, PanelBox } from '@/components/motion/parts';
import { DUR, T, fade, tw } from '@/lib/motion';
import { Card } from '@/components/ui/card';
import ActionButton from '@/components/ui/action-button';
import Spinner from '@/components/ui/spinner';
import type { PayoutAnswer } from '@/lib/api';
import { tokenAmountText } from '@/lib/copy/format';
import { chainName } from '@/lib/explorer';
import { cn } from '@/lib/cn';
import { useActivity } from '@/features/activity/track';

// Back link of the real BoxHeader: fades on hover, sinks a little when pressed.
const BACK = '[&_button]:transition [&_button]:duration-100 [&_button:hover]:opacity-70 [&_button:active]:scale-[0.97] motion-reduce:[&_button:active]:scale-100';

type Row = ['done' | 'wait' | 'todo', string, string];

/** The design's three rows from the payout record: signed, waiting in line (only while queued), paid out. */
export function withdrawRows(p: PayoutAnswer | undefined, nowSec: number): Row[] {
  const where = p ? chainName(`eip155:${p.terms.dstChain}`) : '';
  const amount = p ? BigInt(p.received ?? p.amount ?? p.terms.minOut) : null;
  const paid: Row = [p?.outcome === 'delivered' ? 'done' : 'todo', `Paid out to your ${where} wallet`, amount === null ? '' : `${tokenAmountText(amount, 6, 'USDC')} USDC`];
  const rows: Row[] = [['done', 'Withdrawal signed', 'One signature, no gas']];
  // until the payout record answers, only the signature is known
  if (!p) return rows;
  // contract 5.10: refunded is an undone withdrawal (its shares came back); failed is held by the canister for a person's check
  if (p.outcome === 'refunded') return [...rows, ['done', 'Your stake is back', 'You can try again later']];
  if (p.outcome === 'failed' || p.onHold === true) return [...rows, ['todo', 'On hold', "Your money is safe. We're checking it and will finish or refund it."]];
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
    <PanelBox className="flex flex-col gap-6 md:max-w-[537px]">
      <motion.div variants={fade} className={BACK}><BoxHeader title="Withdrawal" onBack={onBack} /></motion.div>
      <motion.div variants={fade} className="w-full">
        <Card className="cursor-auto flex-col items-start gap-5">
          {steps.map(([st, t, d], i) => (
            <div key={t} className="relative flex items-center gap-x-5">
              {st === 'wait' && (
                <motion.div className="pointer-events-none absolute -inset-x-3 -inset-y-1.5 rounded-xl bg-blue-600/10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ ...T.enter, delay: DUR.draw }} />
              )}
              <div className={cn(
                'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                st === 'done' ? 'bg-success/15 text-success' : st === 'wait' ? 'bg-blue-500/15' : 'bg-white/10',
              )}>
                {/* keyed by state: a step that turns done later draws its check at that moment */}
                {st === 'done' ? <DrawCheck key="done" delay={DUR.lead} /> : st === 'wait' ? <Spinner key="wait" /> : null}
                {i < steps.length - 1 && (
                  // the line fills from the top once the check is drawn
                  <span className="absolute top-full h-[20px] w-[2px]">
                    <motion.span className="absolute inset-0 origin-top bg-success/15" initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ ...T.draw, delay: DUR.lead + DUR.draw * (i + 0.5) }} />
                  </span>
                )}
              </div>
              <div className="relative">
                <p className={cn('text-base font-semibold', st === 'todo' ? 'text-secondary' : 'text-white')}>{t}</p>
                <p className="text-sm font-normal text-secondary">{d}</p>
              </div>
            </div>
          ))}
        </Card>
      </motion.div>
      <motion.p variants={fade} className="text-center text-sm text-secondary">You can leave this page. The payout arrives in your wallet by itself.</motion.p>
      <motion.div variants={fade} className={cn('w-full', tw.quick, tw.press)}>
        <ActionButton isDisabled={false} onClick={onBack}>Back to pool</ActionButton>
      </motion.div>
    </PanelBox>
  );
}
