// The coin field's table, one place for the page (CoinLayer) and for what moves it (coin-motion).

/** name, center across and down the window in %, coin size in px, px between its two walls, seconds from wall to wall. */
export type Coin = [name: string, x: number, y: number, size: number, walls: number, seconds: number];
export const COINS: Coin[] = [
  ['ethereum', 9, 24, 100, 48, 18], ['btc', 88, 20, 105, 55, 20.25], ['usdc', 16, 74, 96, 44, 15], ['sol', 82, 76, 91, 50, 18.75],
  ['icp', 3, 50, 82, 42, 14.25], ['optimism', 96, 48, 75, 36, 12.75], ['arbitrum', 22, 13, 68, 32, 11.25], ['base', 72, 16, 73, 34, 12],
  ['polygon', 27, 88, 66, 38, 13.5], ['unichain', 70, 91, 71, 32, 11.25], ['monad', 40, 17, 59, 28, 10.5], ['hyperevm', 58, 93, 62, 30, 11.25],
  ['worldchain', 5, 88, 68, 40, 14.25], ['plasma', 94, 88, 64, 36, 12.75], ['gldt', 20, 46, 80, 46, 16.5], ['ogy', 79, 46, 78, 44, 15.75],
];
/** The resting image holds the coins 4 across, in this order. */
export const REST_ACROSS = 4;
