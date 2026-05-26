from __future__ import annotations

import hashlib
import logging
import mimetypes
import os
import re
import uuid
from pathlib import Path
from typing import Any

from fastapi import HTTPException, UploadFile

from ..db import conn, execute, fetch, fetch_one, j
from ..document_kinds import normalize_document_kind
from .common import UPLOAD_ROOT, enqueue_document_ingest, upload_path_from_row
from .memory_service import workspace_key_for_project

log = logging.getLogger(__name__)

MAX_UPLOAD_BYTES = int(os.getenv('MAX_UPLOAD_BYTES', str(50 * 1024 * 1024)))

ALLOWED_SUFFIXES = frozenset(
    {
        '.pdf',
        '.doc',
        '.docx',
        '.xls',
        '.xlsx',
        '.ppt',
        '.pptx',
        '.csv',
        '.txt',
        '.md',
        '.rtf',
        '.odt',
        '.ods',
        '.odp',
        '.odg',
        '.odf',
        '.png',
        '.jpg',
        '.jpeg',
        '.webp',
        '.json',
        '.zip',
    }
)


def _safe_filename(name: str) -> str:
    base = Path(name or 'upload').name
    base = re.sub(r'[^a-zA-Z0-9._-]+', '_', base).strip('._') or 'upload'
    return base[:200]


def _project_exists(project_key: str) -> bool:
    return bool(fetch_one('SELECT key FROM projects WHERE key=%s', (project_key,)))


def list_project_documents(
    project_key: str,
    *,
    include_archived: bool = False,
    kinds: list[str] | None = None,
):
    if not _project_exists(project_key):
        raise HTTPException(404, 'project not found')
    sql = """SELECT id, title, original_filename, mime_type, document_kind, processing_status, error_message,
                    archived_at, created_at, ingested_at, checksum, storage_bucket, storage_key, workspace_key, project_key
             FROM source_documents WHERE project_key=%s"""
    params: list[Any] = [project_key]
    if not include_archived:
        sql += ' AND archived_at IS NULL'
    if kinds:
        normalized = []
        for k in kinds:
            try:
                normalized.append(normalize_document_kind(k))
            except ValueError:
                raise HTTPException(400, f'invalid kind filter: {k!r}')
        sql += ' AND document_kind = ANY(%s::text[])'
        params.append(normalized)
    sql += ' ORDER BY created_at DESC LIMIT 500'
    return fetch(sql, tuple(params))


def create_project_upload(
    project_key: str,
    file: UploadFile,
    document_kind: str | None,
) -> dict[str, Any]:
    if not _project_exists(project_key):
        raise HTTPException(404, 'project not found')
    wk = workspace_key_for_project(project_key)
    if not wk:
        raise HTTPException(404, 'project not found')
    kind = normalize_document_kind(document_kind)
    raw_name = file.filename or 'upload'
    suffix = Path(raw_name).suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        raise HTTPException(400, f'file type not allowed: {suffix or "(none)"}')
    body = file.file.read()
    if len(body) > MAX_UPLOAD_BYTES:
        raise HTTPException(400, f'file too large (max {MAX_UPLOAD_BYTES} bytes)')
    if not body:
        raise HTTPException(400, 'empty file')
    doc_id = uuid.uuid4()
    safe = _safe_filename(raw_name)
    rel_key = f'{doc_id}/{safe}'
    abs_path = (UPLOAD_ROOT / rel_key).resolve()
    try:
        abs_path.relative_to(UPLOAD_ROOT)
    except ValueError:
        raise HTTPException(400, 'invalid path')
    abs_path.parent.mkdir(parents=True, exist_ok=True)
    abs_path.write_bytes(body)
    checksum = hashlib.sha256(body).hexdigest()
    mt = file.content_type or mimetypes.guess_type(raw_name)[0] or 'application/octet-stream'
    title = Path(raw_name).stem or 'upload'
    doc_meta: dict[str, Any] = {}
    if kind == 'scenario':
        doc_meta = {'scenario_csv': True}
    elif kind == 'omnichannel_plan':
        doc_meta = {'omnichannel_plan': True}
    row = execute(
        """INSERT INTO source_documents(
               id, title, source_type, source_uri, storage_bucket, storage_key, mime_type, checksum,
               metadata, workspace_key, project_key, original_filename, processing_status, document_kind
           ) VALUES (
               %s, %s, 'project_upload', NULL, 'local-uploads', %s, %s, %s, %s::jsonb,
               %s, %s, %s, 'queued', %s
           ) RETURNING *""",
        (str(doc_id), title, rel_key, mt, checksum, j(doc_meta), wk, project_key, raw_name, kind),
    )
    enqueue_document_ingest(str(doc_id))
    return row


def download_row(project_key: str, document_id: str):
    row = fetch_one(
        """SELECT * FROM source_documents
           WHERE id=%s::uuid AND project_key=%s""",
        (document_id, project_key),
    )
    if not row:
        raise HTTPException(404, 'document not found')
    p = upload_path_from_row(row)
    if not p.is_file():
        raise HTTPException(404, 'file missing on disk')
    return row, p


def patch_document(project_key: str, document_id: str, payload: dict[str, Any]):
    row = fetch_one(
        'SELECT * FROM source_documents WHERE id=%s::uuid AND project_key=%s',
        (document_id, project_key),
    )
    if not row:
        raise HTTPException(404, 'document not found')
    archived = payload.get('archived')
    new_kind = payload.get('document_kind')
    if archived is None and new_kind is None:
        return row
    if new_kind is not None:
        try:
            normalize_document_kind(new_kind)
        except ValueError as e:
            raise HTTPException(400, str(e)) from e
    with conn() as c, c.cursor() as cur:
        if archived is True:
            cur.execute(
                'UPDATE source_documents SET archived_at=now() WHERE id=%s::uuid AND project_key=%s',
                (document_id, project_key),
            )
            cur.execute(
                "UPDATE memories SET status='archived', updated_at=now() WHERE source_document_id=%s::uuid",
                (document_id,),
            )
        elif archived is False:
            cur.execute(
                'UPDATE source_documents SET archived_at=NULL WHERE id=%s::uuid AND project_key=%s',
                (document_id, project_key),
            )
            cur.execute(
                """UPDATE memories SET status='active', updated_at=now()
                   WHERE source_document_id=%s::uuid AND status='archived'""",
                (document_id,),
            )
        if new_kind is not None:
            nk = normalize_document_kind(new_kind)
            cur.execute(
                """UPDATE source_documents SET document_kind=%s,
                       metadata = metadata || %s::jsonb
                   WHERE id=%s::uuid AND project_key=%s""",
                (nk, j({'scenario_csv': nk == 'scenario'}), document_id, project_key),
            )
            if nk == 'scenario':
                cur.execute(
                    """DELETE FROM project_items
                       WHERE project_key=%s AND item_type='timeline_event'
                         AND metadata->>'source_document_id'=%s""",
                    (project_key, str(document_id)),
                )
            cur.execute(
                'UPDATE memories SET metadata = metadata || %s::jsonb, updated_at=now() WHERE source_document_id=%s::uuid',
                (j({'document_kind': nk}), document_id),
            )
        cur.execute(
            'SELECT * FROM source_documents WHERE id=%s::uuid AND project_key=%s',
            (document_id, project_key),
        )
        out = cur.fetchone()
        c.commit()
    if new_kind is not None:
        try:
            nk = normalize_document_kind(new_kind)
            if nk == 'timeline' and str(out.get('processing_status') or '') == 'ready':
                enqueue_document_ingest(str(document_id), 'timeline_extract')
        except ValueError:
            pass
    return out


def delete_document(project_key: str, document_id: str):
    row = fetch_one(
        'SELECT * FROM source_documents WHERE id=%s::uuid AND project_key=%s',
        (document_id, project_key),
    )
    if not row:
        raise HTTPException(404, 'document not found')
    try:
        p = upload_path_from_row(row)
        if p.is_file():
            p.unlink()
        parent = p.parent
        if parent != UPLOAD_ROOT.resolve() and parent.is_dir() and not any(parent.iterdir()):
            parent.rmdir()
    except HTTPException as e:
        log.warning(
            'delete_document unlink skipped (path policy) document_id=%s storage_key=%r: %s',
            document_id,
            row.get('storage_key'),
            e.detail,
        )
    except OSError as e:
        log.warning(
            'delete_document unlink failed document_id=%s storage_key=%r: %s',
            document_id,
            row.get('storage_key'),
            e,
        )
    # timeline_event rows reference this file via metadata (no FK); remove so the calendar updates.
    execute(
        """DELETE FROM project_items
           WHERE project_key=%s AND item_type='timeline_event'
             AND metadata->>'source_document_id'=%s""",
        (project_key, str(document_id)),
    )
    execute('DELETE FROM source_documents WHERE id=%s::uuid', (document_id,))
    return {'deleted': True, 'id': document_id}
