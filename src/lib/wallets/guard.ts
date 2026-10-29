// Design note (smart wallet detection, plan 1's connect-time guard; Jeff, 2026-10-29: option B now, full support later).
// A smart wallet is an EVM wallet whose address holds contract code (a Safe, an ERC-4337 account, Coinbase's Base
// Account). It may swap (Swapic.sol accepts ERC-1271 signatures); what it must never do: receive on ANOTHER EVM chain at
// its own address by default (its address may not be the person's there), or stake (withdraw_evm takes only a key's
// signature, so such a stake could never be withdrawn). So the wallet is FLAGGED, never disconnected: when an EVM wallet
// connects (and on every chain change), the bridge reads the address's code on the connected chain through wagmi's
// getBytecode on the AppKit adapter's config (the app's only chain read path) and asks judgeEvmWallet. The Base Account
// connector id is smart outright; contract code is smart; EIP-7702 delegation code (0xef0100 and a 20 byte address) is
// regular, because that account still signs with its own key; no code is regular. Unread code (the read failed) is read
// as regular, and the quoter's payerIsContract refusal is the backstop (ck routes, stakes). The store keeps
// `smartWallet` beside the address; the Swap panel and the Pool read it (plans 2 and 3, "Smart wallets"). Tested in
// guard.test.ts.

/** wagmi's id for the Base Account connector (@wagmi/connectors/dist/esm/baseAccount.js:9). */
export const BASE_ACCOUNT_CONNECTOR_ID = 'baseAccount';

const DELEGATION = /^0xef0100[0-9a-fA-F]{40}$/;

export type EvmWalletKind = 'regular' | 'smart';

/** `code`: the address's code on the connected chain; undefined or null when it could not be read. */
export function judgeEvmWallet(connectorId: string | undefined, code: string | undefined | null): EvmWalletKind {
  if (connectorId === BASE_ACCOUNT_CONNECTOR_ID) return 'smart';
  if (code === undefined || code === null || code === '0x' || code === '') return 'regular';
  if (DELEGATION.test(code)) return 'regular';
  return 'smart';
}
