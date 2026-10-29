// Moved from the design's scanner-screens.tsx (sha 8c1770a93ada).
import * as React from 'react';

export function InfoRow({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-[#898989]">{k}</span>
      <span className="flex min-w-0 items-center gap-x-1 text-right font-semibold text-white">{children}</span>
    </div>
  );
}
