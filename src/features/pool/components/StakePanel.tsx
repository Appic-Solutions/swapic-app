'use client';
// Stake: moved from the design's pool-screens.tsx StakePanel (the approved static look; the design bundle built 2026-10-29
// 14:46 was rebuilt with the motion pass before this task, so the body is the current source with no motion part in it, in
// the app's static TwoColumn), wired to data: From is USDC on an EVM chain (the address from the canister's get_config, plan
// check C4; the chain's name and logo from GET /v2/chains), the amount with the wallet's balance, Added to your stake from a
// stake quote asked 600 ms after typing, the room under the cap checked before any quote, and the button running the
// checked swap flow (executeStakeEvm). It reads `amount` from the link once (useQueryOnce), as the screenshots do.
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TokenCard } from '@/components/ui/token-card';
import ActionButton from '@/components/ui/action-button';
import AmountCard from '@/components/design/AmountCard';
import { ResultCard } from '@/components/design/ResultCard';
import { Note } from '@/components/design/Note';
import { TwoColumn } from '@/components/design/TwoColumn';
import { ClockIcon, FireIcon } from '@/components/icons';
import type { UiToken } from '@/components/ui/token-types';
import { ApiError, getOrders, getQuote, postStakeQuote, submitGasless, userMessage, type StakeRequest } from '@/lib/api';
import { icpClient } from '@/lib/icp';
import { formatAmount, formatUnits, formatUsd, formatUsdWhole, parseUnits } from '@/lib/money';
import { useQueryOnce } from '@/lib/use-query-once';
import { useEvmConnect, useEvmSigner, useWallets } from '@/lib/wallets';
import type { ExecOutcome } from '@/features/swap/execute';
import { useGuardContext } from '@/features/swap/quote';
import { TokenSelect } from '@/features/swap/components/TokenSelect';
import { useBalance } from '@/features/swap/tokens';
import { tiles, usePool } from '../data';
import { USDC_LOGO, useUsdcTokens } from '../usdc';
import { StakeAvatar } from './parts';
import { executeStakeEvm, pickStakeOption, POOL_PAUSED, stakeRoom, stakeView } from '../flows';

const ARBITRUM = 'eip155:42161';
const NO_ROUTE = 'No route found for this amount';

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function StakeFlow() {
  const [picking, setPicking] = React.useState(false);
  const tokens = useUsdcTokens();
  const [picked, setPicked] = React.useState<UiToken | null>(null);
  // the design opens on USDC on Arbitrum
  const from = picked ?? tokens.find((t) => t.chain === ARBITRUM) ?? tokens[0] ?? null;
  if (picking && from) {
    return (
      <TokenSelect
        title="Stake From"
        chain={from.chain}
        chains={tokens.map((t) => t.chain)}
        fixedTokens={Object.fromEntries(tokens.map((t) => [t.chain, [t]]))}
        selected={from}
        onBack={() => setPicking(false)}
        onSelect={(t) => { setPicked(t); setPicking(false); }}
      />
    );
  }
  return <StakePanel from={from} onPickFrom={() => setPicking(true)} />;
}

function StakePanel({ from, onPickFrom }: { from: UiToken | null; onPickFrom: () => void }) {
  const router = useRouter();
  const qc = useQueryClient();
  const link = useQueryOnce();
  const evm = useWallets((s) => s.evm);
  const signer = useEvmSigner();
  const openEvm = useEvmConnect();
  const pool = usePool().data;
  const guardReady = !!useGuardContext();
  const [amountText, setAmountText] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);
  const [resume, setResume] = React.useState<(() => Promise<ExecOutcome>) | null>(null);

  React.useEffect(() => {
    const a = link?.get('amount');
    if (a) setAmountText(a);
  }, [link]);

  let amount: bigint | null = null;
  let amountError: string | null = null;
  if (from && amountText) {
    try {
      amount = parseUnits(amountText, from.decimals);
    } catch (e) {
      amountError = (e as Error).message;
    }
  }
  const { balance, loading: balanceLoading } = useBalance(from);
  const room = pool ? stakeRoom(pool) : null;
  const closed = pool ? !pool.open : false;
  const capped = amount !== null && room !== null && amount > room;
  const smart = evm?.smartWallet === true;
  const overBalance = amount !== null && balance !== undefined && amount > balance;

  // the stake quote: 600 ms after typing, only under the room (the quoter refuses past the cap), for the paying wallet as owner
  const typed = useDebounced(amountText, 600);
  let request: StakeRequest | null = null;
  if (from && evm && pool && !closed && !smart && room !== null) {
    try {
      const a = parseUnits(typed, from.decimals);
      if (a > 0n && a <= room) request = { fromChain: from.chain, fromToken: from.address, amount: a.toString(), owner: evm.address, payer: evm.address };
    } catch { /* the amount line says why */ }
  }
  const q = useQuery({
    queryKey: ['stake-quote', request],
    queryFn: () => postStakeQuote(request!),
    enabled: !!request,
    staleTime: 0,
    gcTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: () => (typeof document !== 'undefined' && document.visibilityState === 'visible' ? 20_000 : false),
  });
  const option = q.data ? pickStakeOption(q.data) : undefined;
  const view = option ? stakeView(option) : null;
  // skeletons from the moment an amount that will be quoted is typed until its quote answers (the design's loading card)
  const asks = !!from && !!evm && !!pool && !closed && !smart && amount !== null && amount > 0n && !capped;
  const loading = asks && (typed !== amountText || (!!request && q.isFetching && !q.data));
  const quoteError = q.error ? (q.error instanceof ApiError && q.error.code === 'no_route' ? NO_ROUTE : userMessage(q.error)) : q.data && !option ? NO_ROUTE : null;

  const message = overBalance && from ? `Not enough ${from.symbol} in your wallet` : amountError ?? quoteError ?? undefined;
  const ready = amount !== null && amount > 0n && !capped && !closed && !smart && !overBalance && !!view && !amountError && guardReady;
  const label = amount === null || amount === 0n
    ? 'Set token amount to continue'
    : capped && room !== null
      ? `Up to ${formatUsdWhole(room)} right now`
      : !evm
        ? 'Connect wallet'
        : busy
          ? undefined
          : resume
            ? 'Try again'
            : `Stake ${formatUnits(amount, from!.decimals)} ${from!.symbol}`;

  const after = (out: ExecOutcome) => {
    setBusy(false);
    setResume(null);
    if (out.kind === 'started') {
      void qc.invalidateQueries({ queryKey: ['account', evm?.address] });
      router.push('/pool');
    } else if (out.kind === 'failed') setNote(out.message);
    else if (out.kind === 'unknown') { setNote(out.message); setResume(() => out.resume); }
    else if (out.kind === 'newPrice') { setNote('The amount added changed. Check it and stake again.'); void q.refetch(); }
  };
  const onStake = async () => {
    if (busy) return;
    if (!evm) { void openEvm(); return; }
    if (resume) { setBusy(true); after(await resume()); return; }
    if (!ready || !signer || !from || amount === null || !view) return;
    setBusy(true);
    setNote(null);
    after(await executeStakeEvm(
      { from, amount, evm: signer, shownAdded: view.added, onStep: () => {} },
      { getQuote, getOrders, submitGasless, postStakeQuote, icp: icpClient(), nowMs: () => Date.now(), sleep: (ms) => new Promise((r) => setTimeout(r, ms)) },
    ));
  };

  const apy = pool ? tiles(pool).apy : null;
  const enabled = busy || (!evm && amount !== null && amount > 0n && !capped) || !!resume || ready;
  return (
    <TwoColumn
      title="Stake"
      onBack={() => router.push('/pool')}
      left={
        <>
          <TokenCard token={from ?? undefined} customOnClick={onPickFrom} label="From" className="max-h-min py-5 active:scale-[0.98] md:max-h-min md:rounded-3xl md:py-5" />
          <AmountCard
            token={{ logo: from?.logo ?? USDC_LOGO, chainLogo: from?.chainLogo ?? '' }}
            amountText={amountText}
            onAmountText={(t) => { setAmountText(t); setNote(null); setResume(null); }}
            usdText={amount === null ? null : formatUsd(amount)}
            balanceText={evm && balance !== undefined && from ? formatAmount(balance, from.decimals) : undefined}
            onMax={() => { if (balance !== undefined && from) setAmountText(formatUnits(balance, from.decimals).replace(/,/g, '')); }}
            balanceLoading={!!evm && balanceLoading}
            message={capped ? undefined : message}
          />
          {capped && room !== null && (
            <p className="mt-2 animate-slide-in-from-top text-xs text-yellow-600">
              You can stake up to {formatUsdWhole(room)} right now.
            </p>
          )}
          {smart && (
            // PROVISIONAL copy (plan 3 Smart wallets, awaiting Jeff)
            <p className="mt-2 animate-slide-in-from-top text-xs text-yellow-600">The pool needs a regular wallet for now.</p>
          )}
          {note && <p className="mt-2 animate-slide-in-from-top text-xs text-yellow-600">{note}</p>}
        </>
      }
      right={
        <>
          <ResultCard
            label="Added to your stake"
            loading={loading}
            avatar={<StakeAvatar className="h-12 w-12" />}
            big={`~${view ? view.addedText : '0.00'} USDC`}
            small={apy && apy !== 'Not yet' ? `Starts earning ${apy} APY right away` : 'Starts earning right away'}
            rows={[
              ['Fee', view ? view.feeText : '$0.00'],
              ['Ready in', view ? view.readyText : ''],
              ['Withdraw', 'Anytime, no exit fee', 'green'],
            ]}
          />
          {closed ? (
            <Note tone="yellow" icon={<ClockIcon width={18} height={18} />}>{POOL_PAUSED}</Note>
          ) : (
            <Note icon={<FireIcon width={18} height={18} />}>
              Your stake earns from every swap that uses the pool. Withdraw anytime.
            </Note>
          )}
        </>
      }
      action={<ActionButton isDisabled={!enabled} onClick={enabled ? () => void onStake() : undefined}>{label}</ActionButton>}
    />
  );
}
