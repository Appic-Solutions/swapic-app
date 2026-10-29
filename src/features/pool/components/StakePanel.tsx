'use client';
// Stake: moved from the design's pool-screens.tsx StakePanel (the approved static look; the design bundle built 2026-10-29
// 14:46 was rebuilt with the motion pass before this task, so the body is the current source with no motion part in it, in
// the app's static TwoColumn), wired to data. From is USDC on an EVM chain (the address from the canister's get_config, plan
// check C4; the chain's name and logo from GET /v2/chains) or, with the ICP wallet connected, ckUSDC on ICP. From an EVM
// chain: Added to your stake from a stake quote asked 600 ms after typing, the room under the cap checked before any quote,
// and the button running the checked swap flow (executeStakeEvm). From ICP: two ledger fees, an approval then stake_icp
// (executeStakeIcp), and a stake whose pull answer was lost shown as pending until its shares grow. It reads `amount` and
// `from` (`<chain>|<address>`, as the Swap link) from the link once (useQueryOnce).
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TokenCard } from '@/components/ui/token-card';
import ActionButton from '@/components/ui/action-button';
import AmountCard from '@/components/design/AmountCard';
import { ResultCard } from '@/components/design/ResultCard';
import { Note } from '@/components/design/Note';
import { TwoColumn } from '@/components/design/TwoColumn';
import { CheckIcon, ClockIcon, FireIcon } from '@/components/icons';
import type { UiToken } from '@/components/ui/token-types';
import { ApiError, getAccount, getOrders, getQuote, postStakeQuote, submitGasless, userMessage, type StakeRequest } from '@/lib/api';
import { icpClient } from '@/lib/icp';
import { formatAmount, formatUnits, formatUsd, formatUsdWhole, maxIcp, parseUnits } from '@/lib/money';
import { useQueryOnce } from '@/lib/use-query-once';
import { useEvmConnect, useEvmSigner, useIcpCaller, useIcpConnect, useWallets } from '@/lib/wallets';
import type { ExecOutcome } from '@/features/swap/execute';
import { useGuardContext } from '@/features/swap/quote';
import { TokenSelect } from '@/features/swap/components/TokenSelect';
import { useBalance } from '@/features/swap/tokens';
import { tiles, useMyStakes, usePool } from '../data';
import { CKUSDC_TOKEN, USDC_LOGO, useUsdcTokens } from '../usdc';
import { StakeAvatar } from './parts';
import { defaultStakeFrom } from '../stake-from';
import { CKUSDC, executeStakeEvm, executeStakeIcp, pickStakeOption, POOL_PAUSED, stakeRoom, stakeView } from '../flows';

const NO_ROUTE = 'No route found for this amount';
/** A stake from ICP whose pull answer was lost: its account is read every 5 s, for at most two minutes (plan 3 Task 8). */
const LANDING_EVERY_MS = 5_000;
const LANDING_FOR_MS = 120_000;

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
  const link = useQueryOnce();
  const icp = useWallets((s) => s.icp);
  const evmChain = useWallets((s) => s.evm?.chainId ?? null);
  const evmTokens = useUsdcTokens();
  const tokens = React.useMemo(() => (icp ? [...evmTokens, CKUSDC_TOKEN] : evmTokens), [evmTokens, icp]);
  const [picked, setPicked] = React.useState<UiToken | null>(null);
  // the link may name one (`from=<chain>|<address>`); else the connected chain's USDC, else Arbitrum's (defaultStakeFrom)
  const linked = tokens.find((t) => t.key === link?.get('from'));
  const from = picked ?? linked ?? defaultStakeFrom(tokens, evmChain);
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
  const { evm, icp } = useWallets();
  const signer = useEvmSigner();
  const caller = useIcpCaller();
  const openEvm = useEvmConnect();
  const openIcp = useIcpConnect();
  const pool = usePool().data;
  const { stakes } = useMyStakes();
  const guardReady = !!useGuardContext();
  const [amountText, setAmountText] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);
  const [landing, setLanding] = React.useState(false);
  const [resume, setResume] = React.useState<(() => Promise<ExecOutcome>) | null>(null);

  React.useEffect(() => {
    const a = link?.get('amount');
    if (a) setAmountText(a);
  }, [link]);

  const fromIcp = from?.chain_type === 'ICP';
  const wallet = fromIcp ? !!icp : !!evm;
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
  const smart = !fromIcp && evm?.smartWallet === true;
  const overBalance = amount !== null && balance !== undefined && amount > balance;

  // from an EVM chain, the stake quote: 600 ms after typing, only under the room (the quoter refuses past the cap), for the
  // paying wallet as owner
  const typed = useDebounced(amountText, 600);
  let request: StakeRequest | null = null;
  if (from && !fromIcp && evm && pool && !closed && !smart && room !== null) {
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
  // from ICP: the pool takes the amount itself; the person pays two ledger fees (the approval and the pull)
  const fee = useQuery({ queryKey: ['ledger-fee', CKUSDC], queryFn: () => icpClient().ledgerFee(CKUSDC), enabled: fromIcp, staleTime: 600_000 }).data;
  const option = q.data ? pickStakeOption(q.data) : undefined;
  const view = fromIcp
    ? (amount !== null && amount > 0n && fee !== undefined ? { added: amount, addedText: formatUsd(amount).slice(1), feeText: formatUsd(2n * fee), readyText: '5 Sec' } : null)
    : option ? stakeView(option) : null;
  // skeletons from the moment an amount that will be quoted is typed until its quote answers (the design's loading card)
  const asks = !fromIcp && !!from && !!evm && !!pool && !closed && !smart && amount !== null && amount > 0n && !capped;
  const loading = asks && (typed !== amountText || (!!request && q.isFetching && !q.data));
  const quoteError = fromIcp ? null : q.error ? (q.error instanceof ApiError && q.error.code === 'no_route' ? NO_ROUTE : userMessage(q.error)) : q.data && !option ? NO_ROUTE : null;

  const message = overBalance && from ? `Not enough ${from.symbol} in your wallet` : amountError ?? quoteError ?? undefined;
  const ready = amount !== null && amount > 0n && !capped && !closed && !smart && !overBalance && !!view && !amountError
    && (fromIcp ? !!caller : guardReady && !!signer);
  const label = amount === null || amount === 0n
    ? 'Set token amount to continue'
    : capped && room !== null
      ? `Up to ${formatUsdWhole(room)} right now`
      : !wallet
        ? 'Connect wallet'
        : busy
          ? undefined
          : resume
            ? 'Try again'
            : `Stake ${formatUnits(amount, from!.decimals)} ${from!.symbol}`;

  /** A lost pull: the stake shows as pending; the account is read every 5 s until its shares grow, two minutes at most. */
  const waitForShares = async (owner: string, before: bigint) => {
    setLanding(true);
    const until = Date.now() + LANDING_FOR_MS;
    while (Date.now() < until) {
      await new Promise((r) => setTimeout(r, LANDING_EVERY_MS));
      const a = await qc.fetchQuery({ queryKey: ['account', owner], queryFn: () => getAccount(owner), staleTime: 0 }).catch(() => null);
      if (a && BigInt(a.shares) > before) break;
    }
    router.push('/pool');
  };
  const after = (out: ExecOutcome | { kind: 'landing' }, owner: string | undefined, before: bigint) => {
    setBusy(false);
    setResume(null);
    if (out.kind === 'started') {
      void qc.invalidateQueries({ queryKey: ['account', owner] });
      router.push('/pool');
    } else if (out.kind === 'landing') {
      setBusy(true);
      void waitForShares(owner!, before);
    } else if (out.kind === 'failed') setNote(out.message);
    else if (out.kind === 'unknown') { setNote(out.message); if (out.resume) setResume(() => out.resume); }
    else if (out.kind === 'newPrice') { setNote('The amount added changed. Check it and stake again.'); void q.refetch(); }
  };
  const onStake = async () => {
    if (busy) return;
    if (!wallet) { void (fromIcp ? openIcp() : openEvm()); return; }
    const owner = fromIcp ? icp?.principal : evm?.address;
    const before = stakes.find((s) => s.owner === owner)?.shares ?? 0n;
    if (resume) { setBusy(true); after(await resume(), owner, before); return; }
    if (!ready || !from || amount === null || !view) return;
    setBusy(true);
    setNote(null);
    if (fromIcp) {
      after(await executeStakeIcp({ amount, caller: caller!, onStep: () => {} }, icpClient()), owner, before);
      return;
    }
    after(await executeStakeEvm(
      { from, amount, evm: signer!, shownAdded: view.added, onStep: () => {} },
      { getQuote, getOrders, submitGasless, postStakeQuote, icp: icpClient(), nowMs: () => Date.now(), sleep: (ms) => new Promise((r) => setTimeout(r, ms)) },
    ), owner, before);
  };

  const apy = pool ? tiles(pool).apy : null;
  const enabled = busy || (!wallet && amount !== null && amount > 0n && !capped) || !!resume || ready;
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
            balanceText={wallet && balance !== undefined && from ? formatAmount(balance, from.decimals) : undefined}
            onMax={() => {
              if (balance === undefined || !from) return;
              // from ICP the wallet also pays two ledger fees (the approval and the pull), so Max leaves them
              const max = fromIcp ? (fee === undefined ? null : maxIcp(balance, fee)) : balance;
              if (max !== null) setAmountText(formatUnits(max, from.decimals).replace(/,/g, ''));
            }}
            balanceLoading={wallet && balanceLoading}
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
              ['Withdraw', fromIcp ? 'Anytime on ICP, no exit fee' : 'Anytime, no exit fee', 'green'],
            ]}
          />
          {closed ? (
            <Note tone="yellow" icon={<ClockIcon width={18} height={18} />}>{POOL_PAUSED}</Note>
          ) : landing ? (
            <Note tone="blue" icon={<ClockIcon width={18} height={18} />}>Your stake is going in. It shows in Your stake in a moment.</Note>
          ) : fromIcp ? (
            <Note icon={<CheckIcon />}>
              Your ICP wallet asks you to approve the ckUSDC, then to confirm. No gas. A stake from ICP pays out on ICP.
            </Note>
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
