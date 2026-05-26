"""Aggregated AI stack status for the Models dashboard page."""

from __future__ import annotations

import asyncio
import os
import time
from typing import Any

import httpx
from fastapi import APIRouter

from ..services import embedding_store, retrieval_config_service
from .agent_lanes import get_agent_lanes

router = APIRouter(prefix='/api/model', tags=['model'])

MODEL_ROUTER_URL = os.getenv('MODEL_ROUTER_URL', 'http://model-router:8085').rstrip('/') or 'http://model-router:8085'
RERANKER_PROBE_TIMEOUT = float(os.getenv('MODEL_OVERVIEW_RERANKER_PROBE_SEC', '8') or '8')


def _router_feature_flags() -> dict[str, Any]:
    """Safe env reads until model-router /health exposes features (Phase 4 merges both)."""
    mcp_raw = (os.getenv('MCP_BRIDGE_TARGETS', '') or '').strip()
    mcp_names = [p.split('=', 1)[0].strip() for p in mcp_raw.split(',') if '=' in p]
    return {
        'ollama_pull_enabled': os.getenv('OLLAMA_PULL_ENABLED', 'true').strip().lower() not in ('0', 'false', 'no'),
        'ollama_probe_chat': os.getenv('OLLAMA_PROBE_CHAT', '0').strip().lower() not in ('0', 'false', 'no'),
        'ollama_grammar_failure_fallback': os.getenv('OLLAMA_GRAMMAR_FAILURE_FALLBACK', '1').strip().lower()
        not in ('0', 'false', 'no'),
        'pm_schema_fallback': os.getenv('PM_SCHEMA_FALLBACK', '').strip().lower() in ('1', 'true', 'yes'),
        'kitt_router_grammar_mode': (os.getenv('KITT_ROUTER_GRAMMAR_MODE', '') or 'never').strip().lower()
        or 'never',
        'default_embed_model': (os.getenv('DEFAULT_EMBED_MODEL', 'nomic-embed-text') or 'nomic-embed-text').strip(),
        'embedding_dim': int(os.getenv('EMBEDDING_DIM', '0') or '0'),
        'mcp_bridge_enabled': os.getenv('MCP_BRIDGE_ENABLED', '0').strip().lower() in ('1', 'true', 'yes'),
        'mcp_targets': mcp_names,
    }


def _runtime_flags() -> dict[str, Any]:
    return {
        'web_deepfetch_reranker_id': (os.getenv('WEB_DEEPFETCH_RERANKER_ID', 'colbert_gte_modern') or 'colbert_gte_modern').strip(),
        'retrieval_v2_enabled': os.getenv('RETRIEVAL_V2_ENABLED', '1').strip().lower() not in ('0', 'false', 'no'),
    }


def _retrieval_slice() -> dict[str, Any]:
    embedders = retrieval_config_service.list_embedder_catalog()
    agents = retrieval_config_service.list_agent_retrieval_configs()
    missing = {e['embedder_id']: embedding_store.count_missing_embeddings(e['embedder_id']) for e in embedders}
    return {'agents': agents, 'embedders': embedders, 'missing_embeddings': missing}


async def _fetch_json(client: httpx.AsyncClient, url: str) -> dict[str, Any]:
    res = await client.get(url)
    res.raise_for_status()
    data = res.json()
    return data if isinstance(data, dict) else {'raw': data}


async def _probe_tei_rerank(client: httpx.AsyncClient, base: str) -> None:
    """Confirm TEI reranker can score docs (empty /health is normal for TEI)."""
    res = await client.post(
        f'{base}/rerank',
        json={'query': 'ping', 'texts': ['doc one', 'doc two'], 'truncate': True},
    )
    res.raise_for_status()
    data = res.json()
    if not isinstance(data, list):
        raise ValueError(f'TEI /rerank expected list, got {type(data).__name__}')


async def _probe_reranker(reranker_id: str, endpoint: str) -> dict[str, Any]:
    t0 = time.monotonic()
    base = endpoint.rstrip('/')
    out: dict[str, Any] = {
        'reranker_id': reranker_id,
        'endpoint': endpoint,
    }
    try:
        timeout = httpx.Timeout(RERANKER_PROBE_TIMEOUT, connect=min(5.0, RERANKER_PROBE_TIMEOUT))
        async with httpx.AsyncClient(timeout=timeout) as client:
            res = await client.get(f'{base}/health')
            res.raise_for_status()
            body = (res.text or '').strip()
            if not body:
                await _probe_tei_rerank(client, base)
                out['ok'] = True
                out['health'] = {'tei': True}
            else:
                health = res.json()
                out['ok'] = True
                out['health'] = health if isinstance(health, dict) else {'raw': health}
        out['latency_ms'] = int((time.monotonic() - t0) * 1000)
    except Exception as e:
        out['ok'] = False
        out['error'] = str(e)[:500]
        out['latency_ms'] = int((time.monotonic() - t0) * 1000)
    return out


async def _probe_rerankers(catalog_rerankers: list[dict[str, Any]]) -> list[dict[str, Any]]:
    probes: list[tuple[str, str]] = []
    for row in catalog_rerankers:
        rid = str(row.get('reranker_id') or '')
        backend = str(row.get('backend') or '')
        endpoint = row.get('endpoint')
        if not rid or rid == 'off' or backend in ('none', ''):
            continue
        if backend == 'tei' and isinstance(endpoint, str) and endpoint.strip():
            probes.append((rid, endpoint.strip()))
    if not probes:
        return []
    results = await asyncio.gather(*[_probe_reranker(rid, ep) for rid, ep in probes])
    return list(results)


def _merge_router_features(router_health: dict[str, Any] | None) -> dict[str, Any]:
    local = _router_feature_flags()
    if not router_health:
        return local
    remote = router_health.get('features')
    if isinstance(remote, dict):
        merged = {**local, **remote}
        if remote.get('mcp_targets'):
            merged['mcp_targets'] = remote['mcp_targets']
        return merged
    return local


@router.get('/overview')
async def model_overview():
    ollama: dict[str, Any] = {'ok': False, 'error': 'model-router unreachable'}
    catalog: dict[str, Any] = {'embedders': [], 'rerankers': []}
    router_health: dict[str, Any] | None = None
    errors: list[str] = []

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            try:
                ollama = await _fetch_json(client, f'{MODEL_ROUTER_URL}/v1/models')
            except Exception as e:
                ollama = {'ok': False, 'error': str(e)[:500]}
                errors.append(f'ollama:{e}')

            try:
                catalog = await _fetch_json(client, f'{MODEL_ROUTER_URL}/v1/retrieval/catalog')
            except Exception as e:
                errors.append(f'catalog:{e}')

            try:
                router_health = await _fetch_json(client, f'{MODEL_ROUTER_URL}/health')
            except Exception as e:
                errors.append(f'router_health:{e}')
    except Exception as e:
        errors.append(str(e)[:500])

    rerankers = catalog.get('rerankers') if isinstance(catalog.get('rerankers'), list) else []
    reranker_health = await _probe_rerankers(rerankers)

    try:
        retrieval = _retrieval_slice()
    except Exception as e:
        retrieval = {'agents': [], 'embedders': [], 'missing_embeddings': {}}
        errors.append(f'retrieval:{e}')

    try:
        lanes = get_agent_lanes()
    except Exception as e:
        lanes = {'lanes': {}, 'agents': []}
        errors.append(f'lanes:{e}')

    features = _merge_router_features(router_health)
    if isinstance(ollama.get('features'), dict):
        features['ollama_pull_enabled'] = ollama['features'].get(
            'ollama_pull_enabled', features.get('ollama_pull_enabled')
        )

    return {
        'version': 1,
        'ok': ollama.get('ok') is True and not any(h.get('ok') is False for h in reranker_health),
        'errors': errors,
        'ollama': ollama,
        'router': {
            'health': router_health,
            'features': features,
        },
        'catalog': {
            'embedders': catalog.get('embedders') or [],
            'rerankers': rerankers,
        },
        'retrieval': retrieval,
        'lanes': lanes,
        'reranker_health': reranker_health,
        'runtime': _runtime_flags(),
    }
