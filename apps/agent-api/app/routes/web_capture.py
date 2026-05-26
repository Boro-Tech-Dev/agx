import os

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

router = APIRouter(prefix='/api/web', tags=['web-capture'])


def _browser_runner_url() -> str:
    return os.getenv('BROWSER_RUNNER_URL', 'http://browser-runner:8094').strip().rstrip('/') or 'http://browser-runner:8094'


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
    return f'browser-runner: {(response.text or "")[:4000]}'


async def _proxy_get(path: str, timeout: float) -> dict:
    url = f'{_browser_runner_url()}{path}'
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            res = await client.get(url)
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f'browser-runner unreachable: {e}') from e
    try:
        res.raise_for_status()
    except httpx.HTTPStatusError as e:
        raise HTTPException(e.response.status_code, detail=_runner_error_detail(e.response)) from e
    return res.json()


async def _proxy_post(path: str, payload: dict, timeout: float) -> dict:
    url = f'{_browser_runner_url()}{path}'
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            res = await client.post(url, json=payload)
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f'browser-runner unreachable: {e}') from e
    try:
        res.raise_for_status()
    except httpx.HTTPStatusError as e:
        raise HTTPException(e.response.status_code, detail=_runner_error_detail(e.response)) from e
    return res.json()


@router.get('/health')
async def web_health():
    """Crawl limits, browser engine, and runner version (proxied from browser-runner)."""
    return await _proxy_get('/health', timeout=10.0)


@router.post('/crawl-stream')
async def web_crawl_stream(payload: dict):
    """NDJSON crawl progress + final `done` line (same payload as `/crawl`)."""
    url = f'{_browser_runner_url()}/tools/web/crawl-stream'
    sec = _proxy_timeout('WEB_PROXY_CRAWL_TIMEOUT_SEC', 900.0)
    timeout = httpx.Timeout(sec, connect=min(30.0, sec))

    async def stream():
        async with httpx.AsyncClient(timeout=timeout) as client:
            try:
                async with client.stream('POST', url, json=payload) as r:
                    if r.status_code >= 400:
                        body = (await r.aread()).decode('utf-8', errors='replace')[:4000]
                        raise HTTPException(r.status_code, f'browser-runner: {body}')
                    async for chunk in r.aiter_bytes():
                        if chunk:
                            yield chunk
            except httpx.RequestError as e:
                raise HTTPException(status_code=502, detail=f'browser-runner unreachable: {e}') from e

    return StreamingResponse(stream(), media_type='application/x-ndjson')


@router.post('/screenshot')
async def web_screenshot(payload: dict):
    return await _proxy_post(
        '/tools/web/screenshot',
        payload,
        timeout=_proxy_timeout('WEB_PROXY_SCREENSHOT_TIMEOUT_SEC', 300.0),
    )


@router.post('/pdf')
async def web_pdf(payload: dict):
    return await _proxy_post(
        '/tools/web/pdf',
        payload,
        timeout=_proxy_timeout('WEB_PROXY_SCREENSHOT_TIMEOUT_SEC', 300.0),
    )


@router.post('/extract')
async def web_extract(payload: dict):
    return await _proxy_post(
        '/tools/web/extract',
        payload,
        timeout=_proxy_timeout('WEB_PROXY_EXTRACT_TIMEOUT_SEC', 300.0),
    )


@router.post('/crawl')
async def web_crawl(payload: dict):
    return await _proxy_post(
        '/tools/web/crawl',
        payload,
        timeout=_proxy_timeout('WEB_PROXY_CRAWL_TIMEOUT_SEC', 900.0),
    )
