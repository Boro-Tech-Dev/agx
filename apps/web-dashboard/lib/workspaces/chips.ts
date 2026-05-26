import { statusToVariant, type StatusVariant } from '../ragtag/statusVariants';

const variantChip: Record<StatusVariant, string> = {
  active: 'bg-rt-cyan/15 text-rt-cyan',
  warning: 'bg-rt-yellow/15 text-rt-yellow',
  success: 'bg-rt-green/15 text-rt-green',
  info: 'bg-rt-purple/15 text-rt-purple',
  error: 'bg-rt-orange/15 text-rt-orange',
  neutral: 'bg-rt-panel text-rt-ice/70',
};

/** Tailwind classes matching {@link StatusPill} variants for inline spans. */
export function statusChip(status?: string): string {
  return variantChip[statusToVariant(status ?? '')];
}

/** Left border for run Output / detail rails — tied to run status. */
export function outputRailBorderLeftClass(status?: string | null): string {
  const v = statusToVariant(status ?? '');
  if (v === 'success') return 'border-l-rt-green';
  if (v === 'warning') return 'border-l-rt-yellow';
  if (v === 'error') return 'border-l-rt-orange';
  if (v === 'active') return 'border-l-rt-cyan';
  if (v === 'info') return 'border-l-rt-purple';
  return 'border-l-rt-panel';
}

export function priorityChip(p?: string) {
  const s = (p || '').toLowerCase();
  if (s === 'high' || s === 'critical') return variantChip.error;
  if (s === 'medium') return variantChip.warning;
  if (s === 'low') return variantChip.success;
  return variantChip.neutral;
}

export function processingDocChip(st?: string) {
  return statusChip(st);
}

export function approvalStatusChip(status?: string) {
  return statusChip(status);
}

export function itemTypePill(itemType?: string) {
  const s = (itemType || '').toLowerCase();
  if (s === 'task') return 'bg-rt-cyan/15 text-rt-cyan';
  if (s === 'anomaly') return 'bg-rt-green/15 text-rt-green';
  if (s === 'risk') return 'bg-rt-orange/15 text-rt-orange';
  if (s === 'cost') return 'bg-rt-orange/15 text-rt-orange';
  if (s === 'decision') return 'bg-rt-purple/15 text-rt-purple';
  if (s === 'open_question') return 'bg-rt-yellow/15 text-rt-yellow';
  if (s === 'idea') return 'bg-rt-cyan/15 text-rt-cyan';
  if (s === 'dependency' || s === 'milestone') return variantChip.neutral;
  if (s === 'timeline_event') return 'bg-rt-green/15 text-rt-green';
  return variantChip.neutral;
}
