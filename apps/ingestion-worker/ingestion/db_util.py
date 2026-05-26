"""Optional psycopg connection pool for ingestion (see INGEST_DB_POOL_* env)."""

from __future__ import annotations

import os
from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row

DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://dd_agent:dd_agent_dev@postgres:5432/dd_agents')

_pool = None


def _pool_enabled() -> bool:
    return os.getenv('INGEST_DB_POOL_ENABLED', '').lower() in ('1', 'true', 'yes')


def _get_pool():
    global _pool
    if not _pool_enabled():
        return None
    if _pool is None:
        from psycopg_pool import ConnectionPool

        _pool = ConnectionPool(
            conninfo=DATABASE_URL,
            min_size=int(os.getenv('INGEST_DB_POOL_MIN', '1')),
            max_size=int(os.getenv('INGEST_DB_POOL_MAX', '4')),
            kwargs={'row_factory': dict_row},
        )
    return _pool


@contextmanager
def connection():
    p = _get_pool()
    if p:
        with p.connection() as conn:
            yield conn
    else:
        with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
            yield conn
