'use client';
// Brings the coin field to life on screens wide enough to have it: coin-motion.ts loads after the page is ready, as its own
// small file, so it never slows the first paint, and phones never fetch it at all.
import * as React from 'react';

export function Backdrop() {
  React.useEffect(() => {
    const wide = window.matchMedia('(min-width: 1024px) and (hover: hover)');
    const later = window.requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, 200));
    let stop: (() => void) | null = null;
    let live = true;
    const on = () => {
      if (!wide.matches) { stop?.(); stop = null; return; }
      if (stop) return;
      later(() => {
        void import('./coin-motion').then(({ startCoins }) => {
          const box = document.querySelector<HTMLElement>('[data-coins]');
          if (live && box && !stop && wide.matches) stop = startCoins(box);
        });
      });
    };
    on();
    wide.addEventListener('change', on);
    return () => { live = false; stop?.(); wide.removeEventListener('change', on); };
  }, []);
  return null;
}
