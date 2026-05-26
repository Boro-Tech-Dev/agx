"""SearXNG deep-fetch: fetch+chunk top-N URLs from browser-runner with cache + budget.

This module does NOT chunk or rerank — it only returns extracted page bodies
(plus a small amount of metadata). Chunking and reranking live in
``worker.web_search_context`` so they can be tested independently.
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from dataclasses import asdict, dataclass
from typing import Any

import httpx

from worker.web_cache import WebCache

log = logging.getLogger(__name__)

BROWSER_RUNNER_URL = (
    os.getenv('BROWSER_RUNNER_URL', 'http://browser-runner:8094').strip().rstrip('/')
    or 'http://browser-runner:8094'
)


def deepfetch_enabled() -> bool:
    return os.getenv('WEB_DEEPFETCH_ENABLED', '0').strip().lower() in ('1', 'true', 'yes', 'on')


def _int_env(name: str, default: int, *, lo: int = 1, hi: int | None = None) -> int:
    raw = (os.getenv(name, '') or '').strip()
    try:
        v = int(raw) if raw else default
    except ValueError:
        v = default
    v = max(lo, v)
    if hi is not None:
        v = min(hi, v)
    return v


def deepfetch_top_urls() -> int:
    return _int_env('WEB_DEEPFETCH_TOP_URLS', 6, lo=1, hi=20)


def deepfetch_concurrency() -> int:
    return _int_env('WEB_DEEPFETCH_CONCURRENCY', 4, lo=1, hi=16)


def deepfetch_per_url_timeout_sec() -> float:
    raw = (os.getenv('WEB_DEEPFETCH_PER_URL_TIMEOUT_SEC', '') or '').strip()
    try:
        v = float(raw) if raw else 8.0
    except ValueError:
        v = 8.0
    return max(1.0, v)


def deepfetch_budget_ms() -> int:
    return _int_env('WEB_DEEPFETCH_BUDGET_MS', 12000, lo=1000, hi=120000)


def deepfetch_min_chars() -> int:
    return _int_env('WEB_DEEPFETCH_MIN_CHARS', 200, lo=0, hi=20000)


def deepfetch_render_js_fallback() -> bool:
    return os.getenv('WEB_DEEPFETCH_RENDER_JS_FALLBACK', '0').strip().lower() in ('1', 'true', 'yes', 'on')


@dataclass
class FetchedPage:
    url: str
    final_url: str
    title: str
    text: str
    source: str  # "live" | "cache" | "skipped"
    rendered_js: bool = False
    error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


async def _extract_via_browser(
    client: httpx.AsyncClient,
    url: str,
    *,
    render_js: bool,
    per_url_timeout_sec: float,
) -> tuple[str, str, str]:
    """Returns (final_url, title, text). Raises on transport / 5xx."""
    res = await client.post(
        f'{BROWSER_RUNNER_URL}/tools/web/extract',
        json={'url': url, 'render_js': render_js},
        timeout=per_url_timeout_sec,
    )
    res.raise_for_status()
    data = res.json() if res.content else {}
    if not isinstance(data, dict):
        return url, '', ''
    return (
        str(data.get('final_url') or url),
        str(data.get('title') or ''),
        str(data.get('text') or ''),
    )


async def _fetch_one(
    sem: asyncio.Semaphore,
    client: httpx.AsyncClient,
    cache: WebCache,
    url: str,
    *,
    per_url_timeout_sec: float,
    min_chars: int,
    render_js_fallback: bool,
) -> FetchedPage:
    async with sem:
        cached = await cache.get(url)
        if cached and isinstance(cached.get('text'), str):
            return FetchedPage(
                url=url,
                final_url=str(cached.get('final_url') or url),
                title=str(cached.get('title') or ''),
                text=str(cached.get('text') or ''),
                source='cache',
                rendered_js=bool(cached.get('rendered_js') or False),
            )
        if await cache.is_host_blocked(url):
            return FetchedPage(
                url=url,
                final_url=url,
                title='',
                text='',
                source='skipped',
                error='host_blocked',
            )
        rendered_js = False
        try:
            final_url, title, text = await _extract_via_browser(
                client, url, render_js=False, per_url_timeout_sec=per_url_timeout_sec
            )
            if render_js_fallback and len(text.strip()) < min_chars:
                rendered_js = True
                final_url, title, text = await _extract_via_browser(
                    client, url, render_js=True, per_url_timeout_sec=per_url_timeout_sec
                )
        except Exception as e:
            await cache.block_host(url)
            return FetchedPage(
                url=url,
                final_url=url,
                title='',
                text='',
                source='skipped',
                error=str(e)[:300],
            )
        page = FetchedPage(
            url=url,
            final_url=final_url,
            title=title,
            text=text,
            source='live',
            rendered_js=rendered_js,
        )
        # Cache only non-empty fetches.
        if text.strip():
            await cache.set(
                url,
                {
                    'text': text,
                    'title': title,
                    'final_url': final_url,
                    'rendered_js': rendered_js,
                    'cached_at': int(time.time()),
                },
            )
        return page


async def deepfetch_urls(
    urls: list[str],
    *,
    cache: WebCache | None = None,
    client: httpx.AsyncClient | None = None,
    concurrency: int | None = None,
    per_url_timeout_sec: float | None = None,
    budget_ms: int | None = None,
    min_chars: int | None = None,
    render_js_fallback: bool | None = None,
) -> list[FetchedPage]:
    """Concurrently fetch URLs through ``browser-runner /tools/web/extract``.

    Returns one ``FetchedPage`` per input URL in input order, even on failure
    (so callers can preserve SearXNG ranking). Pages that didn't return in time
    are emitted with ``source='skipped'`` and ``error='budget_expired'``.
    """
    clean = [u.strip() for u in (urls or []) if isinstance(u, str) and u.strip()]
    if not clean:
        return []

    sem = asyncio.Semaphore(int(concurrency or deepfetch_concurrency()))
    per_url_to = float(per_url_timeout_sec or deepfetch_per_url_timeout_sec())
    budget = float(budget_ms or deepfetch_budget_ms()) / 1000.0
    min_chars_val = int(min_chars if min_chars is not None else deepfetch_min_chars())
    render_fb = render_js_fallback if render_js_fallback is not None else deepfetch_render_js_fallback()
    cache_obj = cache if cache is not None else WebCache()

    own_client = client is None
    if own_client:
        # Per-call (parent) timeout; per-URL timeout is enforced inside _extract_via_browser.
        client = httpx.AsyncClient(timeout=per_url_to + 1.0)

    tasks: dict[asyncio.Task, str] = {}
    try:
        for url in clean:
            task = asyncio.create_task(
                _fetch_one(
                    sem,
                    client,
                    cache_obj,
                    url,
                    per_url_timeout_sec=per_url_to,
                    min_chars=min_chars_val,
                    render_js_fallback=render_fb,
                )
            )
            tasks[task] = url

        done, pending = await asyncio.wait(tasks.keys(), timeout=budget)
        results_by_url: dict[str, FetchedPage] = {}
        for task in done:
            url = tasks[task]
            try:
                results_by_url[url] = task.result()
            except Exception as e:
                results_by_url[url] = FetchedPage(
                    url=url,
                    final_url=url,
                    title='',
                    text='',
                    source='skipped',
                    error=str(e)[:300],
                )
        for task in pending:
            url = tasks[task]
            task.cancel()
            results_by_url[url] = FetchedPage(
                url=url,
                final_url=url,
                title='',
                text='',
                source='skipped',
                error='budget_expired',
            )
        # Best-effort wait for cancellation so we don't leak tasks.
        if pending:
            await asyncio.gather(*pending, return_exceptions=True)
        return [results_by_url[u] for u in clean]
    finally:
        if own_client:
            await client.aclose()
