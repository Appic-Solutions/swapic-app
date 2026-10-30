// Moved from the design's pool-screens.tsx Tiles: the live StatusBox markup (it prefixes "$", so it is not reused).
import * as React from 'react';
import type { PoolAnswer } from '@/lib/api';
import { tw } from '@/lib/motion';
import { tiles } from '../data';

export function Tiles({ pool }: { pool: PoolAnswer }) {
  const t = tiles(pool);
  // no rate yet (contract 5.3: null until the snapshots span 7 days): the APY tile is left out, never "0%"
  const rows: [string, string, string | null][] = [
    ...(t.apy === 'Not yet' ? [] : [['APY, 7 days', t.apy, t.apySub] as [string, string, string | null]]),
    ['Total staked', t.staked, 'by all stakers'],
    ['Earned, 24H', t.earned24h, 'paid to stakers from swaps'],
  ];
  return (
    <div className="flex w-full gap-3 overflow-x-auto hide-scrollbar">
      {rows.map(([l, v, s]) => (
        // hover lift, no press: a tile is not clickable (motion part 2)
        <div key={l} className={'flex min-h-24 min-w-[150px] flex-1 flex-col justify-between gap-y-1.5 rounded-2xl bg-white/15 p-5 text-white hover:bg-white/20 ' + tw.quick + ' ' + tw.lift}>
          <p className="text-[13px] font-semibold leading-5 text-[#898989]">{l}</p>
          <p className="font-bold md:text-xl">{v}</p>
          {s !== null && <p className="text-xs text-[#898989]">{s}</p>}
        </div>
      ))}
    </div>
  );
}
