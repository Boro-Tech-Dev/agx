/** Keep capture_mode in sync with apps/agent-api/app/project_type_catalog.py */

export type ProjectTypeRow = { value: string; label: string; capture_mode: 'action' | 'log_only' };

export const LOG_ONLY_SLUGS: ReadonlySet<string> = new Set([
  'personal_journal',
  'health_activity_log',
  'media_log',
  'quotes_snippets',
  'metrics_checkins',
  'general_inbox',
]);

export function isLogOnlyProjectType(slug: string | null | undefined): boolean {
  return Boolean(slug && LOG_ONLY_SLUGS.has(slug));
}

export const BLOCKED_BREAKDOWN_AGENT_KEYS = new Set(['pm', 'synergy', 'clinic', 'kitt', 'bubs']);

export function allowsStructuredBreakdown(project: { metadata?: unknown } | null | undefined): boolean {
  const m = project?.metadata;
  if (!m || typeof m !== 'object') return false;
  return (m as Record<string, unknown>).allow_structured_breakdown === true;
}
