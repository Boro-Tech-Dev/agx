"""Run full timeline extract → map → persist for one document."""

from __future__ import annotations

import logging
from pathlib import Path

from .db_util import connection
from .extract_text import extract_plain_text
from .project_capture_policy import persist_items_allowed
from .timeline_map import map_rows_with_llm
from .timeline_persist import delete_timeline_events_for_document, insert_timeline_events
from .timeline_raw_parse import parse_raw_timeline

log = logging.getLogger(__name__)

_IMAGE_SUFFIXES = frozenset({'.png', '.jpg', '.jpeg', '.webp'})


def _upload_path(storage_bucket: str, storage_key: str, upload_root: Path) -> Path:
    if storage_bucket != 'local-uploads':
        raise ValueError('invalid bucket')
    key = (storage_key or '').strip()
    if not key or '..' in key or key.startswith('/'):
        raise ValueError('invalid key')
    p = (upload_root / key).resolve()
    try:
        p.relative_to(upload_root)
    except ValueError:
        raise ValueError('path outside upload root') from None
    return p


def run_timeline_pipeline(
    project_key: str,
    source_document_id: str,
    text: str,
    original_filename: str | None,
) -> int:
    """
    Returns number of project_items inserted (0 if skipped or empty).
    """
    if not persist_items_allowed(project_key):
        log.info('timeline pipeline skipped (policy) project=%s doc=%s', project_key, source_document_id)
        return 0
    raw = parse_raw_timeline(text, original_filename)
    if not raw:
        log.info('timeline pipeline: no raw rows doc=%s', source_document_id)
        return 0
    mapped = map_rows_with_llm(raw)
    delete_timeline_events_for_document(project_key, source_document_id)
    n = insert_timeline_events(project_key, source_document_id, mapped)
    log.info('timeline pipeline inserted %s rows project=%s doc=%s', n, project_key, source_document_id)
    return n


def run_timeline_pipeline_for_document_id(document_id: str, upload_root: Path) -> int:
    """Load ready `timeline` source_document by id, extract text, run pipeline. Returns insert count."""
    with connection() as conn, conn.cursor() as cur:
        cur.execute(
            """SELECT * FROM source_documents
               WHERE id=%s::uuid AND processing_status='ready' AND document_kind='timeline'""",
            (document_id,),
        )
        row = cur.fetchone()
    if not row:
        log.debug('timeline_extract_only: no ready timeline doc %s', document_id)
        return 0
    pk = row.get('project_key')
    if not pk:
        return 0
    try:
        path = _upload_path(row['storage_bucket'], row['storage_key'], upload_root)
    except Exception as e:
        log.warning('timeline_extract_only path %s: %s', document_id, e)
        return 0
    if not path.is_file():
        log.warning('timeline_extract_only missing file %s', document_id)
        return 0
    ext = path.suffix.lower()
    if ext in _IMAGE_SUFFIXES:
        text = ''
    else:
        try:
            text = extract_plain_text(path)
        except Exception:
            log.exception('timeline_extract_only extract failed %s', document_id)
            return 0
    title = row.get('original_filename') or row.get('title') or 'upload'
    return run_timeline_pipeline(pk, document_id, text, title)
