import type { ReactNode } from 'react';

import { KpiCard } from '../ui/ragtag/KpiCard';
import { statusToVariant, type StatusVariant } from '../../lib/ragtag/statusVariants';

export type HomeKpiCardProps = {
  label: string;
  value: string;
  href?: string;
  error?: string | null;
  variant?: 'primary' | 'default';
  status?: 'active' | 'warning' | null;
  statusLabel?: string;
  statusVariant?: StatusVariant;
  sparkline?: ReactNode;
};

export function HomeKpiCard({
  label,
  value,
  href,
  error,
  status,
  statusLabel,
  statusVariant,
  sparkline,
}: HomeKpiCardProps) {
  const pillText =
    statusLabel ??
    (status === 'active' ? 'PROCESSING' : status === 'warning' ? 'QUEUED' : undefined);
  const pillVariant =
    statusVariant ?? (status === 'active' ? 'active' : status === 'warning' ? 'warning' : undefined);

  return (
    <KpiCard
      label={label}
      value={value}
      href={href}
      error={error}
      status={pillText}
      statusVariant={pillVariant}
      sparkline={sparkline}
    />
  );
}
