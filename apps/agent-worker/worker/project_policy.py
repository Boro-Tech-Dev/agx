"""Project capture policy for the worker. Keep LOG_ONLY_SLUGS in sync with agent-api project_type_catalog.LOG_ONLY_SLUGS."""

from __future__ import annotations

from worker.db import fetch_one

# Must match apps/agent-api/app/project_type_catalog.py
CATALOG_SLUGS: frozenset[str] = frozenset(
    {
        'software_delivery',
        'product_discovery',
        'marketing_campaign',
        'operations_runbook',
        'research_synthesis',
        'personal_journal',
        'health_activity_log',
        'media_log',
        'quotes_snippets',
        'metrics_checkins',
        'general_inbox',
        'other',
    }
)

LOG_ONLY_SLUGS: frozenset[str] = frozenset(
    {
        'personal_journal',
        'health_activity_log',
        'media_log',
        'quotes_snippets',
        'metrics_checkins',
        'general_inbox',
    },
)


def persist_items_allowed(project_key: str | None) -> bool:
    """False → skip persist_items (log_only without exception, or unknown slug)."""
    if not project_key:
        return True
    row = fetch_one('SELECT project_type, metadata FROM projects WHERE key=%s', (project_key,))
    if not row:
        return True
    pt = str(row.get('project_type') or '').strip().lower()
    meta = row.get('metadata') or {}
    if not isinstance(meta, dict):
        meta = {}
    if meta.get('allow_structured_breakdown') is True:
        return True
    if pt not in CATALOG_SLUGS:
        return False
    if pt in LOG_ONLY_SLUGS:
        return False
    return True
