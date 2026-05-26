import json
import os
from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row

DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://dd_agent:dd_agent_dev@postgres:5432/dd_agents')

_pool = None


def _pool_enabled() -> bool:
    return os.getenv('WORKER_DB_POOL_ENABLED', '').lower() in ('1', 'true', 'yes')


def _get_pool():
    global _pool
    if not _pool_enabled():
        return None
    if _pool is None:
        from psycopg_pool import ConnectionPool

        _pool = ConnectionPool(
            conninfo=DATABASE_URL,
            min_size=int(os.getenv('WORKER_DB_POOL_MIN', '1')),
            max_size=int(os.getenv('WORKER_DB_POOL_MAX', '8')),
            kwargs={'row_factory': dict_row},
        )
    return _pool


@contextmanager
def _connection():
    p = _get_pool()
    if p:
        with p.connection() as conn:
            yield conn
    else:
        with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
            yield conn


def fetch(sql, params=()):
    with _connection() as c, c.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()


def fetch_one(sql, params=()):
    with _connection() as c, c.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchone()


def execute_many(sql: str, params_seq: list[tuple]) -> None:
    if not params_seq:
        return
    with _connection() as c, c.cursor() as cur:
        cur.executemany(sql, params_seq)
        c.commit()


def insert_run_events_many(rows: list[tuple]) -> None:
    """rows: (run_id, event_type, message, payload_json_str)"""
    if not rows:
        return
    execute_many(
        'insert into run_events(run_id,event_type,message,payload) values(%s,%s,%s,%s::jsonb)',
        rows,
    )


def count_embedded_document_chunks_for_project(project_key: str) -> int:
    """
    Count document_chunks with non-null embeddings for a project.
    Returns -1 on error (caller should fall back to requesting an embed).
    """
    if not project_key:
        return -1
    try:
        row = fetch_one(
            """SELECT COUNT(*)::int AS c FROM document_chunks dc
               INNER JOIN source_documents sd ON sd.id = dc.document_id
               WHERE sd.project_key = %s AND dc.embedding IS NOT NULL""",
            (project_key,),
        )
        if not row or row.get('c') is None:
            return 0
        return int(row['c'])
    except Exception:
        return -1


def count_embedded_document_chunks_for_project_cached(project_key: str) -> int:
    """
    Same as count_embedded_document_chunks_for_project with optional Redis TTL cache.
    CHUNK_COUNT_CACHE_TTL_SEC (default 0) disables caching.
    """
    ttl_raw = (os.getenv('CHUNK_COUNT_CACHE_TTL_SEC', '') or '').strip()
    try:
        ttl = int(ttl_raw) if ttl_raw else 0
    except ValueError:
        ttl = 0
    if ttl <= 0 or not project_key:
        return count_embedded_document_chunks_for_project(project_key)
    url = (os.getenv('REDIS_URL', '') or '').strip()
    if not url:
        return count_embedded_document_chunks_for_project(project_key)
    key = f'agentx:chunkcnt:{project_key[:200]}'
    try:
        import redis as redis_mod

        r = redis_mod.Redis.from_url(url, decode_responses=True)
        cached = r.get(key)
        if cached is not None:
            try:
                return int(cached)
            except ValueError:
                pass
        n = count_embedded_document_chunks_for_project(project_key)
        if n >= 0:
            try:
                r.setex(key, ttl, str(n))
            except Exception:
                pass
        return n
    except Exception:
        return count_embedded_document_chunks_for_project(project_key)


def execute(sql, params=()):
    with _connection() as c, c.cursor() as cur:
        cur.execute(sql, params)
        row = cur.fetchone() if cur.description else None
        c.commit()
        return row


def j(value):
    return json.dumps(value, default=str)
