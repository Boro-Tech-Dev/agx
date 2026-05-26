"""Read/write unified embeddings table."""

from __future__ import annotations

import hashlib
import json
import logging
from typing import Any

from ..db import execute, fetch, fetch_one

log = logging.getLogger(__name__)


def text_hash(text: str) -> str:
    return hashlib.sha256((text or '').encode('utf-8')).hexdigest()


def vstr(vec: list[float]) -> str:
    return '[' + ','.join(str(float(x)) for x in vec) + ']'


def upsert_embedding(
    *,
    source_type: str,
    source_id: str,
    embedder_id: str,
    dim: int,
    content: str,
    vector: list[float],
) -> None:
    th = text_hash(content)
    if dim == 768:
        execute(
            """INSERT INTO embeddings(source_type, source_id, embedder_id, dim, text_hash, embedding_768)
               VALUES (%s,%s,%s,768,%s,%s::vector)
               ON CONFLICT (source_type, source_id, embedder_id) DO UPDATE SET
                 text_hash = EXCLUDED.text_hash,
                 embedding_768 = EXCLUDED.embedding_768,
                 embedding_1024 = NULL,
                 dim = 768,
                 created_at = now()""",
            (source_type, source_id, embedder_id, th, vstr(vector)),
        )
    elif dim == 1024:
        execute(
            """INSERT INTO embeddings(source_type, source_id, embedder_id, dim, text_hash, embedding_1024)
               VALUES (%s,%s,%s,1024,%s,%s::vector)
               ON CONFLICT (source_type, source_id, embedder_id) DO UPDATE SET
                 text_hash = EXCLUDED.text_hash,
                 embedding_1024 = EXCLUDED.embedding_1024,
                 embedding_768 = NULL,
                 dim = 1024,
                 created_at = now()""",
            (source_type, source_id, embedder_id, th, vstr(vector)),
        )
    else:
        log.warning('upsert_embedding: unsupported dim %s', dim)


def count_missing_embeddings(embedder_id: str, source_type: str | None = None) -> int:
    if source_type == 'document_chunk':
        row = fetch_one(
            """SELECT COUNT(*)::int AS c FROM document_chunks dc
               WHERE NOT EXISTS (
                 SELECT 1 FROM embeddings e
                 WHERE e.source_type = 'document_chunk' AND e.source_id = dc.id AND e.embedder_id = %s
               )""",
            (embedder_id,),
        )
    elif source_type == 'memory':
        row = fetch_one(
            """SELECT COUNT(*)::int AS c FROM memories m WHERE m.status = 'active'
               AND NOT EXISTS (
                 SELECT 1 FROM embeddings e
                 WHERE e.source_type = 'memory' AND e.source_id = m.id AND e.embedder_id = %s
               )""",
            (embedder_id,),
        )
    else:
        c1 = count_missing_embeddings(embedder_id, 'document_chunk')
        c2 = count_missing_embeddings(embedder_id, 'memory')
        return c1 + c2
    return int(row['c']) if row else 0


def iter_sources_needing_embed(embedder_id: str, source_type: str, *, limit: int = 500, offset: int = 0):
    if source_type == 'document_chunk':
        return fetch(
            """SELECT dc.id::text AS source_id, dc.content AS content
               FROM document_chunks dc
               WHERE NOT EXISTS (
                 SELECT 1 FROM embeddings e
                 WHERE e.source_type = 'document_chunk' AND e.source_id = dc.id AND e.embedder_id = %s
               )
               ORDER BY dc.created_at
               LIMIT %s OFFSET %s""",
            (embedder_id, limit, offset),
        )
    return fetch(
        """SELECT m.id::text AS source_id, (m.title || E'\\n' || m.body) AS content
           FROM memories m WHERE m.status = 'active'
           AND NOT EXISTS (
             SELECT 1 FROM embeddings e
             WHERE e.source_type = 'memory' AND e.source_id = m.id AND e.embedder_id = %s
           )
           ORDER BY m.updated_at
           LIMIT %s OFFSET %s""",
        (embedder_id, limit, offset),
    )
