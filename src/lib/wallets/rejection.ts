// How a wallet's failure is read. Kept apart from evm-signer.ts so it imports no wallet SDK setup and is unit tested.
// Design note (money). Must never happen: a call whose answer was lost read as "the user said no" (the app would
// tell them nothing happened, and a retry could pay twice). How the design proves it: an ICP signer's error
// (@icp-sdk/signer's SignerError, OISY and NFID in accounts mode) is read by its ICRC-25 code only
// (github.com/dfinity/wg-identity-authentication, topics/icrc_25_signer_interaction_standard.md, Errors): 3001
// "The user has canceled the action" is a no; 4000 "The network call failed" and 4001 "The transport channel was
// closed unexpectedly" are lost answers, which go to the records check (plan check M4) and are never retried on their
// own. ICRC-25's 4001 is not EIP-1193's 4001 (user rejected), so a SignerError is told apart with instanceof before
// any EVM rule runs. Plug answers its own "no" as 3000 (generic) with the text "User rejected", raised before the call is
// sent, so exactly that pair is a no too; every other 3000 (Plug's failures after the call went out) stays what it was,
// never a no. Tested in rejection.test.ts.
import { SignerError } from '@icp-sdk/signer';

const ICRC25_GENERIC = 3000;
const ICRC25_ACTION_ABORTED = 3001;
const ICRC25_NETWORK_ERROR = 4000;
const ICRC25_CHANNEL_CLOSED = 4001;

/** EIP-1193 4200 (unsupported method), JSON-RPC -32601 (method not found) and -32004 (method not supported). */
const NO_SUCH_METHOD = new Set([4200, -32601, -32004]);
/** The same in words: WalletConnect's refusal of a method its session lacks (sign-client: "request() method: ..."), a wallet
 *  or device naming the method, typed data or EIP-712 beside saying it has none, or that this device or wallet has it not. */
const NO_SUCH_METHOD_TEXT = /request\(\) method: *eth_signTypedData|(method|sign_?typed_?data|typed data|eip-?712)[^.]*\b(not supported|unsupported|not implemented|not available|does not exist|not found)\b|\b(unsupported|not supported|does not support|doesn't support)\b[^.]*(method|sign_?typed_?data|typed data|eip-?712)|not supported (on|by) (this|your) (device|wallet)/i;

const causeOf = (e: unknown): unknown => (e && typeof e === 'object' ? (e as { cause?: unknown }).cause : undefined);
/** An ICP signer's no: ICRC-25 3001, or Plug's 3000 "User rejected". */
const signerSaidNo = (e: SignerError) => e.code === ICRC25_ACTION_ABORTED || (e.code === ICRC25_GENERIC && /^user rejected\.?$/i.test(e.message.trim()));

/** Wallets say "no" in several ways: EIP-1193 4001, viem's UserRejectedRequestError, WalletConnect text, ICRC-25 3001,
 *  Plug's 3000 "User rejected". */
export function isUserRejection(e: unknown): boolean {
  if (e instanceof SignerError) return signerSaidNo(e);
  const any = e as { code?: unknown; name?: unknown; message?: unknown } | null;
  if (!any) return false;
  if (any.code === 4001 || any.name === 'UserRejectedRequestError') return true;
  if (typeof any.message === 'string' && /user (rejected|denied)|rejected the request|cancel/i.test(any.message)) {
    // a wrapper around a signer error is judged by the signer error, never by its own text
    const inner = causeOf(e);
    return inner instanceof SignerError ? signerSaidNo(inner) : true;
  }
  const inner = causeOf(e);
  return inner ? isUserRejection(inner) : false;
}

/** An ICP signer whose channel closed or whose network call failed: the call may have run, so the records decide. */
export function isLostSignerAnswer(e: unknown): boolean {
  if (e instanceof SignerError) return e.code === ICRC25_CHANNEL_CLOSED || e.code === ICRC25_NETWORK_ERROR;
  const inner = causeOf(e);
  return inner ? isLostSignerAnswer(inner) : false;
}

/** A wallet that has no way to sign typed data, told apart from a person's no (which always wins, and is never this). The
 *  caller asks it of a typed data request alone, so a chain the wallet lacks never reads as this. */
export function isUnsupportedSign(e: unknown): boolean {
  if (isUserRejection(e)) return false;
  const any = e as { code?: unknown; message?: unknown } | null;
  if (!any) return false;
  if (typeof any.code === 'number' && NO_SUCH_METHOD.has(any.code)) return true;
  if (typeof any.message === 'string' && NO_SUCH_METHOD_TEXT.test(any.message)) return true;
  const inner = causeOf(e);
  return inner ? isUnsupportedSign(inner) : false;
}
