import type { ReactNode } from 'react';

/**
 * Subtle hero background for viz-heavy panels — uses `--viz-surface-glow` from globals.css.
 */
export function VizSurface({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-app-border ${className}`}
      style={{
        background:
          'linear-gradient(135deg, rgb(var(--app-surface)) 0%, rgb(var(--viz-surface-glow) / 0.35) 55%, rgb(var(--app-surface)) 100%)',
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07] dark:opacity-[0.12]"
        style={{
          backgroundImage: `radial-gradient(circle at 20% 20%, rgb(var(--viz-series-1) / 0.5) 0, transparent 45%),
            radial-gradient(circle at 80% 60%, rgb(var(--viz-series-3) / 0.35) 0, transparent 40%)`,
        }}
        aria-hidden
      />
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
