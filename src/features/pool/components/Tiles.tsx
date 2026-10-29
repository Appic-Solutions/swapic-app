// Moved from the design's pool-screens.tsx Tiles: the live StatusBox markup (it prefixes "$", so it is not reused).
import * as React from 'react';
import type { PoolAnswer } from '@/lib/api';
import { tiles } from '../data';

export function Tiles({ pool }: { pool: PoolAnswer }) {
  const t = tiles(pool);
  const rows: [string, string, string | null][] = [
    ['APY, 7 days', t.apy, t.apySub],
    ['Total staked', t.staked, 'by all stakers'],
    ['Earned, 24H', t.earned24h, 'paid to stakers from swaps'],
  ];
  return (
    <div className="flex w-full gap-3 overflow-x-auto hide-scrollbar">
      {rows.map(([l, v, s]) => (
        <div key={l} className="flex min-h-24 min-w-[150px] flex-1 flex-col justify-between gap-y-1.5 rounded-2xl bg-white/15 p-5 text-white transition-colors duration-200 hover:bg-white/20">
          <p className="text-[13px] font-semibold leading-5 text-[#898989]">{l}</p>
          <p className="font-bold md:text-xl">{v}</p>
          {s !== null && <p className="text-xs text-[#898989]">{s}</p>}
        </div>
      ))}
    </div>
  );
}
