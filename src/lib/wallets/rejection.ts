// How a wallet's failure is read. Kept apart from evm-signer.ts so it imports no wallet SDK setup and is unit tested.
// Design note (money). Must never happen: a call whose answer was lost read as "the user said no" (the app would
// tell them nothing happened, and a retry could pay twice). How the design proves it: an ICP signer's error
// (@icp-sdk/signer's SignerError, OISY and NFID in accounts mode) is read by its ICRC-25 code only
// (github.com/dfinity/wg-identity-authentication, topics/icrc_25_signer_interaction_standard.md, Errors): 3001
// "The user has canceled the action" is a no; 4000 "The network call failed" and 4001 "The transport channel was
// closed unexpectedly" are lost answers, which go to the records check (plan check M4) and are never retried on their
// own. ICRC-25's 4001 is not EIP-1193's 4001 (user rejected), so a SignerError is told apart with instanceof before
// any EVM rule runs. Tested in rejection.test.ts.
import { SignerError } from '@icp-sdk/signer';

const ICRC25_ACTION_ABORTED = 3001;
const ICRC25_NETWORK_ERROR = 4000;
const ICRC25_CHANNEL_CLOSED = 4001;

const causeOf = (e: unknown): unknown => (e && typeof e === 'object' ? (e as { cause?: unknown }).cause : undefined);

/** Wallets say "no" in several ways: EIP-1193 4001, viem's UserRejectedRequestError, WalletConnect text, ICRC-25 3001. */
export function isUserRejection(e: unknown): boolean {
  if (e instanceof SignerError) return e.code === ICRC25_ACTION_ABORTED;
  const any = e as { code?: unknown; name?: unknown; message?: unknown } | null;
  if (!any) return false;
  if (any.code === 4001 || any.name === 'UserRejectedRequestError') return true;
  if (typeof any.message === 'string' && /user (rejected|denied)|rejected the request|cancel/i.test(any.message)) {
    // a wrapper around a signer error is judged by the signer error, never by its own text
    const inner = causeOf(e);
    return inner instanceof SignerError ? inner.code === ICRC25_ACTION_ABORTED : true;
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
