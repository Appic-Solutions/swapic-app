// The one grey line under a panel's main button: what can be done now (Hint, src/components/design/Hint.tsx). Short and
// plain, each under about 70 characters. Swap's line follows its button's state (swapHint, features/swap/button.ts).
export const HINTS = {
  /** Swap: no From or no To token yet. */
  swapPick: 'Pick the token to send and the token to receive.',
  /** Swap: both tokens, no amount. */
  swapAmount: 'Type an amount to see the routes.',
  /** Swap: the routes for the amount are loading (or a shared link's tokens). */
  swapLoading: 'Finding the routes for this amount.',
  /** Swap: routes shown, ready for Review swap. */
  swapRoutes: 'Pick a route, then press Review swap.',
  /** Swap: no route, or the amount is over what fits right now. */
  swapNoRoute: 'Try a smaller amount or another token.',
  /** Swap: swaps paused for a while. */
  swapPaused: 'Swaps you already started keep going. Try again soon.',
  /** Swap: no wallet on the From side. */
  swapConnect: 'Connect the wallet you send from.',
  /** Swap: the receiving address is missing or not valid. */
  swapAddress: 'Paste the address that should receive the tokens.',
  /** Swap: more than the wallet holds. */
  swapBalance: 'Lower the amount to what your wallet holds.',
  /** Swap: the gasless route must approve first and the wallet has no coin for it. */
  swapCoin: 'Add a little of the chain’s coin for gas, or pick another route.',
  /** Review swap. */
  review: 'Check the details, then confirm in your wallet.',
  /** Your swap, on its way or ended (the blue note already says the page can be left). */
  status: 'Start another swap now, or follow this one in History.',
  /** The pool page. */
  pool: 'Stake USDC from any chain, or withdraw anytime.',
  /** Stake. */
  stake: 'Pick the chain and the amount to stake.',
  /** Withdraw. */
  withdraw: 'Pick the amount and the chain to receive on.',
} as const;
