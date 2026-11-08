// The app's guard on what the real quoter built and the mainnet fork landed (solana/fork/run_services.sh). Skipped anywhere else.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Quote, Route, SolanaBurnPayment } from '@/lib/api';
import { tableEntries } from '@/lib/solana/rpc';
import { fromBase64 } from '@/lib/solana/tx';
import type { GuardContext } from './context';
import { verifySolanaBurn } from './solana';

const file = process.env.SOLANA_FORK_ANSWERS;
const run = file ? JSON.parse(readFileSync(file, 'utf8')) : null;

async function table(address: string): Promise<string[] | null> {
  const reply = await fetch('http://127.0.0.1:8899', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getAccountInfo', params: [address, { encoding: 'base64' }] }),
  });
  const body = await reply.json() as { result?: { value?: { data: [string, string] } | null } };
  return body.result?.value ? tableEntries(fromBase64(body.result.value.data[0])) : null;
}

describe.skipIf(!run)('the guard on the fork', () => {
  it('passes every burn the quoter built', async () => {
    const h = run.hold;
    const contracts = { swapic: '0x5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a', usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', runner: '0x5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b', cctpReceiver: '0x5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c', tokenMessenger: '0x5d5d5d5d5d5d5d5d5d5d5d5d5d5d5d5d5d5d5d5d' };
    const anchors = { programId: h.program, payerKey: h.canister, adminKey: h.admin, maxCuLimit: 1_400_000, maxCuPrice: 20_000n, maxFeeDeciBps: 30 };
    const guard = {
      config: { poolChain: 8453, chains: new Map([[8453, contracts]]), cctpDomains: new Map([[8453, 6]]), ecoPortal: null, solana: anchors },
      ecoProver: null, ckHelper: null, canisterEvm: '0xcacacacacacacacacacacacacacacacacacacaca', solana: anchors,
    } as unknown as GuardContext;
    expect(run.answers.length).toBeGreaterThan(0);
    for (const a of run.answers) {
      const solana: SolanaBurnPayment = {
        kind: 'burn', message: a.message, feePayer: a.feePayer, blockhash: a.blockhash, lastValidBlockHeight: a.lastValidBlockHeight, lookupTables: a.lookupTables, version: 0, reference: a.reference,
      };
      const route = { executable: true, amountOutMin: a.amountOutMin, fees: { network: a.network, bridge: '0', platform: '0' }, solana } as unknown as Route;
      const quote = { fromChain: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', toChain: 'eip155:8453', quotedAt: Math.floor(Date.now() / 1000) } as unknown as Quote;
      const checked = await verifySolanaBurn({
        quote, route, mode: a.mode === 'gasless' ? 'gasless' : 'userPays', user: a.user, recipient: a.recipient, fromToken: a.fromToken, toToken: a.toToken,
        amountIn: BigInt(a.amountIn), shownMin: BigInt(a.amountOutMin), guard, tables: table, nowSec: Math.floor(Date.now() / 1000),
      });
      expect(checked.orderId).toBe(a.reference);
    }
  });
});
