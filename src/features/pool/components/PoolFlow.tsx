'use client';
// The Pool tab's one panel (the approved prototype, design pool-screens.tsx PoolFlowScreen, motion part 2): the pool page,
// Stake, Stake From, the stake pick, Withdraw, Receive on and the withdrawal's status change in place (MorphFrame). The
// skeleton fades out to the pool page; Stake and Withdraw open with the stake card flying into their card; a signed
// withdrawal shows its steps checking in as its record says; back on the pool page its line opens calmly in Your stake.
// /pool, /pool/stake and /pool/withdraw open it on their view; the link stays as it was loaded while the views change
// (a shared /pool/stake?amount=… link still opens Stake with that amount).
import * as React from 'react';
import type { UiToken } from '@/components/ui/token-types';
import { MorphFrame } from '@/components/motion/parts';
import { formatUnits } from '@/lib/money';
import { useQueryOnce } from '@/lib/use-query-once';
import { useWallets } from '@/lib/wallets';
import { TokenSelect } from '@/features/swap/components/TokenSelect';
import { parseTokenKey, tokenKeyOf } from '@/features/swap/link';
import { useMyStakes, usePool, type MyStake } from '../data';
import { defaultStakeFrom } from '../stake-from';
import { CKUSDC_TOKEN, useUsdcTokens } from '../usdc';
import { PoolLoading, PoolPanel } from './PoolPanel';
import { ReceiveOnPicker } from './ReceiveOnPicker';
import { StakePanel } from './StakePanel';
import { PAYOUT_ORDER, WithdrawPanel } from './WithdrawPanel';
import { WithdrawPick } from './WithdrawPick';
import { WithdrawStatus } from './WithdrawStatus';

/**
 * The Pool's views. A review step before signing goes in as one more name here (between stake or withdraw and the
 * wallet step) and one more row in POOL_LAYOUT; nothing else in the frame changes.
 */
export type PoolView = 'pool' | 'stake' | 'stakeFrom' | 'withdrawPick' | 'withdraw' | 'receiveOn' | 'status';
type Shown = PoolView | 'loading';

const TWO_COLUMN_FRAME = 'h-full md:h-fit md:w-full md:max-w-[537px] lg:max-w-[1060px] overflow-x-hidden';
const NARROW_FRAME = 'md:w-full md:max-w-[537px]';
/** Each view's panel size and layout in the one panel (the design's POOL_LAYOUT; widths and heights glide). */
const POOL_LAYOUT: Record<Shown, { frame: string; view?: string }> = {
  loading: { frame: 'md:w-full md:max-w-[1204px] md:max-h-[789px]' },
  pool: { frame: 'md:w-full md:max-w-[1204px] md:max-h-[740px] md:overflow-y-hidden', view: 'gap-y-6 md:max-h-[740px] md:flex-row md:items-start md:gap-x-16' },
  stake: { frame: TWO_COLUMN_FRAME },
  stakeFrom: { frame: NARROW_FRAME },
  withdrawPick: { frame: NARROW_FRAME },
  withdraw: { frame: TWO_COLUMN_FRAME },
  receiveOn: { frame: NARROW_FRAME },
  status: { frame: NARROW_FRAME },
};

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
  const go = (v: PoolView, fresh: number | null = null) => { setFreshPayout(fresh); setView(v); };

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
  // the pool page waits on the pool and the stakes (the skeleton until then); Withdraw on the stakes (which panel opens
  // depends on both wallets' accounts), drawn as nothing until they answer the first time
  const opened = React.useRef(false);
  const withdrawing = resolved === 'withdraw' || resolved === 'withdrawPick' || resolved === 'receiveOn';
  if (withdrawing && loading && !opened.current) return null;
  opened.current = true;
  const shown: Shown = resolved === 'pool' && (!pool.data || loading) ? 'loading' : resolved;
  const L = POOL_LAYOUT[shown];

  const body = (): React.ReactNode => {
    switch (shown) {
      case 'loading':
        return <PoolLoading />;
      case 'pool':
        return <PoolPanel freshPayout={freshPayout} onStake={() => go('stake')} onWithdraw={() => go('withdrawPick')} />;
      case 'stake':
        return <StakePanel from={from} amountText={stakeAmount} onAmountText={setStakeAmount} onPickFrom={() => from && go('stakeFrom')} onBack={() => go('pool')} onDone={() => go('pool')} />;
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
            // an ICP payout is paid at once: back to the pool page; an EVM one shows its steps
            onStarted={(id) => { if (icpStake) go('pool'); else { setStatusId(id); go('status'); } }}
          />
        );
      case 'status':
        return statusId ? <WithdrawStatus id={statusId} onBack={() => go('pool', payoutIdOf(statusId))} /> : null;
    }
  };

  return (
    <MorphFrame view={shown} frameClass={L.frame} viewClass={L.view}>
      {() => body()}
    </MorphFrame>
  );
}
