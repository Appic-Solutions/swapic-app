'use client';
// Stake: moved from the design's pool-screens.tsx StakePanel (the approved static look; the design bundle built 2026-10-29
// 14:46 was rebuilt with the motion pass before this task, so the body is the current source with no motion part in it, in
// the app's static TwoColumn), wired to data. From is USDC on an EVM chain (the address from the canister's get_config, plan
// check C4; the chain's name and logo from GET /v2/chains) or, with the ICP wallet connected, ckUSDC on ICP. From an EVM
// chain: Added to your stake from a stake quote asked 600 ms after typing, the room under the cap checked before any quote,
// and the button running the checked swap flow (executeStakeEvm). From ICP: two ledger fees, an approval then stake_icp
// (executeStakeIcp), and a stake whose pull answer was lost shown as pending until its shares grow. It reads `amount` and
// `from` (`<chain>|<address>`, as the Swap link) from the link once (PoolFlow, useQueryOnce).
// Motion (approved 2026-10-29, part 2): a view of the Pool's in place panel (PoolFlow). The stake card flies into Added to
// your stake; From opens Stake From in the same panel. Review stake (approved 2026-10-30): the button opens the review,
// built from the route as the canister reads it (checkStakeRoute); the signing runs there (StakeReview).
import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { TokenCard } from '@/components/ui/token-card';
import AmountCard from '@/components/design/AmountCard';
import { ResultCard } from '@/components/design/ResultCard';
import { Note } from '@/components/design/Note';
import { TwoColumn } from '@/components/design/TwoColumn';
import { ConfirmButton } from '@/components/motion/parts';
import { motion } from 'motion/react';
import { fade } from '@/lib/motion';
import { CheckIcon, ClockIcon, FireIcon } from '@/components/icons';
import type { UiToken } from '@/components/ui/token-types';
import { ApiError, postStakeQuote, userMessage, type StakeRequest } from '@/lib/api';
import { icpClient } from '@/lib/icp';
import { formatAmount, formatUnits, formatUsd, formatUsdWhole, maxIcp, parseUnits } from '@/lib/money';
import { useEvmConnect, useEvmSigner, useIcpCaller, useIcpConnect, useWallets } from '@/lib/wallets';
import { GuardError, GUARD_MESSAGE } from '@/features/swap/guards/errors';
import { useGuardContext } from '@/features/swap/quote';
import { useBalance, useChains, useTokenList } from '@/features/swap/tokens';
import type { NativeCoin } from '@/features/swap/view';
import { tiles, usePool } from '../data';
import { evmStakeReview, icpStakeReview } from '../review';
import type { StakeStart } from './StakeReview';
import { USDC_LOGO } from '../usdc';
import { STAKE_CARD, StakeAvatar } from './parts';
import { checkStakeRoute, CKUSDC, pickStakeOption, POOL_PAUSED, stakeRoom, stakeView } from '../flows';

const NO_ROUTE = 'No route found for this amount';
const ZERO = '0x0000000000000000000000000000000000000000';

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Stake: `amountText` is the flow's (it outlives Stake From and the review); `onReview` opens Review stake. */
export function StakePanel({ from, amountText, onAmountText, onPickFrom, onBack, onReview }: {
  from: UiToken | null; amountText: string; onAmountText: (t: string) => void; onPickFrom: () => void; onBack: () => void; onReview: (s: StakeStart) => void;
}) {
  const { evm, icp } = useWallets();
  const signer = useEvmSigner();
  const caller = useIcpCaller();
  const openEvm = useEvmConnect();
  const openIcp = useIcpConnect();
  const pool = usePool().data;
  const guard = useGuardContext();
  const guardReady = !!guard;
  const setAmountText = onAmountText;
  const [note, setNote] = React.useState<string | null>(null);
  // the From chain's coin, priced by its row in the token list (the gas words of a route you pay gas on)
  const { chains } = useChains();
  const fromChain = chains.find((c) => c.chainId === from?.chain);
  const coinRow = useTokenList(from && from.chain_type === 'EVM' ? from.chain : '', '').tokens.find((t) => t.address === ZERO);
  const native: NativeCoin = { symbol: fromChain?.nativeToken.symbol ?? '', decimals: fromChain?.nativeToken.decimals ?? 18, priceUsd: coinRow?.priceUsd ?? null };

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
        : 'Review stake';

  const apyText = pool ? tiles(pool).apy : null;
  const apyLine = apyText && apyText !== 'Not yet' ? `Starts earning ${apyText} APY right away` : 'Starts earning right away';
  /** Review stake: from an EVM chain the route is read as the canister reads it first; a route that fails never opens one. */
  const onStake = () => {
    if (!wallet) { void (fromIcp ? openIcp() : openEvm()); return; }
    if (!ready || !from || amount === null) return;
    setNote(null);
    if (fromIcp) {
      if (fee === undefined || !icp) return;
      onReview({ from, amount, owner: icp.principal, review: icpStakeReview(amount, fee, from), apyLine });
      return;
    }
    if (!q.data || !option || !evm) return;
    try {
      const checked = checkStakeRoute({ quote: q.data, option, from, amount, owner: evm.address, guard, nowSec: Math.floor(Date.now() / 1000) });
      onReview({ from, amount, owner: evm.address, review: evmStakeReview({ option, checked, from, amount, native }), evm: { approval: !!checked.approval, native }, apyLine });
    } catch (e) {
      setNote(e instanceof GuardError ? GUARD_MESSAGE : userMessage(e));
    }
  };

  const apy = apyText;
  const enabled = (!wallet && amount !== null && amount > 0n && !capped) || ready;
  return (
    <TwoColumn
      inPlace
      title="Stake"
      onBack={onBack}
      // inside the in place panel each part fades (TwoColumn: callers fade their own parts)
      left={
        <motion.div variants={fade} className="flex w-full flex-col">
          <TokenCard token={from ?? undefined} customOnClick={onPickFrom} label="From" className="max-h-min py-5 active:scale-[0.98] md:max-h-min md:rounded-3xl md:py-5" />
          <AmountCard
            token={{ logo: from?.logo ?? USDC_LOGO, chainLogo: from?.chainLogo ?? '' }}
            amountText={amountText}
            onAmountText={(t) => { setAmountText(t); setNote(null); }}
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
        </motion.div>
      }
      right={
        <motion.div variants={fade} className="flex w-full flex-col gap-y-4 lg:flex-1">
          <ResultCard
            label="Added to your stake"
            fly={STAKE_CARD}
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
          ) : fromIcp ? (
            <Note icon={<CheckIcon />}>
              Your ICP wallet asks you to approve the ckUSDC, then to confirm. No gas. A stake from ICP pays out on ICP.
            </Note>
          ) : (
            <Note icon={<FireIcon width={18} height={18} />}>
              Your stake earns from every swap that uses the pool. Withdraw anytime.
            </Note>
          )}
        </motion.div>
      }
      action={<ConfirmButton label={label} disabled={!enabled} onClick={onStake} />}
    />
  );
}
