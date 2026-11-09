import type { Fees, Quote } from '@/lib/api';
import type { RouteOptionView } from '@/components/design/RouteOption';
import type { UiToken } from '@/components/ui/token-types';
import { tokenAmountText } from '@/lib/copy/format';
import { dollarsToMicro, formatAmount, formatUsd, parseDecimal, usdMicro } from '@/lib/money';
import { gasIsUsdc } from '@/lib/chains';
import { shownMinOf, type PickedOption } from './options';

export interface NativeCoin {
  symbol: string;
  decimals: number;
  priceUsd: string | null;
  /** False when the wallet holds none of the coin on the From chain; null or absent when unknown (no wallet, still loading). */
  held?: boolean | null;
}

/** The gasless card's line under the amount (Jeff 2026-11-04): a wallet with none of the From chain's coin is told it
 *  needs none; any other wallet reads "Just sign". Only EVM sources: an ICP wallet pays no gas coin anyway. */
export function gaslessNote(p: PickedOption, from: UiToken, native: NativeCoin): string | undefined {
  if (p.mode === 'userPays' || from.chain_type !== 'EVM' || !native.symbol) return undefined;
  if (native.held === false) return `You have no ${native.symbol} on ${from.chainName}. Gasless works anyway`;
  // Arc pays its gas in USDC: "no USDC needed" would read wrong beside a USDC swap
  return gasIsUsdc(from.chain) ? 'Just sign, no gas to pay' : `Just sign, no ${native.symbol} needed`;
}

/** A gasless card whose wallet must approve Permit2 first (Jeff 2026-11-06): 'once' when it can pay that gas, 'noCoin' when
 *  it holds none of the From chain's coin. Nothing on any other card: You pay gas shows its approve only on Review swap. */
export function approveState(p: PickedOption, native: NativeCoin): 'once' | 'noCoin' | undefined {
  if (p.mode !== 'gasless' || !(p.route.needsApproval || p.route.sign?.approval)) return undefined;
  return native.held === false ? 'noCoin' : 'once';
}

/** The ck minter's route takes a network fee out of the swap: at least the canister's floor, in dollars, never a free card. */
export const networkFeeText = (p: PickedOption): string => `${formatUsd(BigInt(p.route.icpCkSwap?.terms.networkFee ?? '0'))} network fee`;

/** The design's gas row: the user's gas in the source chain's coin. The quote gives it in dollars (`userGasUsd`,
 *  answer/mod.rs:440-443); it is turned into the coin at the coin's price: wei = microUsd * 10^(decimals + 12) / priceE18. */
export function gasText(p: PickedOption, native: NativeCoin): string {
  if (p.route.icpCkSwap) return networkFeeText(p);
  if (p.mode === 'icpPull') return 'None';
  if (p.mode === 'gasless') return 'None, Swapic pays it';
  const usd = p.route.userGasUsd;
  if (!usd || native.priceUsd === null) return 'You pay it';
  const price = parseDecimal(native.priceUsd, 18);
  if (price === 0n) return 'You pay it';
  const amount = (dollarsToMicro(usd) * 10n ** BigInt(native.decimals + 12)) / price;
  return `~ ${formatAmount(amount, native.decimals)} ${native.symbol}, you pay it`;
}

/** Every fee line in micro USDC (answer/mod.rs:166-195). `platform` is in the output token on a same chain swap with no USDC side. */
export function sumFees(f: Fees, platformInTokenOut?: { decimals: number; priceUsd: string | null }): bigint {
  const lines = [f.network, f.bridge, f.premium, f.icpFees, f.moveFee].reduce((a, x) => a + (x ? BigInt(x) : 0n), 0n);
  const platform = BigInt(f.platform);
  if (!platformInTokenOut) return lines + platform;
  return lines + (usdMicro(platform, platformInTokenOut.decimals, platformInTokenOut.priceUsd) ?? 0n);
}

export function etaText(seconds: number): string {
  return seconds < 90 ? `${seconds} sec` : `${Math.round(seconds / 60)} min`;
}

export function routeView(p: PickedOption, ctx: { from: UiToken; to: UiToken; amountIn: bigint; sameChainNoUsdc: boolean; native: NativeCoin }): RouteOptionView {
  const r = p.route;
  const amountOut = BigInt(r.amountOut);
  const usdOut = usdMicro(amountOut, ctx.to.decimals, ctx.to.priceUsd);
  const fee = sumFees(r.fees, ctx.sameChainNoUsdc ? { decimals: ctx.to.decimals, priceUsd: ctx.to.priceUsd } : undefined);
  return {
    key: p.key,
    tags: p.tags,
    gasless: p.mode !== 'userPays' && !p.route.icpCkSwap,
    durationText: etaText(r.etaSeconds),
    amountOutText: formatAmount(amountOut, ctx.to.decimals),
    // the token's own format (stable coins with two decimals), as Review swap's "You get at least" shows it
    minOutText: `${tokenAmountText(shownMinOf(p), ctx.to.decimals, ctx.to.symbol)} ${ctx.to.symbol}`,
    usdOutText: usdOut === null ? null : formatUsd(usdOut),
    networkFeeText: BigInt(r.fees.network) > 0n ? formatUsd(BigInt(r.fees.network)) : undefined,
    totalFeeText: formatUsd(fee),
    gasText: gasText(p, ctx.native),
    gaslessNote: gaslessNote(p, ctx.from, ctx.native),
    approve: approveState(p, ctx.native),
    approveBlocked: `You need a little ${ctx.native.symbol} to approve ${ctx.from.symbol} once`,
    viaMinter: r.routeId.split('+').includes('ckMinter'),
  };
}

export const isSameChainNoUsdc = (q: Quote, usdcOfChain: string | undefined) =>
  q.fromChain === q.toChain && !!usdcOfChain && q.fromToken.address.toLowerCase() !== usdcOfChain.toLowerCase() && q.toToken.address.toLowerCase() !== usdcOfChain.toLowerCase();
