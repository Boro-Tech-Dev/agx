'use client';

import { Line, LineChart, ResponsiveContainer } from 'recharts';

import { useVizChartColors } from './chartTheme';

export type KpiSparklineRow = { x: string; y: number };

/**
 * Bare Recharts sparkline (axes hidden). Loaded via `next/dynamic` from KpiSparkline.
 */
export function KpiSparklineChart({
  data,
  data2,
  height = 38,
}: {
  data: KpiSparklineRow[];
  data2?: KpiSparklineRow[];
  height?: number;
}) {
  const c = useVizChartColors();
  const merged =
    data2 && data2.length === data.length
      ? data.map((row, i) => ({ ...row, y2: data2[i]?.y ?? 0 }))
      : data;

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={merged} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <Line
            type="monotone"
            dataKey="y"
            stroke={c.series1}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
          {data2 ? (
            <Line
              type="monotone"
              dataKey="y2"
              stroke={c.series2}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          ) : null}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

