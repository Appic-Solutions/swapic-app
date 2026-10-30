'use client';
// The Pool tab's one panel (the approved prototype, design pool-screens.tsx PoolFlowScreen, motion part 2): the pool page,
// Stake, Stake From, the stake pick, Withdraw, Receive on and the withdrawal's status change in place (MorphFrame). The
// skeleton fades out to the pool page; Stake and Withdraw open with the stake card flying into their card; a signed
// withdrawal shows its steps checking in as its record says; back on the pool page its line opens calmly in Your stake.
// /pool, /pool/stake and /pool/withdraw open it on their view, and the link follows the view: opening Stake or Withdraw in
// place pushes its path (the browser's native history, which Next follows: the panel stays mounted), so Back returns to
// the previous view and a refresh reopens it; the pickers and the status keep their parent's path. A shared
// /pool/stake?amount=… link still opens Stake with that amount. A click on the Pool tab goes back to the pool page.
// Review stake, Your stake and Review withdrawal (approved 2026-10-30) come between Stake or Withdraw and the wallet step:
// into and out of them, and the withdrawal's steps, the panel changes with the calm fade (the whole old view out, then the
// whole new one in, the panel easing to its size; nothing flies). They keep their parent's path.
import * as React from 'react';
import { usePathname } from 'next/navigation';
import { motion } from 'motion/react';
import type { UiToken } from '@/components/ui/token-types';
import { MorphFrame } from '@/components/motion/parts';
import { formatUnits } from '@/lib/money';
import { T } from '@/lib/motion';
import { useQueryOnce } from '@/lib/use-query-once';
import { useWallets } from '@/lib/wallets';
import { useNavReset } from '@/lib/nav-tab';
import { TokenSelect } from '@/features/swap/components/TokenSelect';
import { parseTokenKey, tokenKeyOf } from '@/features/swap/link';
import { useQueryClient } from '@tanstack/react-query';
import { tiles, useMyStakes, usePool, type MyStake } from '../data';
import type { StakeReview as StakeReviewData } from '../review';
import { defaultStakeFrom } from '../stake-from';
import { CKUSDC_TOKEN, useUsdcTokens } from '../usdc';
import { PoolLoading, PoolPanel } from './PoolPanel';
import { ReceiveOnPicker } from './ReceiveOnPicker';
import { StakePanel } from './StakePanel';
import { StakeReview, type StakeStart, type StakeStarted } from './StakeReview';
import { StakeStatus } from './StakeStatus';
import { WithdrawReview, type WithdrawStart } from './WithdrawReview';
import { PAYOUT_ORDER, WithdrawPanel } from './WithdrawPanel';
import { WithdrawPick } from './WithdrawPick';
import { WithdrawStatus } from './WithdrawStatus';

/** The Pool's views: each is one name here, one row in POOL_LAYOUT and one path in PATH. */
export type PoolView = 'pool' | 'stake' | 'stakeFrom' | 'stakeReview' | 'stakeStatus' | 'withdrawPick' | 'withdraw' | 'receiveOn' | 'withdrawReview' | 'status';
/** Into and out of these views the panel changes with the calm fade (Jeff's pick, motion rows 68 to 73): nothing flies. */
const CALM_VIEWS: PoolView[] = ['stakeReview', 'stakeStatus', 'withdrawReview', 'status'];

const TWO_COLUMN_FRAME = 'h-full md:h-fit md:w-full md:max-w-[537px] lg:max-w-[1060px] overflow-x-hidden';
const NARROW_FRAME = 'md:w-full md:max-w-[537px]';
/** Each view's panel size and layout in the one panel (the design's POOL_LAYOUT; widths and heights glide). */
const POOL_LAYOUT: Record<PoolView, { frame: string; view?: string }> = {
  pool: { frame: 'md:w-full md:max-w-[1204px] md:max-h-[740px] md:overflow-y-hidden', view: 'gap-y-6 md:max-h-[740px] md:flex-row md:items-start md:gap-x-16' },
  stake: { frame: TWO_COLUMN_FRAME },
  stakeFrom: { frame: NARROW_FRAME },
  stakeReview: { frame: TWO_COLUMN_FRAME },
  stakeStatus: { frame: TWO_COLUMN_FRAME },
  withdrawPick: { frame: NARROW_FRAME },
  withdraw: { frame: TWO_COLUMN_FRAME },
  receiveOn: { frame: NARROW_FRAME },
  withdrawReview: { frame: TWO_COLUMN_FRAME },
  status: { frame: NARROW_FRAME },
};

/** Each view's path: Stake and Withdraw have their own; pickers, the reviews and the status pages keep their parent's. */
const PATH: Record<PoolView, string> = {
  pool: '/pool', stake: '/pool/stake', stakeFrom: '/pool/stake', stakeReview: '/pool/stake', stakeStatus: '/pool/stake',
  withdrawPick: '/pool/withdraw', withdraw: '/pool/withdraw', receiveOn: '/pool/withdraw', withdrawReview: '/pool/withdraw', status: '/pool/withdraw',
};
const bare = (p: string) => (p.length > 1 ? p.replace(/\/+$/, '') : p);
/** The view a path opens (the browser's Back and Forward). */
const viewOfPath = (p: string): PoolView => (bare(p) === '/pool/stake' ? 'stake' : bare(p) === '/pool/withdraw' ? 'withdrawPick' : 'pool');

/** The payout id in a started withdrawal's activity id (`payout-<id>`). */
const payoutIdOf = (id: string) => (/^payout-\d+$/.test(id) ? Number(id.slice(7)) : null);

export function PoolFlow({ start }: { start: 'pool' | 'stake' | 'withdraw' }) {
  const link = useQueryOnce();
  const pool = usePool();
  const { stakes, loading } = useMyStakes();
  const [view, setView] = React.useState<PoolView>(start === 'withdraw' ? 'withdrawPick' : start);
  const [statusId, setStatusId] = React.useState<string | null>(null);
  // back from a signed withdrawal: that withdrawal's waiting line (by its payout id) opens calmly in Your stake
  const [freshPayout, setFreshPayout] = React.useState<number | null>(null);
  // the view now, read by the path's effect below (set at once in show, before the path changes)
  const current = React.useRef(view);
  // a change into or out of a review or status page is calm; every way in or out comes through show (a button, the
  // browser's Back, the Pool tab)
  const [calm, setCalm] = React.useState(false);
  const show = (v: PoolView, fresh: number | null = null) => {
    setCalm(CALM_VIEWS.includes(current.current) || CALM_VIEWS.includes(v));
    current.current = v;
    setFreshPayout(fresh);
    setView(v);
  };
  const go = (v: PoolView, fresh: number | null = null) => {
    show(v, fresh);
    if (bare(window.location.pathname) !== PATH[v]) window.history.pushState(null, '', PATH[v]);
  };
  // Back and Forward (or a link that changes the path while the panel stays) open the path's view
  const pathname = usePathname();
  React.useEffect(() => {
    if (PATH[current.current] !== bare(pathname)) show(viewOfPath(pathname));
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  // a click on the Pool tab: the pool page (its link sets the path)
  useNavReset('Pool', () => show('pool'));

  // Stake: From is USDC on an EVM chain or, with the ICP wallet connected, ckUSDC on ICP; the link may name one
  // (`from=<chain>|<address>`, the swap link's exact form); else the connected chain's USDC, else Arbitrum's
  const icp = useWallets((s) => s.icp);
  const evmChain = useWallets((s) => s.evm?.chainId ?? null);
  const evmTokens = useUsdcTokens();
  const stakeTokens = React.useMemo(() => (icp ? [...evmTokens, CKUSDC_TOKEN] : evmTokens), [evmTokens, icp]);
  const [stakePicked, setStakePicked] = React.useState<UiToken | null>(null);
  const [stakeAmount, setStakeAmount] = React.useState('');
  const ref = start === 'stake' ? parseTokenKey(link?.get('from')) : null;
  const linked = ref ? stakeTokens.find((t) => t.key === tokenKeyOf(ref)) : undefined;
  const from = stakePicked ?? linked ?? defaultStakeFrom(stakeTokens, evmChain);

  // Withdraw: a stake pays out where its wallet lives; with both wallets holding one, the pick comes first
  const payoutTokens = React.useMemo(() => [...evmTokens].sort((x, y) => PAYOUT_ORDER.indexOf(x.chain) - PAYOUT_ORDER.indexOf(y.chain)), [evmTokens]);
  const live = stakes.filter((s) => s.shares > 0n);
  const both = live.length > 1;
  const [kind, setKind] = React.useState<MyStake['kind']>('evm');
  const [to, setTo] = React.useState<UiToken | null>(null);
  const [withdrawAmount, setWithdrawAmount] = React.useState('');
  // the reviews and Your stake: what Stake or Withdraw handed on, and what the stake follows once it started
  const [stakeStart, setStakeStart] = React.useState<StakeStart | null>(null);
  const [stakeStarted, setStakeStarted] = React.useState<{ s: StakeStarted; review: StakeReviewData } | null>(null);
  const [withdrawStart, setWithdrawStart] = React.useState<WithdrawStart | null>(null);
  const qc = useQueryClient();
  // leaving Your stake: the stake counts in Your stake and the chart (the account and its history read again)
  const leaveStatus = (v: PoolView) => {
    if (stakeStart) {
      void qc.invalidateQueries({ queryKey: ['account', stakeStart.owner] });
      void qc.invalidateQueries({ queryKey: ['account-history', stakeStart.owner] });
    }
    go(v);
  };
  const apy = pool.data ? tiles(pool.data).apy : null;
  const stake = both ? live.find((s) => s.kind === kind) : live[0] ?? stakes.find((s) => s.kind === 'evm');
  const icpStake = stake?.kind === 'icp';
  const receiveTokens = icpStake ? [CKUSDC_TOKEN] : payoutTokens;
  const toToken = icpStake ? CKUSDC_TOKEN : to ?? payoutTokens[0] ?? null;

  // the link's amount, once, for the panel the page opened on
  React.useEffect(() => {
    const a = link?.get('amount');
    if (!a) return;
    if (start === 'stake') setStakeAmount(a);
    if (start === 'withdraw') setWithdrawAmount(a);
  }, [link, start]);

  // one stake (or none yet): the pick is skipped
  const resolved: PoolView = view === 'withdrawPick' && !both ? 'withdraw' : view;
  // The pool page waits on the pool and the stakes: until they answer the first time it is the skeleton, drawn outside the
  // frame, and the frame fades in over it once they have (a frame view that leaves while the page is still starting up
  // could keep its exit waiting: the frame starts on a real view). Withdraw waits on the stakes (which panel opens depends
  // on both wallets' accounts), drawn as nothing until they answer the first time.
  const ready = !!pool.data && !loading;
  const opened = React.useRef(false);
  const skeleton = React.useRef(false);
  const withdrawing = resolved === 'withdraw' || resolved === 'withdrawPick' || resolved === 'receiveOn';
  if (withdrawing && loading && !opened.current) return null;
  if (resolved === 'pool' && !ready && !opened.current) { skeleton.current = true; return <PoolLoading />; }
  opened.current = true;
  const shown: PoolView = resolved;
  const L = POOL_LAYOUT[shown];

  const body = (): React.ReactNode => {
    switch (shown) {
      case 'pool':
        // the pool page opened from Stake or Withdraw before its data has answered: the skeleton in its place
        return !ready ? <PoolLoading /> : <PoolPanel freshPayout={freshPayout} onStake={() => go('stake')} onWithdraw={() => go('withdrawPick')} />;
      case 'stake':
        return <StakePanel from={from} amountText={stakeAmount} onAmountText={setStakeAmount} onPickFrom={() => from && go('stakeFrom')} onBack={() => go('pool')} onReview={(st) => { setStakeStart(st); go('stakeReview'); }} />;
      case 'stakeReview':
        return stakeStart ? (
          <StakeReview start={stakeStart} onBack={() => go('stake')} onStarted={(st, review) => { setStakeStarted({ s: st, review }); go('stakeStatus'); }} />
        ) : null;
      case 'stakeStatus':
        return stakeStart && stakeStarted ? (
          <StakeStatus
            start={stakeStart} started={stakeStarted.s} review={stakeStarted.review} apy={apy && apy !== 'Not yet' ? apy : null}
            onPool={() => leaveStatus('pool')} onMore={() => leaveStatus('stake')}
          />
        ) : null;
      case 'stakeFrom':
        return from ? (
          <TokenSelect
            title="Stake From"
            chain={from.chain}
            chains={stakeTokens.map((t) => t.chain)}
            fixedTokens={Object.fromEntries(stakeTokens.map((t) => [t.chain, [t]]))}
            selected={from}
            onBack={() => go('stake')}
            onSelect={(t) => { setStakePicked(t); go('stake'); }}
          />
        ) : null;
      case 'withdrawPick':
        return (
          <WithdrawPick
            stakes={live} picked={kind} evmChains={payoutTokens.map((t) => t.chainName)}
            onPick={(k) => { setKind(k); setTo(null); }}
            onBack={() => go('pool')}
            // Continue fills in the whole of the picked stake (the design's flow)
            onContinue={() => { const st = live.find((x) => x.kind === kind); setWithdrawAmount(st ? formatUnits(st.valueUsdc, 6).replace(/,/g, '') : ''); go('withdraw'); }}
          />
        );
      case 'receiveOn':
        return stake && toToken ? <ReceiveOnPicker stake={stake} tokens={receiveTokens} selected={toToken} onBack={() => go('withdraw')} onSelect={(t) => { setTo(t); go('withdraw'); }} /> : null;
      case 'withdraw':
        return (
          <WithdrawPanel
            key={stake?.kind ?? 'none'}
            stake={stake} named={both || icpStake} to={toToken} amountText={withdrawAmount} onAmountText={setWithdrawAmount}
            onBack={() => go(both ? 'withdrawPick' : 'pool')}
            onPickTo={() => go('receiveOn')}
            onReview={(st) => { setWithdrawStart(st); go('withdrawReview'); }}
          />
        );
      case 'withdrawReview':
        return withdrawStart ? (
          <WithdrawReview
            start={withdrawStart}
            onBack={() => go('withdraw')}
            // an ICP payout is paid at once: back to the pool page; an EVM one shows its steps
            onStarted={(id) => { if (withdrawStart.review.kind === 'icp') go('pool'); else { setStatusId(id); go('status'); } }}
          />
        ) : null;
      case 'status':
        return statusId ? <WithdrawStatus id={statusId} onBack={() => go('pool', payoutIdOf(statusId))} /> : null;
    }
  };

  const frame = (
    <MorphFrame view={shown} calm={calm} frameClass={L.frame} viewClass={L.view}>
      {() => body()}
    </MorphFrame>
  );
  // after the skeleton: the page fades in where it stood (the page fade's layout)
  return skeleton.current ? (
    <motion.div className="flex w-full md:items-center md:justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: T.enter }}>{frame}</motion.div>
  ) : frame;
}
