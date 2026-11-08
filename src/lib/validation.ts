import { isAddress } from 'viem';
import { Principal } from '@icp-sdk/core/principal';
import { ed25519 } from '@noble/curves/ed25519';
import { decode58 } from '@/lib/solana/base58';

/** An EVM address; mixed case must be the EIP-55 checksum (viem strict mode). */
export function isEvmAddress(text: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(text) && isAddress(text, { strict: true });
}

/** An ICP principal in its text form, and not the anonymous one. */
export function isIcpPrincipal(text: string): boolean {
  if (!/^[a-z0-9]{5}(-[a-z0-9]{5})*(-[a-z0-9]{1,5})?$/.test(text)) return false;
  try {
    const p = Principal.fromText(text);
    return p.toText() === text && !p.isAnonymous();
  } catch {
    return false;
  }
}

/** Whether 32 bytes are a point on ed25519: a wallet's key is, a program-derived address (a token account) is not. */
export function isOnCurve(bytes: Uint8Array): boolean {
  try {
    ed25519.ExtendedPoint.fromHex(bytes);
    return true;
  } catch {
    return false;
  }
}

/** A Solana wallet: base58 of 32 bytes on the curve, trimmed. A pasted token account or program-derived address is off
 *  the curve and refused; a mint or a program is on it, so `solanaRecipientProblem` also reads the chain. */
export function isSolanaAddress(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 32 || trimmed.length > 44) return false;
  const bytes = decode58(trimmed);
  return !!bytes && bytes.length === 32 && isOnCurve(bytes);
}
