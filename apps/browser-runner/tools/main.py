from __future__ import annotations

import base64
import json
import logging
from contextlib import asynccontextmanager
from typing import Any
from urllib.parse import urljoin

import httpx
import trafilatura
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from playwright.async_api import Browser, async_playwright
from prometheus_client import Counter
from prometheus_fastapi_instrumentator import Instrumentator

from .browser_engine import browser_engine_name, launch_browser
from .capture_helpers import (
    BrowserStagingOptions,
    playwright_capture_flow,
    playwright_pdf_bytes,
    playwright_screenshot_bytes,
)
from .capture_debug import log_capture_failure
from .crawl_execute import crawl_iterate, crawl_iterate_events
from .interaction_plan import interaction_plan_max_steps
from .ssrf import validate_public_http_url
from .web_payloads import (
    HTTP_TIMEOUT_SEC,
    MAX_CRAWL_ARTICLE_CHARS,
    MAX_CRAWL_DEPTH,
    MAX_CRAWL_PAGES,
    MAX_CRAWL_SECONDS,
    MAX_TEXT_RESPONSE_CHARS,
    NAV_TIMEOUT_MS,
    CrawlPayload,
    ExtractPayload,
    PdfPayload,
    ScreenshotPayload,
)

log = logging.getLogger(__name__)

WEB_CAPTURE_FAILURES = Counter(
    'web_capture_failures_total',
    'Web capture operations that returned HTTP 502',
    ['op', 'engine'],
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    playwright = await async_playwright().start()
    browser = await launch_browser(playwright)
    app.state.playwright = playwright
    app.state.browser = browser
    app.state.browser_engine = browser_engine_name()
    log.info('playwright %s ready', app.state.browser_engine)
    yield
    await browser.close()
    await playwright.stop()
    log.info('playwright stopped')


app = FastAPI(title='DD Browser Runner', version='0.4.0', lifespan=lifespan)
Instrumentator(
    should_group_status_codes=True,
    should_instrument_requests_inprogress=True,
).instrument(app).expose(app, include_in_schema=False)


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException) -> JSONResponse:
    if isinstance(exc.detail, dict):
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return JSONResponse(status_code=exc.status_code, content={'detail': exc.detail})


def _browser(req: Request) -> Browser:
    b = getattr(req.app.state, 'browser', None)
    if b is None:
        raise HTTPException(status_code=503, detail='browser not initialized')
    return b


def _engine(req: Request) -> str:
    return getattr(req.app.state, 'browser_engine', None) or browser_engine_name()


def _httpx_basic_auth(staging: BrowserStagingOptions) -> httpx.Auth | None:
    if not staging.http_credentials:
        return None
    return httpx.BasicAuth(staging.http_credentials.username, staging.http_credentials.password)


def _attach_interactives(out: dict[str, Any], interactives: dict[str, Any] | None) -> None:
    if interactives is not None:
        out['interactives'] = interactives['items']
        out['interactives_truncated'] = interactives['truncated']


def _attach_har(out: dict[str, Any], har_b64: str | None) -> None:
    if har_b64:
        out['har_base64'] = har_b64


async def _safe_httpx_get(url: str, auth: httpx.Auth | None = None) -> httpx.Response:
    timeout = httpx.Timeout(HTTP_TIMEOUT_SEC, connect=min(15.0, HTTP_TIMEOUT_SEC))
    headers = {'User-Agent': 'agent-x-browser-runner/0.4'}
    async with httpx.AsyncClient(timeout=timeout, headers=headers, auth=auth) as client:
        current = validate_public_http_url(url)
        for _ in range(10):
            res = await client.get(current, follow_redirects=False)
            if res.status_code in (301, 302, 303, 307, 308):
                loc = res.headers.get('location')
                if not loc:
                    return res
                current = urljoin(current, loc)
                validate_public_http_url(current)
                continue
            return res
        raise HTTPException(status_code=400, detail='too many redirects')


@app.get('/health')
def health(request: Request):
    return {
        'ok': True,
        'version': '0.4.0',
        'browser_engine': _engine(request),
        'nav_timeout_ms': NAV_TIMEOUT_MS,
        'max_crawl_pages': MAX_CRAWL_PAGES,
        'max_crawl_depth': MAX_CRAWL_DEPTH,
        'max_crawl_seconds': MAX_CRAWL_SECONDS,
        'max_crawl_article_chars': MAX_CRAWL_ARTICLE_CHARS,
        'max_text_response_chars': MAX_TEXT_RESPONSE_CHARS,
        'interaction_plan_max_steps': interaction_plan_max_steps(),
    }


@app.post('/tools/web/screenshot')
async def web_screenshot(payload: ScreenshotPayload, request: Request):
    url = validate_public_http_url(payload.url)
    browser = _browser(request)
    viewport = {'width': payload.viewport_width, 'height': payload.viewport_height}
    try:
        png, final_url, overlay_clicks, interactives, har = await playwright_screenshot_bytes(
            browser,
            target_url=url,
            viewport=viewport,
            staging=payload.staging,
            full_page=payload.full_page,
            device_scale_factor=payload.device_scale_factor,
            omit_background=payload.omit_background,
            include_interactives=payload.include_interactives,
            interaction_plan=payload.interaction_plan,
            capture_options=payload.capture_options(),
        )
    except HTTPException as exc:
        if exc.status_code == 502:
            WEB_CAPTURE_FAILURES.labels(op='screenshot', engine=_engine(request)).inc()
        raise
    except Exception as e:
        log_capture_failure('screenshot', url=url, exc=e)
        WEB_CAPTURE_FAILURES.labels(op='screenshot', engine=_engine(request)).inc()
        raise HTTPException(status_code=502, detail=f'screenshot failed: {e!s}') from e

    b64 = base64.standard_b64encode(png).decode('ascii')
    out: dict[str, Any] = {
        'url': url,
        'final_url': final_url,
        'format': 'png',
        'image_base64': b64,
        'full_page': payload.full_page,
        'device_scale_factor': payload.device_scale_factor,
        'omit_background': payload.omit_background,
        'overlay_clicks_attempted': overlay_clicks,
    }
    _attach_interactives(out, interactives)
    _attach_har(out, har)
    return out


@app.post('/tools/web/pdf')
async def web_pdf(payload: PdfPayload, request: Request):
    url = validate_public_http_url(payload.url)
    browser = _browser(request)
    viewport = {'width': payload.viewport_width, 'height': payload.viewport_height}
    try:
        pdf, final_url, overlay_clicks, interactives, har = await playwright_pdf_bytes(
            browser,
            target_url=url,
            viewport=viewport,
            staging=payload.staging,
            pdf_format=payload.format,
            print_background=payload.print_background,
            include_interactives=payload.include_interactives,
            interaction_plan=payload.interaction_plan,
            capture_options=payload.capture_options(),
        )
    except HTTPException as exc:
        if exc.status_code == 502:
            WEB_CAPTURE_FAILURES.labels(op='pdf', engine=_engine(request)).inc()
        raise
    except Exception as e:
        log_capture_failure('pdf', url=url, exc=e)
        WEB_CAPTURE_FAILURES.labels(op='pdf', engine=_engine(request)).inc()
        raise HTTPException(status_code=502, detail=f'pdf failed: {e!s}') from e

    out: dict[str, Any] = {
        'url': url,
        'final_url': final_url,
        'format': 'pdf',
        'pdf_base64': base64.standard_b64encode(pdf).decode('ascii'),
        'page_format': payload.format,
        'print_background': payload.print_background,
        'overlay_clicks_attempted': overlay_clicks,
    }
    _attach_interactives(out, interactives)
    _attach_har(out, har)
    return out


@app.post('/tools/web/extract')
async def web_extract(payload: ExtractPayload, request: Request):
    url = validate_public_http_url(payload.url)
    if not payload.render_js:
        try:
            res = await _safe_httpx_get(url, auth=_httpx_basic_auth(payload.staging))
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=502, detail=f'fetch failed: {e!s}') from e
        if res.status_code >= 400:
            raise HTTPException(status_code=502, detail=f'http {res.status_code}')
        html = res.text
        extracted = trafilatura.extract(html, url=url, include_comments=False, include_tables=False)
        text = (extracted or '').strip()
        if not text:
            text = trafilatura.extract(html, url=url, favor_precision=False) or ''
            text = text.strip()
        title = ''
        meta = trafilatura.extract_metadata(html)
        if meta and meta.title:
            title = meta.title.strip()
        truncated = len(text) > MAX_TEXT_RESPONSE_CHARS
        out = text[:MAX_TEXT_RESPONSE_CHARS]
        return {
            'url': url,
            'final_url': str(res.request.url) if res.request else url,
            'title': title,
            'text': out,
            'render_js': False,
            'truncated': truncated,
            'overlay_clicks_attempted': 0,
        }

    browser = _browser(request)
    try:
        _, final_url, title, body, overlay_clicks, interactives, har = await playwright_capture_flow(
            browser,
            target_url=url,
            viewport={'width': 1280, 'height': 720},
            staging=payload.staging,
            screenshot_full_page=None,
            article_extract=True,
            include_interactives=payload.include_interactives,
            interaction_plan=payload.interaction_plan,
            capture_options=payload.capture_options(),
        )
    except HTTPException as exc:
        if exc.status_code == 502:
            WEB_CAPTURE_FAILURES.labels(op='extract', engine=_engine(request)).inc()
        raise
    except Exception as e:
        log_capture_failure('extract', url=url, exc=e)
        WEB_CAPTURE_FAILURES.labels(op='extract', engine=_engine(request)).inc()
        raise HTTPException(status_code=502, detail=f'extract failed: {e!s}') from e

    body = body.strip()
    truncated = len(body) > MAX_TEXT_RESPONSE_CHARS
    out_text = body[:MAX_TEXT_RESPONSE_CHARS]
    ex: dict[str, Any] = {
        'url': url,
        'final_url': final_url,
        'title': title,
        'text': out_text,
        'render_js': True,
        'truncated': truncated,
        'overlay_clicks_attempted': overlay_clicks,
    }
    _attach_interactives(ex, interactives)
    _attach_har(ex, har)
    return ex


@app.post('/tools/web/crawl')
async def web_crawl(payload: CrawlPayload, request: Request):
    browser = _browser(request)
    return await crawl_iterate(browser, payload, on_event=None)


@app.post('/tools/web/crawl-stream')
async def web_crawl_stream(payload: CrawlPayload, request: Request):
    browser = _browser(request)

    async def ndjson_body():
        try:
            async for ev in crawl_iterate_events(browser, payload):
                yield (json.dumps(ev, ensure_ascii=False, default=str) + '\n').encode('utf-8')
        except Exception as e:
            log.exception('crawl-stream encode')
            line = json.dumps({'type': 'fatal', 'error': str(e)[:500]}, ensure_ascii=False) + '\n'
            yield line.encode('utf-8')

    return StreamingResponse(ndjson_body(), media_type='application/x-ndjson')
