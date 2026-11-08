// Design note (the Solana guard, design 5.5, attack H2). Only bytes this file passed reach the wallet. Must never happen: a
// transaction that pays someone other than the screen's recipient, another token, another chain, or less than the screen
// shows; a fee payer other than the user or the canister's own key (a burn); the canister as anyone's fee payer on a swap
// inside Solana; an instruction this file does not know. How the design proves it: the message is decoded here, every
// instruction is read against the same rules as the canister's co-sign checker (canister/impl/src/solana/cosign) plus the
// user's own interest, every address is computed here or read from the canister's config, never from the quoter. A lookup table
// that cannot be read refuses the swap. Tests: solana.test.ts, on bytes the Rust wire crate composed and real Jupiter answers.
import { bytesToHex, keccak256, type Hex } from 'viem';
import type { Quote, Route, SolanaBurnPayment, SolanaOrderPayment } from '@/lib/api';
import { decode58, encode58 } from '@/lib/solana/base58';
import {
  ATA_PROGRAM, COMPUTE_BUDGET, FORWARD_MAGIC, JUPITER, JUPITER_SPONSOR, JUPITER_Z, SYSTEM_PROGRAM, TOKEN_2022_PROGRAM, TOKEN_PROGRAM, USDC_MINT,
  WSOL_MINT, ataOf, shardsOf,
} from '@/lib/solana/pda';
import { decodeV0, fromBase64, resolveAccounts, unsignedWire, type CompiledIx, type V0Message } from '@/lib/solana/tx';
import type { TableRead } from '@/lib/solana/rpc';
import { chainKind, SOLANA_CHAIN } from '@/lib/explorer';
import { sameAddress, sameToken } from './abi';
import type { GuardContext } from './context';
import { GuardError, must } from './errors';
import { decodeMemo } from './memo';

const FLAG_FAST = 1 << 2;
const FLAG_SUBACCOUNT = 1 << 3;
const FLAG_EVENT_KEYPAIR = 1 << 4;
const FLAG_FLOAT = 1 << 5;
const FLAG_MEMO = 1 << 6;
const FLAG_RESERVED = 1 << 7;
const TAG_SWAP_BURN = 1;
const TAG_BURN = 2;

export type BurnAction = 'deliver' | 'swap' | 'ckDeposit';
export interface BurnArgs {
  tag: number; fast: boolean; eventKeypair: boolean; float: boolean; domain: number;
  /** The ref, given or the memo's keccak. */
  ref: Hex; memo: Uint8Array | null; deadline: number; recipient: Hex; action: BurnAction;
  tokenOut: Hex | null; minOut: bigint | null; minGas: number; maxFeeDeciBps: number; amount: bigint; fee: number; jupiter: Uint8Array;
}

class Bytes {
  at = 0;
  constructor(readonly b: Uint8Array) {}
  take(n: number) {
    must(this.at + n <= this.b.length, 'solanaArgs');
    const out = this.b.slice(this.at, this.at + n);
    this.at += n;
    return out;
  }
  u8() { return this.take(1)[0]!; }
  le(n: number) {
    let v = 0n;
    const s = this.take(n);
    for (let i = n - 1; i >= 0; i--) v = (v << 8n) | BigInt(s[i]!);
    return v;
  }
}

const hex = (b: Uint8Array) => bytesToHex(b).toLowerCase() as Hex;
const isZero = (b: Uint8Array) => b.every((x) => x === 0);
const beNumber = (b: Uint8Array) => b.reduce((v, x) => (v << 8n) | BigInt(x), 0n);

/** The program's compact arguments, read as `BurnArgs::decode` reads them: a refusal there is a refusal here. */
export function readBurnArgs(data: Uint8Array): BurnArgs {
  const r = new Bytes(data);
  const tag = r.u8();
  must(tag === TAG_SWAP_BURN || tag === TAG_BURN, 'solanaArgs');
  const flags = r.u8();
  must((flags & FLAG_RESERVED) === 0, 'solanaArgs');
  const bits = flags & 3;
  must(bits < 3, 'solanaArgs');
  const action: BurnAction = bits === 0 ? 'deliver' : bits === 1 ? 'swap' : 'ckDeposit';
  const domain = r.u8();
  let ref: Hex;
  let memo: Uint8Array | null = null;
  if (flags & FLAG_MEMO) {
    must(action === 'deliver', 'solanaArgs');
    const m = r.u8();
    must(m > 0, 'solanaArgs');
    memo = r.take(m);
    ref = keccak256(memo).toLowerCase() as Hex;
  } else {
    ref = hex(r.take(32));
  }
  const deadline = Number(r.le(4));
  const recipient = r.take(20);
  must(!isZero(recipient), 'solanaArgs');
  must(!(flags & FLAG_SUBACCOUNT) || action === 'ckDeposit', 'solanaArgs');
  let tokenOut: Hex | null = null;
  let minOut: bigint | null = null;
  if (action === 'swap') {
    const token = r.take(20);
    must(!isZero(token), 'solanaArgs');
    tokenOut = hex(token);
    const n = r.u8();
    must(n > 0 && n <= 32, 'solanaArgs');
    const least = r.take(n);
    must(!isZero(least), 'solanaArgs');
    minOut = beNumber(least);
  } else if (action === 'ckDeposit') {
    // the app offers no ck deposit out of Solana
    throw new GuardError('solanaArgs');
  }
  const minGas = Number(r.le(4));
  must((action === 'deliver') === (minGas === 0), 'solanaArgs');
  const maxFeeDeciBps = Number(r.le(2));
  const amount = r.le(8);
  const fee = Number(r.le(4));
  const jupiter = data.slice(r.at);
  must(tag !== TAG_BURN || jupiter.length === 0, 'solanaArgs');
  return {
    tag, fast: !!(flags & FLAG_FAST), eventKeypair: !!(flags & FLAG_EVENT_KEYPAIR), float: !!(flags & FLAG_FLOAT), domain, ref, memo,
    deadline, recipient: hex(recipient), action, tokenOut, minOut, minGas, maxFeeDeciBps, amount, fee, jupiter,
  };
}

const ROUTE_V2 = '0xbb64facc31c4af14';
const SHARED_ROUTE_V2 = '0xd19853937cfed8e9';
const JUPITER_Z_FILL = '0xa860b7a35c0a28a0';

export interface JupiterRoute {
  inAmount: bigint; minimumOut: bigint;
  /** Where the route holds its parties, by account slot. */
  authority: number; source: number; destination: number; sourceMint: number; destinationMint: number;
}

/** One of the two Jupiter routes, its amounts read where the wire crate reads them; any other instruction is refused. */
export function readJupiterRoute(data: Uint8Array): JupiterRoute {
  const name = bytesToHex(data.slice(0, 8));
  must(name === ROUTE_V2 || name === SHARED_ROUTE_V2, 'solanaJupiter');
  const shared = name === SHARED_ROUTE_V2;
  const r = new Bytes(data.slice(shared ? 9 : 8));
  const inAmount = r.le(8);
  const quoted = r.le(8);
  const slippage = r.le(2);
  must(slippage <= 10_000n, 'solanaJupiter');
  return {
    inAmount,
    minimumOut: (quoted * (10_000n - slippage)) / 10_000n,
    authority: shared ? 1 : 0, source: shared ? 2 : 1, destination: shared ? 5 : 2, sourceMint: shared ? 6 : 3, destinationMint: shared ? 7 : 4,
  };
}

const maxFeeOf = (amount: bigint, deciBps: number) => (amount * BigInt(deciBps) + 99_999n) / 100_000n;

interface Tables { read: TableRead }

async function tablesOf(m: V0Message, t: Tables): Promise<Map<string, readonly string[]>> {
  const out = new Map<string, readonly string[]>();
  for (const l of m.lookups) {
    const entries = await t.read(l.table);
    must(!!entries, 'solanaTable');
    out.set(l.table, entries!);
  }
  return out;
}

/** The user's own account of `mint`, under either token program. */
const ownAccounts = (user: string, mint: string) => [ataOf(user, mint, TOKEN_PROGRAM), ataOf(user, mint, TOKEN_2022_PROGRAM)];

/** An instruction beside the swap: compute budget always; the rest only on the user's own accounts of the mints it swaps. */
function readSideInstruction(ix: CompiledIx, accounts: readonly string[], user: string, mints: readonly string[]): void {
  const at = (slot: number) => accounts[ix.accounts[slot]!];
  if (ix.program === ATA_PROGRAM) {
    // CreateIdempotent, paid by anyone, for the user
    must(ix.data.length === 1 && ix.data[0] === 1 && ix.accounts.length === 6, 'solanaSide');
    must(at(2) === user && mints.includes(at(3)!), 'solanaSide');
    return;
  }
  const wsol = ataOf(user, WSOL_MINT, TOKEN_PROGRAM);
  if (ix.program === SYSTEM_PROGRAM) {
    // wrapping the user's own SOL: a transfer from the user to their own wrapped account, and nothing else
    must(ix.data.length === 12 && ix.data[0] === 2 && ix.data[1] === 0 && ix.data[2] === 0 && ix.data[3] === 0, 'solanaSide');
    must(at(0) === user && at(1) === wsol, 'solanaSide');
    return;
  }
  if (ix.program === TOKEN_PROGRAM) {
    const kind = ix.data[0];
    // SyncNative on the user's wrapped account; CloseAccount of it back to the user. Approve, SetAuthority and the rest: no.
    if (kind === 17) { must(ix.data.length === 1 && at(0) === wsol, 'solanaSide'); return; }
    if (kind === 9) { must(ix.data.length === 1 && at(0) === wsol && at(1) === user && at(2) === user, 'solanaSide'); return; }
  }
  throw new GuardError('solanaProgram');
}

function readComputeBudget(ix: CompiledIx): { limit?: number; price?: bigint } {
  must(ix.accounts.length === 0, 'solanaCompute');
  const r = new Bytes(ix.data);
  const kind = r.u8();
  if (kind === 2) return { limit: Number(r.le(4)) };
  if (kind === 3) return { price: r.le(8) };
  throw new GuardError('solanaCompute');
}

export interface SolanaCheckInput {
  quote: Quote; route: Route; mode: 'gasless' | 'userPays';
  /** The connected wallet, case exact. */
  user: string;
  /** The EVM address, or the ICP principal, the screen shows; on a swap inside Solana, the wallet. */
  recipient: string;
  fromToken: string; toToken: string; amountIn: bigint; shownMin: bigint;
  guard: GuardContext | undefined; tables: TableRead; nowSec: number;
}

export interface CheckedSolana {
  kind: 'burn' | 'order';
  /** The bytes the wallet signs. */
  wire: Uint8Array;
  /** The order the watcher follows. */
  orderId: Hex;
  requestId: string | null;
  gasless: boolean;
  minOut: bigint;
}

const MIN_LIFE_S = 60;
const MAX_LIFE_S = 7_200;

/** What needs no table: the fee payer, the programs, the arguments against the screen. A route that fails this is no card. */
export function checkBurnBytes(i: SolanaCheckInput, p: SolanaBurnPayment) {
  const anchors = i.guard?.solana;
  must(!!anchors, 'noAnchor');
  const a = anchors!;
  must(p.kind === 'burn' && p.version === 0, 'solanaShape');
  const m = decodeV0(fromBase64(p.message));
  must(!!m, 'solanaMessage');
  const msg = m!;
  const gasless = i.mode === 'gasless';
  const feePayer = gasless ? a.payerKey : i.user;
  must(msg.keys[0] === feePayer && p.feePayer === feePayer, 'solanaFeePayer');
  must(msg.blockhash === p.blockhash, 'solanaBlockhash');
  must(msg.requiredSignatures === (gasless ? 2 : 1), 'solanaSigners');
  must(!gasless || msg.keys[1] === i.user, 'solanaSigners');
  must(i.user !== a.payerKey && i.user !== a.adminKey, 'solanaSigners');
  // the tables the answer names are the message's: read for the table check, and never another
  must(msg.lookups.every((l) => p.lookupTables.includes(l.table)) && p.lookupTables.length === msg.lookups.length, 'solanaTable');

  const swaps = msg.instructions.filter((ix) => ix.program === a.programId);
  must(swaps.length === 1, 'solanaProgram');
  const burn = swaps[0]!;
  const budget: { limit?: number; price?: bigint } = {};
  for (const ix of msg.instructions) {
    if (ix.program === COMPUTE_BUDGET) Object.assign(budget, readComputeBudget(ix));
    else if (ix.program !== a.programId) must(!gasless, 'solanaProgram'); // a gasless burn is exactly limit, price, burn
  }
  must(budget.limit !== undefined && budget.price !== undefined, 'solanaCompute');
  must(budget.limit! <= a.maxCuLimit && budget.price! <= a.maxCuPrice, 'solanaCompute');

  const args = readBurnArgs(burn.data);
  must(args.fast && !args.eventKeypair, 'solanaArgs');
  must(args.float === gasless, 'solanaArgs');
  must(args.ref === p.reference.toLowerCase(), 'solanaRef');
  must(args.deadline > i.nowSec + MIN_LIFE_S && args.deadline <= i.nowSec + MAX_LIFE_S, 'expired');
  must(BigInt(args.fee) === BigInt(i.route.fees.network), 'solanaFee');
  must(args.maxFeeDeciBps <= a.maxFeeDeciBps, 'solanaFee');
  // what is burned at least, and what arrives at least, whatever Circle keeps of its most
  const burned = args.amount - BigInt(args.fee);
  must(burned > 0n, 'solanaFee');
  const least = burned - maxFeeOf(burned, args.maxFeeDeciBps);

  const isPool = !!p.memo;
  const poolChain = i.guard!.config.poolChain;
  const toKind = chainKind(i.quote.toChain);
  const chain = isPool ? poolChain : toKind?.kind === 'evm' ? toKind.id : null;
  must(chain !== null && i.guard!.config.cctpDomains.get(chain!) === args.domain, 'toChain');
  const destination = i.guard!.config.chains.get(chain!);
  must(!!destination, 'toChain');
  const d = destination!;
  must(![d.swapic, d.runner, d.cctpReceiver].some((own) => sameAddress(own, args.recipient)), 'recipient');
  if (isPool) {
    must(!!args.memo && hex(args.memo!) === p.memo!.toLowerCase(), 'memo');
    const t = decodeMemo(p.memo! as Hex);
    must(t.kind === 'swap', 'memo');
    if (t.kind === 'swap') {
      must(t.recipient.subaccount === null && t.recipient.owner === i.recipient, 'recipient');
      must(t.tokenOut === i.toToken, 'tokenOut');
      must(t.minOut === BigInt(i.route.amountOutMin) && t.minOut >= i.shownMin, 'minOut');
      must(t.minUsdc > 0n && t.minUsdc <= least, 'poolLeast');
    }
    must(args.action === 'deliver' && !!i.guard!.canisterEvm && sameAddress(args.recipient, i.guard!.canisterEvm), 'recipient');
  } else {
    must(sameAddress(args.recipient, i.recipient), 'recipient');
    if (args.action === 'swap') {
      must(!sameAddress(args.tokenOut, d.usdc) && sameToken(args.tokenOut!, i.toToken), 'tokenOut');
      must(args.minOut! >= i.shownMin, 'minOut');
    } else {
      must(sameAddress(i.toToken, d.usdc), 'tokenOut');
      must(least >= i.shownMin, 'minOut');
    }
  }
  return { msg, burn, args, gasless, anchors: a };
}

/** The burn account slots of the program's instruction (solana/program burn). */
const SLOT = { user: 0, canister: 2, auth: 3, vault: 4, tail: 21, route: 22 };

export async function verifySolanaBurn(i: SolanaCheckInput): Promise<CheckedSolana> {
  const p = i.route.solana;
  must(!!p && p.kind === 'burn', 'solanaShape');
  const pay = p as SolanaBurnPayment;
  const { msg, burn, args, gasless, anchors } = checkBurnBytes(i, pay);
  const tables = await tablesOf(msg, { read: i.tables });
  const accounts = resolveAccounts(msg, tables);
  must(!!accounts, 'solanaTable');
  const all = accounts!;
  const at = (slot: number) => all[burn.accounts[slot]!];
  must(at(SLOT.user) === i.user, 'solanaSigners');
  must(at(SLOT.canister) === anchors.payerKey, 'solanaSigners');
  const shard = Number(BigInt(args.ref) & 3n);
  const own = shardsOf(anchors.programId)[shard]!;
  must(at(SLOT.auth) === own.auth && at(SLOT.vault) === own.vault, 'solanaShard');

  const mints = [i.fromToken, USDC_MINT, WSOL_MINT];
  for (const ix of msg.instructions) {
    if (ix.program === COMPUTE_BUDGET || ix === burn) continue;
    readSideInstruction(ix, all, i.user, mints);
  }
  if (args.tag === TAG_BURN) {
    must(i.fromToken === USDC_MINT && args.amount === i.amountIn, 'amountIn');
    must(at(SLOT.tail) === ataOf(i.user, USDC_MINT), 'solanaSource');
  } else {
    must(at(SLOT.tail) === JUPITER, 'solanaJupiter');
    const route = readJupiterRoute(args.jupiter);
    must(route.inAmount === i.amountIn, 'amountIn');
    const slot = (n: number) => all[burn.accounts[SLOT.route + n]!];
    must(slot(route.authority) === i.user, 'solanaSource');
    must(ownAccounts(i.user, i.fromToken).includes(slot(route.source)!), 'solanaSource');
    must(slot(route.sourceMint) === i.fromToken && slot(route.destinationMint) === USDC_MINT, 'tokenIn');
    must(slot(route.destination) === own.vault, 'solanaDestination');
  }
  return {
    kind: 'burn',
    wire: unsignedWire(fromBase64(pay.message), msg.requiredSignatures),
    orderId: args.ref,
    requestId: null,
    gasless,
    minOut: BigInt(i.route.amountOutMin),
  };
}

/** The destination of a swap inside Solana: the user's own account of the mint, or the placeholder JupiterZ writes for SOL. */
function isOwnOutput(address: string | undefined, user: string, mint: string): boolean {
  if (!address) return false;
  if (ownAccounts(user, mint).includes(address)) return true;
  return mint === WSOL_MINT && address === user;
}

/**
 * A swap inside Solana: the guard is the only Swapic wall on this route (attack H2). Fails closed on any instruction it does
 * not know; the canister is nobody's fee payer here.
 */
export async function verifySolanaOrder(i: SolanaCheckInput): Promise<CheckedSolana> {
  const p = i.route.solana;
  must(!!p && p.kind === 'order', 'solanaShape');
  const pay = p as SolanaOrderPayment;
  const anchors = i.guard?.solana;
  must(!!anchors, 'noAnchor');
  must(i.quote.fromChain === SOLANA_CHAIN && i.quote.toChain === SOLANA_CHAIN, 'toChain');
  const wire = fromBase64(pay.transaction);
  const body = readUnsignedMessage(wire);
  const m = decodeV0(body.message);
  must(!!m, 'solanaMessage');
  const msg = m!;
  const payer = msg.keys[0]!;
  must(payer !== anchors!.payerKey && payer !== anchors!.adminKey, 'solanaFeePayer');
  must(payer === (pay.signatureFeePayer ?? i.user), 'solanaFeePayer');
  must(msg.keys.slice(0, msg.requiredSignatures).includes(i.user), 'solanaSigners');
  const accounts = resolveAccounts(msg, await tablesOf(msg, { read: i.tables }));
  must(!!accounts, 'solanaTable');
  const all = accounts!;
  const mints = [i.fromToken, i.toToken, WSOL_MINT];
  let swaps = 0;
  for (const ix of msg.instructions) {
    if (ix.program === COMPUTE_BUDGET) { readComputeBudget(ix); continue; }
    if (ix.program === JUPITER) {
      const route = readJupiterRoute(ix.data);
      const slot = (n: number) => all[ix.accounts[n]!];
      must(route.inAmount === i.amountIn, 'amountIn');
      must(slot(route.authority) === i.user, 'solanaSource');
      must(ownAccounts(i.user, i.fromToken).includes(slot(route.source)!), 'solanaSource');
      must(slot(route.sourceMint) === i.fromToken && slot(route.destinationMint) === i.toToken, 'tokenIn');
      must(isOwnOutput(slot(route.destination), i.user, i.toToken), 'recipient');
      must(route.minimumOut >= i.shownMin, 'minOut');
      swaps++;
      continue;
    }
    if (ix.program === JUPITER_Z) {
      must(bytesToHex(ix.data.slice(0, 8)) === JUPITER_Z_FILL && ix.accounts.length >= 11, 'solanaJupiter');
      // a market maker's fill, paid by that market maker, never by a sponsor or the user
      const slot = (n: number) => all[ix.accounts[n]!];
      must(payer !== i.user && payer !== JUPITER_SPONSOR && slot(1) === payer, 'solanaFeePayer');
      must(slot(0) === i.user, 'solanaSource');
      must(slot(6) === i.fromToken && slot(8) === i.toToken, 'tokenIn');
      // the program stands in for the user's account where the coin itself moves
      must(i.fromToken === WSOL_MINT ? slot(2) === JUPITER_Z : ownAccounts(i.user, i.fromToken).includes(slot(2)!), 'solanaSource');
      must(i.toToken === WSOL_MINT ? slot(4) === JUPITER_Z : ownAccounts(i.user, i.toToken).includes(slot(4)!), 'recipient');
      const r = new Bytes(ix.data.slice(8));
      must(r.le(8) === i.amountIn, 'amountIn');
      must(r.le(8) >= i.shownMin, 'minOut');
      swaps++;
      continue;
    }
    readSideInstruction(ix, all, i.user, mints);
  }
  must(swaps === 1, 'solanaJupiter');
  return {
    kind: 'order',
    wire,
    orderId: keccak256(new TextEncoder().encode(pay.requestId)).toLowerCase() as Hex,
    requestId: pay.requestId,
    gasless: pay.gasless,
    minOut: BigInt(i.route.amountOutMin),
  };
}

function readUnsignedMessage(wire: Uint8Array): { message: Uint8Array } {
  // the signature slots come first, by their compact count
  let count = 0;
  let at = 0;
  for (let i = 0; i < 3; i++) {
    const b = wire[at++];
    must(b !== undefined, 'solanaMessage');
    count |= (b! & 0x7f) << (7 * i);
    if (!(b! & 0x80)) break;
  }
  return { message: wire.slice(at + count * 64) };
}

/** A route's check before any table is read: whether it may be a card at all. */
export function solanaRouteOffered(i: Omit<SolanaCheckInput, 'tables'>): boolean {
  const p = i.route.solana;
  if (!p) return false;
  try {
    if (p.kind === 'burn') { checkBurnBytes({ ...i, tables: async () => null }, p); return true; }
    must(i.quote.fromChain === SOLANA_CHAIN && i.quote.toChain === SOLANA_CHAIN, 'toChain');
    return true;
  } catch {
    return false;
  }
}

export const verifySolana = (i: SolanaCheckInput): Promise<CheckedSolana> =>
  (i.route.solana?.kind === 'order' ? verifySolanaOrder(i) : verifySolanaBurn(i));

// ---------- a burn into Solana, read on an EVM order (plan.ts) or an ICP plan ----------

export const SOLANA_DOMAIN = 5;
const ENVELOPE_LEN = 110;

export interface SolanaDelivery {
  /** The wallet paid, base58; a 32-byte Forwarder hook names none, so the mint recipient is checked against the screen's. */
  recipient: string | null;
  mintOut: string;
  /** The least it delivers. */
  minOut: bigint;
  mintRecipient: string;
  ref: Hex | null;
}

const toKey = (word: Hex) => {
  const bytes = Uint8Array.from(word.slice(2).match(/../g)!.map((x) => parseInt(x, 16)));
  must(bytes.length === 32, 'burnRecipient');
  return bytes;
};

/** A burn to domain 5, as the canister reads it (solana/arrival): into the program's vault and auth pair, or the Forwarder. */
export function readSolanaBurn(
  b: { mintRecipient: Hex; caller: Hex; hook: Hex; maxFee: bigint; min: bigint },
  programId: string,
): SolanaDelivery {
  const hook = toKey2(b.hook);
  if (hook.length === ENVELOPE_LEN && hook[0] === 1) {
    const r = new Bytes(hook.slice(1));
    const ref = hex(r.take(32));
    must(r.u8() === 1, 'envelopeSwap');
    r.take(4);
    const recipient = r.take(32);
    const mint = r.take(32);
    const minOut = r.le(8);
    must(minOut > 0n, 'envelopeSwap');
    const shard = Number(BigInt(ref) & 3n);
    const own = shardsOf(programId)[shard]!;
    must(encode58(toKey(b.mintRecipient)) === own.vault && encode58(toKey(b.caller)) === own.auth, 'burnRecipient');
    return { recipient: encode58(recipient), mintOut: encode58(mint), minOut, mintRecipient: own.vault, ref };
  }
  // the Forwarder: 32 bytes of magic, or 65 naming the owner whose account it opens
  must(hook.length === 32 || hook.length === 65, 'burnRecipient');
  must(FORWARD_MAGIC.every((x, n) => hook[n] === x) && hook.slice(12, 28).every((x) => x === 0), 'burnRecipient');
  const declared = (hook[28]! << 24) | (hook[29]! << 16) | (hook[30]! << 8) | hook[31]!;
  must(hook.length === 32 ? declared === 0 : declared === 33 && hook[32] === 1, 'burnRecipient');
  must(isZero(toKey(b.caller)), 'burnRecipient');
  const mintRecipient = encode58(toKey(b.mintRecipient));
  const owner = hook.length === 65 ? encode58(hook.slice(33)) : null;
  if (owner) must(mintRecipient === ataOf(owner, USDC_MINT), 'burnRecipient');
  must(b.min > b.maxFee, 'burnRecipient');
  return { recipient: owner, mintOut: USDC_MINT, minOut: b.min - b.maxFee, mintRecipient, ref: null };
}

const toKey2 = (data: Hex) => Uint8Array.from((data.slice(2).match(/../g) ?? []).map((x) => parseInt(x, 16)));

/** The burn against the screen. */
export function checkSolanaDelivery(d: SolanaDelivery, recipient: string, toToken: string, minOut: bigint): void {
  must(d.recipient === null ? d.mintRecipient === ataOf(recipient, USDC_MINT) : d.recipient === recipient, 'recipient');
  must(d.mintOut === toToken, 'tokenOut');
  must(d.minOut >= minOut, 'minOut');
}

/** Whether a wallet on Solana can be paid: nobody's program, no token account, no data. A read that fails answers null. */
export async function canReceive(address: string, read: (a: string) => Promise<{ owner: string; executable: boolean; data: Uint8Array } | 'missing' | null>): Promise<boolean | null> {
  if (decode58(address)?.length !== 32) return false;
  const account = await read(address);
  if (account === null) return null;
  if (account === 'missing') return true;
  return account.owner === SYSTEM_PROGRAM && !account.executable && account.data.length === 0;
}

