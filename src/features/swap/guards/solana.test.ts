// The guard on bytes the Rust wire crate composed (tests/fixtures/solana/guard.json, written by libraries/solana's
// write_guard_fixture) and on real Jupiter answers (orders.json): every honest message passes, and every change to the money
// is refused. Hostile bytes are made by editing the honest ones, so a check that stopped reading a field fails here.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { encodeFunctionData, type Hex } from 'viem';
import type { Quote, Route, SolanaBurnPayment, SolanaOrderPayment } from '@/lib/api';
import { encode58 } from '@/lib/solana/base58';
import { ataOf, COMPUTE_BUDGET, JUPITER, shardsOf, USDC_MINT, WSOL_MINT, findProgramAddress } from '@/lib/solana/pda';
import { decodeV0, fromBase64, toBase64 } from '@/lib/solana/tx';
import type { SolanaAnchors } from '@/lib/icp';
import type { GuardContext } from './context';
import { STEP_ABI, type OrderValue } from './abi';
import { GuardError } from './errors';
import { readPlan } from './plan';
import {
  canReceive, checkSolanaDelivery, readBurnArgs, readJupiterRoute, readSolanaBurn, solanaRouteOffered, verifySolanaBurn, verifySolanaOrder,
  type SolanaCheckInput,
} from './solana';

const g = JSON.parse(readFileSync('tests/fixtures/solana/guard.json', 'utf8'));
const orders = JSON.parse(readFileSync('tests/fixtures/solana/orders.json', 'utf8'));

const SOLANA = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
const anchors: SolanaAnchors = { programId: g.programId, payerKey: g.payerKey, adminKey: g.adminKey, maxCuLimit: 1_400_000, maxCuPrice: 1_000_000n, maxFeeDeciBps: 500 };
const contracts = { swapic: '0x5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a', usdc: g.usdcEvm, runner: '0x5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b', cctpReceiver: '0x5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c', tokenMessenger: '0x5d5d5d5d5d5d5d5d5d5d5d5d5d5d5d5d5d5d5d5d' } as const;
const guard = {
  config: { poolChain: 8453, chains: new Map([[8453, contracts]]), cctpDomains: new Map([[8453, 6]]), ecoPortal: null, solana: anchors },
  ecoProver: null, ckHelper: null, canisterEvm: '0xcacacacacacacacacacacacacacacacacacacaca', solana: anchors,
} as unknown as GuardContext;
const tableMap = new Map<string, string[]>(g.tables.map((t: { address: string; entries: string[] }) => [t.address, t.entries]));
const tables = async (t: string) => tableMap.get(t) ?? null;
const NOW = 2_000_000_000;

function burnInput(c: { message: string; tables: string[]; user?: string; inAmount?: string; tokenIn?: string }, mode: 'gasless' | 'userPays', over: Partial<SolanaCheckInput> = {}): SolanaCheckInput {
  const payment: SolanaBurnPayment = {
    kind: 'burn', message: c.message, feePayer: mode === 'gasless' ? g.payerKey : c.user ?? g.user, blockhash: g.blockhash, lastValidBlockHeight: 100,
    lookupTables: c.tables, version: 0, reference: g.reference,
  };
  const route = { executable: true, amountOut: '950000000', amountOutMin: g.minOut, fees: { network: '50000', bridge: '0', platform: '0' }, solana: payment } as unknown as Route;
  const quote = { fromChain: SOLANA, toChain: 'eip155:8453', fromToken: { address: c.tokenIn ?? USDC_MINT }, toToken: { address: g.tokenOut }, amountIn: c.inAmount ?? '1000000000', quotedAt: NOW } as unknown as Quote;
  return {
    quote, route, mode, user: c.user ?? g.user, recipient: g.recipient, fromToken: c.tokenIn ?? USDC_MINT, toToken: g.tokenOut,
    amountIn: BigInt(c.inAmount ?? '1000000000'), shownMin: BigInt(g.minOut), guard, tables, nowSec: NOW, ...over,
  };
}
const deliver = (i: SolanaCheckInput): SolanaCheckInput => ({ ...i, toToken: g.usdcEvm, shownMin: 900_000_000n });
const refused = async (work: Promise<unknown>, rule: string) => {
  const e = await work.then(() => null, (x: unknown) => x);
  expect(e).toBeInstanceOf(GuardError);
  expect((e as GuardError).rule).toBe(rule);
};

/** The honest message with the Swapic arguments' bytes changed. */
function editArgs(message: string, edit: (data: Uint8Array) => void, program = g.programId): string {
  const bytes = fromBase64(message);
  const m = decodeV0(bytes)!;
  const ix = m.instructions.find((x) => x.program === program)!;
  const start = indexOf(bytes, ix.data);
  const data = bytes.slice(start, start + ix.data.length);
  edit(data);
  bytes.set(data, start);
  return toBase64(bytes);
}
function indexOf(hay: Uint8Array, needle: Uint8Array): number {
  outer: for (let i = hay.length - needle.length; i >= 0; i--) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return i;
  }
  throw new Error('not found');
}
const withMessage = (i: SolanaCheckInput, message: string): SolanaCheckInput => ({ ...i, route: { ...i.route, solana: { ...(i.route.solana as SolanaBurnPayment), message } } });

describe('a burn out of Solana', () => {
  it('passes each message the wire crate composes, user paid and gasless', async () => {
    const user = await verifySolanaBurn(deliver(burnInput(g.burn, 'userPays')));
    expect(user.kind).toBe('burn');
    expect(user.orderId).toBe(g.reference);
    expect(user.gasless).toBe(false);
    const gasless = await verifySolanaBurn(deliver(burnInput(g.gaslessBurn, 'gasless')));
    expect(gasless.gasless).toBe(true);
    expect(await verifySolanaBurn(burnInput(g.userSwap, 'userPays'))).toBeTruthy();
    expect(await verifySolanaBurn(burnInput(g.gaslessSwap, 'gasless'))).toBeTruthy();
  });

  it('hands the wallet the message with an empty slot for every signer', async () => {
    const checked = await verifySolanaBurn(deliver(burnInput(g.gaslessBurn, 'gasless')));
    expect(checked.wire[0]).toBe(2);
    expect(checked.wire.slice(1, 129).every((b) => b === 0)).toBe(true);
    expect(toBase64(checked.wire.slice(129))).toBe(g.gaslessBurn.message);
  });

  it('refuses a swap burn whose optional receiver is not the vault', async () => {
    const bytes = fromBase64(g.userSwap.message);
    const burn = decodeV0(bytes)!.instructions.find((x) => x.program === g.programId)!;
    // the route's accounts start at slot 22, its optional receiver is the eighth: the user's own key, here
    bytes[indexOf(bytes, Uint8Array.from(burn.accounts)) + 22 + 7] = burn.accounts[0]!;
    await refused(verifySolanaBurn(burnInput({ ...g.userSwap, message: toBase64(bytes) }, 'userPays')), 'solanaDestination');
  });

  it('refuses a fee payer that is not the user or the canister', async () => {
    const i = deliver(burnInput(g.burn, 'userPays'));
    await refused(verifySolanaBurn({ ...i, user: g.adminKey }), 'solanaFeePayer');
    // a gasless ask answered with a message the user pays
    await refused(verifySolanaBurn(deliver(burnInput(g.burn, 'gasless'))), 'solanaFeePayer');
  });

  it('refuses another recipient, another token, another amount, a smaller minimum', async () => {
    const swap = burnInput(g.userSwap, 'userPays');
    await refused(verifySolanaBurn({ ...swap, recipient: '0x1111111111111111111111111111111111111111' }), 'recipient');
    await refused(verifySolanaBurn({ ...swap, toToken: '0x2222222222222222222222222222222222222222' }), 'tokenOut');
    await refused(verifySolanaBurn({ ...swap, amountIn: swap.amountIn + 1n }), 'amountIn');
    await refused(verifySolanaBurn({ ...swap, shownMin: 900_000_001n }), 'minOut');
    await refused(verifySolanaBurn({ ...swap, fromToken: WSOL_MINT === swap.fromToken ? USDC_MINT : WSOL_MINT }), 'solanaSource');
  });

  it('refuses a recipient that is one of Swapic\'s own contracts', async () => {
    const m = editArgs(g.burn.message, (d) => {
      const at = 3 + 32 + 4;
      d.set(Uint8Array.from(Buffer.from(contracts.runner.slice(2), 'hex')), at);
    });
    await refused(verifySolanaBurn(withMessage(deliver(burnInput(g.burn, 'userPays')), m)), 'recipient');
  });

  it('refuses a fee, a deadline or a most fee the screen does not show', async () => {
    const i = deliver(burnInput(g.burn, 'userPays'));
    await refused(verifySolanaBurn({ ...i, route: { ...i.route, fees: { ...i.route.fees, network: '1' } } }), 'solanaFee');
    await refused(verifySolanaBurn({ ...i, nowSec: 2_000_000_600 }), 'expired');
    await refused(verifySolanaBurn({ ...i, nowSec: 1_000_000_000 }), 'expired');
    const a: SolanaAnchors = { ...anchors, maxFeeDeciBps: 1 };
    await refused(verifySolanaBurn({ ...i, guard: { ...guard, solana: a } }), 'solanaFee');
  });

  it('refuses a compute price or limit above the canister\'s', async () => {
    const i = deliver(burnInput(g.burn, 'userPays'));
    await refused(verifySolanaBurn({ ...i, guard: { ...guard, solana: { ...anchors, maxCuPrice: 1n } } }), 'solanaCompute');
    await refused(verifySolanaBurn({ ...i, guard: { ...guard, solana: { ...anchors, maxCuLimit: 1 } } }), 'solanaCompute');
  });

  it('refuses reserved flags and the event keypair fallback the app never asks for', async () => {
    const i = deliver(burnInput(g.burn, 'userPays'));
    await refused(verifySolanaBurn(withMessage(i, editArgs(g.burn.message, (d) => { d[1]! |= 0x80; }))), 'solanaArgs');
    await refused(verifySolanaBurn(withMessage(i, editArgs(g.burn.message, (d) => { d[1]! |= 0x10; }))), 'solanaArgs');
    await refused(verifySolanaBurn(withMessage(i, editArgs(g.burn.message, (d) => { d[1]! &= ~0x04; }))), 'solanaArgs');
  });

  it('refuses a message whose blockhash or tables the answer does not name', async () => {
    const i = deliver(burnInput(g.burn, 'userPays'));
    await refused(verifySolanaBurn({ ...i, route: { ...i.route, solana: { ...(i.route.solana as SolanaBurnPayment), blockhash: g.user } } }), 'solanaBlockhash');
    await refused(verifySolanaBurn({ ...i, route: { ...i.route, solana: { ...(i.route.solana as SolanaBurnPayment), lookupTables: [] } } }), 'solanaTable');
  });

  it('fails closed when a lookup table cannot be read', async () => {
    await refused(verifySolanaBurn(deliver({ ...burnInput(g.burn, 'userPays'), tables: async () => null })), 'solanaTable');
  });

  it('refuses a canister with no Solana line', async () => {
    await refused(verifySolanaBurn({ ...deliver(burnInput(g.burn, 'userPays')), guard: { ...guard, solana: null } }), 'noAnchor');
  });

  it('never offers a card it cannot read, whatever the quoter says', () => {
    const i = deliver(burnInput(g.burn, 'userPays'));
    expect(solanaRouteOffered(i)).toBe(true);
    expect(solanaRouteOffered({ ...i, recipient: '0x1111111111111111111111111111111111111111' })).toBe(false);
    expect(solanaRouteOffered(withMessage(i, 'AAAA'))).toBe(false);
  });
});

describe('the bytes the guard reads', () => {
  it('reads the arguments as the wire crate writes them', () => {
    const m = decodeV0(fromBase64(g.userSwap.message))!;
    const args = readBurnArgs(m.instructions.find((x) => x.program === g.programId)!.data);
    expect(args.tag).toBe(1);
    expect(args.ref).toBe(g.reference);
    expect(args.recipient).toBe(g.recipient);
    expect(args.tokenOut).toBe(g.tokenOut);
    expect(args.minOut).toBe(900_000_000n);
    expect(args.domain).toBe(6);
    expect(args.fee).toBe(50_000);
    expect(readJupiterRoute(args.jupiter).inAmount).toBe(BigInt(g.userSwap.inAmount));
  });
  it('refuses any Jupiter instruction but the two routes', () => {
    expect(() => readJupiterRoute(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9]))).toThrow(GuardError);
  });
  it('computes the same shard addresses as the wire crate', () => {
    expect(shardsOf(g.programId)).toEqual(g.shards);
    expect(ataOf(g.user, USDC_MINT)).toBe(g.userUsdc);
    expect(findProgramAddress([new TextEncoder().encode('auth'), Uint8Array.of(0)], g.programId)).toBe(g.shards[0].auth);
  });
});

function orderInput(name: string, over: Partial<SolanaCheckInput> = {}): SolanaCheckInput {
  const o = orders[name];
  const payment: SolanaOrderPayment = { kind: 'order', transaction: o.transaction, requestId: o.requestId ?? 'r1', signatureFeePayer: o.signatureFeePayer, gasless: o.gasless };
  const route = { executable: true, amountOutMin: o.otherAmountThreshold, fees: { network: '0', bridge: '0', platform: '0' }, solana: payment } as unknown as Route;
  const quote = { fromChain: SOLANA, toChain: SOLANA, quotedAt: NOW } as unknown as Quote;
  return {
    quote, route, mode: o.gasless ? 'gasless' : 'userPays', user: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', recipient: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    fromToken: o.inputMint, toToken: o.outputMint, amountIn: BigInt(o.inAmount), shownMin: BigInt(o.otherAmountThreshold), guard, tables: tablesFor(o), nowSec: NOW, ...over,
  };
}

/**
 * A real answer's tables are not in the sample: stand-ins that hold nothing of use, but for the route's two mints, which a real
 * order keeps in its tables, written where the route names them.
 */
function tablesFor(o: { transaction: string; inputMint: string; outputMint: string }) {
  const wire = fromBase64(o.transaction);
  const message = decodeV0(wire.slice(1 + wire[0]! * 64))!;
  const held = new Map(message.lookups.map((l) => [l.table, Array.from({ length: 256 }, (_, i) => encode58(Uint8Array.from({ length: 32 }, (_, j) => (j === 0 ? 200 : i % 251))))]));
  // the order resolveAccounts reads them in: every table's writable entries, then every table's readonly ones
  const places = [
    ...message.lookups.flatMap((l) => l.writable.map((at) => ({ table: l.table, at }))),
    ...message.lookups.flatMap((l) => l.readonly.map((at) => ({ table: l.table, at }))),
  ];
  const route = message.instructions.find((x) => x.program === JUPITER);
  if (route) {
    const { sourceMint, destinationMint } = readJupiterRoute(route.data);
    for (const [slot, mint] of [[sourceMint, o.inputMint], [destinationMint, o.outputMint]] as const) {
      const place = places[route.accounts[slot]! - message.keys.length];
      if (place) held.get(place.table)![place.at] = mint;
    }
  }
  return async (table: string) => held.get(table) ?? null;
}

describe('a swap inside Solana, on real answers', () => {
  it('passes a market maker\'s fill, into a token and out of the coin', async () => {
    const bonk = await verifySolanaOrder(orderInput('rfqBonk', { shownMin: BigInt(orders.rfqBonk.outAmount) }));
    expect(bonk.kind).toBe('order');
    const solIn = await verifySolanaOrder(orderInput('rfqSolIn', { shownMin: BigInt(orders.rfqSolIn.outAmount) }));
    expect(solIn.gasless).toBe(true);
    const solOut = await verifySolanaOrder(orderInput('rfqSolOut', { shownMin: BigInt(orders.rfqSolOut.outAmount) }));
    expect(solOut.kind).toBe('order');
  });

  it('refuses a fill that pays less than the screen shows, for another amount or to another token', async () => {
    const o = orders.rfqBonk;
    await refused(verifySolanaOrder(orderInput('rfqBonk', { shownMin: BigInt(o.outAmount) + 1n })), 'minOut');
    await refused(verifySolanaOrder(orderInput('rfqBonk', { amountIn: BigInt(o.inAmount) - 1n })), 'amountIn');
    // the account it opens is of a mint the screen does not name: refused before the fill is read
    await refused(verifySolanaOrder(orderInput('rfqBonk', { toToken: WSOL_MINT })), 'solanaSide');
  });

  it('refuses someone else\'s swap', async () => {
    await refused(verifySolanaOrder(orderInput('rfqBonk', { user: g.user })), 'solanaSigners');
  });

  it('refuses the canister as the fee payer of a swap inside Solana', async () => {
    const o = orders.rfqBonk;
    const a: SolanaAnchors = { ...anchors, payerKey: o.signatureFeePayer };
    await refused(verifySolanaOrder(orderInput('rfqBonk', { guard: { ...guard, solana: a } })), 'solanaFeePayer');
  });

  it('refuses a fee payer the answer does not name', async () => {
    const i = orderInput('rfqBonk');
    const pay = i.route.solana as SolanaOrderPayment;
    await refused(verifySolanaOrder({ ...i, route: { ...i.route, solana: { ...pay, signatureFeePayer: g.user } } }), 'solanaFeePayer');
  });

  it('refuses a route whose optional receiver pays someone else', async () => {
    const i = orderInput('metisSol');
    const wire = fromBase64(orders.metisSol.transaction);
    const message = decodeV0(wire.slice(1 + wire[0]! * 64))!;
    const route = message.instructions.find((x) => x.program === JUPITER)!;
    // the honest order leaves it empty, and this writes the taker's source account there: not its own output
    wire[indexOf(wire, Uint8Array.from(route.accounts)) + 7] = route.accounts[1]!;
    const pay = i.route.solana as SolanaOrderPayment;
    await refused(verifySolanaOrder({ ...i, route: { ...i.route, solana: { ...pay, transaction: toBase64(wire) } } }), 'recipient');
  });

  it('caps the priority fee an order charges its signer, and passes what real orders ask', async () => {
    const i = orderInput('metisSol');
    expect(await verifySolanaOrder(i)).toBeTruthy();
    expect(await verifySolanaOrder(orderInput('metisShared'))).toBeTruthy();
    const wire = fromBase64(orders.metisSol.transaction);
    const message = decodeV0(wire.slice(1 + wire[0]! * 64))!;
    const price = message.instructions.find((x) => x.program === COMPUTE_BUDGET && x.data[0] === 3)!;
    new DataView(wire.buffer, wire.byteOffset).setBigUint64(indexOf(wire, Uint8Array.from(price.data)) + 1, 1_000_000_000n, true);
    const pay = i.route.solana as SolanaOrderPayment;
    await refused(verifySolanaOrder({ ...i, route: { ...i.route, solana: { ...pay, transaction: toBase64(wire) } } }), 'solanaCompute');
  });

  it('never shows a gasless card over an order the user pays for', async () => {
    await refused(verifySolanaOrder(orderInput('metisSol', { mode: 'gasless' })), 'solanaFeePayer');
  });

  it('refuses an order when the screen names another recipient: it pays the wallet that signs', async () => {
    await refused(verifySolanaOrder(orderInput('metisSol', { recipient: g.user })), 'recipient');
  });

  it('refuses an instruction it does not know', async () => {
    const i = orderInput('rfqBonk', { shownMin: BigInt(orders.rfqBonk.outAmount) });
    const wire = fromBase64(orders.rfqBonk.transaction);
    // the compute budget program's key in the message swapped for another program
    const key = Uint8Array.from(Buffer.from(ataBytes(COMPUTE_BUDGET)));
    const at = indexOf(wire, key);
    wire.set(ataBytes(g.programId), at);
    const pay = i.route.solana as SolanaOrderPayment;
    await refused(verifySolanaOrder({ ...i, route: { ...i.route, solana: { ...pay, transaction: toBase64(wire) } } }), 'solanaProgram');
  });
});

function ataBytes(text: string): Uint8Array {
  const A = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let n = 0n;
  for (const c of text) n = n * 58n + BigInt(A.indexOf(c));
  const out = new Uint8Array(32);
  for (let i = 31; i >= 0; i--) { out[i] = Number(n & 255n); n >>= 8n; }
  return out;
}

describe('a burn into Solana, read on an EVM order', () => {
  const word = (text: string) => `0x${Buffer.from(ataBytes(text)).toString('hex')}` as Hex;
  const base = { maxFee: 1_000n, min: 1_000_000n };

  it('reads a swap into the program: its vault and auth pair, its hook against the screen', () => {
    const read = readSolanaBurn({ ...base, mintRecipient: word(g.hookVault), caller: word(g.hookAuth), hook: g.swapHook }, g.programId);
    expect(read.ref).toBe(g.reference);
    expect(read.mintOut).toBe(WSOL_MINT);
    expect(read.minOut).toBe(11_000_000n);
    checkSolanaDelivery(read, read.recipient!, WSOL_MINT, 11_000_000n);
    expect(() => checkSolanaDelivery(read, g.payerKey, WSOL_MINT, 1n)).toThrow(GuardError);
    expect(() => checkSolanaDelivery(read, read.recipient!, USDC_MINT, 1n)).toThrow(GuardError);
    expect(() => checkSolanaDelivery(read, read.recipient!, WSOL_MINT, 11_000_001n)).toThrow(GuardError);
  });

  it('refuses a swap minted anywhere but the program, or held by another caller', () => {
    expect(() => readSolanaBurn({ ...base, mintRecipient: word(g.user), caller: word(g.hookAuth), hook: g.swapHook }, g.programId)).toThrow(GuardError);
    expect(() => readSolanaBurn({ ...base, mintRecipient: word(g.hookVault), caller: word(g.user), hook: g.swapHook }, g.programId)).toThrow(GuardError);
  });

  const forwarder = (owner?: string) => {
    const bytes = new Uint8Array(owner ? 65 : 32);
    bytes.set(new TextEncoder().encode('cctp-forward'));
    if (owner) { bytes[31] = 33; bytes[32] = 1; bytes.set(ataBytes(owner), 33); }
    return `0x${Buffer.from(bytes).toString('hex')}` as Hex;
  };
  const zero = `0x${'00'.repeat(32)}` as Hex;

  it('reads USDC through the delivery hook, to the owner\'s own account and no other', () => {
    const ata = ataOf(g.user, USDC_MINT);
    const long = readSolanaBurn({ ...base, mintRecipient: word(ata), caller: zero, hook: forwarder(g.user) }, g.programId);
    expect(long.recipient).toBe(g.user);
    expect(long.minOut).toBe(999_000n);
    checkSolanaDelivery(long, g.user, USDC_MINT, 999_000n);
    const short = readSolanaBurn({ ...base, mintRecipient: word(ata), caller: zero, hook: forwarder() }, g.programId);
    expect(short.recipient).toBeNull();
    checkSolanaDelivery(short, g.user, USDC_MINT, 999_000n);
    expect(() => checkSolanaDelivery(short, g.payerKey, USDC_MINT, 1n)).toThrow(GuardError);
    expect(() => readSolanaBurn({ ...base, mintRecipient: word(g.hookVault), caller: zero, hook: forwarder(g.user) }, g.programId)).toThrow(GuardError);
    expect(() => readSolanaBurn({ ...base, mintRecipient: word(ata), caller: word(g.user), hook: forwarder(g.user) }, g.programId)).toThrow(GuardError);
  });
});

describe('who can receive on Solana', () => {
  const read = (answer: Awaited<ReturnType<Parameters<typeof canReceive>[1]>>) => async () => answer;
  it('a new wallet or a system account can; a token account, a program or an unread account cannot', async () => {
    expect(await canReceive(g.user, read('missing'))).toBe(true);
    expect(await canReceive(g.user, read({ owner: '11111111111111111111111111111111', executable: false, data: new Uint8Array() }))).toBe(true);
    expect(await canReceive(g.user, read({ owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', executable: false, data: new Uint8Array(165) }))).toBe(false);
    expect(await canReceive(g.user, read({ owner: 'BPFLoaderUpgradeab1e11111111111111111111111', executable: true, data: new Uint8Array(36) }))).toBe(false);
    expect(await canReceive(g.user, read(null))).toBeNull();
    expect(await canReceive('not an address', read('missing'))).toBe(false);
  });
});

describe('an EVM order that burns into Solana', () => {
  const word = (text: string) => `0x${Buffer.from(ataBytes(text)).toString('hex')}` as Hex;
  const USDC = g.usdcEvm as Hex;
  const order = (hook: Hex, recipient: Hex, caller: Hex, payoutToken: Hex = '0x0000000000000000000000000000000000000000'): OrderValue => ({
    ref: g.reference, payer: '0x1111111111111111111111111111111111111111', tokenIn: USDC, amountIn: 1_000_000n, deadline: BigInt(NOW + 600), memo: '0x',
    payout: { token: payoutToken, recipient: '0x0000000000000000000000000000000000000000', minOut: 0n },
    steps: [{
      target: contracts.tokenMessenger, token: USDC, min: 1_000_000n, value: 0n, writes: [{ at: 4, minus: 0n }],
      data: encodeFunctionData({ abi: STEP_ABI, functionName: 'depositForBurnWithHook', args: [0n, 5, recipient, USDC, caller, 1_000n, 1_000, hook] }),
    }],
  } as unknown as OrderValue);
  const ctx = { ...guard, sourceChainId: 8453, payer: '0x1111111111111111111111111111111111111111' as Hex, orderDeadline: BigInt(NOW + 600), nowSec: NOW };

  it('reads the swap into the program, and it delivers nothing on any EVM chain', () => {
    const plan = readPlan(order(g.swapHook, word(g.hookVault), word(g.hookAuth)), ctx);
    expect(plan.rail).toBe('burn');
    expect(plan.delivery).toBeNull();
    expect(plan.solana!.mintOut).toBe(WSOL_MINT);
    expect(plan.solana!.minOut).toBe(11_000_000n);
  });

  it('refuses a burn that also pays out, another mint recipient, or no Solana line', () => {
    expect(() => readPlan(order(g.swapHook, word(g.hookVault), word(g.hookAuth), USDC), ctx)).toThrow(GuardError);
    expect(() => readPlan(order(g.swapHook, word(g.user), word(g.hookAuth)), ctx)).toThrow(GuardError);
    expect(() => readPlan(order(g.swapHook, word(g.hookVault), word(g.hookAuth)), { ...ctx, solana: null })).toThrow(GuardError);
  });

  it('refuses a hook under another order\'s ref', () => {
    const other = { ...order(g.swapHook, word(g.hookVault), word(g.hookAuth)), ref: `0x${'11'.repeat(32)}` as Hex };
    expect(() => readPlan(other, ctx)).toThrow(GuardError);
  });
});

