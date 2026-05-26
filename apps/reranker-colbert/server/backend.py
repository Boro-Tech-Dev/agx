"""ColBERT backends: real (PyLate) + stub (no heavy deps, used by tests).

The HTTP layer in :mod:`server.main` calls :func:`get_backend` which lazily
chooses :class:`ColbertBackend` when PyLate is importable and the configured
``COLBERT_MODEL`` loads, else falls back to :class:`StubBackend`. The stub is
deterministic length+overlap based; it lets the service answer ``/health`` and
``/rerank`` even on environments where torch/PyLate aren't installed, and gives
tests something predictable to assert against.
"""

from __future__ import annotations

import logging
import os
import threading
from dataclasses import dataclass
from typing import Protocol

log = logging.getLogger(__name__)


DEFAULT_MODEL = os.getenv('COLBERT_MODEL', 'lightonai/GTE-ModernColBERT-v1').strip() or 'lightonai/GTE-ModernColBERT-v1'
DEFAULT_BATCH_SIZE = max(1, int(os.getenv('COLBERT_BATCH_SIZE', '16') or '16'))
DEFAULT_MAX_DOC_LENGTH = max(64, int(os.getenv('COLBERT_MAX_DOC_TOKENS', '300') or '300'))
DEFAULT_MAX_QUERY_LENGTH = max(16, int(os.getenv('COLBERT_MAX_QUERY_TOKENS', '64') or '64'))


@dataclass
class ScoredIndex:
    index: int
    score: float


class RerankBackend(Protocol):
    name: str
    model: str
    device: str

    def rerank(self, query: str, documents: list[str], *, truncate: bool = True) -> list[ScoredIndex]:
        ...


class StubBackend:
    """Length+overlap scoring; no heavy deps. Deterministic for tests."""

    name = 'stub'
    model = 'stub://length-overlap'
    device = 'cpu'

    def rerank(self, query: str, documents: list[str], *, truncate: bool = True) -> list[ScoredIndex]:
        q_tokens = {t for t in (query or '').lower().split() if t}
        scored: list[ScoredIndex] = []
        for i, d in enumerate(documents or []):
            d_tokens = {t for t in (d or '').lower().split() if t}
            overlap = len(q_tokens & d_tokens)
            # Tie-break with inverse length so short docs win when tied (cheap proxy).
            length_pen = 1.0 / max(1, len(d or ''))
            score = float(overlap) + length_pen
            scored.append(ScoredIndex(index=i, score=score))
        scored.sort(key=lambda s: s.score, reverse=True)
        return scored


class ColbertBackend:
    """PyLate-backed ColBERT scoring (real MaxSim late interaction)."""

    name = 'pylate'

    def __init__(self, model_name: str = DEFAULT_MODEL):
        from pylate import models  # imported lazily to avoid hard dep at import time

        try:
            import torch

            self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        except Exception:
            self.device = 'cpu'
        log.info('Loading ColBERT model %s on %s', model_name, self.device)
        self._model = models.ColBERT(
            model_name_or_path=model_name,
            document_length=DEFAULT_MAX_DOC_LENGTH,
            query_length=DEFAULT_MAX_QUERY_LENGTH,
        )
        self.model = model_name

    def rerank(self, query: str, documents: list[str], *, truncate: bool = True) -> list[ScoredIndex]:
        from pylate import scores  # noqa: WPS433
        import torch  # noqa: WPS433

        if not documents:
            return []
        # Encode query once
        q_embs = self._model.encode(
            [query or ''],
            is_query=True,
            batch_size=1,
            convert_to_tensor=True,
        )
        # Batched document encoding
        d_embs = self._model.encode(
            [str(d or '') for d in documents],
            is_query=False,
            batch_size=DEFAULT_BATCH_SIZE,
            convert_to_tensor=True,
        )
        with torch.no_grad():
            sim = scores.colbert_scores(q_embs, d_embs)  # shape: [1, n_docs]
        flat = sim.squeeze(0).detach().cpu().tolist()
        ordered = sorted(
            (ScoredIndex(index=i, score=float(s)) for i, s in enumerate(flat)),
            key=lambda x: x.score,
            reverse=True,
        )
        return ordered


_BACKEND_LOCK = threading.Lock()
_BACKEND: RerankBackend | None = None


def get_backend() -> RerankBackend:
    """Return the singleton backend, picking real ColBERT when available."""
    global _BACKEND
    if _BACKEND is not None:
        return _BACKEND
    with _BACKEND_LOCK:
        if _BACKEND is not None:
            return _BACKEND
        force_stub = os.getenv('COLBERT_FORCE_STUB', '').strip().lower() in ('1', 'true', 'yes')
        if force_stub:
            log.info('COLBERT_FORCE_STUB set; using StubBackend')
            _BACKEND = StubBackend()
            return _BACKEND
        try:
            _BACKEND = ColbertBackend(DEFAULT_MODEL)
            log.info('ColbertBackend ready model=%s', DEFAULT_MODEL)
        except Exception as e:
            log.warning('PyLate ColBERT unavailable (%s); falling back to StubBackend', e)
            _BACKEND = StubBackend()
        return _BACKEND


def reset_backend_for_tests() -> None:
    """Drop the singleton so a new backend (e.g. the stub) is picked up."""
    global _BACKEND
    with _BACKEND_LOCK:
        _BACKEND = None
