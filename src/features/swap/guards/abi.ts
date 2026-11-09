import { encodeAbiParameters, hashTypedData, parseAbi, parseAbiParameters, type Hex } from 'viem';
import type { OrderJson } from '@/lib/api';

export const PERMIT2 = '0x000000000022D473030F116dDEE9F6B43aC78BA3' as const;
/** KyberSwap's router and executor, one address on every chain (canister/types/src/swapic/mod.rs:1154-1194). */
export const KYBER_ROUTER = '0x6131b5fae19ea4f9d964eac0408e4408b66337b5' as const;
export const KYBER_EXECUTOR = '0x8f10b468b06c6fd214b65f87778827f7d113f996' as const;
const NATIVE = ['0x0000000000000000000000000000000000000000', '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'];

export const sameAddress = (a?: string | null, b?: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
export const isNative = (a: string) => NATIVE.includes(a.toLowerCase());
/** The quoter writes the coin as the zero address, the order as 0xEeee…EEeE (contract 1.2). */
export const sameToken = (a: string, b: string) => (isNative(a) && isNative(b)) || sameAddress(a, b);

/** The Swapic Order, its memo last (tests/fixtures/golden/interface.json `type_string`; viem orders referenced types by
 *  name: Payout, Step, Write). */
export const ORDER_TYPES = {
  Order: [
    { name: 'ref', type: 'bytes32' }, { name: 'payer', type: 'address' }, { name: 'tokenIn', type: 'address' },
    { name: 'amountIn', type: 'uint256' }, { name: 'deadline', type: 'uint256' }, { name: 'steps', type: 'Step[]' },
    { name: 'payout', type: 'Payout' }, { name: 'memo', type: 'bytes' },
  ],
  Step: [
    { name: 'target', type: 'address' }, { name: 'data', type: 'bytes' }, { name: 'token', type: 'address' },
    { name: 'min', type: 'uint256' }, { name: 'writes', type: 'Write[]' },
  ],
  Write: [{ name: 'at', type: 'uint32' }, { name: 'minus', type: 'uint256' }],
  Payout: [{ name: 'token', type: 'address' }, { name: 'recipient', type: 'address' }, { name: 'minOut', type: 'uint256' }],
} as const;

export const ORDER_TUPLE = {
  type: 'tuple',
  components: [
    { name: 'ref', type: 'bytes32' }, { name: 'payer', type: 'address' }, { name: 'tokenIn', type: 'address' },
    { name: 'amountIn', type: 'uint256' }, { name: 'deadline', type: 'uint256' },
    {
      name: 'steps', type: 'tuple[]',
      components: [
        { name: 'target', type: 'address' }, { name: 'data', type: 'bytes' }, { name: 'token', type: 'address' },
        { name: 'min', type: 'uint256' },
        { name: 'writes', type: 'tuple[]', components: [{ name: 'at', type: 'uint32' }, { name: 'minus', type: 'uint256' }] },
      ],
    },
    { name: 'payout', type: 'tuple', components: [{ name: 'token', type: 'address' }, { name: 'recipient', type: 'address' }, { name: 'minOut', type: 'uint256' }] },
    { name: 'memo', type: 'bytes' },
  ],
} as const;

/** Swapic.run(Order). */
export const SWAPIC_RUN_ABI = [
  { type: 'function', name: 'run', stateMutability: 'payable', inputs: [{ name: 'order', ...ORDER_TUPLE }], outputs: [{ name: 'id', type: 'bytes32' }] },
] as const;

/** Swapic.runWithPermit2(Order, Permit2Auth), selector 0x21be144a: the payer's own transaction, its input pulled through
 *  Permit2. Apart from SWAPIC_RUN_ABI, so a route's `tx` can only ever read as run(Order). */
export const SWAPIC_PERMIT2_ABI = [
  {
    type: 'function', name: 'runWithPermit2', stateMutability: 'nonpayable',
    inputs: [
      { name: 'o', ...ORDER_TUPLE },
      { name: 'a', type: 'tuple', components: [{ name: 'nonce', type: 'uint256' }, { name: 'deadline', type: 'uint256' }, { name: 'signature', type: 'bytes' }] },
    ],
    outputs: [{ name: 'id', type: 'bytes32' }],
  },
] as const;

/** The calls a step may make, as the canister reads them (canister/types/src/swapic/mod.rs:60-147). */
export const STEP_ABI = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function depositForBurnWithHook(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken, bytes32 destinationCaller, uint256 maxFee, uint32 minFinalityThreshold, bytes hookData)',
  'function depositErc20(address erc20Address, uint256 amount, bytes32 principal, bytes32 subaccount)',
  'struct EcoTokenAmount { address token; uint256 amount; }',
  'struct EcoReward { uint64 deadline; address creator; address prover; uint256 nativeAmount; EcoTokenAmount[] tokens; }',
  'function publishAndFund(uint64 destination, bytes route, EcoReward reward, bool allowPartial) payable returns (bytes32, address)',
  'struct Recipe { address target; bytes data; address scaler; }',
  'function fill(address token, uint256 amount, bytes envelope, Recipe recipe)',
  'struct SwapDescription { address srcToken; address dstToken; address[] srcReceivers; uint256[] srcAmounts; address[] feeReceivers; uint256[] feeAmounts; address dstReceiver; uint256 amount; uint256 minReturnAmount; uint256 flags; bytes permit; }',
  'struct SwapExecution { address callTarget; address approveTarget; bytes targetData; SwapDescription desc; bytes clientData; }',
  'function swap(SwapExecution execution) payable returns (uint256, uint256)',
  // Across's SpokePoolPeriphery (selector 0x110560ad) and MulticallHandler (BSC design 7.1, 7.3)
  'struct AcrossFees { uint256 amount; address recipient; }',
  'struct BaseDepositData { address inputToken; bytes32 outputToken; uint256 outputAmount; address depositor; bytes32 recipient; uint256 destinationChainId; bytes32 exclusiveRelayer; uint32 quoteTimestamp; uint32 fillDeadline; uint32 exclusivityParameter; bytes message; }',
  'struct SwapAndDepositData { AcrossFees submissionFees; BaseDepositData depositData; address swapToken; address exchange; uint8 transferType; uint256 swapTokenAmount; uint256 minExpectedInputTokenAmount; bytes routerCalldata; bool enableProportionalAdjustment; address spokePool; uint256 nonce; }',
  'function swapAndBridge(SwapAndDepositData swapAndDepositData) payable',
  'struct Replacement { address token; uint256 offset; }',
  'function makeCallWithBalance(address target, bytes callData, uint256 value, Replacement[] replacement)',
  'function balanceOf(address owner) view returns (uint256)',
]);
/** Eco Portal v2.12's Route (libraries/onchain/src/eco/mod.rs:15-46 in the services worktree). */
export const ECO_ROUTE = parseAbiParameters(
  '(bytes32 salt, uint64 deadline, address portal, uint256 nativeAmount, (address token, uint256 amount)[] tokens, (address target, bytes data, uint256 value)[] calls)',
);

export interface OrderValue {
  ref: Hex; payer: Hex; tokenIn: Hex; amountIn: bigint; deadline: bigint;
  steps: readonly { target: Hex; data: Hex; token: Hex; min: bigint; writes: readonly { at: number; minus: bigint }[] }[];
  payout: { token: Hex; recipient: Hex; minOut: bigint };
  /** A pool deposit's encoded terms (memo.ts); `0x` on every other order. */
  memo: Hex;
}

export function orderValue(o: OrderJson): OrderValue {
  return {
    ref: o.ref as Hex, payer: o.payer as Hex, tokenIn: o.tokenIn as Hex, amountIn: BigInt(o.amountIn), deadline: BigInt(o.deadline),
    steps: o.steps.map((s) => ({
      target: s.target as Hex, data: s.data as Hex, token: s.token as Hex, min: BigInt(s.min),
      writes: s.writes.map((w) => ({ at: w.at, minus: BigInt(w.minus) })),
    })),
    payout: { token: o.payout.token as Hex, recipient: o.payout.recipient as Hex, minOut: BigInt(o.payout.minOut) },
    memo: (o.memo ?? '0x').toLowerCase() as Hex,
  };
}

export function orderJsonOf(o: OrderValue): Omit<OrderJson, 'abi'> {
  return {
    ref: o.ref, payer: o.payer, tokenIn: o.tokenIn, amountIn: o.amountIn.toString(), deadline: o.deadline.toString(),
    steps: o.steps.map((s) => ({ target: s.target, data: s.data, token: s.token, min: s.min.toString(), writes: s.writes.map((w) => ({ at: w.at, minus: w.minus.toString() })) })),
    payout: { token: o.payout.token, recipient: o.payout.recipient, minOut: o.payout.minOut.toString() },
    memo: o.memo,
  };
}

export const orderAbi = (o: OrderValue): Hex => encodeAbiParameters([ORDER_TUPLE], [o as never]);

/** The order id: the EIP-712 digest under Swapic v3 on that chain (answer/mod.rs:476-479). */
export function orderIdOf(o: OrderValue, chainId: number, swapic: Hex): Hex {
  return hashTypedData({
    domain: { name: 'Swapic', version: '3', chainId, verifyingContract: swapic },
    types: ORDER_TYPES, primaryType: 'Order', message: o,
  }).toLowerCase() as Hex;
}
