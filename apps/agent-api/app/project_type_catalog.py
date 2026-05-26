"""Canonical project types: labels, capture_mode, and validation.

Keep SQL CHECK constraints and worker/worker/project_policy.py LOG_ONLY_SLUGS in sync with CATALOG_SLUGS.
"""

from __future__ import annotations

from typing import Any, Literal

CaptureMode = Literal['action', 'log_only']

PROJECT_TYPES: list[dict[str, Any]] = [
    {'value': 'software_delivery', 'label': 'Software / delivery', 'capture_mode': 'action'},
    {'value': 'product_discovery', 'label': 'Product discovery', 'capture_mode': 'action'},
    {'value': 'marketing_campaign', 'label': 'Marketing / campaign', 'capture_mode': 'action'},
    {'value': 'operations_runbook', 'label': 'Operations / runbook', 'capture_mode': 'action'},
    {'value': 'research_synthesis', 'label': 'Research synthesis', 'capture_mode': 'action'},
    {'value': 'personal_journal', 'label': 'Personal journal', 'capture_mode': 'log_only'},
    {'value': 'health_activity_log', 'label': 'Health & activity log', 'capture_mode': 'log_only'},
    {'value': 'media_log', 'label': 'Media log (music, film, books)', 'capture_mode': 'log_only'},
    {'value': 'quotes_snippets', 'label': 'Quotes & snippets', 'capture_mode': 'log_only'},
    {'value': 'metrics_checkins', 'label': 'Metrics & check-ins', 'capture_mode': 'log_only'},
    {'value': 'general_inbox', 'label': 'General inbox / unstructured', 'capture_mode': 'log_only'},
    {'value': 'other', 'label': 'Other', 'capture_mode': 'action'},
]

CATALOG_SLUGS: frozenset[str] = frozenset(t['value'] for t in PROJECT_TYPES)
LOG_ONLY_SLUGS: frozenset[str] = frozenset(t['value'] for t in PROJECT_TYPES if t['capture_mode'] == 'log_only')

# Agents that mint structured project_items via breakdown workflows (pm/kitt business schema; synergy/bubs personal; clinic).
BLOCKED_BREAKDOWN_AGENTS: frozenset[str] = frozenset(
    {'pm', 'synergy', 'clinic', 'kitt', 'bubs'}
)


def normalize_project_type(raw: str | None) -> str:
    if raw is None or not str(raw).strip():
        raise ValueError('project_type is required')
    s = str(raw).strip().lower()
    if s not in CATALOG_SLUGS:
        raise ValueError(f'project_type must be one of: {", ".join(sorted(CATALOG_SLUGS))}')
    return s


def is_log_only(project_type: str) -> bool:
    return project_type in LOG_ONLY_SLUGS


def allows_structured_breakdown(row: dict[str, Any] | None) -> bool:
    if not row:
        return False
    meta = row.get('metadata')
    if not isinstance(meta, dict):
        return False
    return meta.get('allow_structured_breakdown') is True


def persist_timeline_events_allowed(row: dict[str, Any] | None) -> bool:
    """Same rules as apps/ingestion-worker/ingestion/project_capture_policy.persist_items_allowed (timeline rows)."""
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
