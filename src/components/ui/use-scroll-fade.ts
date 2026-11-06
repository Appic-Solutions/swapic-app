'use client';
import * as React from 'react';

/**
 * A scroll box fades at an edge with more behind it, so nothing reads as cut off; a list that fits, or one scrolled to its
 * end, keeps a crisp edge. Put `ref` on the box and `fade` (globals.css) in its classes. The box may mount later than the
 * component; `forward` is a ref of the caller's own that should hold the box too.
 */
export function useScrollFade<T extends HTMLElement>(forward?: React.RefObject<T | null>) {
  const [box, setBox] = React.useState<T | null>(null);
  const ref = React.useCallback((el: T | null) => {
    if (forward) forward.current = el;
    setBox(el);
  }, [forward]);
  const [edges, setEdges] = React.useState({ top: false, bottom: false });
  React.useEffect(() => {
    if (!box) return;
    const read = () => {
      // phones: the box is not a scroll box, the page scrolls
      const scrolls = getComputedStyle(box).overflowY !== 'visible';
      const top = scrolls && box.scrollTop > 1;
      const bottom = scrolls && box.scrollTop + box.clientHeight < box.scrollHeight - 1;
      setEdges((e) => (e.top === top && e.bottom === bottom ? e : { top, bottom }));
    };
    const sizes = new ResizeObserver(read);
    const watch = () => { sizes.disconnect(); sizes.observe(box); [...box.children].forEach((c) => sizes.observe(c)); read(); };
    const rows = new MutationObserver(watch);
    rows.observe(box, { childList: true });
    box.addEventListener('scroll', read, { passive: true });
    watch();
    // rows that arrive rising 6 px overflow for a moment, and nothing says when they settle
    const settled = setTimeout(read, 800);
    return () => { clearTimeout(settled); sizes.disconnect(); rows.disconnect(); box.removeEventListener('scroll', read); };
  }, [box]);
  return { ref, fade: edges.top && edges.bottom ? 'fade-y' : edges.top ? 'fade-top' : edges.bottom ? 'fade-bottom' : '' };
}
