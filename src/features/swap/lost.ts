// Design note: plan 2 Task 7 (M4). After a lost answer, the records decide, and "nothing happened" waits until the call can no
// longer run: the IC drops an update not run within its ingress expiry, 5 minutes from when it was signed (before the answer
// was lost); 6 minutes leaves room for the clocks.
export type Seen = 'done' | 'nothing' | 'unclear';
export interface Clock { nowMs(): number; sleep(ms: number): Promise<void> }
export const realClock: Clock = { nowMs: () => Date.now(), sleep: (ms) => new Promise((r) => setTimeout(r, ms)) };
export const LOST_WINDOW_MS = 360_000;
export const LOOK_EVERY_MS = 15_000;

/** Look every 15 s; answer `done` as soon as the records show it, anything else only once the window has passed. */
export async function settleLost(look: () => Promise<Seen>, clock: Clock, lostAtMs: number): Promise<Seen> {
  for (;;) {
    let seen: Seen;
    try { seen = await look(); } catch { seen = 'unclear'; }
    if (seen === 'done' || clock.nowMs() >= lostAtMs + LOST_WINDOW_MS) return seen;
    await clock.sleep(LOOK_EVERY_MS);
  }
}
