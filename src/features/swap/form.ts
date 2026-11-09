import { create } from 'zustand';
import type { UiToken } from '@/components/ui/token-types';
import type { OptionTag } from './options';
import { isEvmAddress, isIcpPrincipal } from '@/lib/validation';

export interface SwapFormState {
  from: UiToken | null; to: UiToken | null; amountText: string;
  recipient: { show: boolean; address: string; error: string };
  tag: OptionTag;
  /** The amount Max last put there: a click, no more is coming, so its quote asks at once (quote.ts askedAmount). */
  maxText?: string;
}
const EMPTY: SwapFormState = { from: null, to: null, amountText: '', recipient: { show: false, address: '', error: '' }, tag: 'Gasless' };

export const useSwapForm = create<SwapFormState & { set(p: Partial<SwapFormState>): void; flip(): void; reset(): void }>()((set) => ({
  ...EMPTY,
  set: (p) => set(p),
  flip: () => set((s) => ({ from: s.to, to: s.from, amountText: '', tag: 'Gasless' })),
  reset: () => set({ ...EMPTY }),
}));

/** The Send To Wallet field's sentence, the live WalletAddressInput's own wording, judged from the address itself
 *  (the live component checks its internal text, which misses an address given in the link). */
export function recipientError(to: UiToken | null, address: string): string {
  if (!to) return '';
  if (!address) return 'Wallet Address cannot be empty';
  if (to.chain_type === 'ICP') return isIcpPrincipal(address) ? '' : 'ICP Wallet Address is not valid';
  return isEvmAddress(address) ? '' : 'EVM Wallet Address is not valid';
}
