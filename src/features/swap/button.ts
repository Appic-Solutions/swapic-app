import { formatUsdWhole } from '@/lib/money';
import { HINTS } from '@/lib/copy/hints';

/** `capped`: the amount is over the canister's per swap cap (the quote's 422 aboveSwapCap; `cap` says how much fits). */
export type QuoteState = 'none' | 'loading' | 'ready' | 'empty' | 'paused' | 'icpPaused' | 'capped' | 'error';
export interface ButtonInput {
  from: boolean; to: boolean; amount: bigint | null; amountError: string | null; overBalance: boolean;
  quote: QuoteState; hasOptions: boolean; recipientShown: boolean; recipientError: string | null;
  /** A wallet is connected on the From side. */
  fromWallet: boolean;
  /** A recipient is known: the To side's wallet, or a valid Send To Wallet address. */
  recipient: boolean;
  /** The per swap cap in micro USD when the quote said the amount is over it. */
  cap?: bigint | null;
  /** The picked gasless card must approve first and the wallet holds none of this coin. */
  needsCoin?: string;
}

/** The action button's text (spec 5.1); undefined shows the spinner. */
export function swapButton(i: ButtonInput): { text: string | undefined; enabled: boolean } {
  if (!i.from || !i.to) return { text: 'Select tokens to swap', enabled: false };
  if (i.amount === null || i.amount === 0n || i.amountError) return { text: 'Set token amount to continue', enabled: false };
  if (i.quote === 'loading') return { text: undefined, enabled: false };
  if (i.quote === 'paused') return { text: 'Swaps are paused', enabled: false };
  if (i.quote === 'icpPaused') return { text: 'Paused for now', enabled: false };
  // as Stake's over the cap: how much fits right now, never a button that cannot work
  if (i.quote === 'capped' && i.cap !== undefined && i.cap !== null) return { text: `Up to ${formatUsdWhole(i.cap)} right now`, enabled: false };
  if (i.quote === 'empty' || i.quote === 'error' || !i.hasOptions) return { text: 'No route found', enabled: false };
  if (i.recipientShown && i.recipientError) return { text: 'Enter a valid address', enabled: false };
  if (!i.fromWallet) return { text: 'Connect wallet', enabled: true };
  if (!i.recipient) return { text: 'Enter a valid address', enabled: false };
  if (i.needsCoin) return { text: `Add ${i.needsCoin} to continue`, enabled: false };
  return { text: 'Review swap', enabled: !i.overBalance };
}

/** The grey line under the button (lib/copy/hints.ts): what can be done now, read in the button's own order; every state
 *  has one, so the panel never changes height as they change. */
export function swapHint(i: ButtonInput): string {
  if (!i.from || !i.to) return HINTS.swapPick;
  if (i.amount === null || i.amount === 0n || i.amountError) return HINTS.swapAmount;
  if (i.quote === 'loading') return HINTS.swapLoading;
  if (i.quote === 'paused' || i.quote === 'icpPaused') return HINTS.swapPaused;
  if (i.quote === 'capped' || i.quote === 'empty' || i.quote === 'error' || !i.hasOptions) return HINTS.swapNoRoute;
  if (i.recipientShown && i.recipientError) return HINTS.swapAddress;
  if (!i.fromWallet) return HINTS.swapConnect;
  if (!i.recipient) return HINTS.swapAddress;
  if (i.needsCoin) return HINTS.swapCoin;
  if (i.overBalance) return HINTS.swapBalance;
  return HINTS.swapRoutes;
}
