'use client';
// Withdraw to an EVM chain: moved from the design's pool-screens.tsx WithdrawPanel (the approved static look; its body has
// no motion part, drawn in the app's static TwoColumn), wired to data: the EVM wallet's stake (the ICP stake leaves only on
// ICP, Task 8), the 25/50/75/Max chips of it, Receive on as USDC on an EVM chain (the canister's address, plan check C4),
// You receive from the withdraw quote asked 600 ms after the amount settles and checked as it will be signed
// (checkWithdrawQuote), then one signature (executeWithdrawEvm) and the status page. It reads `amount` from the link once.
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TokenCard } from '@/components/ui/token-card';
import ActionButton from '@/components/ui/action-button';
import { Avatar } from '@/components/ui/avatar';
import AmountCard from '@/components/design/AmountCard';
import { ResultCard } from '@/components/design/ResultCard';
import { Note } from '@/components/design/Note';
import { TwoColumn } from '@/components/design/TwoColumn';
import { SWAPIC_LOGO } from '@/components/design/swapic-logo';
import { CheckIcon, ClockIcon } from '@/components/icons';
import type { UiToken } from '@/components/ui/token-types';
import { postWithdraw, postWithdrawQuote, userMessage, type WithdrawRequest } from '@/lib/api';
import { tokenAmountText } from '@/lib/copy/format';
import { chainNumber } from '@/lib/explorer';
import { icpClient } from '@/lib/icp';
import { formatUnits, formatUsd, parseUnits, percentOf } from '@/lib/money';
import { cn } from '@/lib/cn';
import { useQueryOnce } from '@/lib/use-query-once';
import { useEvmConnect, useEvmSigner, useWallets } from '@/lib/wallets';
import type { ExecOutcome } from '@/features/swap/execute';
import { GuardError, GUARD_MESSAGE } from '@/features/swap/guards/errors';
import { useGuardContext } from '@/features/swap/quote';
import { TokenSelect } from '@/features/swap/components/TokenSelect';
import { useMyStakes, usePool } from '../data';
import { executeWithdrawEvm, POOL_PAUSED } from '../flows';
import { USDC_LOGO, useUsdcTokens } from '../usdc';
import { usedNonces } from '../used-nonces';
import { checkWithdrawQuote, type CheckedWithdraw } from '../withdraw-sig';
import { WithdrawStatus } from './WithdrawStatus';

const BASE = 'eip155:8453';
const PCTS = [25, 50, 75, 100] as const;

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

const minutes = (etaAt: number, nowSec: number) => Math.max(1, Math.round((etaAt - nowSec) / 60));

export function WithdrawFlow() {
  const router = useRouter();
  const tokens = useUsdcTokens();
  const [view, setView] = React.useState<'withdraw' | 'receive' | { status: string }>('withdraw');
  const [picked, setPicked] = React.useState<UiToken | null>(null);
  // Base first: the payout leaves from Base, so it is the quickest
  const to = picked ?? tokens.find((t) => t.chain === BASE) ?? tokens[0] ?? null;
  if (typeof view === 'object') return <WithdrawStatus id={view.status} onBack={() => router.push('/pool')} />;
  if (view === 'receive' && to) {
    return (
      <TokenSelect
        title="Receive on"
        chain={to.chain}
        chains={tokens.map((t) => t.chain)}
        fixedTokens={Object.fromEntries(tokens.map((t) => [t.chain, [t]]))}
        selected={to}
        onBack={() => setView('withdraw')}
        onSelect={(t) => { setPicked(t); setView('withdraw'); }}
      />
    );
  }
  return <WithdrawPanel to={to} onPickTo={() => setView('receive')} onStarted={(id) => setView({ status: id })} />;
}

function WithdrawPanel({ to, onPickTo, onStarted }: { to: UiToken | null; onPickTo: () => void; onStarted: (activityId: string) => void }) {
  const router = useRouter();
  const qc = useQueryClient();
  const link = useQueryOnce();
  const evm = useWallets((s) => s.evm);
  const signer = useEvmSigner();
  const openEvm = useEvmConnect();
  const pool = usePool().data;
  const guard = useGuardContext();
  const { stakes } = useMyStakes();
  const stake = stakes.find((s) => s.kind === 'evm');
  const total = stake?.valueUsdc ?? 0n;
  const [amountText, setAmountText] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);

  React.useEffect(() => {
    const a = link?.get('amount');
    if (a) setAmountText(a);
  }, [link]);

  let amount: bigint | null = null;
  let amountError: string | null = null;
  if (amountText) {
    try {
      amount = parseUnits(amountText, 6);
    } catch (e) {
      amountError = (e as Error).message;
    }
  }
  const closed = pool ? !pool.open : false;
  const overStake = amount !== null && !!stake && amount > total;

  // the quote: 600 ms after the amount settles, for this wallet as staker and recipient, in the canister's USDC of that chain
  const typed = useDebounced(amountText, 600);
  const dstUsdc = to ? guard?.config.chains.get(chainNumber(to.chain))?.usdc : undefined;
  let request: WithdrawRequest | null = null;
  if (evm && to && dstUsdc && stake && !closed) {
    try {
      const a = parseUnits(typed, 6);
      if (a > 0n && a <= total) request = { staker: evm.address, usdc: a.toString(), dstChain: to.chain, recipient: evm.address, tokenOut: dstUsdc };
    } catch { /* the amount line says why */ }
  }
  const q = useQuery({
    queryKey: ['withdraw-quote', request],
    queryFn: () => postWithdrawQuote(request!),
    enabled: !!request,
    staleTime: 0,
    gcTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: () => (typeof document !== 'undefined' && document.visibilityState === 'visible' ? 30_000 : false),
  });
  const state = useQuery({ queryKey: ['pool-state'], queryFn: () => icpClient().poolState(), staleTime: 30_000 });
  // checked exactly as it will be signed: a quote that fails here never shows numbers
  let checked: CheckedWithdraw | null = null;
  let checkError: string | null = null;
  if (q.data && request && guard && state.data) {
    try {
      const cfg = guard.config;
      checked = checkWithdrawQuote({
        answer: q.data, staker: evm!.address, usdc: BigInt(request.usdc), dstChainId: chainNumber(request.dstChain), dstUsdc,
        poolChain: cfg.poolChain, swapic: cfg.poolChain === null ? undefined : cfg.chains.get(cfg.poolChain)?.swapic,
        totalAssets: state.data.totalAssets, totalShares: state.data.totalShares, nowSec: Math.floor(Date.now() / 1000), used: usedNonces.has,
      });
    } catch (e) {
      checkError = e instanceof GuardError ? GUARD_MESSAGE : userMessage(e);
    }
  }
  const asks = !!evm && !!to && !!stake && !closed && amount !== null && amount > 0n && !overStake;
  const loading = asks && (typed !== amountText || (!!request && q.isFetching && !q.data));
  const quoteError = q.error ? userMessage(q.error) : checkError;
  const message = overStake ? 'This is more than your stake' : amountError ?? quoteError ?? undefined;

  const nowSec = Math.floor(Date.now() / 1000);
  const arrives = !checked ? '' : checked.queued
    ? checked.queueEtaAt === null ? 'In line' : `In line, about ${minutes(checked.queueEtaAt, nowSec)} min`
    : checked.etaSeconds < 90 ? 'Right away' : `About ${Math.round(checked.etaSeconds / 60)} min`;
  const ready = !!checked && !loading && !closed && !overStake && !amountError && !!signer;
  const label = amount === null || amount === 0n ? 'Set token amount to continue' : !evm ? 'Connect wallet' : busy ? undefined : 'Sign withdrawal';
  const enabled = busy || (!evm && amount !== null && amount > 0n) || ready;

  const after = (out: ExecOutcome) => {
    setBusy(false);
    if (out.kind === 'started') {
      void qc.invalidateQueries({ queryKey: ['account', evm?.address] });
      onStarted(out.activityId);
    } else if (out.kind === 'failed' || out.kind === 'unknown') setNote(out.message);
  };
  const onSign = async () => {
    if (busy) return;
    if (!evm) { void openEvm(); return; }
    if (!ready || !signer || !to || amount === null) return;
    setBusy(true);
    setNote(null);
    after(await executeWithdrawEvm(
      { usdc: amount, dstChain: to.chain, evm: signer, onStep: () => {} },
      { icp: icpClient(), postWithdrawQuote, postWithdraw, nowMs: () => Date.now(), used: usedNonces },
    ));
  };

  const where = to?.chainName ?? '';
  const queuedNote = checked?.queued
    ? checked.queueEtaAt === null ? 'Your withdrawal waits in line and pays out by itself.' : `Your withdrawal waits in line and pays out in about ${minutes(checked.queueEtaAt, nowSec)} min.`
    : null;
  return (
    <TwoColumn
      title="Withdraw"
      onBack={() => router.push('/pool')}
      left={
        <>
          <AmountCard
            label="Withdraw from your stake"
            token={{ logo: USDC_LOGO, chainLogo: SWAPIC_LOGO }}
            amountText={amountText}
            onAmountText={(t) => { setAmountText(t); setNote(null); }}
            usdText={amount === null ? null : formatUsd(amount)}
            balanceText={stake ? tokenAmountText(total, 6, 'USDC') : undefined}
            onMax={() => setAmountText(formatUnits(total, 6).replace(/,/g, ''))}
            message={message}
          />
          <div className="mt-3 flex items-center gap-2.5">
            {PCTS.map((p) => {
              const v = percentOf(total, p);
              const on = amount !== null && v === amount && total > 0n;
              return (
                <span
                  key={p}
                  onClick={() => { setAmountText(formatUnits(v, 6).replace(/,/g, '')); setNote(null); }}
                  className={cn(
                    'flex h-8 flex-1 cursor-pointer items-center justify-center rounded-full text-xs transition-colors duration-200 active:scale-95',
                    on ? 'border border-[#e9ddf9] bg-white/70 font-semibold text-[#0A0A0B]' : 'bg-[#565656] text-white/70 hover:bg-[#6a6a6a]',
                  )}
                >
                  {p === 100 ? 'Max' : `${p}%`}
                </span>
              );
            })}
          </div>
          <div className="mt-4">
            <TokenCard token={to ?? undefined} customOnClick={onPickTo} label="Receive on" className="max-h-min py-5 active:scale-[0.98] md:max-h-min md:rounded-3xl md:py-5" />
          </div>
          {note && <p className="mt-2 animate-slide-in-from-top text-xs text-yellow-600">{note}</p>}
        </>
      }
      right={
        <>
          <ResultCard
            label="You receive"
            loading={loading}
            avatar={<Avatar src={USDC_LOGO} className="h-12 w-12" />}
            big={`~${checked ? tokenAmountText(checked.expectedOut, 6, 'USDC') : '0.00'} USDC on ${where}`}
            small={`From your stake of ${formatUsd(total)}`}
            rows={[
              ['Fee', checked ? formatUsd(checked.feeUsdc) : '$0.00'],
              ['Arrives', arrives],
              ['Exit fee', 'None', 'green'],
            ]}
          />
          {closed ? (
            <Note tone="yellow" icon={<ClockIcon width={18} height={18} />}>{POOL_PAUSED}</Note>
          ) : queuedNote ? (
            <>
              <Note tone="blue" icon={<ClockIcon width={18} height={18} />}>{queuedNote}</Note>
              {to && to.chain !== BASE && (
                <p className="px-2 text-xs text-[#898989]">
                  While it waits, the cost of sending it to {where} can change. If it cannot be paid in full in time, your stake comes back.
                </p>
              )}
            </>
          ) : (
            <Note icon={<CheckIcon />}>One signature, no gas. The USDC arrives in your wallet by itself.</Note>
          )}
        </>
      }
      action={<ActionButton isDisabled={!enabled} onClick={enabled ? () => void onSign() : undefined}>{label}</ActionButton>}
    />
  );
}
