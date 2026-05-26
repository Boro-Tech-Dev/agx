"""Persist timeline_event rows; idempotent per (project_key, source_document_id)."""

from __future__ import annotations

import json
import uuid
from typing import Any

from .db_util import connection
from .timeline_phase_catalog import CATALOG_VERSION, SCHEDULE_CONSTRAINTS


def delete_timeline_events_for_document(project_key: str, source_document_id: str) -> None:
    with connection() as conn, conn.cursor() as cur:
        cur.execute(
            """DELETE FROM project_items
               WHERE project_key=%s AND item_type='timeline_event'
                 AND metadata->>'source_document_id'=%s""",
            (project_key, source_document_id),
        )
        conn.commit()


def insert_timeline_events(
    project_key: str,
    source_document_id: str,
    mapped_rows: list[dict],
) -> int:
    """Returns number of rows inserted."""
    if not mapped_rows:
        return 0
    notes = SCHEDULE_CONSTRAINTS[:2000]
    inserted = 0
    with connection() as conn, conn.cursor() as cur:
        for mr in mapped_rows:
            title = mr.get('canonical_label') or (f"Raw: {mr.get('raw_label', '')[:200]}")
            body_obj: dict[str, Any] = {
                'raw_label': mr.get('raw_label'),
                'phase_id': mr.get('phase_id'),
                'phase_order': mr.get('phase_order'),
                'mapping_confidence': mr.get('mapping_confidence'),
                'unmapped': mr.get('unmapped'),
                'catalog_version': CATALOG_VERSION,
                'schedule_notes': notes,
            }
            if mr.get('start_date_iso'):
                body_obj['start_date_iso'] = mr['start_date_iso']
            if mr.get('end_date_iso'):
                body_obj['end_date_iso'] = mr['end_date_iso']
            if mr.get('timeline_note'):
                body_obj['timeline_note'] = mr['timeline_note']
            due = mr.get('date_iso')
            meta = {
                'origin': 'timeline_upload',
                'source_document_id': source_document_id,
                'phase_id': mr.get('phase_id'),
                'phase_order': mr.get('phase_order'),
                'raw_label': mr.get('raw_label'),
                'mapping_confidence': mr.get('mapping_confidence'),
                'catalog_version': CATALOG_VERSION,
                'unmapped': mr.get('unmapped'),
                'row_index': mr.get('row_index'),
            }
            if mr.get('start_date_iso'):
                meta['start_date_iso'] = mr['start_date_iso']
            if mr.get('end_date_iso'):
                meta['end_date_iso'] = mr['end_date_iso']
            if mr.get('timeline_note'):
                meta['timeline_note'] = mr['timeline_note']
            cur.execute(
                """INSERT INTO project_items(
                       id, project_key, item_type, title, body, status, priority,
                       due_date, owner, source_run_id, metadata
                   ) VALUES (
                       %s::uuid, %s, 'timeline_event', %s, %s, 'open', 'medium',
                       %s, NULL, NULL, %s::jsonb
                   )""",
                (
                    str(uuid.uuid4()),
                    project_key,
                    title[:240],
                    json.dumps(body_obj, default=str),
                    due,
                    json.dumps(meta, default=str),
                ),
            )
            inserted += 1
        conn.commit()
    return inserted
