'use client';

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { useVizChartColors } from './chartTheme';

type Row = { x: string; y: number };

/**
 * Compact line chart; supply time-series rows via `data`.
 */
export function MiniStatSparkline({
  data,
  caption,
  height = 72,
}: {
  data: Row[];
  caption?: string;
  height?: number;
}) {
  const c = useVizChartColors();

  return (
    <div className="min-w-0">
      {caption ? <p className="mb-1 text-[10px] text-app-muted">{caption}</p> : null}
      <div style={{ height }} className="w-full min-w-[8rem]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
            <XAxis dataKey="x" tick={{ fontSize: 9, fill: c.axis }} tickLine={false} axisLine={{ stroke: c.grid }} />
            <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
            <Tooltip
              contentStyle={{
                fontSize: 11,
                borderRadius: 8,
                borderColor: 'rgb(var(--app-border))',
                backgroundColor: 'rgb(var(--app-surface))',
              }}
            />
            <Line type="monotone" dataKey="y" stroke={c.series1} strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
