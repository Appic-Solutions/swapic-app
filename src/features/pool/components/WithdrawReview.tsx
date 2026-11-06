'use client';
// Review withdrawal (approved 2026-10-30, design pool-screens.tsx WithdrawReview; its words are provisional, in Jeff's copy
// batch): what you withdraw, the least you get on the chain picked, the fee and when it arrives (or the line), and the
// wallet it is paid to. Every amount is the checked record's (review.ts). Sign withdrawal runs the existing signing
// (executeWithdrawEvm: a fresh record, checked again; one paying less than shown comes back as new terms, never signed);
// a stake made from ICP is withdrawn with executeWithdrawIcp and pays out on ICP. While the wallet asks, the button reads
// "Confirm in your wallet" with the soft glow; a "no" brings it back with "You cancelled in your wallet.". Once it has
// started, a short hold (as Swap's), then the withdrawal's steps (or, from ICP, the pool page).
import * as React from 'react';
import { motion } from 'motion/react';
import { MotionCard, ConfirmButton } from '@/components/motion/parts';
import { Note } from '@/components/design/Note';
import { SideBlock } from '@/components/design/SideBlock';
import { TwoColumn } from '@/components/design/TwoColumn';
import { CheckIcon, ClockIcon, WarningIcon } from '@/components/icons';
import type { StepView } from '@/components/orders/types';
import type { UiToken } from '@/components/ui/token-types';
import { postWithdraw, postWithdrawQuote } from '@/lib/api';
import { chainLogo } from '@/lib/explorer';
import { icpClient } from '@/lib/icp';
import { MS, fade } from '@/lib/motion';
import { useEvmSigner, useIcpCaller } from '@/lib/wallets';
import type { ExecOutcome } from '@/features/swap/execute';
import type { MyStake } from '../data';
import { executeWithdrawEvm, executeWithdrawIcp, type WithdrawNewTerms } from '../flows';
import { evmWithdrawReview, type WithdrawReview as ReviewData } from '../review';
import { usedNonces } from '../used-nonces';
import { ArrowDown, Details, inPool, REVIEW_CARD, tokenSide, WalletRow, WalletStepsCard, walletSteps } from './ReviewParts';

/** What Withdraw hands Review withdrawal: the stake, the amount, where it pays out, and the checked numbers. */
export interface WithdrawStart { stake: MyStake; to: UiToken; amount: bigint; review: ReviewData }

function WithdrawNote({ review }: { review: ReviewData }) {
  return review.queuedText ? (
    <Note calm tone="blue" icon={<ClockIcon width={16} height={16} />}>{review.queuedText}</Note>
  ) : review.kind === 'icp' ? (
    <Note calm icon={<CheckIcon />}>Your ICP wallet asks you to confirm. No gas. The ckUSDC arrives right away.</Note>
  ) : (
    <Note calm icon={<CheckIcon />}>One signature, no gas. The USDC arrives in your wallet by itself.</Note>
  );
}

export function WithdrawReview({ start, onBack, onStarted }: { start: WithdrawStart; onBack: () => void; onStarted: (activityId: string) => void }) {
  const signer = useEvmSigner();
  const caller = useIcpCaller();
  const icp = start.review.kind === 'icp';
  const [review, setReview] = React.useState(start.review);
  const [wasGet, setWasGet] = React.useState<string | null>(null);
  const [states, setStates] = React.useState<StepView['state'][] | undefined>(undefined);
  const [busy, setBusy] = React.useState(false);
  const [cancelled, setCancelled] = React.useState(false);
  const [note, setNote] = React.useState<{ tone: 'yellow' | 'blue'; text: string } | null>(null);

  const after = (out: ExecOutcome | WithdrawNewTerms) => {
    setBusy(false);
    if (out.kind === 'started') {
      // a short hold for the check to draw, then the next view (the withdrawal has started: nothing waits on this)
      setBusy(true);
      const id = out.activityId;
      setTimeout(() => onStarted(id), MS.hold);
      return;
    }
    if (out.kind === 'rejected') {
      setStates((s) => s?.map((x) => (x === 'wait' ? 'todo' : x)));
      setCancelled(true);
      return;
    }
    if (out.kind === 'newTerms') {
      const next = evmWithdrawReview(out.checked, Math.floor(Date.now() / 1000));
      setStates(undefined);
      setWasGet(review.getText);
      setReview(next);
      setNote({ tone: 'yellow', text: `The price moved. You now get at least ${next.getText}.` });
      return;
    }
    if (out.kind === 'failed' || out.kind === 'unknown') setNote({ tone: out.kind === 'unknown' ? 'blue' : 'yellow', text: out.message });
  };

  const sign = async () => {
    if (busy) return;
    setCancelled(false);
    setNote(null);
    setBusy(true);
    setWasGet(null);
    setStates(review.steps.map(() => 'todo'));
    const onStep = (i: number, st: 'wait' | 'done' | 'fail') => setStates((s) => (s ?? review.steps.map(() => 'todo' as const)).map((x, j) => (j === i ? st : x)));
    if (icp) {
      if (!caller) { setBusy(false); return; }
      after(await executeWithdrawIcp({ wanted: start.amount, moveFee: review.moveFee, caller, onStep }, icpClient()));
      return;
    }
    if (!signer) { setBusy(false); return; }
    after(await executeWithdrawEvm(
      { usdc: start.amount, dstChain: start.to.chain, evm: signer, onStep, shownMinOut: review.minOut },
      { icp: icpClient(), postWithdrawQuote, postWithdraw, nowMs: () => Date.now(), used: usedNonces },
    ));
  };

  const steps = walletSteps(review.steps, states);
  const waiting = busy && !!states?.some((s) => s === 'wait');
  const label = wasGet ? 'Accept new price' : busy && !waiting ? undefined : icp ? 'Withdraw' : 'Sign withdrawal';
  return (
    <TwoColumn
      inPlace
      longTitle
      title="Review withdrawal"
      onBack={onBack}
      left={
        <MotionCard variants={fade} className={REVIEW_CARD}>
          <div className="flex w-full flex-1 flex-col justify-center gap-4">
            <SideBlock label="You withdraw" side={inPool(start.amount, '', 'From your stake')} amount={review.withdrawText} />
            <ArrowDown />
            <SideBlock label={review.getLabel} side={tokenSide(start.to, review.minOut, icp ? '~' : '')} amount={review.getText} tone={wasGet ? 'text-warn' : undefined} />
            {wasGet && <p className="-mt-2 ml-16 text-sm font-normal text-secondary">was <span className="line-through">{wasGet}</span></p>}
          </div>
          <div className="w-full space-y-2 border-t border-line pt-3">
            <WalletRow k="Paid to" icp={icp} address={start.stake.owner} logo={chainLogo(start.to.chain)} />
          </div>
        </MotionCard>
      }
      right={
        <>
          <Details rows={[['Fee', review.feeText], ['Arrives', review.arrives]]} />
          <WalletStepsCard steps={steps} />
          <motion.div variants={fade}>
            {note ? (
              <Note calm tone={note.tone} icon={note.tone === 'blue' ? <ClockIcon width={16} height={16} /> : <WarningIcon />}>{note.text}</Note>
            ) : (
              <WithdrawNote review={review} />
            )}
          </motion.div>
        </>
      }
      action={<ConfirmButton label={label} waiting={waiting} cancelled={cancelled} onClick={() => void sign()} />}
    />
  );
}
