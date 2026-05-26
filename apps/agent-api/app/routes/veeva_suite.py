"""Proxy Veeva Suite ZIP runs (RTE/CLM) to the internal veeva-suite-worker Node service."""

from __future__ import annotations

import os

import httpx
from fastapi import APIRouter, HTTPException, Request, Response

router = APIRouter(prefix='/api/veeva-suite', tags=['veeva-suite'])


def _veeva_suite_worker_url() -> str:
    return (
        os.getenv('VEEVA_SUITE_WORKER_URL', 'http://veeva-suite-worker:4317').strip().rstrip('/')
        or 'http://veeva-suite-worker:4317'
    )


def _proxy_timeout() -> float:
    raw = os.getenv('VEEVA_SUITE_PROXY_TIMEOUT_SEC', '').strip()
    if not raw:
        return 600.0
    try:
        return float(raw)
    except ValueError:
        return 600.0


_HOP_BY_HOP = frozenset(
    {
        'connection',
        'keep-alive',
        'proxy-authenticate',
        'proxy-authorization',
        'te',
        'trailers',
        'transfer-encoding',
        'upgrade',
        'host',
        'content-length',
    }
)


def _forwardable_headers(request: Request) -> dict[str, str]:
    out: dict[str, str] = {}
    for k, v in request.headers.items():
        lk = k.lower()
        if lk in _HOP_BY_HOP:
            continue
        out[k] = v
    return out


def _strip_hop_by_hop(h: dict[str, str]) -> dict[str, str]:
    return {k: v for k, v in h.items() if k.lower() not in _HOP_BY_HOP}


@router.get('/health')
async def veeva_suite_health():
    url = f'{_veeva_suite_worker_url()}/api/health'
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.get(url)
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f'veeva-suite-worker unreachable: {e}') from e
    try:
        res.raise_for_status()
    except httpx.HTTPStatusError as e:
        body = (e.response.text or '')[:4000]
        raise HTTPException(e.response.status_code, f'veeva-suite-worker: {body}') from e
    return res.json()


@router.post('/suite-runs/tokens')
async def veeva_suite_runs_tokens(request: Request):
    url = f'{_veeva_suite_worker_url()}/api/suite-runs/tokens'
    body = await request.body()
    headers = _forwardable_headers(request)
    timeout = httpx.Timeout(connect=30.0, read=120.0, write=300.0, pool=30.0)
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            res = await client.post(url, content=body, headers=headers)
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f'veeva-suite-worker unreachable: {e}') from e
    return Response(content=res.content, status_code=res.status_code, headers=_strip_hop_by_hop(dict(res.headers)))


@router.post('/suite-runs')
async def veeva_suite_runs_post(request: Request):
    url = f'{_veeva_suite_worker_url()}/api/suite-runs'
    body = await request.body()
    headers = _forwardable_headers(request)
    timeout = httpx.Timeout(connect=30.0, read=_proxy_timeout(), write=300.0, pool=30.0)
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            res = await client.post(url, content=body, headers=headers)
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f'veeva-suite-worker unreachable: {e}') from e
    return Response(content=res.content, status_code=res.status_code, headers=_strip_hop_by_hop(dict(res.headers)))


@router.post('/suite-runs/{run_id}/submission')
async def veeva_suite_runs_submission(run_id: str, request: Request):
    url = f'{_veeva_suite_worker_url()}/api/suite-runs/{run_id}/submission'
    body = await request.body()
    headers = _forwardable_headers(request)
    if not any(k.lower() == 'content-type' for k in headers):
        headers['Content-Type'] = 'application/json'
    timeout = httpx.Timeout(connect=30.0, read=_proxy_timeout(), write=300.0, pool=30.0)
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            res = await client.post(url, content=body, headers=headers)
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f'veeva-suite-worker unreachable: {e}') from e
    return Response(content=res.content, status_code=res.status_code, headers=_strip_hop_by_hop(dict(res.headers)))


@router.get('/suite-runs/{run_id}')
async def veeva_suite_runs_get(run_id: str):
    url = f'{_veeva_suite_worker_url()}/api/suite-runs/{run_id}'
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            res = await client.get(url)
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f'veeva-suite-worker unreachable: {e}') from e
    try:
        res.raise_for_status()
    except httpx.HTTPStatusError as e:
        body = (e.response.text or '')[:4000]
        raise HTTPException(e.response.status_code, f'veeva-suite-worker: {body}') from e
    return Response(content=res.content, status_code=res.status_code, headers=_strip_hop_by_hop(dict(res.headers)))


@router.get('/suite-runs/{run_id}/download')
async def veeva_suite_runs_download(run_id: str):
    url = f'{_veeva_suite_worker_url()}/api/suite-runs/{run_id}/download'
    try:
        async with httpx.AsyncClient(timeout=_proxy_timeout()) as client:
            res = await client.get(url)
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f'veeva-suite-worker unreachable: {e}') from e
    try:
        res.raise_for_status()
    except httpx.HTTPStatusError as e:
        body = (e.response.text or '')[:4000]
        raise HTTPException(e.response.status_code, f'veeva-suite-worker: {body}') from e
    return Response(content=res.content, status_code=res.status_code, headers=_strip_hop_by_hop(dict(res.headers)))


@router.api_route('/outputs/{path:path}', methods=['GET', 'HEAD'])
async def veeva_suite_outputs_proxy(path: str, request: Request):
    q = request.url.query
    url = f'{_veeva_suite_worker_url()}/outputs/{path}'
    if q:
        url = f'{url}?{q}'
    headers = _forwardable_headers(request)
    timeout = httpx.Timeout(connect=30.0, read=300.0, write=30.0, pool=30.0)
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
            res = await client.request(request.method, url, headers=headers)
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f'veeva-suite-worker unreachable: {e}') from e
    return Response(content=res.content, status_code=res.status_code, headers=_strip_hop_by_hop(dict(res.headers)))
