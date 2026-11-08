// Moved from the design's pool-screens.tsx Tiles: the live StatusBox markup (it prefixes "$", so it is not reused).
import * as React from 'react';
import { SkeletonText } from '@/components/ui/skeleton';
import type { PoolAnswer } from '@/lib/api';
import { tiles } from '../data';

// short windows (a laptop at 125%): lower tiles; tiny ones leave out the small line under the number
const tile = 'flex min-w-0 flex-1 flex-col justify-between gap-y-1 rounded-3xl border border-line bg-input-fields p-4 text-white md:min-h-24 md:p-5 md:short:min-h-0 md:short:py-4 md:tiny:py-3';
const sub = 'text-xs text-secondary md:tiny:hidden';
const label = 'text-xs font-medium text-secondary md:text-sm';

/** The tiles while the pool loads: the labels and what never changes stay, the numbers wait. */
export function TilesLoading() {
  return (
    <div className="grid w-full grid-cols-2 gap-3 [&>*:last-child:nth-child(odd)]:col-span-2 md:flex">
      <div className={tile}>
        <p className={label}>APY, 7 days</p>
        <SkeletonText className="w-14 font-semibold md:text-xl" />
        <SkeletonText className="w-20 text-xs md:tiny:hidden" />
      </div>
      <div className={tile}>
        <p className={label}>Total staked</p>
        <SkeletonText className="w-20 font-semibold md:text-xl" />
        <p className={sub}>by all stakers</p>
      </div>
      <div className={tile}>
        <p className={label}>Earned, 24H</p>
        <SkeletonText className="w-16 font-semibold md:text-xl" />
        <p className={sub}>paid to stakers from swaps</p>
      </div>
    </div>
  );
}

export function Tiles({ pool }: { pool: PoolAnswer }) {
  const t = tiles(pool);
  // no rate yet (contract 5.3: null until the snapshots span 7 days): the APY tile is left out, never "0%"
  const rows: [string, string, string | null][] = [
    ...(t.apy === 'Not yet' ? [] : [['APY, 7 days', t.apy, t.apySub] as [string, string, string | null]]),
    ['Total staked', t.staked, 'by all stakers'],
    ['Earned, 24H', t.earned24h, 'paid to stakers from swaps'],
  ];
  return (
    <div className="grid w-full grid-cols-2 gap-3 [&>*:last-child:nth-child(odd)]:col-span-2 md:flex">
      {rows.map(([l, v, s]) => (
        <div key={l} className={tile}>
          <p className={label}>{l}</p>
          <p className="font-semibold md:text-xl">{v}</p>
          {s !== null && <p className={sub}>{s}</p>}
        </div>
      ))}
    </div>
  );
}
