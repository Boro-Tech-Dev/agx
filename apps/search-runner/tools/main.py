from __future__ import annotations

import logging
import os
from typing import Any, Literal

import httpx
from fastapi import FastAPI, HTTPException
from prometheus_fastapi_instrumentator import Instrumentator
from pydantic import BaseModel, Field

log = logging.getLogger(__name__)

app = FastAPI(title='DD Search Runner', version='0.1.0')
Instrumentator(
    should_group_status_codes=True,
    should_instrument_requests_inprogress=True,
).instrument(app).expose(app, include_in_schema=False)


def _web_search_enabled() -> bool:
    return os.getenv('WEB_SEARCH_ENABLED', '1').strip().lower() not in ('0', 'false', 'no', 'off')


def _searxng_base() -> str:
    return (os.getenv('SEARXNG_URL', 'http://searxng:8080') or '').strip().rstrip('/') or 'http://searxng:8080'


def _search_timeout() -> float:
    raw = (os.getenv('WEB_SEARCH_TIMEOUT_SEC', '') or '').strip()
    try:
        return max(5.0, float(raw)) if raw else 15.0
    except ValueError:
        return 15.0


def _max_results() -> int:
    raw = (os.getenv('WEB_SEARCH_MAX_RESULTS', '') or '').strip()
    try:
        return max(1, min(20, int(raw))) if raw else 10
    except ValueError:
        return 10


class WebSearchPayload(BaseModel):
    query: str = Field(..., min_length=1, max_length=500)
    pageno: int = Field(default=1, ge=1, le=20)
    time_range: Literal['day', 'month', 'year'] | None = None
    language: str = Field(default='all', max_length=16)
    safesearch: int | None = Field(default=None, ge=0, le=2)
    max_results: int | None = Field(default=None, ge=1, le=20)


@app.get('/health')
def health():
    return {
        'ok': True,
        'version': '0.1.0',
        'web_search_enabled': _web_search_enabled(),
        'searxng_url': _searxng_base(),
        'max_results_default': _max_results(),
    }


@app.post('/tools/web/search')
async def web_search(payload: WebSearchPayload):
    if not _web_search_enabled():
        raise HTTPException(status_code=403, detail='web search disabled (WEB_SEARCH_ENABLED=0)')

    base = _searxng_base()
    url = f'{base}/search'
    params: dict[str, str] = {
        'q': payload.query.strip(),
        'format': 'json',
        'pageno': str(payload.pageno),
    }
    if payload.time_range:
        params['time_range'] = payload.time_range
    if payload.language and payload.language != 'all':
        params['language'] = payload.language
    if payload.safesearch is not None:
        params['safesearch'] = str(payload.safesearch)

    headers: dict[str, str] = {'User-Agent': 'agent-x-search-runner/0.1'}
    user = (os.getenv('SEARXNG_AUTH_USERNAME', '') or '').strip()
    pwd = (os.getenv('SEARXNG_AUTH_PASSWORD', '') or '').strip()
    auth = httpx.BasicAuth(user, pwd) if user and pwd else None

    timeout = httpx.Timeout(_search_timeout(), connect=min(10.0, _search_timeout()))
    try:
        async with httpx.AsyncClient(timeout=timeout, headers=headers, auth=auth) as client:
            res = await client.get(url, params=params)
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f'searxng unreachable: {e}') from e

    if res.status_code == 403:
        raise HTTPException(
            status_code=502,
            detail={
                'error': 'searxng_json_disabled',
                'hint': 'Enable search.formats json in infra/searxng/settings.yml and restart searxng',
                'body': (res.text or '')[:800],
            },
        )
    if res.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail={'error': 'searxng_error', 'status': res.status_code, 'body': (res.text or '')[:800]},
        )

    try:
        data = res.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f'searxng invalid json: {e}') from e

    raw_results = data.get('results') if isinstance(data, dict) else None
    if not isinstance(raw_results, list):
        raise HTTPException(status_code=502, detail='searxng response missing results array')

    cap = payload.max_results if payload.max_results is not None else _max_results()
    results: list[dict[str, Any]] = []
    for row in raw_results[:cap]:
        if not isinstance(row, dict):
            continue
        snippet = (row.get('content') or row.get('snippet') or '')[:500]
        results.append(
            {
                'title': (row.get('title') or '')[:300],
                'url': (row.get('url') or '')[:2000],
                'snippet': snippet,
                'score': float(row.get('score') or 0),
                'source_engine': (row.get('engine') or row.get('engines') or ''),
            }
        )

    return {
        'query': payload.query.strip(),
        'pageno': payload.pageno,
        'count': len(results),
        'results': results,
        'searxng_url': base,
    }
