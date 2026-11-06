'use client';
// Your stake (approved 2026-10-30, design pool-screens.tsx StakeStatus; its words are provisional, in Jeff's copy batch):
// Your swap's page for a stake, in the same layout (SwapStatus with the stake's words). It fades in after the wallet
// approved (nothing shrinks into the ring); the ring fills while it moves and closes with the check badge and the glow.
// Every step follows real data only:
// - from an EVM chain the stake is an order: its steps check in from the watcher's tracking, as Swap's do (useActivity,
//   statusView), and it is Staked only when the order's status says delivered;
// - from ICP: "Approved ckUSDC" checked once the approval returned, "Staked" once stake_icp returned; a stake whose pull
//   answer was lost (landing) shows as on its way until pool_account shows more shares than right before the call.
// "Your stake is now …" shows only once the account, read again after the stake went in, holds more shares than right
// before signing (shares, not value: value moves with the pool's price).
import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Principal } from '@icp-sdk/core/principal';
import ActionButton from '@/components/ui/action-button';
import { Note } from '@/components/design/Note';
import { SWAPIC_LOGO } from '@/components/design/swapic-logo';
import { CopyButton, useCopied } from '@/components/orders/CopyButton';
import { CheckIcon, ClockIcon, PlusIcon } from '@/components/icons';
import { ICP_CHAIN } from '@/config';
import { getAccount, type OrderStatusAnswer } from '@/lib/api';
import { clockText, dayText, short, tookText } from '@/lib/copy/format';
import { chainLogo } from '@/lib/explorer';
import { icpClient } from '@/lib/icp';
import { formatUsd } from '@/lib/money';
import { cn } from '@/lib/cn';
import { QUIET } from '@/components/ui/styles';
import { tw } from '@/lib/motion';
import { useActivity } from '@/features/activity/track';
import { SwapStatus } from '@/features/swap/components/SwapStatus';
import { statusView, type StatusData } from '@/features/swap/status-view';
import { combine, useMyStakes } from '../data';
import type { StakeReview as ReviewData } from '../review';
import { inPool, tokenSide } from './ReviewParts';
import type { StakeStart, StakeStarted } from './StakeReview';

/** How full the ring is at most while the stake moves (it closes only when the record says it is in). */
const RING_MOVING = 0.85;

export function StakeStatus({ start, started, review, apy, onPool, onMore }: {
  start: StakeStart; started: StakeStarted; review: ReviewData; apy: string | null; onPool: () => void; onMore: () => void;
}) {
  const [copied, copy] = useCopied();
  const qc = useQueryClient();
  const startedAt = React.useRef(Date.now());
  const evm = started.kind === 'evm';
  const { status, steps } = useActivity(evm ? started.orderId : null);

  // from ICP after a lost pull: pool_account, every 5 s until it shows more shares than before the call
  const landing = started.kind === 'icp' && !started.staked ? started : null;
  const account = useQuery({
    queryKey: ['pool-account-icp', start.owner],
    queryFn: () => icpClient().poolAccount({ Icp: { owner: Principal.fromText(start.owner), subaccount: [] } }),
    enabled: !!landing && landing.sharesBefore !== null,
    refetchInterval: (q) => (landing?.sharesBefore != null && q.state.data && q.state.data.shares > landing.sharesBefore ? false : 5_000),
  });
  const grew = !!landing && landing.sharesBefore !== null && !!account.data && account.data.shares > landing.sharesBefore;

  const nowSec = Math.floor(Date.now() / 1000);
  const pay = tokenSide(start.from, start.amount);
  const staked = evm ? status?.outcome === 'delivered' : started.kind === 'icp' && (started.staked || grew);
  const get = inPool(review.added, staked ? '' : '~');
  const earning = apy ? `Earning ${apy} APY from now` : 'Earning from now';
  const amountText = `${review.addedText} USDC`;

  let data: StatusData;
  if (evm && status) {
    const token = (chain: string | null, address: string | null) =>
      chain === start.from.chain && address !== null && address.toLowerCase() === start.from.address.toLowerCase() ? { symbol: start.from.symbol, decimals: start.from.decimals } : null;
    const v = statusView({ status: status as OrderStatusAnswer, steps, pay, get, nowSec, feeText: review.feeText, gasText: review.gasText, gasMode: review.gasMode, toWallet: start.owner, orderId: started.orderId, token });
    data = v.phase === 'delivered' ? { ...v, title: 'Staked', text: earning, ringLogo: SWAPIC_LOGO } : v;
  } else if (evm) {
    data = {
      phase: 'progress', ending: 'pending', pay, get, refundText: null, reason: null, refund: null, steps: [], when: '', title: 'On its way', text: 'Updating live',
      ringLogo: chainLogo(start.from.chain), to: start.owner, fee: review.feeText, gas: review.gasText, orderId: started.orderId, totalText: 'Updating live',
    };
  } else {
    // from ICP: the approval returned before Your stake opened; the stake is checked once its call (or pool_account) says so
    const icpStarted = started as Extract<StakeStarted, { kind: 'icp' }>;
    const approvedAt = icpStarted.approvedAt ?? startedAt.current;
    const stakedAt = icpStarted.staked ? icpStarted.stakedAt : null;
    const took = stakedAt !== null ? stakedAt - icpStarted.signedAt : null;
    data = {
      phase: staked ? 'delivered' : 'progress', ending: staked ? 'delivered' : 'pending', pay, get, refundText: null, reason: null, refund: null,
      steps: [
        { key: 'approve', label: `Approved ${start.from.symbol}`, sub: 'No gas', state: 'done', at: clockText(approvedAt) },
        staked
          ? { key: 'stake', label: `Staked ${amountText}`, state: 'done', ...(stakedAt !== null ? { at: clockText(stakedAt) } : {}) }
          : { key: 'stake', label: `Staking ${amountText}`, sub: 'It shows in Your stake in a moment', state: 'wait' },
      ],
      when: `${dayText(icpStarted.signedAt, Date.now())}, ${clockText(icpStarted.signedAt).slice(0, 5)}`,
      title: staked ? 'Staked' : 'Staking', text: staked ? earning : 'On its way to the pool',
      ringLogo: staked ? SWAPIC_LOGO : chainLogo(ICP_CHAIN), to: start.owner, fee: review.feeText, gas: review.gasText, orderId: '',
      totalText: staked && took !== null ? `${tookText(took)} total` : staked ? '' : 'Updating live',
    };
  }

  // once it is in, the account (and its history, the pool page's chart) is read again, every 5 s until it holds more shares
  // than right before signing; only then the line below names the new total
  const before = started.accountBefore;
  const after = useQuery({
    queryKey: ['account', start.owner],
    queryFn: () => getAccount(start.owner),
    enabled: !!staked,
    refetchInterval: (q) => (before !== null && q.state.data && BigInt(q.state.data.shares) > before ? false : 5_000),
  });
  const fresh = !!staked && before !== null && !!after.data && BigInt(after.data.shares) > before;
  const asked = React.useRef(false);
  React.useEffect(() => {
    if (!staked || asked.current) return;
    asked.current = true;
    void qc.invalidateQueries({ queryKey: ['account', start.owner] });
    void qc.invalidateQueries({ queryKey: ['account-history', start.owner] });
  }, [staked, qc, start.owner]);
  const { stakes } = useMyStakes();
  const total = combine(stakes).valueUsdc;

  // the ring: toward the order's ETA from EVM, a short fill from ICP; closed only when the record says it is in
  const etaAt = evm && status ? (status as OrderStatusAnswer).etaAt ?? null : null;
  const fillFor = React.useMemo(() => (etaAt ? Math.max(1, etaAt - Math.floor(Date.now() / 1000)) : 2.5), [etaAt]);
  const done = data.steps.filter((s) => s.state === 'done').length;
  const progress = etaAt ? RING_MOVING : data.steps.length ? 0.25 + ((RING_MOVING - 0.25) * done) / data.steps.length : 0.25;

  const rows: [string, React.ReactNode][] = [
    ...(evm ? [['Order ID', <React.Fragment key="id"><span className="font-mono font-normal">{short(started.orderId)}</span><CopyButton id="id" copied={copied} onCopy={copy} text={started.orderId} /></React.Fragment>] as [string, React.ReactNode]] : []),
    ['From wallet', <span key="from" className="font-mono font-normal">{short(start.owner)}</span>],
    ['Fee', data.fee],
    ['Gas', data.gas],
  ];
  return (
    <SwapStatus
      data={data}
      ring={{ progress, fillFor, refunding: data.steps.some((s) => s.state === 'fail') }}
      text={{
        title: 'Your stake',
        paid: 'You staked',
        get: 'Added to your stake',
        rows,
        note: fresh ? (
          <Note calm icon={<CheckIcon />}>Your stake is now {formatUsd(total)}{apy ? `, earning ${apy} APY` : ''}.</Note>
        ) : (
          <Note calm tone="blue" icon={<ClockIcon width={16} height={16} />}>You can leave this page. Your stake shows in History.</Note>
        ),
        action: (
          <div className="flex w-full items-center gap-x-2">
            <button onClick={onMore} className={cn(QUIET, 'h-12 shrink-0 px-4')}>
              <PlusIcon width={20} height={20} />Stake more
            </button>
            <ActionButton isDisabled={false} onClick={onPool}>Back to pool</ActionButton>
          </div>
        ),
      }}
    />
  );
}
