import * as React from 'react';
import { create } from 'zustand';
import type { Tab } from '@/components/layout/Nav';

interface NavTabState {
  /** A tab page showing another tab's page in place (History opening an order shows the Scanner's order page) moves the
   *  nav highlight there while it shows (motion row 58); null: the page's own tab. */
  override: Tab | null;
  set: (t: Tab | null) => void;
  /** Counts the clicks on the tab the page already is: its panel goes back to its first view on each (the pool page, the
   *  History list, the Scanner list), as a click on the current tab does on most sites. */
  resets: Record<Tab, number>;
  reset: (t: Tab) => void;
}

export const useNavTab = create<NavTabState>((set) => ({
  override: null,
  set: (override) => set({ override }),
  resets: { Swap: 0, Pool: 0, History: 0, Scanner: 0 },
  reset: (t) => set((s) => ({ resets: { ...s.resets, [t]: s.resets[t] + 1 } })),
}));

/** Runs `onReset` on each click on this tab while its page shows (not on mount). */
export function useNavReset(tab: Tab, onReset: () => void) {
  const n = useNavTab((s) => s.resets[tab]);
  const first = React.useRef(n);
  const run = React.useRef(onReset);
  run.current = onReset;
  React.useEffect(() => {
    if (n !== first.current) { first.current = n; run.current(); }
  }, [n]);
}
