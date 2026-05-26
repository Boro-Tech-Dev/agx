/**
 * Maps run_event.event_type to a left border accent class.
 * Avoids substring pitfalls (e.g. "start" matching inside "started").
 */

const BORDER = {
  default: 'border-l-stone-400 dark:border-l-stone-500',
  milestone: 'border-l-sky-500',
  llm: 'border-l-indigo-500',
  tool: 'border-l-fuchsia-500',
  error: 'border-l-rose-500',
  success: 'border-l-emerald-500',
  warn: 'border-l-amber-500',
} as const;

/** Exact event_type → border (checked first), keys lowercased. */
const EXACT_LOWER: Record<string, string> = {
  'run.queued': BORDER.milestone,
  'run.started': BORDER.milestone,
  'run.completed': BORDER.success,
  'run.degraded': BORDER.warn,
  'run.failed': BORDER.error,
  'run.cancelled': BORDER.default,
  'run.needs_approval': BORDER.warn,
  'run.enqueue_failed': BORDER.error,
  'worker.error': BORDER.error,
  'worker.retry': BORDER.warn,
};

/** Prefixes longest-first so `model.router` wins over `model.`. */
const PREFIX_RULES: { prefix: string; border: string }[] = [
  { prefix: 'model.router.', border: BORDER.llm },
  { prefix: 'model.', border: BORDER.llm },
  { prefix: 'memory.embed.', border: BORDER.llm },
  { prefix: 'memory.', border: BORDER.default },
  { prefix: 'workflow.', border: BORDER.default },
  { prefix: 'project.', border: BORDER.tool },
  { prefix: 'persist_items.', border: BORDER.tool },
  { prefix: 'approval.', border: BORDER.warn },
  { prefix: 'artifact.', border: BORDER.success },
];

export function eventStripeBorderClass(eventType: string): string {
  const t = (eventType || '').trim();
  if (!t) return BORDER.default;
  const lower = t.toLowerCase();
  if (EXACT_LOWER[lower]) return EXACT_LOWER[lower];

  for (const { prefix, border } of PREFIX_RULES) {
    if (lower.startsWith(prefix)) return border;
  }

  if (lower.endsWith('.failed') || lower.includes('enqueue_failed')) return BORDER.error;
  if (lower.includes('.error') || lower === 'worker.error') return BORDER.error;
  if (lower.includes('cancelled')) return BORDER.default;
  if (lower.includes('completed')) return BORDER.success;
  if (lower.includes('degraded')) return BORDER.warn;

  return BORDER.default;
}

/** Extra classes for the most recent event row when the run is still active. */
export function latestEventRowRingClass(
  eventId: string | number | undefined,
  latestEventId: string | number | null,
  runIsNonTerminal: boolean,
): string {
  if (!runIsNonTerminal || latestEventId == null || eventId == null) return '';
  if (String(eventId) !== String(latestEventId)) return '';
  return 'ring-1 ring-inset ring-sky-400/60 dark:ring-sky-400/40';
}

/** Pick latest event id from API order (created_at ascending → last wins). */
export function latestEventIdFromList(events: { id?: string | number }[]): string | number | null {
  if (!events.length) return null;
  const last = events[events.length - 1];
  return last?.id ?? null;
}
