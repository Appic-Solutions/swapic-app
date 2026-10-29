// Moved from the design's pool-screens.tsx (sha cd8202efaf03): display strings come from the caller.
import * as React from 'react';

// Detail rows inside a "You get" / "You receive" card (the live Option Details look).
export function Rows({ rows }: { rows: [string, string, string?][] }) {
  return (
    <div className="w-full space-y-2 border-t border-gray-700 pt-3">
      {rows.map(([k, v, tone]) => (
        <div key={k} className="flex justify-between gap-3 text-sm">
          <span className="text-muted">{k}</span>
          <span className={tone === 'green' ? 'text-[#12b76a]' : ''}>{v}</span>
        </div>
      ))}
    </div>
  );
}
