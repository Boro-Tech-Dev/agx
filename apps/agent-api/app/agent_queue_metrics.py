"""Prometheus gauges for Redis queue depths (same keys as GET /api/monitoring/queues)."""

import logging

from prometheus_client import Gauge

from .services.common import (
    DEAD_QUEUE,
    DOCUMENT_INGEST_PROCESSING_QUEUE,
    DOCUMENT_INGEST_QUEUE,
    PROCESSING_QUEUE,
    RUN_QUEUE,
    rconn,
)

log = logging.getLogger(__name__)

_agent_queue_length = Gauge(
    'agent_queue_length',
    'Length of Redis agent and ingest queues',
    ['queue'],
)


def refresh_agent_queue_gauges() -> None:
    try:
        r = rconn()
        _agent_queue_length.labels(queue='pending').set(r.llen(RUN_QUEUE))
        _agent_queue_length.labels(queue='processing').set(r.llen(PROCESSING_QUEUE))
        _agent_queue_length.labels(queue='dead').set(r.llen(DEAD_QUEUE))
        try:
            ingest_pending = r.llen(DOCUMENT_INGEST_QUEUE)
        except Exception:
            log.exception('ingest queue LLEN')
            return
        _agent_queue_length.labels(queue='ingest_pending').set(ingest_pending)
        try:
            ingest_processing = r.llen(DOCUMENT_INGEST_PROCESSING_QUEUE)
        except Exception:
            log.exception('ingest processing queue LLEN')
            return
        _agent_queue_length.labels(queue='ingest_processing').set(ingest_processing)
    except Exception:
        log.exception('refresh_agent_queue_gauges')
