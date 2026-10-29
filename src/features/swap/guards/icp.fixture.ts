// Test only. No real icpSwap answer exists yet (plan 4 Task 5 records one on staging): the payout plan is the real Base order
// of base-usdc-to-base-eth (you pay gas route) with its payer made the canister's EVM address, as a plan's is, and its id
// recomputed; every step of it still reads as the canister reads it.
import type { Hex } from 'viem';
import type { Route } from '@/lib/api';
import type { UiToken } from '@/components/ui/token-types';
import type { OrderValue } from './abi';
import { CANISTER, GUARD, ICP_ME, executable, forge, load } from './forge.fixture';

const quote = load('base-usdc-to-base-eth');
const base = executable(quote, 'userPays')[0]!;
export const CKUSDC = 'xevnm-gaaaa-aaaar-qafnq-cai';
export const SWAPIC_CANISTER = 'hfisl-ayaaa-aaaar-qch3q-cai';
const NOW_NS = BigInt(quote.quotedAt) * 1_000_000_000n;

/** An icpSwap route in the shape of answer/mod.rs:339-402, around the plan; `edit` changes the plan's order as a hostile quoter would. */
export function icpRoute(edit: (o: OrderValue) => OrderValue = (o) => o): Route {
  const plan = forge(quote, base, (o) => edit({ ...o, payer: CANISTER }));
  const o = plan.order!;
  return {
    ...plan, routeId: 'pool', bridge: 'pool', amountOutMin: o.payout.minOut, sign: undefined, tx: undefined, approval: undefined,
    icpSwap: {
      canister: SWAPIC_CANISTER,
      approve: { ledger: CKUSDC, spender: SWAPIC_CANISTER, amount: '1010000' },
      terms: { tokenIn: CKUSDC, amountIn: '1000000', fromSubaccount: null, refundTo: null, slippageBps: 100, deadlineNs: (NOW_NS + 600_000_000_000n).toString(), plan: { order: o.abi, gasLimit: 450000 } },
      planned: {
        planned: '990000', expectedSale: '1000000', saleFloor: '995000', premium: '1000', premiumBps: 10, networkFee: '9000', leastPayout: '985000',
        delivery: 'sameChain', dstChain: 8453, recipient: base.order!.payout.recipient, tokenOut: base.order!.payout.token, expectedOut: base.amountOut,
        minOut: base.order!.payout.minOut, orderId: plan.orderId!,
      },
    },
  };
}

const ui = (over: Partial<UiToken>): UiToken => ({
  key: '', chain: '', chainId: 0, chainName: '', chainLogo: '', chain_type: 'EVM', address: '', symbol: '', name: '', logo: '', decimals: 6, priceUsd: null, verified: true, ...over,
});

export const ICP_FIXTURE = {
  quote, guard: GUARD, canisterEvm: CANISTER, nowMs: quote.quotedAt * 1000, nowNs: NOW_NS, caller: ICP_ME,
  from: ui({ chain: 'icp:737ba355e855bd4b61279056603e0550', chainId: 0, chain_type: 'ICP', address: CKUSDC, canisterId: CKUSDC, symbol: 'ckUSDC', decimals: 6 }),
  to: ui({ chain: quote.toChain, chainId: 8453, address: quote.toToken.address.toLowerCase(), symbol: quote.toToken.symbol, decimals: quote.toToken.decimals }),
  recipient: base.order!.payout.recipient as Hex,
};
