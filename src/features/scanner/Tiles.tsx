// Moved from the design's scanner-screens.tsx Tiles: the KPI tiles in the live StatusBox look, from GET /v2/scanner/stats.
import * as React from 'react';
import { SkeletonText } from '@/components/ui/skeleton';

const tile = 'flex min-w-0 flex-1 flex-col justify-between gap-y-1 rounded-3xl border border-line bg-input-fields p-4 text-white md:min-h-24 md:p-5';
const label = 'text-xs font-medium text-secondary md:text-sm';
// the tiles before the stats: a sub line that never changes stays (it can wrap on phones), one that does waits
const LOADING: [string, string | null][] = [['Swaps, all time', 'since launch'], ['Volume, all time', 'all chains'], ['Median time', 'signature to delivery'], ['Delivered', null]];

export function Tiles({ tiles }: { tiles: [string, string, string][] | null }) {
  return (
    <div className="grid w-full grid-cols-2 gap-3 [&>*:last-child:nth-child(odd)]:col-span-2 md:flex md:gap-4">
      {tiles
        ? tiles.map(([l, v, s]) => (
            <div key={l} className={tile}>
              <p className={label}>{l}</p>
              <p className="font-semibold md:text-xl">{v}</p>
              <p className="text-xs text-secondary">{s}</p>
            </div>
          ))
        : LOADING.map(([l, s]) => (
            <div key={l} className={tile}>
              <p className={label}>{l}</p>
              <SkeletonText className="w-16 max-w-full font-semibold md:w-20 md:text-xl" />
              {s ? <p className="text-xs text-secondary">{s}</p> : (
                <div>
                  <SkeletonText className="w-24 max-w-full text-xs" />
                  {/* its "x% refunded as USDC" takes two lines on phones */}
                  {l === 'Delivered' && <SkeletonText className="w-16 text-xs md:hidden" />}
                </div>
              )}
            </div>
          ))}
    </div>
  );
}
