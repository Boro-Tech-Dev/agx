"""Reconcile Redis DOCUMENT_INGEST_PROCESSING_QUEUE with Postgres source_documents.

Used when ingestion-worker runs with INGEST_REDIS_RELIABLE=1 (BRPOPLPUSH buffer).
"""

from __future__ import annotations

import json
import logging
import os
import time
from datetime import datetime, timezone

from ..db import fetch_one
from .common import DOCUMENT_INGEST_PROCESSING_QUEUE, DOCUMENT_INGEST_QUEUE, rconn

log = logging.getLogger(__name__)

_TERMINAL = frozenset({'ready', 'failed'})

_ingest_reconcile_last: dict = {}


def get_ingest_reconcile_last_result() -> dict:
    return dict(_ingest_reconcile_last) if _ingest_reconcile_last else {}


def run_ingest_processing_reconcile_once() -> dict:
    batch = max(1, min(500, int(os.getenv('INGEST_PROCESSING_RECONCILE_BATCH', '80'))))
    r = rconn()
    summary = {
        'at': time.time(),
        'at_iso': datetime.now(timezone.utc).isoformat(),
        'examined': 0,
        'removed_terminal': 0,
        'requeued': 0,
        'skipped_processing': 0,
        'skipped_other': 0,
        'removed_missing_doc': 0,
        'removed_no_doc_id': 0,
        'bad_json': 0,
    }

    lock_key = (os.getenv('INGEST_PROCESSING_RECONCILE_LOCK_KEY') or 'agentx:ingest_processing_reconcile:leader').strip()
    lock_ttl = max(5, int(os.getenv('INGEST_PROCESSING_RECONCILE_LOCK_TTL_SEC', '90')))
    lock_disabled = os.getenv('INGEST_PROCESSING_RECONCILE_LOCK_DISABLED', '').lower() in ('1', 'true', 'yes')
    if lock_key and not lock_disabled:
        try:
            acquired = bool(r.set(lock_key, '1', nx=True, ex=lock_ttl))
        except Exception as e:
            log.warning('ingest processing reconcile: lock redis error (fail-open): %s', e)
            acquired = True
        if not acquired:
            summary['skipped_leader'] = True
            log.debug('ingest processing reconcile: skipped (another agent-api holds lock)')
            return summary

    try:
        raws = r.lrange(DOCUMENT_INGEST_PROCESSING_QUEUE, 0, batch - 1)
    except Exception as e:
        summary['error'] = str(e)
        _ingest_reconcile_last.clear()
        _ingest_reconcile_last.update(summary)
        return summary

    for raw in raws:
        summary['examined'] += 1
        if not isinstance(raw, str):
            summary['bad_json'] += 1
            continue
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            summary['bad_json'] += 1
            continue
        doc_id = str(payload.get('document_id') or '').strip()
        if not doc_id:
            try:
                r.lrem(DOCUMENT_INGEST_PROCESSING_QUEUE, 1, raw)
                summary['removed_no_doc_id'] += 1
            except Exception as e:
                log.warning('ingest reconcile lrem no document_id: %s', e)
            continue
        row = fetch_one(
            'select processing_status from source_documents where id=%s::uuid',
            (doc_id,),
        )
        if not row:
            try:
                r.lrem(DOCUMENT_INGEST_PROCESSING_QUEUE, 1, raw)
                summary['removed_missing_doc'] += 1
            except Exception as e:
                log.warning('ingest reconcile lrem missing doc %s: %s', doc_id, e)
            continue
        st = row.get('processing_status') or ''
        if st in _TERMINAL:
            try:
                r.lrem(DOCUMENT_INGEST_PROCESSING_QUEUE, 1, raw)
                summary['removed_terminal'] += 1
            except Exception as e:
                log.warning('ingest reconcile lrem terminal %s: %s', doc_id, e)
        elif st == 'queued':
            try:
                r.lrem(DOCUMENT_INGEST_PROCESSING_QUEUE, 1, raw)
                r.lpush(DOCUMENT_INGEST_QUEUE, raw)
                summary['requeued'] += 1
            except Exception as e:
                log.warning('ingest reconcile requeue %s: %s', doc_id, e)
        elif st == 'processing':
            summary['skipped_processing'] += 1
        else:
            summary['skipped_other'] += 1

    _ingest_reconcile_last.clear()
    _ingest_reconcile_last.update(summary)
    return summary
