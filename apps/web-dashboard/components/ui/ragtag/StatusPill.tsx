import { statusLabel, statusToVariant, type StatusVariant } from '../../../lib/ragtag/statusVariants';
import { cn } from '../../../lib/cn';

export function StatusPill({
  status,
  variant,
  className,
}: {
  status: string;
  variant?: StatusVariant;
  className?: string;
}) {
  const v = variant ?? statusToVariant(status);
  const base =
    'inline-flex items-center px-2 py-0.5 text-[9px] uppercase tracking-widest font-bold border rounded-sm';

  const variants: Record<StatusVariant, string> = {
    active: 'bg-rt-cyan/10 text-rt-cyan border-rt-cyan/30',
    warning: 'bg-rt-yellow/10 text-rt-yellow border-rt-yellow/30',
    success: 'bg-rt-green/10 text-rt-green border-rt-green/30',
    info: 'bg-rt-purple/10 text-rt-purple border-rt-purple/30',
    error: 'bg-rt-orange/10 text-rt-orange border-rt-orange/30',
    neutral: 'bg-rt-panel text-rt-ice border-rt-panel',
  };

  return (
    <span className={cn(base, variants[v], className)}>{statusLabel(status)}</span>
  );
}
