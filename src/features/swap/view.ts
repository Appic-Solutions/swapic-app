import type { Fees, Quote } from '@/lib/api';
import type { RouteOptionView } from '@/components/design/RouteOption';
import type { UiToken } from '@/components/ui/token-types';
import { tokenAmountText } from '@/lib/copy/format';
import { dollarsToMicro, formatAmount, formatListUsd, formatUsd, parseDecimal, usdMicro } from '@/lib/money';
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
 *  it holds none of the From chain's coin. Nothing on any other card: You pay gas shows its approve as a row of its own. */
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
  const micro = dollarsToMicro(usd);
  const amount = (micro * 10n ** BigInt(native.decimals + 12)) / price;
  // the dollars beside the coin (Jeff 2026-11-09: "$0.09" read as the gas while the gas was only in ETH); a chain that pays in USDC is in dollars already
  const dollars = native.symbol === 'USDC' ? '' : ` (${formatListUsd(micro)})`;
  return `~ ${formatAmount(amount, native.decimals)} ${native.symbol}${dollars}, you pay it`;
}

/** What the swap costs in all (Jeff 2026-11-09), in micro dollars: the fees taken out of it, the gas the wallet pays, and an
 *  approve it still owes. An estimate as soon as any wallet gas is in it. */
export function totalCost(p: PickedOption, fees: bigint): { micro: bigint; estimate: boolean } {
  const gas = p.route.userGasUsd;
  const approve = p.route.approvalGasUsd;
  return {
    micro: fees + (gas ? dollarsToMicro(gas) : 0n) + (approve ? dollarsToMicro(approve) : 0n),
    estimate: !!gas || !!approve,
  };
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
  const total = totalCost(p, fee);
  return {
    key: p.key,
    tags: p.tags,
    gasless: p.mode !== 'userPays' && !p.route.icpCkSwap,
    durationText: etaText(r.etaSeconds),
    amountOutText: formatAmount(amountOut, ctx.to.decimals),
    // the token's own format (stable coins with two decimals), as Review swap's "You get at least" shows it
    minOutText: `${tokenAmountText(shownMinOf(p), ctx.to.decimals, ctx.to.symbol)} ${ctx.to.symbol}`,
    usdOutText: usdOut === null ? null : formatUsd(usdOut),
    totalCostText: `${total.estimate ? '~ ' : ''}${formatListUsd(total.micro)}`,
    approveCostText: r.approvalGasUsd ? `~ ${formatListUsd(dollarsToMicro(r.approvalGasUsd))}` : undefined,
    gasText: gasText(p, ctx.native),
    gaslessNote: gaslessNote(p, ctx.from, ctx.native),
    approve: approveState(p, ctx.native),
    approveBlocked: `You need a little ${ctx.native.symbol} to approve ${ctx.from.symbol} once`,
    viaMinter: r.routeId.split('+').includes('ckMinter'),
  };
}

export const isSameChainNoUsdc = (q: Quote, usdcOfChain: string | undefined) =>
  q.fromChain === q.toChain && !!usdcOfChain && q.fromToken.address.toLowerCase() !== usdcOfChain.toLowerCase() && q.toToken.address.toLowerCase() !== usdcOfChain.toLowerCase();
