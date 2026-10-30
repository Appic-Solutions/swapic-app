// Review stake and Review withdrawal (approved 2026-10-30, design pool-screens.tsx StakeReview and WithdrawReview): their
// numbers and wallet steps. Every amount comes from what the checks accepted, never from a quote's display fields:
// - a stake from an EVM chain: Added to your stake is the checked route's minOut (verifyEvmRoute ties it to the order and,
//   for a stake, to route.pool.minOut) less route.pool.rebalanceShare (bound to the order's ref through poolRefOf); the
//   wallet steps are the ones sendCheckedEvm will run on that checked route (an approval only when it carries one);
// - a withdrawal to an EVM chain: the amount, the fee (networkFee + rebalanceShare) and the least paid out (minOut) are the
//   record checkWithdrawQuote accepted and rebuilt (the quoter's expectedOut is never shown);
// - from ICP: the amount and the ledger fee (no quote).
// Fee and Ready in on a stake from EVM (the route's fees and eta) and Arrives on a withdrawal (its eta or line) are the
// quote's own words, as Stake and Withdraw already show them: no check binds a time or the fee breakdown.
import type { UiToken } from '@/components/ui/token-types';
import type { CheckedEvmRoute } from '@/features/swap/guards/evm';
import type { PickedOption } from '@/features/swap/options';
import { gasText, type NativeCoin } from '@/features/swap/view';
import { tokenAmountText } from '@/lib/copy/format';
import { formatAmount, formatUsd } from '@/lib/money';
import { stakeView } from './flows';
import type { CheckedWithdraw } from './withdraw-sig';

/** One wallet step before signing ("In your wallet"). */
export interface WalletStep { label: string; sub: string }

export interface StakeReview {
  kind: 'evm' | 'icp';
  /** USDC added to the stake (6 decimals): what Confirm stake binds (executeStakeEvm's shownAdded). */
  added: bigint;
  payText: string;
  addedText: string;
  feeText: string;
  readyText: string;
  withdrawText: string;
  steps: WalletStep[];
  /** Your stake's Gas row once it has started. */
  gasText: string;
}

/** What the wallet will be asked for a checked stake route: exactly what sendCheckedEvm runs on it. */
export function evmStakeSteps(checked: CheckedEvmRoute, option: PickedOption, from: UiToken, native: NativeCoin): WalletStep[] {
  const once = { label: `Approve ${from.symbol} (once, you pay gas)`, sub: 'Only the first time' };
  const g = gasText(option, native);
  const last = checked.sign
    ? { label: 'Sign in your wallet (no gas)', sub: 'Swapic sends it and pays the gas' }
    : { label: 'Confirm stake (you pay gas)', sub: g.startsWith('~ ') ? `About ${g.slice(2).replace(', you pay it', '')}` : 'You pay the network fee' };
  return checked.approval ? [once, last] : [last];
}

/** Review stake from an EVM chain, from the checked route. */
export function evmStakeReview(i: { option: PickedOption; checked: CheckedEvmRoute; from: UiToken; amount: bigint; native: NativeCoin }): StakeReview {
  const share = BigInt(i.option.route.pool?.rebalanceShare ?? '0');
  const added = i.checked.minOut > share ? i.checked.minOut - share : 0n;
  const v = stakeView(i.option);
  return {
    kind: 'evm', added,
    payText: `${tokenAmountText(i.amount, i.from.decimals, i.from.symbol)} ${i.from.symbol}`,
    addedText: formatUsd(added).slice(1),
    feeText: v.feeText,
    readyText: v.readyText,
    withdrawText: 'Anytime, no exit fee',
    steps: evmStakeSteps(i.checked, i.option, i.from, i.native),
    gasText: i.checked.sign ? 'None, Swapic paid it' : gasText(i.option, i.native).replace('you pay it', 'you paid it'),
  };
}

/** Review stake from ICP: the pool takes the amount itself; the wallet pays two ledger fees (the approval and the pull). */
export function icpStakeReview(amount: bigint, ledgerFee: bigint, from: UiToken): StakeReview {
  return {
    kind: 'icp', added: amount,
    payText: `${tokenAmountText(amount, from.decimals, from.symbol)} ${from.symbol}`,
    addedText: formatUsd(amount).slice(1),
    feeText: formatUsd(2n * ledgerFee),
    readyText: '5 Sec',
    withdrawText: 'Anytime on ICP, no exit fee',
    steps: [
      { label: `Approve ${from.symbol}`, sub: `Lets Swapic take ${formatAmount(amount, from.decimals)} ${from.symbol}` },
      { label: 'Confirm stake', sub: 'No gas' },
    ],
    gasText: 'None',
  };
}

export interface WithdrawReview {
  kind: 'evm' | 'icp';
  /** The least paid out (6 decimals): what Sign withdrawal binds (executeWithdrawEvm's shownMinOut). */
  minOut: bigint;
  withdrawText: string;
  /** "You get at least" over a checked record's floor (EVM); "You get" over ICP's amount less the ledger fee. */
  getLabel: string;
  getText: string;
  feeText: string;
  arrives: string;
  /** The line's words when the payout waits, else null. */
  queuedText: string | null;
  steps: WalletStep[];
}

const minutes = (etaAt: number, nowSec: number) => Math.max(1, Math.round((etaAt - nowSec) / 60));

/** Review withdrawal to an EVM chain, from the record checkWithdrawQuote accepted. */
export function evmWithdrawReview(c: CheckedWithdraw, nowSec: number): WithdrawReview {
  const usdc = BigInt(c.record.usdc);
  const arrives = c.queued
    ? c.queueEtaAt === null ? 'In line' : `In line, about ${minutes(c.queueEtaAt, nowSec)} min`
    : c.etaSeconds < 90 ? 'Right away' : `About ${Math.round(c.etaSeconds / 60)} min`;
  return {
    kind: 'evm', minOut: c.minOut,
    withdrawText: `${tokenAmountText(usdc, 6, 'USDC')} USDC`,
    getLabel: 'You get at least',
    getText: `${tokenAmountText(c.minOut, 6, 'USDC')} USDC`,
    feeText: formatUsd(c.feeUsdc),
    arrives,
    queuedText: c.queued
      ? c.queueEtaAt === null ? 'Your withdrawal waits in line and pays out by itself.' : `Your withdrawal waits in line and pays out in about ${minutes(c.queueEtaAt, nowSec)} min.`
      : null,
    steps: [{ label: 'Sign in your wallet (no gas)', sub: 'Swapic sends it and pays the gas' }],
  };
}

/** Review withdrawal of a stake made from ICP: ckUSDC on ICP less the payout's ledger fee. */
export function icpWithdrawReview(amount: bigint, ledgerFee: bigint): WithdrawReview {
  const receive = amount > ledgerFee ? amount - ledgerFee : 0n;
  return {
    kind: 'icp', minOut: receive,
    withdrawText: `${tokenAmountText(amount, 6, 'USDC')} USDC`,
    getLabel: 'You get',
    getText: `~${tokenAmountText(receive, 6, 'USDC')} ckUSDC`,
    feeText: formatUsd(ledgerFee),
    arrives: 'Right away',
    queuedText: null,
    steps: [{ label: 'Confirm withdrawal', sub: 'No gas' }],
  };
}
