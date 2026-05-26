"""Reconcile Redis PROCESSING_QUEUE with Postgres agent_runs (orphan cleanup).

Mirrors stale-run SQL in apps/agent-worker/worker/main.py recover_stale_runs().
"""

from __future__ import annotations

import json
import logging
import os
import time
from datetime import datetime, timezone

from ..db import execute, fetch_one
from .common import PROCESSING_QUEUE, RUN_QUEUE, rconn

log = logging.getLogger(__name__)

# Same message as worker recover_stale_runs for consistency.
_STALE_SQL = """update agent_runs set status='failed', error_message='Recovered stale running run after worker restart', completed_at=now()
      where status='running' and started_at < now() - (%s || ' minutes')::interval"""

_TERMINAL = frozenset({'completed', 'degraded', 'failed', 'cancelled', 'needs_approval'})

_reconcile_last: dict = {}


def get_reconcile_last_result() -> dict:
    return dict(_reconcile_last) if _reconcile_last else {}


def run_reconcile_once() -> dict:
    stale_minutes = int(os.getenv('STALE_RUNNING_MINUTES', '90'))
    batch = max(1, min(500, int(os.getenv('PROCESSING_RECONCILE_BATCH', '80'))))
    r = rconn()
    summary = {
        'at': time.time(),
        'at_iso': datetime.now(timezone.utc).isoformat(),
        'examined': 0,
        'removed_terminal': 0,
        'requeued': 0,
        'skipped_running': 0,
        'skipped_other': 0,
        'removed_missing_run': 0,
        'removed_no_run_id': 0,
        'bad_json': 0,
    }

    lock_key = (os.getenv('PROCESSING_RECONCILE_LOCK_KEY') or 'agentx:processing_reconcile:leader').strip()
    lock_ttl = max(5, int(os.getenv('PROCESSING_RECONCILE_LOCK_TTL_SEC', '90')))
    lock_disabled = os.getenv('PROCESSING_RECONCILE_LOCK_DISABLED', '').lower() in ('1', 'true', 'yes')
    if lock_key and not lock_disabled:
        try:
            acquired = bool(r.set(lock_key, '1', nx=True, ex=lock_ttl))
        except Exception as e:
            log.warning('processing reconcile: lock redis error (fail-open): %s', e)
            acquired = True
        if not acquired:
            summary['skipped_leader'] = True
            log.debug('processing reconcile: skipped (another agent-api holds lock)')
            return summary

    try:
        execute(_STALE_SQL, (stale_minutes,))
    except Exception as e:
        log.warning('processing reconcile: stale SQL failed: %s', e)
    try:
        raws = r.lrange(PROCESSING_QUEUE, 0, batch - 1)
    except Exception as e:
        summary['error'] = str(e)
        _reconcile_last.clear()
        _reconcile_last.update(summary)
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
        rid = payload.get('run_id')
        if not rid:
            try:
                r.lrem(PROCESSING_QUEUE, 1, raw)
                summary['removed_no_run_id'] += 1
            except Exception as e:
                log.warning('lrem no run_id: %s', e)
            continue
        row = fetch_one('select status from agent_runs where id=%s', (str(rid),))
        if not row:
            try:
                r.lrem(PROCESSING_QUEUE, 1, raw)
                summary['removed_missing_run'] += 1
            except Exception as e:
                log.warning('lrem missing run: %s', e)
            continue
        st = row.get('status') or ''
        if st in _TERMINAL:
            try:
                r.lrem(PROCESSING_QUEUE, 1, raw)
                summary['removed_terminal'] += 1
            except Exception as e:
                log.warning('lrem terminal %s: %s', rid, e)
        elif st == 'queued':
            try:
                r.lrem(PROCESSING_QUEUE, 1, raw)
                r.lpush(RUN_QUEUE, raw)
                summary['requeued'] += 1
            except Exception as e:
                log.warning('requeue %s: %s', rid, e)
        elif st == 'running':
            summary['skipped_running'] += 1
        else:
            summary['skipped_other'] += 1

    _reconcile_last.clear()
    _reconcile_last.update(summary)
    return summary
