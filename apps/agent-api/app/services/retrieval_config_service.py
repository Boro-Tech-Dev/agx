"""Per-agent retrieval config from Postgres."""

from __future__ import annotations

from typing import Any

from ..db import execute, fetch, fetch_one

TOOL_CAPABLE_AGENTS = frozenset({'pm', 'builder', 'forge', 'canon'})


def get_agent_retrieval_config(agent: str) -> dict[str, Any] | None:
    row = fetch_one(
        """SELECT agent, embedder_id, reranker_id, top_k_retrieve, top_k_rerank, updated_at, updated_by
           FROM agent_retrieval_config WHERE agent = %s""",
        (agent,),
    )
    return dict(row) if row else None


def list_agent_retrieval_configs() -> list[dict[str, Any]]:
    rows = fetch(
        """SELECT c.agent, c.embedder_id, c.reranker_id, c.top_k_retrieve, c.top_k_rerank,
                  c.updated_at, c.updated_by,
                  e.display_name AS embedder_display, e.dim AS embedder_dim,
                  r.display_name AS reranker_display
           FROM agent_retrieval_config c
           JOIN embedder_catalog e ON e.embedder_id = c.embedder_id
           JOIN reranker_catalog r ON r.reranker_id = c.reranker_id
           ORDER BY c.agent"""
    )
    return [dict(r) for r in rows]


def list_embedder_catalog() -> list[dict[str, Any]]:
    return [dict(r) for r in fetch('SELECT * FROM embedder_catalog WHERE enabled ORDER BY embedder_id')]


def list_reranker_catalog() -> list[dict[str, Any]]:
    return [dict(r) for r in fetch('SELECT * FROM reranker_catalog WHERE enabled ORDER BY reranker_id')]


def upsert_agent_retrieval_config(agent: str, payload: dict[str, Any], updated_by: str | None = None) -> dict[str, Any]:
    return execute(
        """INSERT INTO agent_retrieval_config(agent, embedder_id, reranker_id, top_k_retrieve, top_k_rerank, updated_by)
           VALUES (%s,%s,%s,%s,%s,%s)
           ON CONFLICT (agent) DO UPDATE SET
             embedder_id = EXCLUDED.embedder_id,
             reranker_id = EXCLUDED.reranker_id,
             top_k_retrieve = EXCLUDED.top_k_retrieve,
             top_k_rerank = EXCLUDED.top_k_rerank,
             updated_at = now(),
             updated_by = EXCLUDED.updated_by
           RETURNING *""",
        (
            agent,
            payload['embedder_id'],
            payload['reranker_id'],
            int(payload.get('top_k_retrieve', 60)),
            int(payload.get('top_k_rerank', 12)),
            updated_by,
        ),
    )


def resolve_retrieval_for_agent(
    agent: str | None,
    *,
    embedder_override: str | None = None,
    reranker_override: str | None = None,
) -> dict[str, Any]:
    defaults = {
        'agent': agent or 'pm',
        'embedder_id': 'nomic-embed-text',
        'reranker_id': 'off',
        'top_k_retrieve': 60,
        'top_k_rerank': 12,
    }
    if agent:
        cfg = get_agent_retrieval_config(agent)
        if cfg:
            defaults.update(cfg)
        elif agent in TOOL_CAPABLE_AGENTS:
            defaults['reranker_id'] = 'colbert_gte_modern'
    if embedder_override:
        defaults['embedder_id'] = embedder_override.strip()
    if reranker_override:
        defaults['reranker_id'] = reranker_override.strip()
    return defaults
