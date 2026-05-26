"""Embed memories and chunks into the unified embeddings table at ingest time."""

from __future__ import annotations

import logging
import os

import httpx

from .embedding_store import text_hash, upsert_embedding

log = logging.getLogger(__name__)

MODEL_ROUTER_URL = os.getenv('MODEL_ROUTER_URL', 'http://model-router:8085').rstrip('/') or 'http://model-router:8085'


def embedders_at_ingest() -> list[str]:
    raw = (os.getenv('EMBED_AT_INGEST', 'nomic-embed-text') or '').strip()
    return [x.strip() for x in raw.split(',') if x.strip()]


async def embed_text_for_embedder(text: str, embedder_id: str) -> tuple[list[float] | None, int]:
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            data = (
                await client.post(
                    f'{MODEL_ROUTER_URL}/v1/embed',
                    json={'input': text[:6000], 'embedder_id': embedder_id},
                )
            ).json()
        if data.get('error'):
            log.warning('embed_text_for_embedder %s: %s', embedder_id, data.get('error'))
            return None, 0
        emb = (data.get('embeddings') or [[]])[0]
        dim = int(data.get('dim') or 768)
        if isinstance(emb, list) and emb:
            return emb, dim
    except Exception as e:
        log.warning('embed_text_for_embedder failed %s: %s', embedder_id, e, exc_info=True)
    return None, 0


async def upsert_source_embeddings(
    *,
    source_type: str,
    source_id: str,
    content: str,
    embedder_ids: list[str] | None = None,
) -> int:
    ids = embedder_ids or embedders_at_ingest()
    n = 0
    for eid in ids:
        vec, dim = await embed_text_for_embedder(content, eid)
        if vec and dim:
            upsert_embedding(
                source_type=source_type,
                source_id=source_id,
                embedder_id=eid,
                dim=dim,
                content=content,
                vector=vec,
            )
            n += 1
    return n


async def embed_memory_record(memory_id: str, title: str, body: str) -> int:
    from ..db import execute

    th = text_hash(f'{title}\n{body}')
    execute('UPDATE memories SET text_hash = %s WHERE id = %s', (th, memory_id))
    return await upsert_source_embeddings(
        source_type='memory',
        source_id=memory_id,
        content=f'{title}\n{body}',
    )
