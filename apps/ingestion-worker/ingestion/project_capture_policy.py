"""Mirror of apps/agent-worker/worker/project_policy.persist_items_allowed — keep in sync when CATALOG_SLUGS / LOG_ONLY_SLUGS change."""

from __future__ import annotations

from .db_util import connection

# Must match apps/agent-worker/worker/project_policy.py
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
    """False → skip minting timeline_event rows (log-only project or unknown slug without exception)."""
    if not project_key:
        return True
    with connection() as conn, conn.cursor() as cur:
        cur.execute(
            'SELECT project_type, metadata FROM projects WHERE key=%s',
            (project_key,),
        )
        row = cur.fetchone()
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
