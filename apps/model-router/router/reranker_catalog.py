"""Hardcoded reranker catalog (mirrors reranker_catalog DB seed)."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class RerankerSpec:
    reranker_id: str
    backend: str
    endpoint: str | None
    model_tag: str | None
    display_name: str


RERANKER_SPECS: dict[str, RerankerSpec] = {
    'off': RerankerSpec('off', 'none', None, None, 'Off'),
    # Phase 2A: ColBERT late-interaction reranker (TEI-shaped wire format, served by
    # apps/reranker-colbert). Backend stays 'tei' so router/rerank.py _rerank_tei works
    # unchanged. Default model is GTE-ModernColBERT-v1; flip COLBERT_MODEL on the
    # service to switch to jinaai/jina-colbert-v2 without code changes.
    'colbert_gte_modern': RerankerSpec(
        'colbert_gte_modern',
        'tei',
        'http://reranker-colbert:8097',
        'lightonai/GTE-ModernColBERT-v1',
        'ColBERT (GTE Modern v1)',
    ),
    'colbert_jina_v2': RerankerSpec(
        'colbert_jina_v2',
        'tei',
        'http://reranker-colbert:8097',
        'jinaai/jina-colbert-v2',
        'ColBERT (Jina v2 multilingual)',
    ),
    'ollama_mxbai_rerank': RerankerSpec(
        'ollama_mxbai_rerank', 'ollama', None, 'mxbai-rerank-large-v2', 'MxBAI LLM Rerank'
    ),
    'ollama_qwen3_rerank': RerankerSpec('ollama_qwen3_rerank', 'ollama', None, 'qwen3-reranker:0.6b', 'Qwen3 Reranker 0.6B'),
}


def get_reranker(reranker_id: str) -> RerankerSpec | None:
    return RERANKER_SPECS.get((reranker_id or '').strip())


def list_rerankers() -> list[dict]:
    return [
        {
            'reranker_id': s.reranker_id,
            'backend': s.backend,
            'endpoint': s.endpoint,
            'model_tag': s.model_tag,
            'display_name': s.display_name,
        }
        for s in RERANKER_SPECS.values()
    ]
