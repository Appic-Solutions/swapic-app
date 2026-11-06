'use client';
// Review stake (approved 2026-10-30, design pool-screens.tsx StakeReview; its words are provisional, in Jeff's copy batch):
// what you stake and from which chain, what is added to your stake, the fee and times, the wallet that stakes, and the
// wallet steps ahead. Every number is the checked one (review.ts). Confirm stake runs the existing flow: from an EVM chain
// executeStakeEvm (a fresh quote and a fresh check; terms worse than shown, or other wallet steps, come back as a new price
// and nothing is signed), from ICP executeStakeIcp (approve the ckUSDC, then confirm). While the wallet asks, the button
// reads "Confirm in your wallet" with the soft glow and the step checks in as the wallet answers; a "no" brings the button
// back with "You cancelled in your wallet.". Once it has gone in, a short hold, then Your stake.
import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { MotionCard, ConfirmButton } from '@/components/motion/parts';
import { Note } from '@/components/design/Note';
import { SideBlock } from '@/components/design/SideBlock';
import { TwoColumn } from '@/components/design/TwoColumn';
import { CheckIcon, ClockIcon, EarnIcon, WarningIcon } from '@/components/icons';
import type { StepView } from '@/components/orders/types';
import type { UiToken } from '@/components/ui/token-types';
import { getAccount, getOrders, getQuote, postStakeQuote, submitGasless, type StakeQuote } from '@/lib/api';
import { chainLogo } from '@/lib/explorer';
import { icpClient } from '@/lib/icp';
import { MS, fade } from '@/lib/motion';
import { useEvmSigner, useIcpCaller } from '@/lib/wallets';
import type { ExecOutcome } from '@/features/swap/execute';
import { GuardError, GUARD_MESSAGE } from '@/features/swap/guards/errors';
import { useGuardContext } from '@/features/swap/quote';
import type { NativeCoin } from '@/features/swap/view';
import { checkStakeRoute, executeStakeEvm, executeStakeIcp, type StakeLanding } from '../flows';
import { evmStakeReview, type StakeReview as ReviewData } from '../review';
import { ArrowDown, Details, inPool, REVIEW_CARD, tokenSide, WalletRow, WalletStepsCard, walletSteps } from './ReviewParts';

/** What Stake hands Review stake: the token and amount, the wallet that stakes, and the checked numbers. */
export interface StakeStart {
  from: UiToken;
  amount: bigint;
  /** The paying wallet: the EVM address or the ICP principal (the stake's owner, contract section 2). */
  owner: string;
  review: ReviewData;
  /** From an EVM chain: the checked route carried an approval (the wallet steps shown), and the chain's coin for gas words. */
  evm?: { approval: boolean; native: NativeCoin };
  /** "Starts earning 4.2% APY right away", or without a rate when the pool has none yet. */
  apyLine: string;
}

/** What Your stake follows once it has started. `accountBefore`: the account's shares read right before signing (null
 *  when that read failed), so "Your stake is now" shows only once a later read has more. From ICP: when Confirm was
 *  pressed and when each call returned; after a lost pull, the canister's shares right before the call. */
export type StakeStarted = { accountBefore: bigint | null } & (
  | { kind: 'evm'; orderId: string }
  | { kind: 'icp'; staked: true; signedAt: number; approvedAt: number | null; stakedAt: number | null }
  | { kind: 'icp'; staked: false; sharesBefore: bigint | null; signedAt: number; approvedAt: number | null }
);

export function StakeNote({ icp }: { icp: boolean }) {
  return icp ? (
    <Note calm icon={<CheckIcon />}>Your ICP wallet asks you to approve the ckUSDC, then to confirm. No gas. A stake from ICP pays out on ICP.</Note>
  ) : (
    <Note calm icon={<EarnIcon width={16} height={16} />}>Your stake earns from every swap that uses the pool. Withdraw anytime.</Note>
  );
}

export function StakeReview({ start, onBack, onStarted }: { start: StakeStart; onBack: () => void; onStarted: (s: StakeStarted, review: ReviewData) => void }) {
  const signer = useEvmSigner();
  const caller = useIcpCaller();
  const guard = useGuardContext();
  const icp = start.review.kind === 'icp';
  const [review, setReview] = React.useState(start.review);
  const [approval, setApproval] = React.useState(start.evm?.approval ?? false);
  const [wasAdded, setWasAdded] = React.useState<string | null>(null);
  const [states, setStates] = React.useState<StepView['state'][] | undefined>(undefined);
  const [busy, setBusy] = React.useState(false);
  const [cancelled, setCancelled] = React.useState(false);
  const [blocked, setBlocked] = React.useState(false);
  const [note, setNote] = React.useState<{ tone: 'yellow' | 'blue'; text: string } | null>(null);
  const [resume, setResume] = React.useState<(() => Promise<ExecOutcome>) | null>(null);
  // from ICP: when Confirm was pressed and when each wallet step's call returned (Your stake's step times)
  const times = React.useRef<{ signedAt: number; done: (number | null)[] }>({ signedAt: 0, done: [] });
  const qc = useQueryClient();
  const accountBefore = React.useRef<bigint | null>(null);

  const after = (out: ExecOutcome | StakeLanding) => {
    setBusy(false);
    setResume(null);
    if (out.kind === 'started' || out.kind === 'landing') {
      // it has gone in (or is on its way): a short hold for the last check to draw, then Your stake (nothing waits on this)
      setBusy(true);
      const t = times.current;
      const before = accountBefore.current;
      const s: StakeStarted = out.kind === 'landing' ? { kind: 'icp', staked: false, sharesBefore: out.sharesBefore, signedAt: t.signedAt, approvedAt: t.done[0] ?? null, accountBefore: before }
        : icp ? { kind: 'icp', staked: true, signedAt: t.signedAt, approvedAt: t.done[0] ?? null, stakedAt: t.done[1] ?? null, accountBefore: before }
          : { kind: 'evm', orderId: out.activityId, accountBefore: before };
      setTimeout(() => onStarted(s, review), MS.hold);
      return;
    }
    if (out.kind === 'rejected') {
      setStates((s) => s?.map((x) => (x === 'wait' ? 'todo' : x)));
      setCancelled(true);
      return;
    }
    if (out.kind === 'newPrice' && start.evm) {
      // the new terms are read as the canister reads them before any number is drawn
      setStates(undefined);
      try {
        const checked = checkStakeRoute({ quote: out.quote as unknown as StakeQuote, option: out.option, from: start.from, amount: start.amount, owner: start.owner as `0x${string}`, guard, nowSec: Math.floor(Date.now() / 1000) });
        const next = evmStakeReview({ option: out.option, checked, from: start.from, amount: start.amount, native: start.evm.native });
        setWasAdded(review.addedText);
        setReview(next);
        setApproval(!!checked.approval);
        setNote({ tone: 'yellow', text: `The price moved. You now add ~${next.addedText} USDC to your stake.` });
      } catch (e) {
        setBlocked(true);
        setNote({ tone: 'yellow', text: e instanceof GuardError ? GUARD_MESSAGE : 'No route found for this amount' });
      }
      return;
    }
    if (out.kind === 'failed') { setNote({ tone: 'yellow', text: out.message }); return; }
    if (out.kind === 'unknown') {
      setNote({ tone: 'blue', text: out.message });
      if (out.resume) setResume(() => out.resume);
    }
  };

  const sign = async () => {
    if (busy || blocked) return;
    setCancelled(false);
    setNote(null);
    setBusy(true);
    if (resume) { after(await resume()); return; }
    setWasAdded(null);
    setStates(review.steps.map(() => 'todo'));
    // the account's shares, read fresh right before signing (Your stake's new total waits for a read with more)
    accountBefore.current = await qc.fetchQuery({ queryKey: ['account', start.owner], queryFn: () => getAccount(start.owner), staleTime: 0 })
      .then((a) => BigInt(a.shares)).catch(() => null);
    times.current = { signedAt: Date.now(), done: [] };
    const onStep = (i: number, st: 'wait' | 'done' | 'fail') => {
      if (st === 'done') times.current.done[i] = Date.now();
      setStates((s) => (s ?? review.steps.map(() => 'todo' as const)).map((x, j) => (j === i ? st : x)));
    };
    if (icp) {
      if (!caller) { setBusy(false); return; }
      after(await executeStakeIcp({ amount: start.amount, moveFee: review.moveFee, caller, onStep }, icpClient()));
      return;
    }
    if (!signer) { setBusy(false); return; }
    after(await executeStakeEvm(
      { from: start.from, amount: start.amount, evm: signer, shownAdded: review.added, shownApproval: approval, onStep },
      { getQuote, getOrders, submitGasless, postStakeQuote, icp: icpClient(), nowMs: () => Date.now(), sleep: (ms) => new Promise((r) => setTimeout(r, ms)) },
    ));
  };

  const steps = walletSteps(review.steps, states);
  const waiting = busy && !!states?.some((s) => s === 'wait');
  const label = blocked ? 'Confirm stake' : wasAdded ? 'Accept new price' : resume ? 'Try again' : busy && !waiting ? undefined : 'Confirm stake';
  return (
    <TwoColumn
      inPlace
      title="Review stake"
      onBack={onBack}
      left={
        <MotionCard variants={fade} className={REVIEW_CARD}>
          <div className="flex w-full flex-1 flex-col justify-center gap-4">
            <SideBlock label="You stake" side={tokenSide(start.from, start.amount)} amount={review.payText} />
            <ArrowDown />
            <SideBlock label="Added to your stake" side={inPool(review.added, '~')} amount={`~${review.addedText} USDC`} tone={wasAdded ? 'text-warn' : undefined} />
            {wasAdded && <p className="-mt-2 ml-16 text-sm font-normal text-secondary">was <span className="line-through">~{wasAdded} USDC</span></p>}
            <p className="-mt-2 ml-16 text-sm font-normal text-secondary">{start.apyLine}</p>
          </div>
          <div className="w-full space-y-2 border-t border-line pt-3">
            <WalletRow k="Staked from" icp={icp} address={start.owner} logo={chainLogo(start.from.chain)} />
          </div>
        </MotionCard>
      }
      right={
        <>
          <Details rows={[['Fee', review.feeText], ['Ready in', review.readyText], ['Withdraw', <span key="w" className="text-success">{review.withdrawText}</span>]]} />
          <WalletStepsCard steps={steps} />
          <motion.div variants={fade}>
            {note ? (
              <Note calm tone={note.tone} icon={note.tone === 'blue' ? <ClockIcon width={16} height={16} /> : <WarningIcon />}>{note.text}</Note>
            ) : (
              <StakeNote icp={icp} />
            )}
          </motion.div>
        </>
      }
      action={<ConfirmButton label={label} waiting={waiting} cancelled={cancelled} disabled={blocked} onClick={() => void sign()} />}
    />
  );
}
