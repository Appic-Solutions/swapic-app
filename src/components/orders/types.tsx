// The shapes the order pieces draw. Every text is formatted by the caller with @/lib/money.

/** One side of an order. `chain` is the chain's name, or `Swapic Pool`. */
export interface SideView {
  symbol: string;
  logo: string;
  chain: string;
  chainLogo: string;
  amountText: string;
  usdText: string;
}

/** One line of the step list; `tx` is a link to the chain's explorer. */
export interface StepView {
  key: string;
  label: string;
  sub?: string;
  state: 'done' | 'wait' | 'fail' | 'todo';
  at?: string;
  took?: string;
  tx?: { text: string; href: string };
}

export type OrderStatus = 'delivered' | 'pending' | 'queued' | 'refunded' | 'failed';
