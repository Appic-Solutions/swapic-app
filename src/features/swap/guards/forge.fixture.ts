// Test only. The canister's anchors as the derived fixture holds them (plan 1 Task 9), and a hostile quoter's edits.
import { readFileSync } from 'node:fs';
import { encodeFunctionData, type Hex } from 'viem';
import type { Quote, Route } from '@/lib/api';
import type { ChainView, SwapicConfigView } from '@/lib/icp';
import { SWAPIC_RUN_ABI, orderAbi, orderIdOf, orderJsonOf, orderValue, type OrderValue } from './abi';
import type { GuardContext } from './context';

const cfg = JSON.parse(readFileSync('tests/fixtures/derived/swapic-config.json', 'utf8'));
export const SWAPIC = cfg.chains['8453'].swapic as Hex;
export const CANISTER = cfg.canisterEvmAddress as Hex;
export const PAYER = '0xf00EBA8E5Fd231b526ADFAAa68B4d0ede72A89AC' as Hex;
export const ATTACKER = '0x000000000000000000000000000000000000dEaD' as Hex;
/** A valid principal that reads 3yfhk…2qe like the design's (whose own text fails its checksum). */
export const ICP_ME = '3yfhk-v3nwx-2xo3k-pjyl5-ugvqk-ywkpy-qaq7m-aocl5-iz5re-kxxtc-2qe';
const config: SwapicConfigView = {
  poolChain: cfg.poolChain,
  chains: new Map(Object.entries(cfg.chains).map(([id, c]) => [Number(id), c as ChainView])),
  cctpDomains: new Map(Object.entries(cfg.cctpDomains).map(([id, d]) => [Number(id), d as number])),
  ecoPortal: cfg.ecoPortal,
};
export const GUARD: GuardContext = { config, ecoProver: cfg.ecoProver, canisterEvm: CANISTER };
export const load = (name: string): Quote => JSON.parse(readFileSync(`tests/fixtures/real/quote/${name}.json`, 'utf8'));
export const clone = <T>(x: T): T => structuredClone(x);
export const executable = (q: Quote, mode: 'gasless' | 'userPays') => q[mode].routes.filter((r) => r.executable);

/** A you pay gas route whose order a hostile quoter changed, with the id, the ABI bytes and the transaction recomputed. */
export function forge(q: Quote, r: Route, edit: (o: OrderValue) => OrderValue): Route {
  const chainId = Number(q.fromChain.split(':')[1]);
  const o = edit(orderValue(r.order!));
  return {
    ...clone(r),
    order: { ...orderJsonOf(o), abi: orderAbi(o) },
    orderId: orderIdOf(o, chainId, SWAPIC),
    tx: r.tx ? { ...r.tx, data: encodeFunctionData({ abi: SWAPIC_RUN_ABI, functionName: 'run', args: [o as never] }) } : r.tx,
  };
}
