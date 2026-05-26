"""Indexed crawl: shared iterator for JSON response and NDJSON progress stream."""

from __future__ import annotations

import asyncio
import base64
import logging
import os
from collections import deque
from collections.abc import AsyncIterator
from typing import Any
from urllib.parse import urljoin, urlparse

import trafilatura
from fastapi import HTTPException
from playwright.async_api import Browser

from .capture_helpers import (
    BrowserStagingOptions,
    _apply_page_headers,
    apply_interaction_plan,
    dismiss_overlays_crawl,
    goto_validated,
    open_crawl_session,
    read_har_payload,
)
from .capture_options import crawl_pdf_max_bytes
from .interactives_scan import collect_interactives
from .ssrf import strip_fragment, validate_public_http_url
from .web_payloads import (
    MAX_CRAWL_ARTICLE_CHARS,
    MAX_CRAWL_DEPTH,
    MAX_CRAWL_PAGES,
    MAX_CRAWL_SECONDS,
    MAX_EXCERPT,
    NAV_TIMEOUT_MS,
    CrawlPayload,
)

log = logging.getLogger(__name__)


def _hostname_same_site(seed_url: str, candidate_url: str) -> bool:
    sh = (urlparse(seed_url).hostname or '').lower()
    th = (urlparse(candidate_url).hostname or '').lower()
    if sh.startswith('www.'):
        sh = sh[4:]
    if th.startswith('www.'):
        th = th[4:]
    return bool(sh) and sh == th


_HEADINGS_JS = """() => {
  const nodes = Array.from(document.querySelectorAll('h1, h2, h3'));
  const out = [];
  for (const el of nodes.slice(0, 40)) {
    const t = (el.innerText || '').trim();
    if (t) out.push(t);
  }
  return out;
}"""


def staging_for_crawl(staging: BrowserStagingOptions) -> BrowserStagingOptions:
    return staging.model_copy(update={'form_login': None})


def _gate_dismissal_row(gate_result: Any) -> dict[str, int]:
    return gate_result.to_gate_dismissal_dict()


async def crawl_iterate(
    browser: Browser,
    payload: CrawlPayload,
    *,
    on_event: Any = None,
) -> dict[str, Any]:
    seed = validate_public_http_url(payload.url)
    staging = staging_for_crawl(payload.staging)
    seed_norm = strip_fragment(seed)
    capture_opts = payload.capture_options()

    max_pages = min(payload.max_pages, MAX_CRAWL_PAGES)
    max_depth = min(payload.max_depth, MAX_CRAWL_DEPTH)
    delay_ms = payload.inter_page_delay_ms

    visited: set[str] = set()
    queue: deque[tuple[str, int]] = deque([(seed_norm, 0)])
    pages: list[dict[str, Any]] = []
    seed_har_b64: str | None = None

    async def emit(ev: dict[str, Any]) -> None:
        if on_event is not None:
            await on_event(ev)

    async def run() -> None:
        nonlocal seed_har_b64
        page_seq = 0
        await emit(
            {
                'type': 'started',
                'seed': seed,
                'max_pages': max_pages,
                'max_depth': max_depth,
                'same_site_only': payload.same_site_only,
                'inter_page_delay_ms': delay_ms,
                'include_full_text': payload.include_full_text,
                'include_interactives': payload.include_interactives,
                'include_pdfs': payload.include_pdfs,
                'interaction_plan_steps': len(payload.interaction_plan or []),
                'auto_dismiss_gates': payload.auto_dismiss_gates,
            }
        )
        pdf_cap = crawl_pdf_max_bytes()
        record_har = capture_opts.record_har
        debug_on_failure = capture_opts.debug_on_failure

        async with open_crawl_session(
            browser,
            viewport={'width': 1280, 'height': 720},
            staging=staging,
            record_har=record_har,
            debug_on_failure=debug_on_failure,
        ) as (context, har_path, _tracing):
            while queue and len(pages) < max_pages:
                raw_u, depth = queue.popleft()
                u = strip_fragment(raw_u)
                if u in visited:
                    continue
                if depth > max_depth:
                    continue
                try:
                    validate_public_http_url(u)
                except HTTPException:
                    continue
                if delay_ms > 0 and visited:
                    await asyncio.sleep(delay_ms / 1000.0)
                visited.add(u)
                page_seq += 1
                await emit(
                    {'type': 'page_begin', 'url': u, 'depth': depth, 'index': page_seq, 'visited': len(visited)}
                )

                page = await context.new_page()
                await _apply_page_headers(page, staging)
                try:
                    await goto_validated(page, u, wait_until=staging.wait_until, timeout_ms=NAV_TIMEOUT_MS)
                    gate_result = await dismiss_overlays_crawl(
                        page,
                        staging,
                        delay_cap_ms=5000,
                        auto_dismiss_gates=payload.auto_dismiss_gates or staging.auto_dismiss_gates,
                    )
                    if depth == 0 and u == seed_norm and payload.interaction_plan:
                        await apply_interaction_plan(page, payload.interaction_plan)

                    title = (await page.title()).strip()
                    text = (await page.inner_text('body')).strip()
                    excerpt = text[:MAX_EXCERPT].replace('\n', ' ')
                    headings: list[str] = []
                    try:
                        raw_h = await page.evaluate(_HEADINGS_JS)
                        if isinstance(raw_h, list):
                            headings = [str(h).strip() for h in raw_h if str(h).strip()][:40]
                    except Exception:
                        headings = []

                    article_text = ''
                    article_truncated = False
                    if payload.include_full_text:
                        html = await page.content()
                        extracted = trafilatura.extract(
                            html,
                            url=page.url,
                            include_comments=False,
                            include_tables=True,
                            favor_precision=True,
                        )
                        article_text = (extracted or '').strip()
                        if not article_text:
                            article_text = (
                                trafilatura.extract(html, url=page.url, favor_precision=False) or ''
                            ).strip()
                        if len(article_text) > MAX_CRAWL_ARTICLE_CHARS:
                            article_truncated = True
                            article_text = article_text[:MAX_CRAWL_ARTICLE_CHARS]

                    overlay_clicks = gate_result.overlay_clicks_attempted
                    gate_dict = _gate_dismissal_row(gate_result)

                    row: dict[str, Any] = {
                        'url': u,
                        'depth': depth,
                        'title': title,
                        'excerpt': excerpt,
                        'headings': headings,
                        'final_url': page.url,
                        'overlay_clicks_attempted': overlay_clicks,
                        'gate_dismissal': gate_dict,
                    }
                    if payload.include_full_text:
                        row['article_text'] = article_text
                        row['article_truncated'] = article_truncated
                    if payload.include_interactives:
                        inv = await collect_interactives(page)
                        row['interactives'] = inv['items']
                        row['interactives_truncated'] = inv['truncated']
                    if payload.include_pdfs:
                        try:
                            pdf_raw = await page.pdf(
                                format=payload.pdf_format,
                                print_background=payload.pdf_print_background,
                            )
                            truncated = len(pdf_raw) > pdf_cap
                            if truncated:
                                pdf_raw = pdf_raw[:pdf_cap]
                            row['pdf_base64'] = base64.standard_b64encode(pdf_raw).decode('ascii')
                            row['pdf_format'] = payload.pdf_format
                            row['pdf_truncated'] = truncated
                        except Exception as pdf_exc:
                            row['pdf_error'] = str(pdf_exc)[:180]
                    pages.append(row)
                    page_end_ev: dict[str, Any] = {
                        'type': 'page_end',
                        'url': u,
                        'depth': depth,
                        'index': page_seq,
                        'title': title,
                        'error': None,
                        'overlay_clicks_attempted': overlay_clicks,
                        'gate_dismissal': gate_dict,
                        'pages_completed': len(pages),
                    }
                    if payload.include_interactives:
                        page_end_ev['interactives_count'] = len(row.get('interactives', []))
                        if row.get('interactives_truncated'):
                            page_end_ev['interactives_truncated'] = True
                    if payload.include_pdfs:
                        page_end_ev['has_pdf'] = bool(row.get('pdf_base64'))
                        if row.get('pdf_truncated'):
                            page_end_ev['pdf_truncated'] = True
                        if row.get('pdf_error'):
                            page_end_ev['pdf_error'] = row['pdf_error']
                    await emit(page_end_ev)
                    if depth < max_depth and len(pages) < max_pages:
                        hrefs = await page.eval_on_selector_all(
                            'a[href]',
                            'els => els.map(a => a.href).filter(Boolean)',
                        )
                        for href in hrefs[:80]:
                            if not isinstance(href, str):
                                continue
                            joined = strip_fragment(urljoin(u, href))
                            parsed = urlparse(joined)
                            if parsed.scheme not in ('http', 'https'):
                                continue
                            if payload.same_site_only and not _hostname_same_site(seed, joined):
                                continue
                            try:
                                validate_public_http_url(joined)
                            except HTTPException:
                                continue
                            if joined not in visited:
                                queue.append((joined, depth + 1))
                except Exception as e:
                    err = str(e)[:220]
                    pages.append({'url': u, 'depth': depth, 'error': err})
                    await emit(
                        {
                            'type': 'page_end',
                            'url': u,
                            'depth': depth,
                            'index': page_seq,
                            'title': None,
                            'error': err,
                            'overlay_clicks_attempted': None,
                            'pages_completed': len(pages),
                        }
                    )
                finally:
                    try:
                        await page.close()
                    except Exception:
                        pass

            if har_path:
                seed_har_b64 = read_har_payload(har_path)
                if os.path.isfile(har_path):
                    try:
                        os.unlink(har_path)
                    except OSError:
                        pass

    try:
        await asyncio.wait_for(run(), timeout=MAX_CRAWL_SECONDS)
    except asyncio.TimeoutError:
        pages.append({'url': '', 'depth': -1, 'error': 'crawl stopped: global timeout'})

    result = {
        'seed': seed,
        'same_site_only': payload.same_site_only,
        'max_depth': max_depth,
        'max_pages': max_pages,
        'inter_page_delay_ms': delay_ms,
        'include_full_text': payload.include_full_text,
        'include_interactives': payload.include_interactives,
        'include_pdfs': payload.include_pdfs,
        'pdf_format': payload.pdf_format if payload.include_pdfs else None,
        'auto_dismiss_gates': payload.auto_dismiss_gates,
        'visited_count': len(visited),
        'pages': pages[:max_pages],
    }
    if seed_har_b64:
        result['har_base64'] = seed_har_b64
    await emit({'type': 'done', 'result': result})
    return result


async def crawl_iterate_events(browser: Browser, payload: CrawlPayload) -> AsyncIterator[dict[str, Any]]:
    queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()

    async def on_event(ev: dict[str, Any]) -> None:
        await queue.put(ev)

    async def producer() -> None:
        try:
            await crawl_iterate(browser, payload, on_event=on_event)
        except Exception as e:
            log.exception('crawl failed')
            await queue.put({'type': 'fatal', 'error': str(e)[:500]})
        finally:
            await queue.put(None)

    task = asyncio.create_task(producer())
    try:
        while True:
            ev = await queue.get()
            if ev is None:
                break
            yield ev
    finally:
        await task
