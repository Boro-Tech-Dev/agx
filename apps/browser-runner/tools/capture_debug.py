"""Failure artifacts (screenshot + Playwright trace) and structured logging."""

from __future__ import annotations

import base64
import logging
import os
import tempfile
from typing import Any
from urllib.parse import urlparse

from fastapi import HTTPException
from playwright.async_api import BrowserContext, Page

from .browser_engine import browser_engine_name
from .capture_options import debug_artifact_max_bytes, debug_on_failure_enabled

log = logging.getLogger(__name__)


def resolve_debug(request_flag: bool) -> bool:
    return debug_on_failure_enabled(request_flag)


async def start_tracing(context: BrowserContext) -> bool:
    try:
        await context.tracing.start(screenshots=True, snapshots=True)
        return True
    except Exception:
        log.warning('tracing.start failed', exc_info=True)
        return False


async def collect_failure_artifacts(
    page: Page | None,
    context: BrowserContext | None,
    *,
    tracing_started: bool,
) -> dict[str, Any]:
    cap = debug_artifact_max_bytes()
    out: dict[str, Any] = {}
    if page is not None:
        try:
            out['final_url'] = page.url
        except Exception:
            pass
        try:
            png = await page.screenshot(type='png', timeout=15_000, animations='disabled')
            if len(png) > cap:
                png = png[:cap]
            out['screenshot_base64'] = base64.standard_b64encode(png).decode('ascii')
        except Exception:
            log.debug('failure screenshot unavailable', exc_info=True)

    if tracing_started and context is not None:
        fd, path = tempfile.mkstemp(suffix='.zip', prefix='web-capture-trace-')
        os.close(fd)
        try:
            await context.tracing.stop(path=path)
            with open(path, 'rb') as f:
                data = f.read(cap + 1)[:cap]
            out['trace_base64'] = base64.standard_b64encode(data).decode('ascii')
        except Exception:
            log.debug('failure trace unavailable', exc_info=True)
        finally:
            try:
                os.unlink(path)
            except OSError:
                pass
    return out


def log_capture_failure(
    op: str,
    *,
    url: str,
    exc: BaseException,
    overlay_clicks: int | None = None,
    **extra: Any,
) -> None:
    host = ''
    try:
        host = urlparse(url).hostname or ''
    except Exception:
        pass
    fields: dict[str, Any] = {
        'op': op,
        'url_host': host,
        'engine': browser_engine_name(),
        'error_type': type(exc).__name__,
        'error': str(exc)[:500],
    }
    if overlay_clicks is not None:
        fields['overlay_clicks'] = overlay_clicks
    fields.update(extra)
    log.warning('web_capture_failed', extra=fields)


def http_exception_with_debug(
    status_code: int,
    message: str,
    debug: dict[str, Any] | None,
) -> HTTPException:
    if debug:
        return HTTPException(status_code=status_code, detail={'detail': message, 'debug': debug})
    return HTTPException(status_code=status_code, detail=message)


async def enrich_http_exception(
    exc: HTTPException,
    page: Page | None,
    context: BrowserContext | None,
    *,
    tracing_started: bool,
    op: str,
    url: str,
) -> HTTPException:
    if exc.status_code != 502:
        return exc
    detail = exc.detail
    if isinstance(detail, dict) and detail.get('debug'):
        return exc
    debug = await collect_failure_artifacts(page, context, tracing_started=tracing_started)
    log_capture_failure(op, url=url, exc=Exception(str(detail)))
    msg = detail if isinstance(detail, str) else str(detail)
    return http_exception_with_debug(502, msg, debug or None)
