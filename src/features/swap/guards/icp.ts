// Design note (ICP approvals and swap_from_icp, plan 2 Task 2). Only the values this function returns reach the ledger
// and the canister. Must never happen: an approval to anyone but the Swapic canister's main account, or for more than
// amount_in + fee; swap_from_icp sent with terms that pay someone else, another token, another chain, or less than the
// screen shows; terms whose deadline the canister would refuse (under 5 minutes or over 1 hour ahead) or whose slippage
// passes 500 bps; a refund sent anywhere but the caller. How the design proves it: approve.spender, icpSwap.canister and
// config.swapicCanisterId agree; the approve amount is exactly terms.amountIn + the ledger's fee; slippage <= 500; the
// deadline sits between now + 5 min 30 s and now + 1 h; no subaccount and no refund_to (the caller's default account);
// the planned recipient, token out and chain are the screen's; plan.order is decoded, its id recomputed under the pool
// chain's anchored Swapic, its payer the canister's EVM address, its memo empty (the canister refuses a payout order with
// one), and every step read by readPlan as the canister will, its delivery the screen's for at least planned.minOut.
// Tests: icp.test.ts.
import { Principal } from '@icp-sdk/core/principal';
import { decodeAbiParameters, getAddress, hexToBytes, type Hex } from 'viem';
import type { Route } from '@/lib/api';
import type { CkSwapTerms, IcpSwapTerms } from '@/lib/icp';
import { ORDER_TUPLE, orderIdOf, sameAddress, sameToken, type OrderValue } from './abi';
import type { GuardContext } from './context';
import { GuardError, must } from './errors';
import { readPlan } from './plan';
import { checkSolanaDelivery } from './solana';

export interface IcpCheckInput {
  route: Route; fromLedger: string; amountIn: bigint; ledgerFee: bigint;
  recipientEvm: Hex; toToken: string; toChainId: number;
  /** Paid on Solana: the wallet the screen shows. `recipientEvm` and `toChainId` then mean nothing. */
  recipientSolana?: string;
  canisterId: string; guard: GuardContext | undefined; nowNs: bigint;
}
export interface CheckedIcpSwap {
  door: 'pool'; ledger: string; approveAmount: bigint; amountIn: bigint; minOut: bigint; expectedOut: bigint; terms: IcpSwapTerms; deadlineNs: bigint;
}

const MIN_AHEAD_NS = 330n * 1_000_000_000n; // the canister's 5 minutes, plus 30 s to sign and send
const MAX_AHEAD_NS = 3_600n * 1_000_000_000n;

export function verifyIcpSwap(i: IcpCheckInput): CheckedIcpSwap {
  const s = i.route.icpSwap;
  must(!!s, 'notIcpSwap');
  const { approve, terms, planned } = s!;
  const g = i.guard;
  const poolChain = g?.config.poolChain ?? null;
  const poolSwapic = poolChain === null ? undefined : g!.config.chains.get(poolChain)?.swapic;
  must(!!g && !!poolSwapic && !!g.canisterEvm, 'noAnchor');

  must(terms.tokenIn === i.fromLedger && approve.ledger === i.fromLedger, 'tokenIn');
  must(BigInt(terms.amountIn) === i.amountIn, 'amountIn');
  must(approve.spender === i.canisterId && (s!.canister === null || s!.canister === i.canisterId), 'approveSpender');
  must(BigInt(approve.amount) === i.amountIn + i.ledgerFee, 'approveAmount');
  must(terms.slippageBps >= 0 && terms.slippageBps <= 500, 'slippage');
  const deadlineNs = BigInt(terms.deadlineNs);
  must(deadlineNs >= i.nowNs + MIN_AHEAD_NS && deadlineNs <= i.nowNs + MAX_AHEAD_NS, 'deadline');
  must(terms.fromSubaccount === null, 'fromSubaccount');
  must(terms.refundTo === null, 'refundTo');

  must(!!s!.solana === !!i.recipientSolana, 'recipient');
  if (i.recipientSolana) {
    // paid on Solana: the canister's terms name the wallet and the mint, the EVM fields its zeroes, the plan runs on the pool chain
    must(s!.solana!.recipient === i.recipientSolana && s!.solana!.mintOut === i.toToken, 'recipient');
    must(planned.dstChain === poolChain, 'dstChain');
  } else {
    must(sameAddress(planned.recipient, i.recipientEvm), 'recipient');
    must(sameToken(planned.tokenOut, i.toToken), 'tokenOut');
    must(planned.dstChain === i.toChainId, 'dstChain');
  }
  const minOut = BigInt(planned.minOut);
  must(BigInt(i.route.amountOutMin) === minOut, 'minOut');

  // the plan: its id under the pool chain's Swapic, paid by the canister, every step read as the canister reads it
  let order: OrderValue;
  try {
    order = decodeAbiParameters([ORDER_TUPLE], terms.plan.order as Hex)[0] as OrderValue;
  } catch {
    throw new GuardError('planOrder');
  }
  must(orderIdOf(order, poolChain!, getAddress(poolSwapic!)) === planned.orderId.toLowerCase(), 'planOrder');
  must(sameAddress(order.payer, g!.canisterEvm), 'planPayer');
  must(order.memo === '0x', 'planMemo');
  const plan = readPlan(order, { ...g!, sourceChainId: poolChain!, payer: getAddress(g!.canisterEvm!), orderDeadline: order.deadline, nowSec: Number(i.nowNs / 1_000_000_000n) });
  if (i.recipientSolana) {
    must(!!plan.solana, 'dstChain');
    checkSolanaDelivery(plan.solana!, i.recipientSolana, i.toToken, minOut);
  } else {
    must(!plan.solana, 'dstChain');
    const d = plan.delivery;
    must(!!d && d.chainId === i.toChainId && sameAddress(d.recipient, i.recipientEvm) && sameToken(d.token, i.toToken) && d.minOut >= minOut, 'planPayout');
  }

  return {
    door: 'pool',
    ledger: i.fromLedger,
    approveAmount: i.amountIn + i.ledgerFee,
    amountIn: i.amountIn,
    minOut,
    expectedOut: BigInt(planned.expectedOut),
    deadlineNs,
    terms: {
      token_in: Principal.fromText(terms.tokenIn),
      amount_in: i.amountIn,
      from_subaccount: [],
      refund_to: [],
      slippage_bps: terms.slippageBps,
      deadline_ns: deadlineNs,
      plan: { order: hexToBytes(terms.plan.order as Hex), gas_limit: BigInt(terms.plan.gasLimit) },
    },
  };
}

export interface CheckedIcpCkSwap {
  door: 'ck'; ledger: string; approveAmount: bigint; amountIn: bigint; minOut: bigint; expectedOut: bigint; terms: CkSwapTerms; deadlineNs: bigint;
}
export type CheckedIcp = CheckedIcpSwap | CheckedIcpCkSwap;

const ETHEREUM = 1;

/**
 * The ck minter's route, swap_from_icp_ck: must never reach the canister paying someone else, another token, another
 * chain, or less than the screen shows; never an approval beyond amount_in + fee; never a refund anywhere but the
 * caller. USDC is anchored on the canister's own get_config, and a route offers one door: the pool's check never
 * accepts these terms, nor this one the pool's. What the fee takes is the door's to refuse: min_usdc covers min_out,
 * the network fee and both ledger fees.
 */
export function verifyIcpCkSwap(i: IcpCheckInput): CheckedIcpCkSwap {
  const s = i.route.icpCkSwap;
  must(!!s && !i.route.icpSwap, 'notIcpCkSwap');
  const { approve, terms } = s!;
  const usdc = i.guard?.config.chains.get(ETHEREUM)?.usdc;
  must(!!usdc, 'noAnchor');

  must(terms.tokenIn === i.fromLedger && approve.ledger === i.fromLedger, 'tokenIn');
  must(BigInt(terms.amountIn) === i.amountIn, 'amountIn');
  must(approve.spender === i.canisterId && (s!.canister === null || s!.canister === i.canisterId), 'approveSpender');
  must(BigInt(approve.amount) === i.amountIn + i.ledgerFee, 'approveAmount');
  const deadlineNs = BigInt(terms.deadlineNs);
  must(deadlineNs >= i.nowNs + MIN_AHEAD_NS && deadlineNs <= i.nowNs + MAX_AHEAD_NS, 'deadline');
  must(terms.fromSubaccount === null, 'fromSubaccount');
  must(terms.refundTo === null, 'refundTo');

  must(terms.dstChain === ETHEREUM && i.toChainId === ETHEREUM, 'dstChain');
  must(sameAddress(terms.recipient, i.recipientEvm), 'recipient');
  must(sameToken(terms.tokenOut, i.toToken) && sameToken(terms.tokenOut, usdc!), 'tokenOut');
  const minOut = BigInt(terms.minOut);
  const minUsdc = BigInt(terms.minUsdc);
  const networkFee = BigInt(terms.networkFee);
  must(BigInt(i.route.amountOutMin) === minOut, 'minOut');
  must(minOut > 0n && networkFee > 0n, 'minOut');
  must(minUsdc >= minOut + networkFee + BigInt(s!.ledgerFees), 'minUsdc');

  return {
    door: 'ck',
    ledger: i.fromLedger,
    approveAmount: i.amountIn + i.ledgerFee,
    amountIn: i.amountIn,
    minOut,
    expectedOut: BigInt(s!.expectedOut),
    deadlineNs,
    terms: {
      token_in: Principal.fromText(terms.tokenIn),
      amount_in: i.amountIn,
      from_subaccount: [],
      refund_to: [],
      deadline_ns: deadlineNs,
      dst_chain: BigInt(terms.dstChain),
      recipient: terms.recipient,
      token_out: terms.tokenOut,
      min_out: minOut,
      min_usdc: minUsdc,
      network_fee: networkFee,
    },
  };
}
