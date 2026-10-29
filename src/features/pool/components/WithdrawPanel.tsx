'use client';
// Withdraw: moved from the design's pool-screens.tsx WithdrawPanel (the approved static look; its body has no motion part,
// drawn in the app's static TwoColumn), wired to data. A stake pays out where its wallet lives (contract section 2): when
// both wallets hold one, WithdrawPick asks which first. The EVM stake: the 25/50/75/Max chips of it, Receive on as USDC on
// an EVM chain (the canister's address, plan check C4), You receive from the withdraw quote asked 600 ms after the amount
// settles and checked as it will be signed (checkWithdrawQuote), then one signature (executeWithdrawEvm) and the status
// page. The ICP stake: ckUSDC on ICP less one ledger fee, then withdraw_icp (executeWithdrawIcp) and back to the pool.
// It reads `amount` from the link once (PoolFlow).
// Motion (approved 2026-10-29, part 2): a view of the Pool's in place panel (PoolFlow). The stake card flies into the
// amount card; the percent chips' light pill slides to the one picked; while the wallet asks, the button reads "Confirm in
// your wallet" with a soft glow, and a "no" in the wallet brings it back with "You cancelled in your wallet.".
import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { TokenCard } from '@/components/ui/token-card';
import { Avatar } from '@/components/ui/avatar';
import AmountCard from '@/components/design/AmountCard';
import { ResultCard } from '@/components/design/ResultCard';
import { Note } from '@/components/design/Note';
import { TwoColumn } from '@/components/design/TwoColumn';
import { ConfirmButton } from '@/components/motion/parts';
import { SWAPIC_LOGO } from '@/components/design/swapic-logo';
import { CheckIcon, ClockIcon } from '@/components/icons';
import type { UiToken } from '@/components/ui/token-types';
import { postWithdraw, postWithdrawQuote, userMessage, type WithdrawRequest } from '@/lib/api';
import { short, tokenAmountText } from '@/lib/copy/format';
import { chainNumber } from '@/lib/explorer';
import { icpClient } from '@/lib/icp';
import { formatUnits, formatUsd, parseUnits, percentOf } from '@/lib/money';
import { cn } from '@/lib/cn';
import { fade, tw } from '@/lib/motion';
import { useEvmConnect, useEvmSigner, useIcpCaller, useIcpConnect, useWallets } from '@/lib/wallets';
import type { ExecOutcome } from '@/features/swap/execute';
import { GuardError, GUARD_MESSAGE } from '@/features/swap/guards/errors';
import { useGuardContext } from '@/features/swap/quote';
import { usePool, type MyStake } from '../data';
import { CKUSDC, executeWithdrawEvm, executeWithdrawIcp, POOL_PAUSED } from '../flows';
import { USDC_LOGO } from '../usdc';
import { usedNonces } from '../used-nonces';
import { checkWithdrawQuote, type CheckedWithdraw } from '../withdraw-sig';
import { SlidingPill, STAKE_CARD } from './parts';

const BASE = 'eip155:8453';
/** The design's order of an EVM stake's payout chains: Base first (the payout leaves from Base, so it is the quickest). */
export const PAYOUT_ORDER = ['eip155:8453', 'eip155:42161', 'eip155:1', 'eip155:137'];
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

/** Withdraw from one stake: `amountText` is the flow's (it outlives Receive on); `onStarted` hears the started payout. */
export function WithdrawPanel({ stake, named, to, amountText, onAmountText, onBack, onPickTo, onStarted }: {
  stake: MyStake | undefined; named: boolean; to: UiToken | null; amountText: string; onAmountText: (t: string) => void;
  onBack: () => void; onPickTo: () => void; onStarted: (activityId: string) => void;
}) {
  const qc = useQueryClient();
  const { evm, icp: icpWallet } = useWallets();
  const signer = useEvmSigner();
  const caller = useIcpCaller();
  const openEvm = useEvmConnect();
  const openIcp = useIcpConnect();
  const pool = usePool().data;
  const guard = useGuardContext();
  const fromIcp = stake?.kind === 'icp';
  const wallet = fromIcp ? !!icpWallet : !!evm;
  const total = stake?.valueUsdc ?? 0n;
  const setAmountText = onAmountText;
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);
  // the wallet is asking right now (a flow step waits on it): the button glows; a "no" there shows the cancelled line
  const [asking, setAsking] = React.useState(false);
  const [cancelled, setCancelled] = React.useState(false);

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
  if (!fromIcp && evm && to && dstUsdc && stake && !closed) {
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
  // an ICP stake pays ckUSDC less the payout's ledger fee (the canister takes every ledger fee out of the amount)
  const fee = useQuery({ queryKey: ['ledger-fee', CKUSDC], queryFn: () => icpClient().ledgerFee(CKUSDC), enabled: fromIcp, staleTime: 600_000 }).data;
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
  const asks = !fromIcp && !!evm && !!to && !!stake && !closed && amount !== null && amount > 0n && !overStake;
  const loading = asks && (typed !== amountText || (!!request && q.isFetching && !q.data));
  const quoteError = q.error ? userMessage(q.error) : checkError;
  const message = overStake ? 'This is more than your stake' : amountError ?? quoteError ?? undefined;

  const nowSec = Math.floor(Date.now() / 1000);
  const icpView = fromIcp && amount !== null && amount > 0n && fee !== undefined && !overStake ? { receive: amount > fee ? amount - fee : 0n, fee } : null;
  const arrives = icpView ? 'Right away' : !checked ? '' : checked.queued
    ? checked.queueEtaAt === null ? 'In line' : `In line, about ${minutes(checked.queueEtaAt, nowSec)} min`
    : checked.etaSeconds < 90 ? 'Right away' : `About ${Math.round(checked.etaSeconds / 60)} min`;
  const ready = (fromIcp ? !!icpView && !!caller : !!checked && !loading && !!signer) && !closed && !overStake && !amountError;
  const label = amount === null || amount === 0n ? 'Set token amount to continue' : !wallet ? 'Connect wallet' : busy ? undefined : fromIcp ? 'Withdraw' : 'Sign withdrawal';
  const enabled = busy || (!wallet && amount !== null && amount > 0n) || ready;

  const after = (out: ExecOutcome) => {
    setBusy(false);
    setAsking(false);
    if (out.kind === 'started') {
      void qc.invalidateQueries({ queryKey: ['account', stake?.owner] });
      setBusy(true);
      onStarted(out.activityId);
    } else if (out.kind === 'rejected') setCancelled(true);
    else if (out.kind === 'failed' || out.kind === 'unknown') setNote(out.message);
  };
  const onSign = async () => {
    if (busy) return;
    if (!wallet) { void (fromIcp ? openIcp() : openEvm()); return; }
    setCancelled(false);
    if (!ready || !to || amount === null) return;
    setBusy(true);
    setNote(null);
    const onStep = (_: number, st: 'wait' | 'done' | 'fail') => setAsking(st === 'wait');
    if (fromIcp) {
      after(await executeWithdrawIcp({ wanted: amount, caller: caller!, onStep }, icpClient()));
      return;
    }
    after(await executeWithdrawEvm(
      { usdc: amount, dstChain: to.chain, evm: signer!, onStep },
      { icp: icpClient(), postWithdrawQuote, postWithdraw, nowMs: () => Date.now(), used: usedNonces },
    ));
  };

  const where = to?.chainName ?? '';
  const queuedNote = checked?.queued
    ? checked.queueEtaAt === null ? 'Your withdrawal waits in line and pays out by itself.' : `Your withdrawal waits in line and pays out in about ${minutes(checked.queueEtaAt, nowSec)} min.`
    : null;
  return (
    <TwoColumn
      inPlace
      title="Withdraw"
      onBack={onBack}
      // inside the in place panel each part fades (TwoColumn: callers fade their own parts)
      left={
        <motion.div variants={fade} className="flex w-full flex-col">
          {/* the stake card flies into this card when Withdraw opens */}
          <AmountCard
            fly={STAKE_CARD}
            label={named && stake ? `Withdraw from ${short(stake.owner)}` : 'Withdraw from your stake'}
            token={{ logo: USDC_LOGO, chainLogo: SWAPIC_LOGO }}
            amountText={amountText}
            onAmountText={(t) => { setAmountText(t); setNote(null); setCancelled(false); }}
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
                  onClick={() => { setAmountText(formatUnits(v, 6).replace(/,/g, '')); setNote(null); setCancelled(false); }}
                  className={cn(
                    'relative flex h-8 flex-1 cursor-pointer items-center justify-center rounded-full text-xs',
                    tw.quick,
                    tw.press,
                    on ? 'font-semibold text-[#0A0A0B]' : 'bg-[#565656] text-white/70 hover:bg-[#6a6a6a]',
                  )}
                >
                  {/* the light pill slides to the chip picked */}
                  {on && <SlidingPill id="withdraw-percent" />}
                  <span className="relative">{p === 100 ? 'Max' : `${p}%`}</span>
                </span>
              );
            })}
          </div>
          <div className="mt-4">
            <TokenCard token={to ?? undefined} customOnClick={onPickTo} label="Receive on" className="max-h-min py-5 active:scale-[0.98] md:max-h-min md:rounded-3xl md:py-5" />
          </div>
          {note && <p className="mt-2 animate-slide-in-from-top text-xs text-yellow-600">{note}</p>}
        </motion.div>
      }
      right={
        <motion.div variants={fade} className="flex w-full flex-col gap-y-4 lg:flex-1">
          <ResultCard
            label="You receive"
            loading={loading}
            avatar={<Avatar src={USDC_LOGO} className="h-12 w-12" />}
            big={fromIcp
              ? `~${icpView ? tokenAmountText(icpView.receive, 6, 'USDC') : '0.00'} ckUSDC on ICP`
              : `~${checked ? tokenAmountText(checked.expectedOut, 6, 'USDC') : '0.00'} USDC on ${where}`}
            small={`From your stake of ${formatUsd(total)}`}
            rows={[
              ['Fee', icpView ? formatUsd(icpView.fee) : checked ? formatUsd(checked.feeUsdc) : '$0.00'],
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
          ) : fromIcp ? (
            <Note icon={<CheckIcon />}>Your ICP wallet asks you to confirm. No gas. The ckUSDC arrives right away.</Note>
          ) : (
            <Note icon={<CheckIcon />}>One signature, no gas. The USDC arrives in your wallet by itself.</Note>
          )}
        </motion.div>
      }
      action={<ConfirmButton label={label} waiting={asking} cancelled={cancelled} disabled={!enabled} onClick={() => void onSign()} />}
    />
  );
}
