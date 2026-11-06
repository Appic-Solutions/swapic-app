// Writes the quote the scenarios serve: tests/fixtures/real/quote/arb-usdc-to-pol-wbtc.json brought to the memo Order, with
// its ids, ABI bytes, transactions and gasless typed data recomputed (as load() in src/features/swap/guards/forge.fixture.ts
// does for vitest). Run it by hand with plain node when the recording changes: `node tests/fake/gen-memo-quote.mjs`. It is a
// script because Playwright's loader cannot import abi.ts from a .mjs file.
import { readFileSync, writeFileSync } from 'node:fs';
import { encodeFunctionData } from 'viem';
import { SWAPIC_RUN_ABI, orderAbi, orderIdOf, orderJsonOf, orderValue } from '../../src/features/swap/guards/abi.ts';

const q = JSON.parse(readFileSync(new URL('../fixtures/real/quote/arb-usdc-to-pol-wbtc.json', import.meta.url), 'utf8'));
const chainId = Number(q.fromChain.split(':')[1]);
for (const mode of ['gasless', 'userPays']) {
  q[mode].routes = q[mode].routes.map((r) => {
    if (!r.order) return r;
    const o = { ...orderValue(r.order), memo: '0x' };
    const id = orderIdOf(o, chainId, r.contracts.source.swapic);
    const out = {
      ...r, order: { ...orderJsonOf(o), abi: orderAbi(o) }, orderId: id,
      tx: r.tx ? { ...r.tx, data: encodeFunctionData({ abi: SWAPIC_RUN_ABI, functionName: 'run', args: [o] }) } : r.tx,
    };
    const s = out.sign;
    if (s?.door === 'auth3009') out.sign = { ...s, auth: { ...s.auth, nonce: BigInt(id).toString() }, typedData: [{ ...s.typedData[0], message: { ...s.typedData[0].message, nonce: id } }] };
    return out;
  });
}
writeFileSync(new URL('../fixtures/derived/quote-arb-usdc-to-pol-wbtc-memo.json', import.meta.url), `${JSON.stringify(q)}\n`);
