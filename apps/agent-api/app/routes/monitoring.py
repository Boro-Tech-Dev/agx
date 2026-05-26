import asyncio
import os

import httpx
from fastapi import APIRouter

from ..db import fetch, fetch_one
from ..services.common import (
    DEAD_QUEUE,
    DOCUMENT_INGEST_PROCESSING_QUEUE,
    DOCUMENT_INGEST_QUEUE,
    PROCESSING_QUEUE,
    RUN_QUEUE,
    rconn,
)
from ..services.ingest_processing_reconcile import get_ingest_reconcile_last_result
from ..services.processing_reconcile import get_reconcile_last_result

router = APIRouter(prefix='/api/monitoring', tags=['monitoring'])
AGENT_WORKER_URL = os.getenv('AGENT_WORKER_URL', 'http://agent-worker:8091')
INGESTION_WORKER_DEFAULT = os.getenv('INGESTION_WORKER_URL', 'http://ingestion-worker:8092')
SCENARIO_WORKER_DEFAULT = os.getenv('SCENARIO_WORKER_URL', 'http://scenario-worker:8093')
VEEVA_SUITE_WORKER_DEFAULT = (
    os.getenv('VEEVA_SUITE_WORKER_URL', 'http://veeva-suite-worker:4317').strip().rstrip('/')
    or 'http://veeva-suite-worker:4317'
)
BROWSER_RUNNER_DEFAULT = os.getenv('BROWSER_RUNNER_URL', 'http://browser-runner:8094').strip().rstrip('/') or 'http://browser-runner:8094'
MODEL_ROUTER_DEFAULT = os.getenv('MODEL_ROUTER_URL', 'http://model-router:8085').strip().rstrip('/') or 'http://model-router:8085'


def _split_urls(env_key: str, fallback: str) -> list[str]:
    raw = os.getenv(env_key, '').strip()
    if raw:
        return [u.strip().rstrip('/') for u in raw.split(',') if u.strip()]
    return [fallback.rstrip('/')]


def _cloud_usd_per_1k_tokens() -> float:
    """Hypothetical blended cloud price per 1K tokens (for local-vs-cloud savings display only)."""
    raw = (os.getenv('CLOUD_LLM_USD_PER_1K_TOKENS', '') or '').strip()
    if not raw:
        return 0.00025
    try:
        return max(0.0, float(raw))
    except ValueError:
        return 0.0


async def _probe_health_urls(urls: list[str], health_path: str = '/health') -> list[dict]:
    path = health_path if health_path.startswith('/') else f'/{health_path}'

    async def one(client: httpx.AsyncClient, base: str) -> dict:
        u = f'{base.rstrip("/")}{path}'
        try:
            resp = await client.get(u)
            resp.raise_for_status()
            return {'url': base, 'ok': True, 'health': resp.json()}
        except Exception as e:
            return {'url': base, 'ok': False, 'error': str(e)}

    async with httpx.AsyncClient(timeout=5) as client:
        return list(await asyncio.gather(*[one(client, b) for b in urls]))


@router.get('/queues')
async def queue_monitoring():
    r = rconn()
    pending = r.llen(RUN_QUEUE)
    processing = r.llen(PROCESSING_QUEUE)
    dead = r.llen(DEAD_QUEUE)
    try:
        ingest_pending = r.llen(DOCUMENT_INGEST_QUEUE)
    except Exception:
        ingest_pending = -1
    try:
        ingest_processing = r.llen(DOCUMENT_INGEST_PROCESSING_QUEUE)
    except Exception:
        ingest_processing = -1

    agent_bases = _split_urls('AGENT_WORKER_URLS', AGENT_WORKER_URL)
    samples = max(1, min(32, int(os.getenv('AGENT_WORKER_HEALTH_SAMPLES', '1'))))
    if len(agent_bases) == 1 and samples > 1:
        probe_agent_urls = agent_bases * samples
    else:
        probe_agent_urls = agent_bases
    workers = await _probe_health_urls(probe_agent_urls)

    ingest_bases = _split_urls('INGESTION_WORKER_URLS', INGESTION_WORKER_DEFAULT)
    ingestion_workers = await _probe_health_urls(ingest_bases)

    scenario_bases = _split_urls('SCENARIO_WORKER_URLS', SCENARIO_WORKER_DEFAULT)
    scenario_workers = await _probe_health_urls(scenario_bases)

    veeva_suite_bases = _split_urls('VEEVA_SUITE_WORKER_URLS', VEEVA_SUITE_WORKER_DEFAULT)
    veeva_suite_workers = await _probe_health_urls(veeva_suite_bases, '/api/health')

    browser_bases = _split_urls('BROWSER_RUNNER_URLS', BROWSER_RUNNER_DEFAULT)
    browser_workers = await _probe_health_urls(browser_bases, '/health')

    model_router_bases = _split_urls('MODEL_ROUTER_URLS', MODEL_ROUTER_DEFAULT)
    model_router_workers = await _probe_health_urls(model_router_bases, '/health')

    any_agent_ok = any(w.get('ok') for w in workers)
    first_ok = next((w for w in workers if w.get('ok')), None)
    first_err = next((w for w in workers if not w.get('ok')), None)

    worker_legacy = first_ok['health'] if first_ok else None
    worker_error_legacy = None if any_agent_ok else (first_err or {}).get('error', 'all worker probes failed')

    runs_by_status = fetch(
        'select status, count(*)::int as n from agent_runs group by status order by status'
    )
    recent_queued = fetch(
        """select id::text, agent_key, status, title, created_at
        from agent_runs where status in ('queued','running')
        order by created_at desc limit 20"""
    )

    llm_usage: dict[str, float | int] | None = None
    try:
        row = fetch_one(
            """
            select
              coalesce(sum((payload->>'prompt_tokens')::bigint), 0)::bigint as prompt_tokens,
              coalesce(sum((payload->>'completion_tokens')::bigint), 0)::bigint as completion_tokens,
              coalesce(sum((payload->>'total_tokens')::bigint), 0)::bigint as total_tokens
            from run_events
            where event_type = 'model.router.completed'
            """
        )
        if row and isinstance(row, dict):
            pt = int(row.get('prompt_tokens') or 0)
            ct = int(row.get('completion_tokens') or 0)
            tot = int(row.get('total_tokens') or 0)
            usd_per_1k = _cloud_usd_per_1k_tokens()
            estimated = round((tot / 1000.0) * usd_per_1k, 4) if tot else 0.0
            llm_usage = {
                'prompt_tokens': pt,
                'completion_tokens': ct,
                'total_tokens': tot,
                'estimated_savings_usd': estimated,
                'usd_per_1k_tokens': usd_per_1k,
            }
    except Exception:
        llm_usage = None

    return {
        'queues': {
            'pending_length': pending,
            'processing_length': processing,
            'dead_letter_length': dead,
            'pending_name': RUN_QUEUE,
            'processing_name': PROCESSING_QUEUE,
            'dead_name': DEAD_QUEUE,
            'ingest_pending_length': ingest_pending,
            'ingest_pending_name': DOCUMENT_INGEST_QUEUE,
            'ingest_processing_length': ingest_processing,
            'ingest_processing_name': DOCUMENT_INGEST_PROCESSING_QUEUE,
        },
        'workers': workers,
        'ingestion_workers': ingestion_workers,
        'scenario_workers': scenario_workers,
        'veeva_suite_workers': veeva_suite_workers,
        'browser_workers': browser_workers,
        'model_router_workers': model_router_workers,
        'worker': worker_legacy,
        'worker_url': agent_bases[0] if agent_bases else AGENT_WORKER_URL,
        'worker_reachable': any_agent_ok,
        'worker_error': worker_error_legacy,
        'runs_by_status': runs_by_status,
        'active_runs': recent_queued,
        'reconcile_last_result': get_reconcile_last_result(),
        'ingest_reconcile_last_result': get_ingest_reconcile_last_result(),
        'llm_usage': llm_usage,
    }
