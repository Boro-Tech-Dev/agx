"""Phase 10 retrieval: per-agent embedder, RRF merge, optional rerank."""

from __future__ import annotations

import logging
import os
from typing import Any

import httpx

from ..db import fetch
from .memory_service import keyword_memory, resolve_search_context, vstr
from .retrieval_config_service import TOOL_CAPABLE_AGENTS, resolve_retrieval_for_agent
from .retrieval_ranking import rrf_merge

log = logging.getLogger(__name__)

MODEL_ROUTER_URL = os.getenv('MODEL_ROUTER_URL', 'http://model-router:8085').rstrip('/') or 'http://model-router:8085'
RETRIEVAL_V2_ENABLED = os.getenv('RETRIEVAL_V2_ENABLED', '1').strip().lower() not in ('0', 'false', 'no')


def retrieval_v2_enabled() -> bool:
    return RETRIEVAL_V2_ENABLED


async def embedding_for_embedder(text: str, embedder_id: str) -> tuple[list[float] | None, int, list[str]]:
    warnings: list[str] = []
    try:
        async with httpx.AsyncClient(timeout=90) as client:
            data = (
                await client.post(
                    f'{MODEL_ROUTER_URL}/v1/embed',
                    json={'input': text[:6000], 'embedder_id': embedder_id},
                )
            ).json()
        if data.get('error'):
            warnings.append(f'embedding_error:{data.get("error")}')
            return None, 0, warnings
        emb = (data.get('embeddings') or [[]])[0]
        dim = int(data.get('dim') or 768)
        if isinstance(emb, list) and emb:
            return emb, dim, warnings
        warnings.append('embedding_empty')
        return None, dim, warnings
    except Exception as e:
        log.warning('embedding_for_embedder failed: %s', e, exc_info=True)
        warnings.append('embedding_request_failed')
        return None, 0, warnings


def _vector_column(dim: int) -> str:
    return 'embedding_768' if dim == 768 else 'embedding_1024'


async def vector_memory_and_chunks(
    query: str,
    *,
    embedder_id: str,
    project_key: str | None,
    workspace_key: str | None,
    limit: int,
    document_kinds: list[str] | None,
) -> tuple[list[dict[str, Any]], list[str]]:
    warnings: list[str] = []
    emb, dim, w = await embedding_for_embedder(query, embedder_id)
    warnings.extend(w)
    if not emb or not dim:
        return [], warnings

    try:
        W, P = resolve_search_context(project_key, workspace_key)
    except Exception:
        raise
    if not W:
        return [], warnings

    col = _vector_column(dim)
    vec = vstr(emb)
    params: list[Any] = [vec, embedder_id, W]
    parts = ['sd.archived_at IS NULL', 'sd.workspace_key=%s']
    if P is not None:
        parts.append('sd.project_key=%s')
        params.append(P)
    if document_kinds:
        parts.append('sd.document_kind = ANY(%s)')
        params.append(document_kinds)
    where_doc = ' AND '.join(parts)
    params.append(vec)
    params.append(limit)

    chunk_rows = fetch(
        f"""SELECT dc.id::text, sd.title, dc.content AS body, 'source_chunk' AS memory_type,
                   'medium' AS confidence, sd.workspace_key, sd.project_key,
                   dc.created_at, dc.created_at AS updated_at, 'vector_chunk' AS source_kind,
                   (e.{col} <=> %s::vector) AS distance
            FROM embeddings e
            JOIN document_chunks dc ON dc.id = e.source_id
            JOIN source_documents sd ON sd.id = dc.document_id
            WHERE e.source_type = 'document_chunk' AND e.embedder_id = %s
              AND e.{col} IS NOT NULL AND {where_doc}
            ORDER BY e.{col} <=> %s::vector LIMIT %s::int""",
        tuple(params),
    )

    mem_params: list[Any] = [vec, embedder_id, W]
    mem_parts = ["m.status = 'active'", 'm.workspace_key=%s']
    if P is not None:
        mem_parts.append('(m.project_key IS NULL OR m.project_key=%s)')
        mem_params.append(P)
    mem_params.append(vec)
    mem_params.append(limit)
    mem_where = ' AND '.join(mem_parts)
    memory_rows = fetch(
        f"""SELECT m.id::text, m.title, m.body, m.memory_type, m.confidence,
                   m.workspace_key, m.project_key, m.created_at, m.updated_at, 'memory' AS source_kind,
                   (e.{col} <=> %s::vector) AS distance
            FROM embeddings e
            JOIN memories m ON m.id = e.source_id
            WHERE e.source_type = 'memory' AND e.embedder_id = %s AND e.{col} IS NOT NULL
              AND {mem_where}
            ORDER BY e.{col} <=> %s::vector LIMIT %s::int""",
        tuple(mem_params),
    )

    rows = [dict(r) for r in chunk_rows] + [dict(r) for r in memory_rows]
    rows.sort(key=lambda r: float(r.get('distance') or 999))
    return rows[:limit], warnings


async def rerank_rows(query: str, rows: list[dict[str, Any]], reranker_id: str) -> tuple[list[dict[str, Any]], list[str]]:
    warnings: list[str] = []
    if reranker_id == 'off' or not rows:
        return rows, warnings
    documents = []
    for r in rows:
        title = (r.get('title') or '').strip()
        body = (r.get('body') or '')[:2000]
        documents.append(f'{title}\n{body}'.strip() or body)
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            data = (
                await client.post(
                    f'{MODEL_ROUTER_URL}/v1/rerank',
                    json={'query': query, 'documents': documents, 'reranker_id': reranker_id},
                )
            ).json()
        if data.get('error'):
            warnings.append(f'rerank_error:{data.get("error")}')
            return rows, warnings
        ranked = data.get('ranked') or []
        reordered: list[dict[str, Any]] = []
        for item in ranked:
            idx = int(item.get('index', 0))
            if 0 <= idx < len(rows):
                row = dict(rows[idx])
                row['rerank_score'] = float(item.get('score') or 0)
                reordered.append(row)
        if reordered:
            return reordered, warnings
    except Exception as e:
        log.warning('rerank_rows failed: %s', e, exc_info=True)
        warnings.append('rerank_request_failed')
    return rows, warnings


async def retrieve(
    agent: str | None,
    query: str,
    project_key: str | None = None,
    workspace_key: str | None = None,
    limit: int = 12,
    document_kinds: list[str] | None = None,
    *,
    embedder_override: str | None = None,
    reranker_override: str | None = None,
) -> tuple[list[Any], list[str], dict[str, Any]]:
    """Returns (rows, warnings, debug)."""
    debug: dict[str, Any] = {'pipeline': 'retrieval_v2'}
    cfg = resolve_retrieval_for_agent(agent, embedder_override=embedder_override, reranker_override=reranker_override)
    debug['config'] = cfg
    embedder_id = cfg['embedder_id']
    reranker_id = cfg['reranker_id']
    k_retrieve = int(cfg.get('top_k_retrieve') or 60)
    k_final = min(limit, int(cfg.get('top_k_rerank') or limit))

    kw_rows, kw_warn = keyword_memory(query, project_key, workspace_key, k_retrieve, document_kinds)
    warnings = list(kw_warn)

    vec_rows, vec_warn = await vector_memory_and_chunks(
        query,
        embedder_id=embedder_id,
        project_key=project_key,
        workspace_key=workspace_key,
        limit=k_retrieve,
        document_kinds=document_kinds,
    )
    warnings.extend(vec_warn)

    merged = rrf_merge([kw_rows, vec_rows], k=k_retrieve)
    debug['candidates'] = len(merged)

    if agent in TOOL_CAPABLE_AGENTS and reranker_id != 'off':
        merged, rr_warn = await rerank_rows(query, merged, reranker_id)
        warnings.extend(rr_warn)
        debug['reranker_id'] = reranker_id

    return merged[:k_final], warnings, debug


def should_use_retrieval_v2(agent: str | None) -> bool:
    if not retrieval_v2_enabled():
        return False
    if not agent:
        return False
    return agent in TOOL_CAPABLE_AGENTS
