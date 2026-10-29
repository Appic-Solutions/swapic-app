// Moved from the design's scanner-screens.tsx Tiles: the KPI tiles in the live StatusBox look, from GET /v2/scanner/stats.
import * as React from 'react';
import Skeleton from '@/components/ui/skeleton';

export function Tiles({ tiles }: { tiles: [string, string, string][] | null }) {
  const shown = tiles ?? [['a', '', ''], ['b', '', ''], ['c', '', ''], ['d', '', '']];
  return (
    <div className="flex w-full gap-3 overflow-x-auto hide-scrollbar md:gap-5">
      {shown.map(([l, v, s]) =>
        !tiles ? (
          <Skeleton key={l} className="min-h-24 min-w-[158px] flex-1 rounded-2xl" />
        ) : (
          <div key={l} className="flex min-h-24 min-w-[158px] flex-1 flex-col justify-between gap-y-1.5 rounded-2xl bg-white/15 p-5 text-white transition-colors duration-200 hover:bg-white/20">
            <p className="text-[13px] font-semibold leading-5 text-[#898989]">{l}</p>
            <p className="font-bold md:text-xl">{v}</p>
            <p className="text-xs text-[#898989]">{s}</p>
          </div>
        ),
      )}
    </div>
  );
}
