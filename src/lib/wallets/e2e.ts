// e2e builds only: the wallets a Playwright test sets on window.__SWAPIC_E2E__. Without `evmKey` they return a fixed
// signature (the fake backend never checks one); with `evmKey` (a key the test generated in memory for this run) they
// sign for real, so the withdraw signature rules run unchanged in the Pool click-through. The marker is a string used
// at run time, so plan 4 Task 6's build check finds this file in any bundle that holds it.
import type { Agent } from '@icp-sdk/core/agent';
import { Principal } from '@icp-sdk/core/principal';
import { privateKeyToAccount } from 'viem/accounts';
import type { IcpCaller } from '@/lib/icp';
import type { EvmSigner, SignableTypedData } from './evm-signer';
import { normalizedSignature, ownSignature, within, type PayerRead } from './guard';

export const E2E_MARKER = 'E2E-FAKE-MARKER';
export interface E2eWallets {
  evm: `0x${string}` | null; icp: string | null; rejectNext?: boolean; evmKey?: `0x${string}`; /** a smart wallet (plan 2 Smart wallets) */ evmSmart?: boolean;
  /** the address holds code a key still signs for (an EIP-7702 delegation): regular in the store, never through Permit2 */
  evmCode?: boolean;
  /** the code at the address cannot be read */
  evmCodeUnread?: boolean;
  /** the code at the address takes this long to read */
  evmCodeDelayMs?: number;
  /** a session that names no typed data method (WalletConnect's list) */
  noTypedData?: boolean;
  /** the wallet answers a typed data request as a method it does not have (EIP-1193 4200) */
  signUnsupported?: boolean;
  /** a "no" to the next typed data request alone, whatever came before it */
  rejectSign?: boolean;
  /** the allowance of Permit2 on chain, as text (none when absent) */
  permit2Allowance?: string;
  /** the allowance of Permit2 cannot be read */
  allowanceUnread?: boolean;
  /** the wallet takes this long to answer a send or a signature (a click-through watches each wallet step light up) */
  delayMs?: number;
  /** every transaction the fake wallet sent, in order (a click-through reads what was really signed) */
  sent?: { chainId: number; to: string; data: string; value: string }[];
  /** every typed data the fake wallet signed, its numbers as text */
  signed?: unknown[];
}
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
      const w = e2eWallets();
      if (w.delayMs) await new Promise((r) => setTimeout(r, w.delayMs));
      maybeReject();
      if (w.rejectSign) { w.rejectSign = false; throw reject(); }
      if (w.signUnsupported) throw Object.assign(new Error('The Provider does not support the requested method.'), { code: 4200 });
      (w.signed ??= []).push(JSON.parse(JSON.stringify(td, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))));
      const key = e2eWallets().evmKey;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return key ? privateKeyToAccount(key).signTypedData(td as any) : FAKE_SIG;
    },
    sendTransaction: async (tx) => {
      const w = e2eWallets();
      if (w.delayMs) await new Promise((r) => setTimeout(r, w.delayMs));
      maybeReject();
      (w.sent ??= []).push({ chainId: tx.chainId, to: tx.to, data: tx.data, value: tx.value.toString() });
      txn++;
      return `0x${txn.toString(16).padStart(64, '0')}` as `0x${string}`;
    },
    waitForReceipt: async () => 'success',
    maxFeePerGas: async () => 2_000_000_000n,
    payerOn: async (_chainId, limitMs): Promise<PayerRead> => {
      const w = e2eWallets();
      if (w.evmSmart || w.evmCode) return 'code';
      if (w.noTypedData) return 'noTypedData';
      if (w.evmCodeUnread) return 'unread';
      const read = await within(limitMs, async () => { if (w.evmCodeDelayMs) await new Promise((r) => setTimeout(r, w.evmCodeDelayMs)); return 'plain' as const; });
      return read ?? 'unread';
    },
    allowanceOf: async () => { const w = e2eWallets(); return w.allowanceUnread ? null : BigInt(w.permit2Allowance ?? '0'); },
    // the fixed signature is nobody's: only a wallet with a key can be asked whose it is
    ownSignature: async (td, signature) => (e2eWallets().evmKey ? ownSignature(address, td, signature) : normalizedSignature(signature)),
  };
}

export function e2eIcpCaller(): IcpCaller {
  const p = e2eWallets().icp ?? '3yfhk-v3nwx-2xo3k-pjyl5-ugvqk-ywkpy-qaq7m-aocl5-iz5re-kxxtc-2qe';
  return { agent: {} as Agent, principal: Principal.fromText(p) };
}
