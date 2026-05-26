"""Redis-driven project document ingestion (LibreOffice + chunk + embed)."""

from __future__ import annotations

import json
import logging
import os
import threading
import time
from pathlib import Path

import httpx
import redis

from .db_util import connection
from .extract_text import chunk_plain_text, extract_plain_text
from .project_capture_policy import persist_items_allowed
from .timeline_pipeline import run_timeline_pipeline, run_timeline_pipeline_for_document_id
from .timeline_raw_parse import parse_raw_timeline

log = logging.getLogger(__name__)

DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://dd_agent:dd_agent_dev@postgres:5432/dd_agents')
REDIS_URL = os.getenv('REDIS_URL', 'redis://redis:6379/0')
DOCUMENT_INGEST_QUEUE = os.getenv('DOCUMENT_INGEST_QUEUE', 'document.ingest')
DOCUMENT_INGEST_PROCESSING_QUEUE = os.getenv(
    'DOCUMENT_INGEST_PROCESSING_QUEUE', 'document.ingest.processing'
)
UPLOAD_ROOT = Path(os.getenv('UPLOAD_ROOT', '/uploads')).resolve()
MODEL_ROUTER_URL = os.getenv('MODEL_ROUTER_URL', 'http://model-router:8085')
EMBEDDING_DIM = int(os.getenv('EMBEDDING_DIM', '768'))

_IMAGE_SUFFIXES = frozenset({'.png', '.jpg', '.jpeg', '.webp'})


def vstr(v: list[float]) -> str:
    return '[' + ','.join(str(float(x)) for x in v) + ']'


def _upload_path(storage_bucket: str, storage_key: str) -> Path:
    if storage_bucket != 'local-uploads':
        raise ValueError('invalid bucket')
    key = (storage_key or '').strip()
    if not key or '..' in key or key.startswith('/'):
        raise ValueError('invalid key')
    p = (UPLOAD_ROOT / key).resolve()
    try:
        p.relative_to(UPLOAD_ROOT)
    except ValueError:
        raise ValueError('path outside upload root') from None
    return p


def embedding_for_sync(text: str) -> list[float] | None:
    try:
        with httpx.Client(timeout=120) as client:
            data = client.post(f'{MODEL_ROUTER_URL}/v1/embed', json={'input': text[:6000]}).json()
        emb = (data.get('embeddings') or [[]])[0]
        return emb if isinstance(emb, list) and emb else None
    except Exception:
        return None


def _fail_standalone(doc_id: str, msg: str) -> None:
    with connection() as conn, conn.cursor() as cur:
        cur.execute(
            "UPDATE source_documents SET processing_status='failed', error_message=%s WHERE id=%s::uuid",
            (msg[:4000], doc_id),
        )
        conn.commit()


def _metadata_blocks_timeline_heuristic(row: dict) -> bool:
    """True when this upload must not run auto-timeline CSV detection (delivery scenario / explicit flag)."""
    m = row.get('metadata')
    if isinstance(m, dict) and m.get('scenario_csv') is True:
        return True
    return False


def _finalize_timeline_status(
    document_id: str,
    title: str,
    timeline_meta: dict,
) -> None:
    """Set processing_status=ready, ingested_at, and merge timeline_pipeline into metadata."""
    payload = {'timeline_pipeline': timeline_meta}
    with connection() as conn, conn.cursor() as cur:
        cur.execute(
            """UPDATE source_documents SET processing_status='ready', ingested_at=now(), error_message=NULL, title=%s,
                   metadata = COALESCE(metadata,'{}'::jsonb) || %s::jsonb
               WHERE id=%s::uuid""",
            (title, json.dumps(payload), document_id),
        )
        conn.commit()


def _patch_document_timeline_meta(document_id: str, timeline_meta: dict) -> None:
    with connection() as conn, conn.cursor() as cur:
        cur.execute(
            """UPDATE source_documents SET metadata = COALESCE(metadata,'{}'::jsonb) || %s::jsonb WHERE id=%s::uuid""",
            (json.dumps({'timeline_pipeline': timeline_meta}), document_id),
        )
        conn.commit()


def process_document(document_id: str) -> None:
    with connection() as conn, conn.cursor() as cur:
        cur.execute(
            """UPDATE source_documents SET processing_status='processing', error_message=NULL
               WHERE id=%s::uuid AND processing_status='queued' RETURNING *""",
            (document_id,),
        )
        row = cur.fetchone()
        conn.commit()
    if not row:
        log.debug('skip or lost claim %s', document_id)
        return

    try:
        path = _upload_path(row['storage_bucket'], row['storage_key'])
    except Exception as e:
        _fail_standalone(document_id, f'path: {e}')
        return
    if not path.is_file():
        _fail_standalone(document_id, 'original file missing')
        return

    ext = path.suffix.lower()
    kind = row.get('document_kind') or 'general'
    kind_lc = str(kind or '').strip().lower()

    if ext in _IMAGE_SUFFIXES:
        title = row.get('original_filename') or row.get('title') or 'upload'
        text = (
            f'[Image upload: {title}]\n'
            'Binary imaging file stored in this project. Pixel-level analysis and vision models are not wired in this pass; '
            'paste accompanying report text or describe the study in a H.E.L.P.eR run. '
            f'Document id for reference: {document_id}.'
        )
    elif ext == '.zip':
        title = row.get('original_filename') or row.get('title') or 'upload'
        if kind_lc == 'veeva_suite':
            text = (
                f'[Veeva RTE email preview ZIP: {title}]\n'
                'Package stored in project documents; download the ZIP for assembled HTML and assets. '
                'This record is for filing and download only. '
                f'Document id: {document_id}.'
            )
        else:
            text = (
                f'[ZIP archive: {title}]\n'
                'Binary archive stored in this project; contents are not expanded for full-text search here. '
                f'Document id: {document_id}.'
            )
    else:
        try:
            text = extract_plain_text(path)
        except Exception as e:
            _fail_standalone(document_id, f'extract: {e}')
            return

    chunks = chunk_plain_text(text)
    wk = row['workspace_key']
    pk = row['project_key']
    title = row.get('original_filename') or row.get('title') or 'upload'
    orig_name = row.get('original_filename') or title

    embedded = 0
    try:
        with connection() as conn, conn.cursor() as cur:
            with conn.transaction():
                cur.execute('DELETE FROM memories WHERE source_document_id=%s::uuid', (document_id,))
                cur.execute('DELETE FROM document_chunks WHERE document_id=%s::uuid', (document_id,))
                for idx, chunk in enumerate(chunks):
                    emb = embedding_for_sync(chunk)
                    if emb and len(emb) == EMBEDDING_DIM:
                        cur.execute(
                            """INSERT INTO document_chunks(document_id,chunk_index,content,token_estimate,metadata,embedding)
                               VALUES(%s::uuid,%s,%s,%s,'{}'::jsonb,%s::vector)""",
                            (document_id, idx, chunk, max(1, len(chunk) // 4), vstr(emb)),
                        )
                        embedded += 1
                    else:
                        skip = json.dumps(
                            {
                                'embedding_skipped': True,
                                'embedding_length': len(emb or []),
                                'expected_dim': EMBEDDING_DIM,
                            }
                        )
                        cur.execute(
                            """INSERT INTO document_chunks(document_id,chunk_index,content,token_estimate,metadata)
                               VALUES(%s::uuid,%s,%s,%s,%s::jsonb)""",
                            (document_id, idx, chunk, max(1, len(chunk) // 4), skip),
                        )
                meta_final = json.dumps(
                    {
                        'document_kind': kind,
                        'original_filename': row.get('original_filename'),
                        'ingested_chunks': len(chunks),
                        'embedded_chunks': embedded,
                        'source': 'project_upload',
                    }
                )
                cur.execute(
                    """INSERT INTO memories(memory_type,title,body,confidence,workspace_key,project_key,source_document_id,metadata)
                       VALUES('note',%s,%s,'medium',%s,%s,%s::uuid,%s::jsonb)""",
                    (title, text[:6000], wk, pk, document_id, meta_final),
                )
                if kind_lc != 'timeline':
                    cur.execute(
                        """UPDATE source_documents SET processing_status='ready', ingested_at=now(), error_message=NULL, title=%s
                           WHERE id=%s::uuid""",
                        (title, document_id),
                    )
                else:
                    cur.execute(
                        """UPDATE source_documents SET metadata = COALESCE(metadata,'{}'::jsonb) || %s::jsonb, title=%s
                           WHERE id=%s::uuid""",
                        (
                            json.dumps({'timeline_pipeline': {'status': 'minting'}}),
                            title,
                            document_id,
                        ),
                    )
    except Exception as e:
        log.exception('ingest failed %s', document_id)
        _fail_standalone(document_id, str(e))
        return

    if kind_lc == 'timeline':
        log.info('timeline document ingest: running pipeline doc=%s project=%s', document_id, pk)
        try:
            if not persist_items_allowed(pk):
                log.info('timeline pipeline skipped (policy) doc=%s project=%s', document_id, pk)
                _finalize_timeline_status(
                    document_id,
                    title,
                    {'status': 'skipped_policy', 'events_inserted': 0},
                )
            else:
                n = run_timeline_pipeline(pk, document_id, text, orig_name)
                log.info('timeline pipeline finished doc=%s inserted=%s', document_id, n)
                _finalize_timeline_status(
                    document_id,
                    title,
                    {'status': 'ok', 'events_inserted': n},
                )
        except Exception as e:
            log.exception('timeline pipeline after ingest failed doc=%s', document_id)
            _finalize_timeline_status(
                document_id,
                title,
                {'status': 'error', 'message': str(e)[:500]},
            )
    elif (
        kind_lc == 'general'
        and not _metadata_blocks_timeline_heuristic(row)
        and ext in ('.csv', '.tsv', '.txt')
        and persist_items_allowed(pk)
    ):
        # Dashboard key-dates calendar reads `timeline_event` rows; those are only minted by the
        # timeline pipeline. Only `general` uploads are auto-promoted (never `scenario`). Metadata
        # `scenario_csv` blocks promotion when a file was stored as a delivery scenario.
        try:
            preview = parse_raw_timeline(text, orig_name)
            if preview:
                if not persist_items_allowed(pk):
                    log.info('timeline auto-run skipped (policy) doc=%s project=%s', document_id, pk)
                    _patch_document_timeline_meta(
                        document_id,
                        {'status': 'skipped_policy', 'events_inserted': 0},
                    )
                else:
                    n = run_timeline_pipeline(pk, document_id, text, orig_name)
                    log.info('timeline auto-run finished doc=%s inserted=%s', document_id, n)
                    _patch_document_timeline_meta(
                        document_id,
                        {'status': 'ok', 'events_inserted': n},
                    )
                    if n > 0:
                        with connection() as conn, conn.cursor() as cur:
                            cur.execute(
                                """UPDATE source_documents SET document_kind=%s WHERE id=%s::uuid""",
                                ('timeline', document_id),
                            )
                            conn.commit()
        except Exception as e:
            log.exception('timeline pipeline auto-run after general-text ingest failed doc=%s', document_id)
            try:
                _patch_document_timeline_meta(
                    document_id,
                    {'status': 'error', 'message': str(e)[:500]},
                )
            except Exception:
                log.exception('failed to patch timeline metadata doc=%s', document_id)


def consume_loop(stop: threading.Event) -> None:
    r = redis.Redis.from_url(REDIS_URL, decode_responses=True)
    reliable = os.getenv('INGEST_REDIS_RELIABLE', '').lower() in ('1', 'true', 'yes')
    if reliable:
        log.info(
            'document ingest consumer reliable mode: %s -> %s',
            DOCUMENT_INGEST_QUEUE,
            DOCUMENT_INGEST_PROCESSING_QUEUE,
        )
    else:
        log.info('document ingest consumer listening on %s (BRPOP)', DOCUMENT_INGEST_QUEUE)
    while not stop.is_set():
        try:
            if reliable:
                raw = r.brpoplpush(DOCUMENT_INGEST_QUEUE, DOCUMENT_INGEST_PROCESSING_QUEUE, 3)
            else:
                item = r.brpop(DOCUMENT_INGEST_QUEUE, timeout=3)
                raw = item[1] if item else None
        except redis.RedisError as e:
            log.warning('redis: %s', e)
            time.sleep(2)
            continue
        if not raw:
            continue
        ok_done = False
        try:
            payload = json.loads(raw)
            doc_id = str(payload.get('document_id') or '').strip()
            if not doc_id:
                ok_done = True
            else:
                mode = str(payload.get('mode') or '').strip().lower()
                if mode == 'timeline_extract':
                    try:
                        run_timeline_pipeline_for_document_id(doc_id, UPLOAD_ROOT)
                    except Exception:
                        log.exception('timeline_extract job failed doc=%s', doc_id)
                    else:
                        ok_done = True
                else:
                    process_document(doc_id)
                    ok_done = True
        except Exception:
            log.exception('job failed raw=%r', raw)
        finally:
            if reliable and ok_done:
                try:
                    r.lrem(DOCUMENT_INGEST_PROCESSING_QUEUE, 1, raw)
                except redis.RedisError as e:
                    log.warning('redis lrem processing queue: %s', e)


def start_consumer_thread() -> tuple[threading.Thread, threading.Event]:
    stop = threading.Event()
    t = threading.Thread(target=consume_loop, args=(stop,), name='document-ingest', daemon=True)
    t.start()
    return t, stop
