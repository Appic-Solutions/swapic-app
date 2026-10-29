// e2e builds only: the wallets a Playwright test sets on window.__SWAPIC_E2E__. Without `evmKey` they return a fixed
// signature (the fake backend never checks one); with `evmKey` (a key the test generated in memory for this run) they
// sign for real, so the withdraw signature rules run unchanged in the Pool click-through. The marker is a string used
// at run time, so plan 4 Task 6's build check finds this file in any bundle that holds it.
import type { Agent } from '@icp-sdk/core/agent';
import { Principal } from '@icp-sdk/core/principal';
import { privateKeyToAccount } from 'viem/accounts';
import type { IcpCaller } from '@/lib/icp';
import type { EvmSigner, SignableTypedData } from './evm-signer';

export const E2E_MARKER = 'E2E-FAKE-MARKER';
export interface E2eWallets { evm: `0x${string}` | null; icp: string | null; rejectNext?: boolean; evmKey?: `0x${string}`; /** a smart wallet (plan 2 Smart wallets) */ evmSmart?: boolean }
declare global { interface Window { __SWAPIC_E2E__?: E2eWallets } }

export const e2eWallets = (): E2eWallets => {
  (globalThis as { __SWAPIC_E2E_MARKER__?: string }).__SWAPIC_E2E_MARKER__ = E2E_MARKER;
  return (typeof window !== 'undefined' && window.__SWAPIC_E2E__) || { evm: null, icp: null };
};

const reject = () => Object.assign(new Error('User rejected the request.'), { code: 4001 });
const FAKE_SIG = `0x${'11'.repeat(32)}${'22'.repeat(32)}1b` as const;
let txn = 0;

export function e2eEvmSigner(address: `0x${string}`): EvmSigner {
  const maybeReject = () => {
    const w = e2eWallets();
    if (w.rejectNext) { w.rejectNext = false; throw reject(); }
  };
  return {
    address,
    ensureChain: async () => {},
    signTypedData: async (td: SignableTypedData) => {
      maybeReject();
      const key = e2eWallets().evmKey;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return key ? privateKeyToAccount(key).signTypedData(td as any) : FAKE_SIG;
    },
    sendTransaction: async () => { maybeReject(); txn++; return `0x${txn.toString(16).padStart(64, '0')}` as `0x${string}`; },
    waitForReceipt: async () => 'success',
    maxFeePerGas: async () => 2_000_000_000n,
  };
}

export function e2eIcpCaller(): IcpCaller {
  const p = e2eWallets().icp ?? '3yfhk-v3nwx-2xo3k-pjyl5-ugvqk-ywkpy-qaq7m-aocl5-iz5re-kxxtc-2qe';
  return { agent: {} as Agent, principal: Principal.fromText(p) };
}
