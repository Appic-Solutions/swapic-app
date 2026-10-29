// Value chart: the live PriceChart (src/app/(panel)/explore/_components/
// price-chart.tsx) with its Y axis fitted to the data, used for a user's stake
// in USDC over time. A stake grows by cents a day, so the live 0-based axis
// would draw a flat line.
// Moved from the design's SharePriceChart.tsx (sha 8090716f1177): the chart draws numbers only;
// every label it shows comes from `format`, which callers build from bigint values with @/lib/money.
import * as React from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface SharePricePoint {
  date: string;
  /** The value drawn at this point (chart coordinates only). */
  value: number;
}
export interface SharePriceChartProps {
  data: SharePricePoint[];
  onHover?: (value: number) => void;
  /** Chart height in px (the live chart uses 360), or '100%' to fill its parent. */
  height?: number | `${number}%`;
  /** Formats the Y axis values. */
  format: (v: number) => string;
  /** Space above and below the line, in data units (default 0.0005). */
  pad?: number;
}

export default function SharePriceChart({ data, onHover, height = 360, format, pad = 0.0005 }: SharePriceChartProps) {
  return (
    <ResponsiveContainer
      height={height}
      width="100%"
      className="relative isolate before:absolute before:bottom-[36px] before:left-1.5 before:h-1/2 before:w-[calc(100%-72px)] before:bg-gradient-to-t before:from-[#11326f41] before:to-[#205fd500]"
    >
      <LineChart data={data} onMouseLeave={() => onHover?.(data.at(-1)?.value ?? 0)}>
        <CartesianGrid className="stroke-white/10" />
        <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={12} />
        <YAxis
          tickCount={6}
          orientation="right"
          strokeWidth={0}
          fontSize={12}
          domain={[(min: number) => min - pad, (max: number) => max + pad]}
          tickFormatter={format}
          width={76}
        />
        <Tooltip
          content={({ active, payload }) => {
            // the hovered point's own number (the caller's data), never a conversion
            const point = payload?.[0]?.payload as SharePricePoint | undefined;
            if (active && point) onHover?.(point.value);
            return null;
          }}
          cursor={{ stroke: '#2160D5', strokeWidth: 1 }}
        />
        <Line type="monotone" dataKey="value" stroke="#2160D5" strokeWidth={3} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
