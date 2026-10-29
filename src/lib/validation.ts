import { isAddress } from 'viem';
import { Principal } from '@icp-sdk/core/principal';

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
