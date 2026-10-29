import { isEvmAddress, isIcpPrincipal } from '@/lib/validation';

const LOOKUP = /^(0x[0-9a-fA-F]{64}|payout-\d+|stake-[0-9a-f]{64}|withdraw-[0-9a-f]{64})$/;

export function classify(text: string): { kind: 'evm' | 'icp' | 'lookup' | 'none'; value: string } {
  const t = text.trim();
  if (isEvmAddress(t)) return { kind: 'evm', value: t.toLowerCase() };
  if (isIcpPrincipal(t)) return { kind: 'icp', value: t };
  if (LOOKUP.test(t)) return { kind: 'lookup', value: t };
  return { kind: 'none', value: t };
}
