import { isEvmAddress, isIcpPrincipal, isSolanaAddress } from '@/lib/validation';
import { decode58 } from '@/lib/solana/base58';

const LOOKUP = /^(0x[0-9a-fA-F]{64}|payout-\d+|stake-[0-9a-f]{64}|withdraw-[0-9a-f]{64})$/;

export function classify(text: string): { kind: 'evm' | 'icp' | 'solana' | 'lookup' | 'none'; value: string } {
  const t = text.trim();
  if (isEvmAddress(t)) return { kind: 'evm', value: t.toLowerCase() };
  if (isIcpPrincipal(t)) return { kind: 'icp', value: t };
  if (isSolanaAddress(t)) return { kind: 'solana', value: t };
  // a Solana signature: base58, case exact
  if (t.length >= 86 && t.length <= 88 && decode58(t)?.length === 64) return { kind: 'lookup', value: t };
  if (LOOKUP.test(t)) return { kind: 'lookup', value: t };
  return { kind: 'none', value: t };
}
