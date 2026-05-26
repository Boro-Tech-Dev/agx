'use client';

import dynamic from 'next/dynamic';

import type { KpiSparklineRow } from './KpiSparklineChart';

const KpiSparklineChart = dynamic(
  () => import('./KpiSparklineChart').then((m) => ({ default: m.KpiSparklineChart })),
  { ssr: false },
);

/**
 * Inline KPI sparkline (no axes/tooltip). Recharts loads on first mount.
 */
export function KpiSparkline({
  data,
  data2,
  height = 28,
  className = '',
}: {
  data: KpiSparklineRow[];
  data2?: KpiSparklineRow[];
  height?: number;
  className?: string;
}) {
  if (data.length < 2) return null;

  return (
    <div className={`shrink-0 ${className}`.trim()} style={{ width: '2.75rem' }} aria-hidden>
      <KpiSparklineChart data={data} data2={data2} height={height} />
    </div>
  );
}
