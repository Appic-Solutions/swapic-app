'use client';
// The page's backdrop: the coin field, on screens wide enough to have room for it. It loads after the page is ready, as its
// own small file, so it never slows the first paint, and phones never fetch it at all.
import * as React from 'react';

const CoinField = React.lazy(() => import('./CoinField'));

export function Backdrop() {
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    const wide = window.matchMedia('(min-width: 1024px) and (hover: hover)');
    const later = window.requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, 200));
    const on = () => { if (wide.matches) later(() => setShow(true)); else setShow(false); };
    on();
    wide.addEventListener('change', on);
    return () => wide.removeEventListener('change', on);
  }, []);
  return show ? <React.Suspense fallback={null}><CoinField /></React.Suspense> : null;
}
