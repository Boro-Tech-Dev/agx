import asyncio
import logging
import os
from contextlib import asynccontextmanager

import httpx
from pydantic import BaseModel, Field

from fastapi import FastAPI, HTTPException, Response
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import CONTENT_TYPE_LATEST, REGISTRY, generate_latest
from prometheus_fastapi_instrumentator import Instrumentator

from .db import fetch
from .agent_queue_metrics import refresh_agent_queue_gauges
from .routes import (
    runs,
    memory,
    ingestion,
    artifacts,
    approvals,
    monitoring,
    hierarchy,
    hierarchy_import,
    projects,
    project_documents,
    tactics,
    calendar,
    scenario,
    web_capture,
    web_search,
    brief_autofill,
    brief_templates,
    veeva_suite,
    ask_clarifier,
    reply_coach,
    learning,
    agent_lanes,
    admin_retrieval,
    model_overview,
)
from .services.ingest_processing_reconcile import run_ingest_processing_reconcile_once
from .services.processing_reconcile import run_reconcile_once

log = logging.getLogger(__name__)


def _processing_reconcile_enabled() -> bool:
    return os.getenv('PROCESSING_RECONCILE_ENABLED', '').lower() in ('1', 'true', 'yes')


def _ingest_reconcile_enabled() -> bool:
    return os.getenv('INGEST_PROCESSING_RECONCILE_ENABLED', '').lower() in ('1', 'true', 'yes')


async def _reconcile_loop():
    interval = max(30, int(os.getenv('PROCESSING_RECONCILE_INTERVAL_SEC', '120')))
    while True:
        try:
            if _processing_reconcile_enabled():
                await asyncio.to_thread(run_reconcile_once)
            if _ingest_reconcile_enabled():
                await asyncio.to_thread(run_ingest_processing_reconcile_once)
        except Exception:
            log.exception('processing reconcile loop')
        await asyncio.sleep(interval)


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = None
    if _processing_reconcile_enabled() or _ingest_reconcile_enabled():
        task = asyncio.create_task(_reconcile_loop())
        parts = []
        if _processing_reconcile_enabled():
            parts.append('agent processing queue')
        if _ingest_reconcile_enabled():
            parts.append('ingest processing queue')
        log.info(
            'Reconcile background task (%s, interval=%ss)',
            ' + '.join(parts) if parts else 'idle',
            int(os.getenv('PROCESSING_RECONCILE_INTERVAL_SEC', '120')),
        )
    yield
    if task:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


app = FastAPI(title='DD Agent API', version='0.6.0', lifespan=lifespan)
origins=[o.strip() for o in os.getenv('CORS_ALLOW_ORIGINS','http://localhost:3000,http://127.0.0.1:3000').split(',') if o.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=['*'], allow_headers=['*'])
Instrumentator(
    should_group_status_codes=True,
    should_instrument_requests_inprogress=True,
).instrument(app)


def _http_base(env_name: str, default: str) -> str:
    v = os.getenv(env_name, '').strip()
    return v if v else default


MODEL_ROUTER_URL = _http_base('MODEL_ROUTER_URL', 'http://model-router:8085')
TOOL_RUNNER_URL = _http_base('TOOL_RUNNER_URL', 'http://tool-runner:8090')


class ModelPullBody(BaseModel):
    model: str = Field(..., min_length=1, max_length=220)

app.include_router(runs.router)
app.include_router(memory.router)
app.include_router(ingestion.router)
app.include_router(artifacts.router)
app.include_router(approvals.router)
app.include_router(monitoring.router)
app.include_router(hierarchy.router)
app.include_router(hierarchy_import.router)
app.include_router(projects.router)
app.include_router(project_documents.router)
app.include_router(tactics.router)
app.include_router(calendar.router)
app.include_router(scenario.router)
app.include_router(web_capture.router)
app.include_router(web_search.router)
app.include_router(brief_autofill.router)
app.include_router(brief_templates.router)
app.include_router(veeva_suite.router)
app.include_router(ask_clarifier.router)
app.include_router(reply_coach.router)
app.include_router(learning.router)
app.include_router(agent_lanes.router)
app.include_router(admin_retrieval.router)
app.include_router(model_overview.router)

@app.get('/health')
def health(): return {'ok':True,'version':'0.6.0','cors_origins':origins}


@app.get('/metrics')
def prometheus_metrics():
    refresh_agent_queue_gauges()
    return Response(generate_latest(REGISTRY), media_type=CONTENT_TYPE_LATEST)
@app.get('/api/agents')
def agents():
    return fetch(
        'select key,name,description,default_model,default_workflow,ui from agents order by key'
    )
@app.get('/api/model/status')
async def model_status():
    try:
        async with httpx.AsyncClient(timeout=20) as client: return (await client.get(f'{MODEL_ROUTER_URL}/v1/models')).json()
    except Exception as e: return {'ok':False,'error':str(e)}


@app.post('/api/model/pull')
async def model_pull(body: ModelPullBody):
    timeout = httpx.Timeout(connect=60.0, read=None, write=60.0, pool=60.0)
    client = httpx.AsyncClient(timeout=timeout)
    try:
        req = client.build_request(
            'POST',
            f'{MODEL_ROUTER_URL}/v1/ollama/pull',
            json={'model': body.model.strip()},
        )
        res = await client.send(req, stream=True)
        if res.status_code >= 400:
            detail = (await res.aread()).decode('utf-8', errors='replace')[:4000]
            await res.aclose()
            await client.aclose()
            raise HTTPException(status_code=res.status_code, detail=detail)

        async def gen():
            try:
                async for chunk in res.aiter_bytes():
                    yield chunk
            finally:
                await res.aclose()
                await client.aclose()

        return StreamingResponse(gen(), media_type='application/x-ndjson')
    except HTTPException:
        raise
    except Exception as e:
        try:
            await client.aclose()
        except Exception:
            pass
        raise HTTPException(status_code=502, detail=str(e)) from e


@app.post('/api/repo/summarize')
async def repo_summarize(payload: dict):
    async with httpx.AsyncClient(timeout=60) as client:
        res = await client.post(f'{TOOL_RUNNER_URL}/tools/repo/summarize', json=payload)
    try:
        res.raise_for_status()
    except httpx.HTTPStatusError as e:
        body = (e.response.text or '')[:4000]
        raise HTTPException(e.response.status_code, f'tool-runner summarize: {body}') from e
    return res.json()


@app.post('/api/repo/search')
async def repo_search(payload: dict):
    async with httpx.AsyncClient(timeout=60) as client:
        res = await client.post(f'{TOOL_RUNNER_URL}/tools/repo/search', json=payload)
    try:
        res.raise_for_status()
    except httpx.HTTPStatusError as e:
        body = (e.response.text or '')[:4000]
        raise HTTPException(e.response.status_code, f'tool-runner search: {body}') from e
    return res.json()
