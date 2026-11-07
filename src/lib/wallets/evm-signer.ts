'use client';
// Design note (wallets and signing, plan 1 Task 7).
// OISY and NFID connect in accounts mode, Internet Identity in delegation mode (lead's call, 2026-10-28).
// Must never happen: a signature or transaction built on a hand made client around window.ethereum (it breaks
// WalletConnect and phones, spec section 8); an email or social login, or a Coinbase smart wallet, connected (they
// are contract wallets, which the gasless and ck routes refuse: payerIsContract); a send on the wrong chain; an
// anonymous ICP principal kept as "connected"; a fake signer in a production build.
// How the design proves it: every EVM action goes through wagmi actions on the AppKit adapter's config
// (signTypedData, sendTransaction, switchChain, and the receipt read on the config's own public client); AppKit is created from
// `@reown/appkit/react-core` (basic mode: email, socials, swaps and onramp off whatever the Reown dashboard says) with
// `features: { email: false, socials: false, analytics: false, swaps: false, onramp: false }` and
// `coinbasePreference: 'eoaOnly'` (both checked in node_modules/@reown/appkit* 1.8.24 type files).
// Smart wallets (Jeff, 2026-10-29, option B): they may swap; the connect-time guard (guard.ts, run by bridge.tsx: the Base
// Account connector or contract code that is not an EIP-7702 delegation) flags them as `smartWallet` in the store, so the
// Swap panel never sends to their own address on another chain and the Pool keeps Stake off;
// EvmSigner.sendTransaction switches chain first and refuses when the wallet reports another chain after the switch;
// the store's setIcp drops 2vxsx-fae (tested); the e2e signers are reached only through an inline
// `process.env.NEXT_PUBLIC_SWAPIC_ENV === 'e2e'` check.
import {
  estimateFeesPerGas, getAccount, getPublicClient, sendTransaction, signTypedData, switchChain,
} from 'wagmi/actions';
import { wagmiConfig } from './evm-config';

export type SignableTypedData = {
  domain: Record<string, unknown>;
  types: Record<string, { name: string; type: string }[]>;
  primaryType: string;
  message: Record<string, unknown>;
};

export interface EvmSigner {
  address: `0x${string}`;
  ensureChain(chainId: number): Promise<void>;
  signTypedData(td: SignableTypedData): Promise<`0x${string}`>;
  sendTransaction(tx: { chainId: number; to: `0x${string}`; data: `0x${string}`; value: bigint }): Promise<`0x${string}`>;
  /** The receipt's status as the chain wrote it; a transaction the wallet replaced with other calls (a cancel) reads as
   *  reverted, since what was sent never ran, and a speed up (the same calls) as its own. With `timeoutMs`, it stops
   *  looking then and throws (the caller's limit). */
  waitForReceipt(chainId: number, hash: `0x${string}`, timeoutMs?: number): Promise<'success' | 'reverted'>;
  maxFeePerGas(chainId: number): Promise<bigint>;
}

type ChainId = (typeof wagmiConfig)['chains'][number]['id'];

export function wagmiSigner(address: `0x${string}`): EvmSigner {
  const ensureChain = async (chainId: number) => {
    if (getAccount(wagmiConfig).chainId !== chainId) await switchChain(wagmiConfig, { chainId: chainId as ChainId });
    if (getAccount(wagmiConfig).chainId !== chainId) throw new Error('wrongChain');
  };
  return {
    address,
    ensureChain,
    async signTypedData(td) {
      const { EIP712Domain: _omit, ...types } = td.types;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return signTypedData(wagmiConfig, { account: address, domain: td.domain as any, types: types as any, primaryType: td.primaryType, message: td.message as any });
    },
    async sendTransaction(tx) {
      await ensureChain(tx.chainId);
      return sendTransaction(wagmiConfig, { account: address, chainId: tx.chainId as ChainId, to: tx.to, data: tx.data, value: tx.value });
    },
    async waitForReceipt(chainId, hash, timeoutMs) {
      // viem's own wait on the config's client: wagmi's action throws on a reverted receipt (it replays the call for a
      // reason), so a revert could not be told from a lost answer; no limit unless the caller sets one, as before
      const client = getPublicClient(wagmiConfig, { chainId: chainId as ChainId });
      if (!client) throw new Error('wrongChain');
      let other = false;
      const r = await client.waitForTransactionReceipt({ hash, timeout: timeoutMs ?? 0, onReplaced: (x) => { other = x.reason !== 'repriced'; } });
      return other ? 'reverted' : r.status;
    },
    async maxFeePerGas(chainId) {
      const f = await estimateFeesPerGas(wagmiConfig, { chainId: chainId as ChainId });
      return f.maxFeePerGas ?? 0n;
    },
  };
}

export { isUserRejection, isLostSignerAnswer } from './rejection';
