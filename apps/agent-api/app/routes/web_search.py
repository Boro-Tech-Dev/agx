import os

import httpx
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix='/api/web', tags=['web-search'])


def _search_runner_url() -> str:
    return (
        os.getenv('SEARCH_RUNNER_URL', 'http://search-runner:8092').strip().rstrip('/')
        or 'http://search-runner:8092'
    )


def _proxy_timeout(name: str, default: float) -> float:
    raw = os.getenv(name, '').strip()
    if not raw:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _runner_error_detail(response: httpx.Response) -> str | dict:
    try:
        body = response.json()
        if isinstance(body, dict):
            return body
    except Exception:
        pass
    return f'search-runner: {(response.text or "")[:4000]}'


async def _proxy_post(path: str, payload: dict, timeout: float) -> dict:
    url = f'{_search_runner_url()}{path}'
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            res = await client.post(url, json=payload)
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f'search-runner unreachable: {e}') from e
    try:
        res.raise_for_status()
    except httpx.HTTPStatusError as e:
        raise HTTPException(e.response.status_code, detail=_runner_error_detail(e.response)) from e
    return res.json()


@router.get('/search-health')
async def web_search_health():
    """Search runner version and SearXNG reachability metadata."""
    url = f'{_search_runner_url()}/health'
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(url)
        res.raise_for_status()
        return res.json()
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f'search-runner unreachable: {e}') from e
    except httpx.HTTPStatusError as e:
        raise HTTPException(e.response.status_code, detail=_runner_error_detail(e.response)) from e


@router.post('/search')
async def web_search(payload: dict):
    return await _proxy_post(
        '/tools/web/search',
        payload,
        timeout=_proxy_timeout('WEB_PROXY_SEARCH_TIMEOUT_SEC', 30.0),
    )
