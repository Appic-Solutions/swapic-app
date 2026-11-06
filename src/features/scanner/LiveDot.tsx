// Moved from the design's scanner-screens.tsx LiveDot.
import * as React from 'react';

export function LiveDot() {
  return (
    <span className="flex items-center gap-x-1.5 rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
      </span>
      Live
    </span>
  );
}
