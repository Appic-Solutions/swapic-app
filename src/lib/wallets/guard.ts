// Design note (smart wallet detection, plan 1's connect-time guard; Jeff, 2026-10-29: option B now, full support later).
// A smart wallet is an EVM wallet whose address holds contract code (a Safe, an ERC-4337 account, Coinbase's Base
// Account). It may swap (Swapic.sol accepts ERC-1271 signatures); what it must never do: receive on ANOTHER EVM chain at
// its own address by default (its address may not be the person's there), or stake (withdraw_evm takes only a key's
// signature, so such a stake could never be withdrawn). So the wallet is FLAGGED, never disconnected: when an EVM wallet
// connects (and on every chain change), the bridge reads the address's code on the connected chain through wagmi's
// getBytecode on the AppKit adapter's config (the app's only chain read path) and asks judgeEvmWallet. The Base Account
// connector id is smart outright; contract code is smart; EIP-7702 delegation code (0xef0100 and a 20 byte address) is
// regular, because that account still signs with its own key; no code is regular. Code that could not be read is
// UNKNOWN (lead, 2026-10-29): read again on the next connect or chain switch; the recipient rule treats it as smart (fail
// closed: the person types the address), the Stake button does not block on it (the quoter's payerIsContract decides).
// The store keeps `smartWallet` beside the address (true, false, or null for unknown); the Swap panel and the Pool read it
// (plans 2 and 3, "Smart wallets"). Tested in guard.test.ts.
//
// Paying through Permit2 (You pay gas, Jeff 2026-11-08) asks more than this: an EIP-7702 account is regular above because
// Swapic tries the key first (Swapic.sol _accepted), but Permit2 does not. Its SignatureVerification.verify takes
// ecrecover only when the signer's code length is 0; with any code, a delegation's 23 bytes too, it asks the code
// (ERC-1271), and a delegate may not read a plain signature (the swap reverts, the person paid the gas). So that path takes
// only an address with no code at all on the chain it pays from (holdsNoCode), and a signature that is that address's own
// key's (ownSignature): an account not deployed there has no code yet and signs some other way (ERC-6492, an owner's
// key), which Permit2 would refuse. A read that failed says nothing about the wallet: `unread` is never "cannot sign".
import { recoverTypedDataAddress, type Hex } from 'viem';
import type { SignableTypedData } from './evm-signer';

/** wagmi's id for the Base Account connector (@wagmi/connectors/dist/esm/baseAccount.js:9). */
export const BASE_ACCOUNT_CONNECTOR_ID = 'baseAccount';

const DELEGATION = /^0xef0100[0-9a-fA-F]{40}$/;

export type EvmWalletKind = 'regular' | 'smart' | 'unknown';

/** `code`: the address's code on the connected chain ('0x' or '' for none); null when it could not be read. */
export function judgeEvmWallet(connectorId: string | undefined, code: string | null): EvmWalletKind {
  if (connectorId === BASE_ACCOUNT_CONNECTOR_ID) return 'smart';
  if (code === null) return 'unknown';
  if (code === '0x' || code === '') return 'regular';
  if (DELEGATION.test(code)) return 'regular';
  return 'smart';
}

/** The address holds no code at all: Permit2 reads its signature with ecrecover. Code that could not be read (null) is not this. */
export const holdsNoCode = (code: string | null): boolean => code === '0x' || code === '';

/** What is known of a payer for Permit2 on one chain: no code and nothing against it, code there, a wallet that says it has no
 *  typed data method, or a read that failed or came too late. */
export type PayerRead = 'plain' | 'code' | 'noTypedData' | 'unread';

/** A read given `ms` to answer: late or failed, it is null. Never throws. */
export const within = <T>(ms: number, read: () => Promise<T>): Promise<T | null> =>
  new Promise((done) => {
    const t = setTimeout(() => done(null), ms);
    read().then((v) => { clearTimeout(t); done(v); }, () => { clearTimeout(t); done(null); });
  });

/** A WalletConnect session names the methods its wallet granted: one without typed data says so before anything is asked.
 *  No other wallet can say it without a popup, so any other provider reads as false here. */
export const sessionLacksTypedData = (provider: unknown): boolean => {
  const methods = (provider as { session?: { namespaces?: Record<string, { methods?: unknown } | undefined> } } | null | undefined)?.session?.namespaces?.eip155?.methods;
  return Array.isArray(methods) && !methods.includes('eth_signTypedData_v4');
};

/** A key's 65 bytes with the last one as Permit2's ecrecover takes it (some devices answer 0 or 1 for 27 or 28); null for
 *  anything else (a contract wallet's or an ERC-6492 answer). */
export function normalizedSignature(signature: Hex): Hex | null {
  if (!/^0x[0-9a-fA-F]{128}(00|01|1b|1c)$/i.test(signature)) return null;
  const v = signature.slice(130).toLowerCase();
  return v === '00' || v === '01' ? `${signature.slice(0, 130)}${v === '00' ? '1b' : '1c'}` as Hex : signature;
}

/** What Permit2 asks of an address with no code: the signature's bytes as they must be sent, when they recover to it over this
 *  very typed data; else null. */
export async function ownSignature(address: string, td: SignableTypedData, signature: Hex): Promise<Hex | null> {
  const bytes = normalizedSignature(signature);
  if (!bytes) return null;
  try {
    const { EIP712Domain: _omit, ...types } = td.types;
    const who = await recoverTypedDataAddress({ domain: td.domain, types, primaryType: td.primaryType, message: td.message, signature: bytes } as never);
    return who.toLowerCase() === address.toLowerCase() ? bytes : null;
  } catch {
    return null;
  }
}
