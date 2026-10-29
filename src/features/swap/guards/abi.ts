import { Principal } from '@icp-sdk/core/principal';
import { concat, encodeAbiParameters, hashTypedData, hexToBytes, keccak256, numberToBytes, parseAbi, parseAbiParameters, stringToBytes, type Hex } from 'viem';
import type { OrderJson, PoolTerms } from '@/lib/api';
import { GuardError } from './errors';

export const PERMIT2 = '0x000000000022D473030F116dDEE9F6B43aC78BA3' as const;
/** KyberSwap's router and executor, one address on every chain (canister/types/src/swapic/mod.rs:1154-1194). */
export const KYBER_ROUTER = '0x6131b5fae19ea4f9d964eac0408e4408b66337b5' as const;
export const KYBER_EXECUTOR = '0x8f10b468b06c6fd214b65f87778827f7d113f996' as const;
const NATIVE = ['0x0000000000000000000000000000000000000000', '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'];

export const sameAddress = (a?: string | null, b?: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
export const isNative = (a: string) => NATIVE.includes(a.toLowerCase());
/** The quoter writes the coin as the zero address, the order as 0xEeee…EEeE (contract 1.2). */
export const sameToken = (a: string, b: string) => (isNative(a) && isNative(b)) || sameAddress(a, b);

/** libraries/onchain/src/swapic/mod.rs:100-103 (viem orders referenced types by name: Payout, Step, Write). */
export const ORDER_TYPES = {
  Order: [
    { name: 'ref', type: 'bytes32' }, { name: 'payer', type: 'address' }, { name: 'tokenIn', type: 'address' },
    { name: 'amountIn', type: 'uint256' }, { name: 'deadline', type: 'uint256' }, { name: 'steps', type: 'Step[]' },
    { name: 'payout', type: 'Payout' },
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
  ],
} as const;

/** Swapic.run(Order), libraries/onchain/src/swapic/mod.rs:64. */
export const SWAPIC_RUN_ABI = [
  { type: 'function', name: 'run', stateMutability: 'payable', inputs: [{ name: 'order', ...ORDER_TUPLE }], outputs: [{ name: 'id', type: 'bytes32' }] },
] as const;

/** The calls a step may make, as the canister reads them (canister/types/src/swapic/mod.rs:60-147). */
export const STEP_ABI = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function depositForBurnWithHook(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken, bytes32 destinationCaller, uint256 maxFee, uint32 minFinalityThreshold, bytes hookData)',
  'struct EcoTokenAmount { address token; uint256 amount; }',
  'struct EcoReward { uint64 deadline; address creator; address prover; uint256 nativeAmount; EcoTokenAmount[] tokens; }',
  'function publishAndFund(uint64 destination, bytes route, EcoReward reward, bool allowPartial) payable returns (bytes32, address)',
  'struct Recipe { address target; bytes data; address scaler; }',
  'function fill(address token, uint256 amount, bytes envelope, Recipe recipe)',
  'struct SwapDescription { address srcToken; address dstToken; address[] srcReceivers; uint256[] srcAmounts; address[] feeReceivers; uint256[] feeAmounts; address dstReceiver; uint256 amount; uint256 minReturnAmount; uint256 flags; bytes permit; }',
  'struct SwapExecution { address callTarget; address approveTarget; bytes targetData; SwapDescription desc; bytes clientData; }',
  'function swap(SwapExecution execution) payable returns (uint256, uint256)',
]);
/** Eco Portal v2.12's Route (libraries/onchain/src/eco/mod.rs:15-46 in the services worktree). */
export const ECO_ROUTE = parseAbiParameters(
  '(bytes32 salt, uint64 deadline, address portal, uint256 nativeAmount, (address token, uint256 amount)[] tokens, (address target, bytes data, uint256 value)[] calls)',
);

export interface OrderValue {
  ref: Hex; payer: Hex; tokenIn: Hex; amountIn: bigint; deadline: bigint;
  steps: readonly { target: Hex; data: Hex; token: Hex; min: bigint; writes: readonly { at: number; minus: bigint }[] }[];
  payout: { token: Hex; recipient: Hex; minOut: bigint };
}

export function orderValue(o: OrderJson): OrderValue {
  return {
    ref: o.ref as Hex, payer: o.payer as Hex, tokenIn: o.tokenIn as Hex, amountIn: BigInt(o.amountIn), deadline: BigInt(o.deadline),
    steps: o.steps.map((s) => ({
      target: s.target as Hex, data: s.data as Hex, token: s.token as Hex, min: BigInt(s.min),
      writes: s.writes.map((w) => ({ at: w.at, minus: BigInt(w.minus) })),
    })),
    payout: { token: o.payout.token as Hex, recipient: o.payout.recipient as Hex, minOut: BigInt(o.payout.minOut) },
  };
}

export function orderJsonOf(o: OrderValue): Omit<OrderJson, 'abi'> {
  return {
    ref: o.ref, payer: o.payer, tokenIn: o.tokenIn, amountIn: o.amountIn.toString(), deadline: o.deadline.toString(),
    steps: o.steps.map((s) => ({ target: s.target, data: s.data, token: s.token, min: s.min.toString(), writes: s.writes.map((w) => ({ at: w.at, minus: w.minus.toString() })) })),
    payout: { token: o.payout.token, recipient: o.payout.recipient, minOut: o.payout.minOut.toString() },
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

const word = (v: string | bigint) => numberToBytes(BigInt(v), { size: 32 });
const principalBytes = (text: string) => {
  try { return Principal.fromText(text).toUint8Array(); } catch { throw new GuardError('poolTerms'); }
};

/** An EVM owner is `0x01 ‖ address`; an ICP owner `0x02 ‖ length ‖ principal ‖ 32 byte subaccount` (zeros for none).
 *  The services write an ICP account as `principal` or `principal.<64 hex>` (libraries/common/src/canister/pool/mod.rs:433-462). */
function ownerHash(account: string): Hex {
  if (/^0x[0-9a-fA-F]{40}$/.test(account)) return keccak256(concat([new Uint8Array([1]), hexToBytes(account as Hex)]));
  const [p, sub] = account.split('.');
  if (sub !== undefined && !/^[0-9a-fA-F]{64}$/.test(sub)) throw new GuardError('poolTerms');
  const bytes = principalBytes(p!);
  return keccak256(concat([new Uint8Array([2, bytes.length]), bytes, sub ? hexToBytes(`0x${sub}`) : new Uint8Array(32)]));
}

/** A pool deposit's ref, the canister's formula: keccak256(tag ‖ owner ‖ details ‖ salt) (canister/types/src/pool/mod.rs:200-272).
 *  A swap's details commit token out, least out, premium and ICP fees; a stake's its rebalancing share. */
export function poolRefOf(t: PoolTerms): Hex {
  if (!/^0x[0-9a-fA-F]{64}$/.test(t.salt)) throw new GuardError('poolTerms');
  const tag = keccak256(stringToBytes(t.kind === 'swap' ? 'swapic.pool.v1.swap' : 'swapic.pool.v1.stake'));
  let details: Hex;
  if (t.kind === 'swap') {
    const token = principalBytes(t.tokenOut ?? '');
    details = keccak256(concat([new Uint8Array([token.length]), token, word(t.minOut ?? '0'), word(t.premium), word(t.icpFees)]));
  } else {
    details = keccak256(word(t.rebalanceShare));
  }
  return keccak256(concat([hexToBytes(tag), hexToBytes(ownerHash(t.account)), hexToBytes(details), hexToBytes(t.salt as Hex)])).toLowerCase() as Hex;
}
