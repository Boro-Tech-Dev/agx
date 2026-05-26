"""Postgres-backed project + timeline snapshot for PM/Synergy/H.E.L.P.eR runs."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from worker.db import fetch, fetch_one
from worker.project_registry_format import (
    OTHER_OPEN_ROW_LIMIT,
    REGISTRY_AGENTS,
    TIMELINE_ROW_LIMIT,
    format_registry_markdown,
    normalize_focus_id_for_retrieval,
)

log = logging.getLogger(__name__)

__all__ = [
    'REGISTRY_AGENTS',
    'build_registry_attachment',
    'build_registry_attachment_async',
    'normalize_focus_id_for_retrieval',
]


def fetch_project_row(project_key: str) -> dict[str, Any] | None:
    return fetch_one(
        """SELECT key, name, description, project_type, pm_kind, metadata
           FROM projects WHERE key = %s""",
        (project_key,),
    )


def fetch_focus_project_item(project_key: str, item_id: str) -> dict[str, Any] | None:
    return fetch_one(
        """SELECT id::text, item_type, title, body, status, priority, due_date, owner, metadata
           FROM project_items
           WHERE id = %s::uuid AND project_key = %s AND item_type <> 'timeline_event'""",
        (item_id, project_key),
    )


def fetch_timeline_events(project_key: str, limit: int) -> list[dict[str, Any]]:
    return fetch(
        """SELECT id::text, item_type, title, body, status, priority, due_date, owner, metadata, created_at
           FROM project_items
           WHERE project_key = %s AND item_type = 'timeline_event'
           ORDER BY
             CASE
               WHEN (metadata->>'phase_order') ~ '^[0-9]+$'
               THEN (metadata->>'phase_order')::int
               ELSE 2147483647
             END,
             due_date NULLS LAST,
             created_at
           LIMIT %s::int""",
        (project_key, limit),
    )


def fetch_other_open_items(project_key: str, limit: int, exclude_id: str | None) -> list[dict[str, Any]]:
    if exclude_id:
        return fetch(
            """SELECT id::text, item_type, title, body, status, priority, due_date, owner, metadata, updated_at
               FROM project_items
               WHERE project_key = %s AND status = 'open' AND item_type <> 'timeline_event'
                 AND id <> %s::uuid
               ORDER BY updated_at DESC
               LIMIT %s::int""",
            (project_key, exclude_id, limit),
        )
    return fetch(
        """SELECT id::text, item_type, title, body, status, priority, due_date, owner, metadata, updated_at
           FROM project_items
           WHERE project_key = %s AND status = 'open' AND item_type <> 'timeline_event'
           ORDER BY updated_at DESC
           LIMIT %s::int""",
        (project_key, limit),
    )


def build_registry_attachment(
    project_key: str | None,
    agent_key: str,
    focus_item_id: Any,
    *,
    include_timeline: bool = True,
    include_open_items: bool = True,
) -> str:
    if not project_key or agent_key not in REGISTRY_AGENTS:
        return ''
    fid = normalize_focus_id_for_retrieval(focus_item_id)
    try:
        project = fetch_project_row(project_key)
        if not project:
            return ''
        focus_row = fetch_focus_project_item(project_key, fid) if fid else None
        timeline = (
            fetch_timeline_events(project_key, TIMELINE_ROW_LIMIT) if include_timeline else []
        )
        exclude = focus_row['id'] if focus_row else None
        other = (
            fetch_other_open_items(project_key, OTHER_OPEN_ROW_LIMIT, exclude)
            if include_open_items
            else []
        )
        return format_registry_markdown(project, timeline, other, focus_row)
    except Exception:
        log.exception('project registry snapshot failed project=%s agent=%s', project_key, agent_key)
        return ''


async def build_registry_attachment_async(
    project_key: str | None,
    agent_key: str,
    focus_item_id: Any,
    *,
    include_timeline: bool = True,
    include_open_items: bool = True,
) -> str:
    """Async variant: parallelizes independent DB reads, then same markdown as build_registry_attachment."""
    if not project_key or agent_key not in REGISTRY_AGENTS:
        return ''
    fid = normalize_focus_id_for_retrieval(focus_item_id)
    try:
        if include_timeline:
            project, timeline = await asyncio.gather(
                asyncio.to_thread(fetch_project_row, project_key),
                asyncio.to_thread(fetch_timeline_events, project_key, TIMELINE_ROW_LIMIT),
            )
        else:
            project = await asyncio.to_thread(fetch_project_row, project_key)
            timeline = []
        if not project:
            return ''
        focus_row = (
            await asyncio.to_thread(fetch_focus_project_item, project_key, fid) if fid else None
        )
        exclude = focus_row['id'] if focus_row else None
        other = (
            await asyncio.to_thread(
                fetch_other_open_items, project_key, OTHER_OPEN_ROW_LIMIT, exclude
            )
            if include_open_items
            else []
        )
        return format_registry_markdown(project, timeline, other, focus_row)
    except Exception:
        log.exception('project registry snapshot failed project=%s agent=%s', project_key, agent_key)
        return ''
