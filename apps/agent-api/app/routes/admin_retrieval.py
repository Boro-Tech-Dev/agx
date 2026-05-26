"""Admin: per-agent retrieval config + embedding backfill."""

from __future__ import annotations

import asyncio
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any, Literal

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from ..services import embedding_store, retrieval_config_service

router = APIRouter(prefix='/api/admin/retrieval', tags=['admin-retrieval'])

MODEL_ROUTER_URL = os.getenv('MODEL_ROUTER_URL', 'http://model-router:8085').rstrip('/') or 'http://model-router:8085'


class AgentRetrievalUpdate(BaseModel):
    embedder_id: str
    reranker_id: str
    top_k_retrieve: int = Field(default=60, ge=5, le=200)
    top_k_rerank: int = Field(default=12, ge=1, le=50)
    updated_by: str | None = None


class EmbedBackfillRequest(BaseModel):
    embedder_id: str
    source_type: Literal['document_chunk', 'memory', 'all'] = 'all'
    dry_run: bool = False
    batch_size: int = Field(default=20, ge=1, le=100)
    max_batches: int = Field(default=500, ge=1, le=5000)


@router.get('/agents')
def list_agents():
    embedders = retrieval_config_service.list_embedder_catalog()
    rerankers = retrieval_config_service.list_reranker_catalog()
    agents = retrieval_config_service.list_agent_retrieval_configs()
    missing = {e['embedder_id']: embedding_store.count_missing_embeddings(e['embedder_id']) for e in embedders}
    return {'agents': agents, 'embedders': embedders, 'rerankers': rerankers, 'missing_embeddings': missing}


@router.put('/agents/{agent}')
def update_agent(agent: str, body: AgentRetrievalUpdate):
    if agent not in retrieval_config_service.TOOL_CAPABLE_AGENTS and body.reranker_id not in ('off',):
        pass  # allow reranker on any agent per playground design
    row = retrieval_config_service.upsert_agent_retrieval_config(agent, body.model_dump(), body.updated_by)
    return row


@router.get('/catalog')
async def catalog_proxy():
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            return (await client.get(f'{MODEL_ROUTER_URL}/v1/retrieval/catalog')).json()
    except Exception as e:
        raise HTTPException(502, f'model-router unreachable: {e}') from e


async def _embed_batch(embedder_id: str, items: list[dict[str, Any]]) -> list[tuple[str, list[float], int]]:
    texts = [str(i.get('content') or '')[:6000] for i in items]
    async with httpx.AsyncClient(timeout=120) as client:
        data = (await client.post(f'{MODEL_ROUTER_URL}/v1/embed', json={'input': texts, 'embedder_id': embedder_id})).json()
    if data.get('error'):
        raise RuntimeError(data['error'])
    dim = int(data.get('dim') or 768)
    embs = data.get('embeddings') or []
    out = []
    for i, item in enumerate(items):
        vec = embs[i] if i < len(embs) else []
        if isinstance(vec, list) and vec:
            out.append((str(item['source_id']), vec, dim))
    return out


@router.post('/embed/backfill')
async def embed_backfill(body: EmbedBackfillRequest):
    """SSE stream: data: {json}\\n\\n per batch."""

    async def gen():
        types = ['document_chunk', 'memory'] if body.source_type == 'all' else [body.source_type]
        total_done = 0
        total_skip = 0
        for st in types:
            for batch_n in range(body.max_batches):
                rows = embedding_store.iter_sources_needing_embed(body.embedder_id, st, limit=body.batch_size, offset=0)
                if not rows:
                    break
                if body.dry_run:
                    payload = {'event': 'batch', 'source_type': st, 'count': len(rows), 'dry_run': True}
                    yield f'data: {json.dumps(payload)}\n\n'
                    total_skip += len(rows)
                    if len(rows) < body.batch_size:
                        break
                    continue
                try:
                    embedded = await _embed_batch(body.embedder_id, rows)
                    for sid, vec, dim in embedded:
                        content = next((r['content'] for r in rows if str(r['source_id']) == sid), '')
                        embedding_store.upsert_embedding(
                            source_type=st,
                            source_id=sid,
                            embedder_id=body.embedder_id,
                            dim=dim,
                            content=content,
                            vector=vec,
                        )
                        total_done += 1
                    payload = {'event': 'batch', 'source_type': st, 'embedded': len(embedded), 'requested': len(rows)}
                    yield f'data: {json.dumps(payload)}\n\n'
                except Exception as e:
                    yield f'data: {json.dumps({"event": "error", "message": str(e)[:500]})}\n\n'
                    break
                if len(rows) < body.batch_size:
                    break
                await asyncio.sleep(0.05)
        yield f'data: {json.dumps({"event": "done", "embedded": total_done, "dry_run_count": total_skip})}\n\n'

    return StreamingResponse(gen(), media_type='text/event-stream')


def _repo_root() -> Path:
    here = Path(__file__).resolve()
    for ancestor in here.parents:
        if (ancestor / 'scripts' / 'retrieval_eval.py').is_file():
            return ancestor
    return here.parents[2] if len(here.parents) > 2 else here.parent


_REPO_ROOT = _repo_root()
_ARTIFACT_ROOT = Path(os.getenv('ARTIFACT_ROOT', str(_REPO_ROOT / 'artifacts')))
_EVAL_DIR = _ARTIFACT_ROOT / 'retrieval_eval'


@router.get('/eval/latest')
def eval_latest():
    if not _EVAL_DIR.is_dir():
        return {'markdown': None, 'path': None}
    files = sorted(_EVAL_DIR.glob('*.md'), key=lambda p: p.stat().st_mtime, reverse=True)
    if not files:
        return {'markdown': None, 'path': None}
    latest = files[0]
    return {'markdown': latest.read_text(encoding='utf-8', errors='replace'), 'path': str(latest)}


@router.post('/eval/run')
async def eval_run():
    script = _REPO_ROOT / 'scripts' / 'retrieval_eval.py'
    if not script.is_file():
        raise HTTPException(404, 'scripts/retrieval_eval.py not found')
    _EVAL_DIR.mkdir(parents=True, exist_ok=True)
    proc = await asyncio.to_thread(
        subprocess.run,
        [sys.executable, str(script)],
        cwd=str(_REPO_ROOT),
        capture_output=True,
        text=True,
        timeout=600,
        env={**os.environ, 'RETRIEVAL_EVAL_FIXTURE': str(_REPO_ROOT / 'fixtures' / 'retrieval' / 'queries.jsonl')},
    )
    if proc.returncode != 0:
        raise HTTPException(500, detail=(proc.stderr or proc.stdout or 'eval failed')[:2000])
    latest = eval_latest()
    return {'ok': True, 'stdout': (proc.stdout or '')[-2000:], **latest}
