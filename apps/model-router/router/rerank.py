"""Rerank documents via TEI cross-encoders or Ollama LLM-as-reranker."""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Any

import httpx

from router.hybrid import OllamaConfig, chat_completion
from router.json_recovery import recover_json
from router.reranker_catalog import RERANKER_SPECS, get_reranker

log = logging.getLogger(__name__)


def _tei_timeout() -> float:
    raw = (os.getenv('RERANK_TEI_TIMEOUT_SEC', '') or '').strip()
    try:
        return max(5.0, float(raw)) if raw else 30.0
    except ValueError:
        return 30.0


async def _rerank_tei(base_url: str, query: str, documents: list[str]) -> list[dict[str, Any]]:
    url = f'{base_url.rstrip("/")}/rerank'
    payload = {'query': query, 'texts': documents, 'truncate': True}
    timeout = httpx.Timeout(_tei_timeout(), connect=min(10.0, _tei_timeout()))
    async with httpx.AsyncClient(timeout=timeout) as client:
        res = await client.post(url, json=payload)
        res.raise_for_status()
        data = res.json()
    # TEI returns [{"index": 0, "score": 0.9}, ...] sorted by score desc
    rows = data if isinstance(data, list) else (data.get('results') or data.get('rankings') or [])
    out: list[dict[str, Any]] = []
    for row in rows:
        if isinstance(row, dict) and 'index' in row:
            out.append({'index': int(row['index']), 'score': float(row.get('score') or 0)})
    if not out and isinstance(data, dict):
        for i, s in enumerate(data.get('scores') or []):
            out.append({'index': i, 'score': float(s)})
        out.sort(key=lambda x: x['score'], reverse=True)
    return out


def _llm_rerank_prompt(query: str, documents: list[str]) -> str:
    lines = [
        'Score each passage for relevance to the query on a scale 0.0 to 1.0.',
        'Return ONLY valid JSON: {"scores": [float, ...]} with one score per passage in order.',
        f'Query: {query[:800]}',
        '',
        'Passages:',
    ]
    for i, doc in enumerate(documents):
        lines.append(f'[{i}] {(doc or "")[:1200]}')
    return '\n'.join(lines)


async def _rerank_ollama(model: str, query: str, documents: list[str], ollama: OllamaConfig) -> list[dict[str, Any]]:
    if not documents:
        return []
    prompt = _llm_rerank_prompt(query, documents)
    out = await chat_completion(
        model=model,
        messages=[{'role': 'user', 'content': prompt}],
        temperature=0.0,
        schema=None,
        ollama=ollama,
    )
    if out.get('error'):
        log.warning('ollama rerank failed: %s', out.get('error'))
        return [{'index': i, 'score': 0.0} for i in range(len(documents))]
    parsed = recover_json(out.get('content') or '')
    scores: list[float] = []
    if isinstance(parsed, dict) and isinstance(parsed.get('scores'), list):
        scores = [float(x) for x in parsed['scores'][: len(documents)]]
    while len(scores) < len(documents):
        scores.append(0.0)
    indexed = [{'index': i, 'score': scores[i]} for i in range(len(documents))]
    indexed.sort(key=lambda x: x['score'], reverse=True)
    return indexed


async def rerank(
    query: str,
    documents: list[str],
    reranker_id: str,
    *,
    ollama: OllamaConfig,
) -> dict[str, Any]:
    """Returns {ranked: [{index, score}], backend_used, latency_ms, error?}."""
    t0 = time.monotonic()
    rid = (reranker_id or 'off').strip()
    if rid == 'off' or not documents:
        ranked = [{'index': i, 'score': 1.0 - i * 0.001} for i in range(len(documents))]
        return {
            'ranked': ranked,
            'backend_used': 'off',
            'latency_ms': int((time.monotonic() - t0) * 1000),
        }

    spec = get_reranker(rid)
    if not spec:
        return {
            'ranked': [{'index': i, 'score': 0.0} for i in range(len(documents))],
            'backend_used': rid,
            'latency_ms': int((time.monotonic() - t0) * 1000),
            'error': f'unknown reranker_id: {rid}',
        }

    texts = [(d or '')[:4000] for d in documents]
    try:
        if spec.backend == 'tei' and spec.endpoint:
            ranked = await _rerank_tei(spec.endpoint, query, texts)
            backend_used = rid
        elif spec.backend == 'ollama' and spec.model_tag:
            ranked = await _rerank_ollama(spec.model_tag, query, texts, ollama)
            backend_used = rid
        else:
            ranked = [{'index': i, 'score': 0.0} for i in range(len(documents))]
            backend_used = rid
            return {
                'ranked': ranked,
                'backend_used': backend_used,
                'latency_ms': int((time.monotonic() - t0) * 1000),
                'error': 'reranker not configured',
            }
    except Exception as e:
        log.warning('rerank %s failed: %s', rid, e, exc_info=True)
        return {
            'ranked': [{'index': i, 'score': 0.0} for i in range(len(documents))],
            'backend_used': rid,
            'latency_ms': int((time.monotonic() - t0) * 1000),
            'error': str(e)[:500],
        }

    if not ranked:
        ranked = [{'index': i, 'score': 0.0} for i in range(len(documents))]

    return {
        'ranked': ranked,
        'backend_used': backend_used,
        'latency_ms': int((time.monotonic() - t0) * 1000),
    }
