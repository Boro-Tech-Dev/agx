import Link from 'next/link';
import type { ReactNode } from 'react';

import { cn } from '../../../lib/cn';
import { StatusPill } from './StatusPill';
import type { StatusVariant } from '../../../lib/ragtag/statusVariants';

export type KpiCardProps = {
  label: string;
  value: string;
  href?: string;
  error?: string | null;
  status?: string;
  statusVariant?: StatusVariant;
  trend?: 'up' | 'down' | 'flat';
  sparkline?: ReactNode;
};

export function KpiCard({
  label,
  value,
  href,
  error,
  status,
  statusVariant = 'info',
  trend,
  sparkline,
}: KpiCardProps) {
  const inner = (
    <div className="flex flex-col border border-rt-panel bg-rt-charcoal p-3 transition-colors hover:border-rt-cyan/30">
      <div className="mb-2 flex items-start justify-between">
        <span className="font-mono text-[10px] uppercase leading-none tracking-widest text-rt-ice/60">
          {label}
        </span>
        {status ? <StatusPill status={status} variant={statusVariant} /> : null}
      </div>
      <div className="mt-auto flex items-end justify-between">
        <span className="font-mono text-xl font-bold leading-none text-rt-white">{value}</span>
        {trend ? (
          <div className="flex h-3 items-end space-x-0.5 opacity-50">
            <div
              className={cn('w-1 bg-rt-cyan', trend === 'up' ? 'h-1' : trend === 'down' ? 'h-3' : 'h-2')}
            />
            <div className="h-2 w-1 bg-rt-cyan" />
            <div
              className={cn('w-1 bg-rt-cyan', trend === 'up' ? 'h-3' : trend === 'down' ? 'h-1' : 'h-2')}
            />
          </div>
        ) : null}
        {sparkline}
      </div>
      {error ? <span className="mt-1 truncate text-[9px] text-rt-orange">{error}</span> : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block min-w-0 flex-1">
        {inner}
      </Link>
    );
  }

  return <div className="min-w-0 flex-1">{inner}</div>;
}
