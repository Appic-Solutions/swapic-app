'use client';
// Moved from platform-v2 src/app/(panel)/swap/_components/select-token/radial-count-down.tsx (the old site's quote timer,
// approved by Jeff 2026-10-31 for the picked route card on Swap and Review swap), with only the props changed:
// - startedAt (ms): when the price on screen was fetched, so the ring follows the real refresh instead of its own clock;
//   a new startedAt starts it again;
// - full, it waits for the next price instead of starting over by itself (and calls onFull once, for Review swap);
// - paused holds it where it is (while the wallet asks to sign).
// The ring is information: it fills with reduce motion on too.
import * as React from 'react';
import { RadialProgress } from '@/components/ui/radial-progress';

export interface RadialCountDownProps {
  /** When the price on screen was fetched (ms since the epoch, as react-query's dataUpdatedAt). */
  startedAt: number;
  /** How long one turn takes (the quote refreshes this often). */
  duration?: number;
  /** Hold the ring where it is. */
  paused?: boolean;
  /** Called once when the ring is full. */
  onFull?: () => void;
}

export const RadialCountDown = ({ startedAt, duration = 20000, paused, onFull }: RadialCountDownProps) => {
  const [progress, setProgress] = React.useState(0);
  const full = React.useRef(onFull);
  full.current = onFull;

  React.useEffect(() => {
    if (paused) return;
    let animationFrameId: number;
    let called = false;

    const animate = () => {
      const elapsed = Date.now() - startedAt;
      const newProgress = Math.min(Math.max((elapsed / duration) * 100, 0), 100);
      setProgress(newProgress);

      if (elapsed < duration) {
        animationFrameId = requestAnimationFrame(animate);
      } else if (!called) {
        called = true;
        full.current?.();
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrameId);
  }, [startedAt, duration, paused]);

  return <RadialProgress value={progress} />;
};
