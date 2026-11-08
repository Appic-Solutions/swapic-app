// runSolana on bytes the Rust wire crate composed: only what the guard passed reaches the wallet, only what the wallet gave
// back unchanged reaches Swapic, and a person's "no" is not an error.
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { executeSwap, walletSteps, type ExecDeps, type ExecInput } from './execute';
import type { Quote, Route } from '@/lib/api';
import type { IcpClient } from '@/lib/icp';
import type { UiToken } from '@/components/ui/token-types';
import { fromBase64, unsignedWire } from '@/lib/solana/tx';
import { USDC_MINT } from '@/lib/solana/pda';

const g = JSON.parse(readFileSync('tests/fixtures/solana/guard.json', 'utf8'));
const SOLANA = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
const NOW_S = 2_000_000_000;

function route(): Route {
  return {
    routeId: 'cctp', rank: 0, executable: true, amountOut: '950000000', amountOutMin: g.minOut, etaSeconds: 20,
    fees: { network: '50000', bridge: '0', platform: '0' },
    solana: {
      kind: 'burn', message: g.gaslessBurn.message, feePayer: g.payerKey, blockhash: g.blockhash, lastValidBlockHeight: 100,
      lookupTables: g.gaslessBurn.tables, version: 0, reference: g.reference,
    },
  } as unknown as Route;
}
function quote(r: Route = route()): Quote {
  return {
    quoteId: 'q', fromChain: SOLANA, toChain: 'eip155:8453', fromToken: { address: USDC_MINT }, toToken: { address: g.usdcEvm }, amountIn: '1000000000',
    quotedAt: NOW_S, expiresAt: NOW_S + 60, unavailable: [], gasless: { allowed: true, routes: [r] }, userPays: { allowed: true, routes: [] },
  } as unknown as Quote;
}
const chains = new Map([[8453, { swapic: '0x5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a', usdc: g.usdcEvm, runner: '0x5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b', cctpReceiver: '0x5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c', tokenMessenger: '0x5d5d5d5d5d5d5d5d5d5d5d5d5d5d5d5d5d5d5d5d' }]]);
const icp = {
  getConfig: async () => ({
    poolChain: 8453, chains, cctpDomains: new Map([[8453, 6]]), ecoPortal: null,
    solana: { programId: g.programId, payerKey: g.payerKey, adminKey: g.adminKey, maxCuLimit: 1_400_000, maxCuPrice: 1_000_000n, maxFeeDeciBps: 500 },
  }),
  ecoProver: async () => null, ckHelper: async () => null, canisterEvmAddress: async () => '0xcacacacacacacacacacacacacacacacacacacaca',
} as unknown as IcpClient;
const token = (over: Partial<UiToken>): UiToken => ({ key: '', chain: SOLANA, chainId: 0, chainName: 'Solana', chainLogo: '', chain_type: 'SOLANA', address: USDC_MINT, symbol: 'USDC', name: 'USDC', logo: '', decimals: 6, priceUsd: '1', verified: true, ...over });

/** A wallet that signs by filling its slot. */
const wallet = (answer?: (wire: Uint8Array) => Uint8Array) => ({
  address: g.user,
  signTransaction: vi.fn(async (wire: Uint8Array) => {
    if (answer) return answer(wire);
    const signed = wire.slice();
    signed.fill(7, 65, 129);
    return signed;
  }),
});

function run(over: { q?: Quote; sol?: ReturnType<typeof wallet> | null; submit?: ExecDeps['submitSolana']; to?: Partial<UiToken>; recipient?: string; account?: ExecDeps['solanaAccount'] } = {}) {
  const sol = over.sol === undefined ? wallet() : over.sol;
  const submit = over.submit ?? vi.fn(async () => ({ orderId: g.reference, status: 'submitted' }));
  const steps: [number, string][] = [];
  const input = {
    query: { payer: g.user, recipient: over.recipient ?? g.recipient } as never, pick: { mode: 'gasless', routeId: 'cctp', tags: ['Gasless'] }, shownMin: 900_000_000n, amountIn: 1_000_000_000n,
    from: token({}), to: token({ chain: 'eip155:8453', chain_type: 'EVM', address: g.usdcEvm, ...over.to }), recipient: over.recipient ?? g.recipient,
    evm: null, icpCaller: null, sol, onStep: (i: number, st: string) => steps.push([i, st]),
  } as unknown as ExecInput;
  const deps = {
    getQuote: vi.fn(async () => over.q ?? quote()), getOrders: vi.fn(), submitGasless: vi.fn(), icp, nowMs: () => NOW_S * 1000, sleep: async () => {},
    submitSolana: submit, solanaTables: async (t: string) => g.tables.find((x: { address: string }) => x.address === t)?.entries ?? null,
    solanaAccount: over.account ?? (async () => 'missing'),
  } as unknown as ExecDeps;
  return { out: executeSwap(input, deps), sol, submit, steps };
}

describe('runSolana', () => {
  it('asks the wallet for the guard\'s bytes and hands Swapic what it signed', async () => {
    const r = run();
    expect(await r.out).toEqual({ kind: 'started', activityId: g.reference });
    expect(r.sol!.signTransaction).toHaveBeenCalledTimes(1);
    expect(r.submit).toHaveBeenCalledTimes(1);
    const body = (r.submit as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(body.orderId).toBe(g.reference);
    expect(r.steps).toEqual([[0, 'wait'], [0, 'done'], [1, 'wait'], [1, 'done']]);
  });

  it('stops at the guard: another recipient reaches no wallet', async () => {
    const r = run({ recipient: '0x1111111111111111111111111111111111111111' });
    expect((await r.out).kind).toBe('failed');
    expect(r.sol!.signTransaction).not.toHaveBeenCalled();
    expect(r.submit).not.toHaveBeenCalled();
  });

  it('takes a "no" in the wallet as a no', async () => {
    const r = run({ sol: wallet(() => { throw Object.assign(new Error('User rejected the request.'), { code: 4001 }); }) });
    expect(await r.out).toEqual({ kind: 'rejected' });
    expect(r.submit).not.toHaveBeenCalled();
  });

  it('sends nothing the wallet changed', async () => {
    const r = run({ sol: wallet((wire) => { const out = wire.slice(); out[out.length - 1]! ^= 1; return out; }) });
    const out = await r.out;
    expect(out.kind).toBe('failed');
    expect(r.submit).not.toHaveBeenCalled();
  });

  it('offers a lost answer again with the identical body', async () => {
    const lost = vi.fn().mockRejectedValueOnce(new TypeError('network')).mockResolvedValueOnce({ orderId: g.reference, status: 'submitted' });
    const r = run({ submit: lost as never });
    const first = await r.out;
    expect(first.kind).toBe('unknown');
    if (first.kind !== 'unknown') throw new Error('unreachable');
    expect(await first.resume!()).toEqual({ kind: 'started', activityId: g.reference });
    expect(lost.mock.calls[0]![0]).toEqual(lost.mock.calls[1]![0]);
    expect(r.sol!.signTransaction).toHaveBeenCalledTimes(1);
  });

  it('needs the wallet connected', async () => {
    expect(await run({ sol: null }).out).toEqual({ kind: 'failed', message: 'Connect wallet' });
  });

  it('says what helps when a small swap inside Solana has no SOL', async () => {
    const r = { ...route(), executable: false, solana: undefined, reason: 'solanaBelowGasless' } as unknown as Route;
    const out = await run({ q: quote(r) }).out;
    expect(out).toEqual({ kind: 'failed', message: 'Add a little SOL to swap under $10 on Solana' });
  });

  it('names its two steps', () => {
    const o = { key: 'k', tags: [], mode: 'gasless', route: route() } as never;
    expect(walletSteps(o, token({}), 1n, { symbol: 'SOL', decimals: 9, priceUsd: '90' }).map((s) => s.label)).toEqual(['Sign in your wallet (no gas)', 'Swapic sends it']);
  });

  it('builds the wallet\'s bytes as the guard gave them', () => {
    const wire = unsignedWire(fromBase64(g.gaslessBurn.message), 2);
    expect(wire[0]).toBe(2);
    expect(wire.length).toBe(1 + 128 + fromBase64(g.gaslessBurn.message).length);
  });
});
