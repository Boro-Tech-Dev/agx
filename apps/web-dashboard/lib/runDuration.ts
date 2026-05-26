function parseRunInstant(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'string') {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : null;
  }
  if (v instanceof Date) {
    const t = v.getTime();
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

/** Compact wall-clock span for run headers and lists. */
export function formatWallMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1000) return '<1s';
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  const mi = m % 60;
  return `${h}h ${mi}m ${s}s`;
}

/**
 * Human-readable run wall time from `started_at` / `completed_at`.
 * When the run has not finished (`completed_at` absent), uses `nowMs` for elapsed time.
 */
export function describeRunWallDuration(
  run: { started_at?: unknown; completed_at?: unknown } | null | undefined,
  nowMs: number,
): { label: string; text: string } | null {
  if (!run) return null;
  const start = parseRunInstant(run.started_at);
  if (start == null) return null;
  const end = parseRunInstant(run.completed_at);
  const span = end != null ? end - start : nowMs - start;
  if (!Number.isFinite(span) || span < 0) return null;
  return {
    label: end != null ? 'Total time' : 'Elapsed',
    text: formatWallMs(span),
  };
}

/**
 * Single string for tables: finished runs use started→completed (else created→completed); in-flight → em dash.
 */
export function formatRunTotalTimeForList(
  run: { started_at?: unknown; completed_at?: unknown; created_at?: unknown } | null | undefined,
): string {
  if (!run) return '—';
  const end = parseRunInstant(run.completed_at);
  if (end == null) return '—';
  const startExec = parseRunInstant(run.started_at);
  const startFallback = parseRunInstant(run.created_at);
  const start = startExec ?? startFallback;
  if (start == null) return '—';
  const span = end - start;
  if (!Number.isFinite(span) || span < 0) return '—';
  return formatWallMs(span);
}
