"""ColBERT reranker HTTP service. Exposes a TEI-compatible /rerank endpoint
so it slots into ``apps/model-router/router/rerank.py`` ``_rerank_tei`` without
any router changes (catalog entry below in 030_retrieval_v2 / 031 migration).

Request:
    POST /rerank
    { "query": "<str>", "texts": ["doc0", "doc1", ...], "truncate": true }

Response (TEI shape):
    [ {"index": 2, "score": 0.91}, {"index": 0, "score": 0.74}, ... ]
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any

from fastapi import FastAPI, HTTPException
from prometheus_fastapi_instrumentator import Instrumentator
from pydantic import BaseModel, Field

from server.backend import get_backend

log = logging.getLogger(__name__)
logging.basicConfig(level=os.getenv('LOG_LEVEL', 'INFO').upper())

app = FastAPI(title='ColBERT Reranker', version='0.1.0')
Instrumentator(
    should_group_status_codes=True,
    should_instrument_requests_inprogress=True,
).instrument(app).expose(app, include_in_schema=False)

MAX_DOCS = max(1, int(os.getenv('COLBERT_MAX_DOCS_PER_CALL', '128') or '128'))


class RerankRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=4000)
    texts: list[str] = Field(default_factory=list, max_length=MAX_DOCS)
    truncate: bool = True


@app.get('/health')
def health() -> dict[str, Any]:
    backend = get_backend()
    return {
        'ok': True,
        'service': 'reranker-colbert',
        'backend': backend.name,
        'model': backend.model,
        'device': backend.device,
    }


@app.post('/rerank')
def rerank(payload: RerankRequest) -> list[dict[str, Any]]:
    if not payload.texts:
        return []
    backend = get_backend()
    t0 = time.monotonic()
    try:
        scored = backend.rerank(payload.query, list(payload.texts), truncate=payload.truncate)
    except Exception as e:
        log.exception('rerank failed')
        raise HTTPException(status_code=500, detail=f'rerank failed: {e}') from e
    elapsed_ms = int((time.monotonic() - t0) * 1000)
    log.info('rerank backend=%s n=%d elapsed_ms=%d', backend.name, len(payload.texts), elapsed_ms)
    return [{'index': s.index, 'score': s.score} for s in scored]
