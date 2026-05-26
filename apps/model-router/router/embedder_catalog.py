"""Hardcoded embedder catalog (mirrors embedder_catalog DB seed). Model-router stays Postgres-free."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class EmbedderSpec:
    embedder_id: str
    dim: int
    ollama_tag: str
    display_name: str


EMBEDDER_SPECS: dict[str, EmbedderSpec] = {
    'nomic-embed-text': EmbedderSpec('nomic-embed-text', 768, 'nomic-embed-text', 'Nomic Embed Text'),
    'embeddinggemma': EmbedderSpec('embeddinggemma', 768, 'embeddinggemma', 'EmbeddingGemma 300M'),
    'mxbai-embed-large': EmbedderSpec('mxbai-embed-large', 1024, 'mxbai-embed-large', 'MxBAI Embed Large'),
    'bge-m3': EmbedderSpec('bge-m3', 1024, 'bge-m3', 'BGE-M3'),
}


def resolve_embedder(embedder_id: str | None, model_override: str | None) -> EmbedderSpec:
    if model_override and not embedder_id:
        tag = model_override.strip()
        for spec in EMBEDDER_SPECS.values():
            if spec.ollama_tag == tag or spec.embedder_id == tag:
                return spec
        return EmbedderSpec(tag, 768, tag, tag)
    eid = (embedder_id or 'nomic-embed-text').strip()
    spec = EMBEDDER_SPECS.get(eid)
    if spec:
        return spec
    return EmbedderSpec(eid, 768, eid, eid)


def list_embedders() -> list[dict]:
    return [
        {
            'embedder_id': s.embedder_id,
            'dim': s.dim,
            'ollama_tag': s.ollama_tag,
            'display_name': s.display_name,
        }
        for s in EMBEDDER_SPECS.values()
    ]
