// Design note (connect-time wallet guard, lead's ruling 2026-10-29).
// Must never happen: a smart-contract wallet kept as the connected EVM wallet (the gasless and ck routes refuse a
// contract payer: payerIsContract), in particular AppKit 1.8.24's Base Account connector, which the adapter always
// adds (@reown/appkit-adapter-wagmi/dist/esm/src/client.js:171-176) and createAppKit cannot switch off.
// How the design proves it: when an EVM wallet connects (and on every chain change), the bridge reads the address's
// code on the connected chain through wagmi's getBytecode on the AppKit adapter's config (the app's only chain read
// path: AppKit's RPC for chains 1, 137, 8453 and 42161) and asks judgeEvmWallet. The Base Account connector id is
// refused outright; contract code is refused; EIP-7702 delegation code (0xef0100 and a 20 byte address) is allowed,
// because that account still signs with its own key. A refused wallet is disconnected before it reaches the store,
// and the wallet menu says why. When the code cannot be read (the read failed), the wallet is allowed and the
// quoter's payerIsContract refusal is the backstop; a smart wallet not yet deployed on the connected chain has no
// code there and is caught the same way. Tested in guard.test.ts.

/** wagmi's id for the Base Account connector (@wagmi/connectors/dist/esm/baseAccount.js:9). */
export const BASE_ACCOUNT_CONNECTOR_ID = 'baseAccount';
/** AppKit's explorer id for Base Account (@reown/appkit-utils/dist/esm/src/PresetsUtil.js:7), for excludeWalletIds. */
export const BASE_ACCOUNT_EXPLORER_ID = 'fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa';

const DELEGATION = /^0xef0100[0-9a-fA-F]{40}$/;

export type EvmWalletVerdict = 'allow' | 'refuse';

/** `code`: the address's code on the connected chain; undefined or null when it could not be read. */
export function judgeEvmWallet(connectorId: string | undefined, code: string | undefined | null): EvmWalletVerdict {
  if (connectorId === BASE_ACCOUNT_CONNECTOR_ID) return 'refuse';
  if (code === undefined || code === null || code === '0x' || code === '') return 'allow';
  if (DELEGATION.test(code)) return 'allow';
  return 'refuse';
}
