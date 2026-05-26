"""Shared Playwright context options, navigation, consent dismissal, and optional form login."""

from __future__ import annotations

import asyncio
import base64
import logging
import os
import tempfile
import time
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator, List, Literal, Optional, Sequence

from fastapi import HTTPException
from pydantic import BaseModel, Field, model_validator
from playwright.async_api import Browser, BrowserContext, Page

from .capture_debug import (
    collect_failure_artifacts,
    enrich_http_exception,
    log_capture_failure,
    resolve_debug,
    start_tracing,
)
from .capture_options import CaptureRequestOptions, har_max_bytes, read_capped_file
from .interactives_scan import collect_interactives
from .interaction_plan import InteractionPlanStep, UPLOAD_MAX_BYTES
from .ssrf import validate_public_http_url

log = logging.getLogger(__name__)

NAV_TIMEOUT_MS = int(os.getenv('WEB_NAV_TIMEOUT_MS', '45000'))
WEB_ALLOW_INSECURE_TLS = os.getenv('WEB_ALLOW_INSECURE_TLS', '').lower() in ('1', 'true', 'yes')

COMMON_CONSENT_SELECTORS: tuple[str, ...] = (
    '#onetrust-accept-btn-handler',
    '#onetrust-close-btn-handler',
    '.onetrust-close-btn-handler',
    '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
    'button[id*="accept-all"]',
    'button[class*="accept-all"]',
    '[data-testid="cookie-accept"]',
    'button:has-text("Accept All")',
    'button:has-text("Accept all")',
    'button:has-text("Accept Cookies")',
    'button:has-text("Allow all cookies")',
    'button:has-text("Allow All")',
    'button:has-text("I agree")',
    'button:has-text("Agree")',
    'button:has-text("OK")',
    'button:has-text("Continue")',
    'button:has-text("Continue to Site")',
    'button:has-text("Continue to site")',
    'button:has-text("Consent")',
    'button:has-text("Confirm")',
    'button:has-text("Yes, I\'m a healthcare professional")',
    '[aria-label*="Accept" i]',
    '[aria-label*="Agree" i]',
    '.trustarc-agree-button',
)

WaitUntil = Literal['load', 'domcontentloaded', 'networkidle']
MAX_EXTRA_SELECTORS = 24
MAX_SELECTOR_LEN = 512
MAX_POST_LOAD_DELAY_MS = 15000
MAX_NETWORK_BLOCK_PATTERNS = 20
MAX_EXTRA_HEADERS = 20
CLICK_TIMEOUT_MS = 2500
OVERLAY_BUDGET_CRAWL_SEC = 12.0


def _playwright_click_intercepted_by_overlay(exc: BaseException) -> bool:
    msg = str(exc).lower()
    return 'intercept' in msg or 'pointer events' in msg


class HttpCredentials(BaseModel):
    username: str = Field(..., min_length=1, max_length=512)
    password: str = Field(default='', max_length=512)


class GeolocationConfig(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


class FormLoginConfig(BaseModel):
    login_url: str | None = Field(None, max_length=4096)
    username_selector: str = Field(..., max_length=MAX_SELECTOR_LEN)
    password_selector: str = Field(..., max_length=MAX_SELECTOR_LEN)
    submit_selector: str | None = Field(None, max_length=MAX_SELECTOR_LEN)
    username: str = Field(..., min_length=1, max_length=512)
    password: str = Field(default='', max_length=512)
    post_submit_wait_until: WaitUntil | None = None
    post_submit_delay_ms: int = Field(default=0, ge=0, le=MAX_POST_LOAD_DELAY_MS)


class BrowserStagingOptions(BaseModel):
    http_credentials: HttpCredentials | None = None
    wait_until: WaitUntil = 'domcontentloaded'
    post_load_delay_ms: int = Field(default=0, ge=0, le=MAX_POST_LOAD_DELAY_MS)
    consent_auto_clicks: bool = False
    auto_dismiss_gates: bool = True
    extra_click_selectors: list[str] = Field(default_factory=list)
    locale: str | None = Field(None, max_length=64)
    timezone_id: str | None = Field(None, max_length=128)
    ignore_https_errors: bool = False
    form_login: FormLoginConfig | None = None
    extra_http_headers: dict[str, str] = Field(default_factory=dict)
    network_block_url_substrings: list[str] = Field(default_factory=list)
    geolocation: GeolocationConfig | None = None

    @model_validator(mode='after')
    def _cap_selectors(self) -> BrowserStagingOptions:
        if len(self.extra_click_selectors) > MAX_EXTRA_SELECTORS:
            raise ValueError(f'at most {MAX_EXTRA_SELECTORS} extra_click_selectors allowed')
        for s in self.extra_click_selectors:
            if len(s) > MAX_SELECTOR_LEN:
                raise ValueError('extra_click_selectors entry too long')
        if len(self.extra_http_headers) > MAX_EXTRA_HEADERS:
            raise ValueError(f'at most {MAX_EXTRA_HEADERS} extra_http_headers allowed')
        for k, v in self.extra_http_headers.items():
            if len(k) > 128 or len(v) > 1024:
                raise ValueError('extra_http_headers key/value too long')
        if len(self.network_block_url_substrings) > MAX_NETWORK_BLOCK_PATTERNS:
            raise ValueError(f'at most {MAX_NETWORK_BLOCK_PATTERNS} network_block_url_substrings allowed')
        for s in self.network_block_url_substrings:
            if len(s) > 200:
                raise ValueError('network_block_url_substrings entry too long')
        return self


def resolve_ignore_https_errors(requested: bool) -> bool:
    if not requested:
        return False
    if not WEB_ALLOW_INSECURE_TLS:
        raise HTTPException(
            status_code=400,
            detail='ignore_https_errors requires WEB_ALLOW_INSECURE_TLS=true on browser-runner',
        )
    return True


def build_new_context_kwargs(
    *,
    viewport: dict[str, int],
    staging: BrowserStagingOptions,
    device_scale_factor: float | None = None,
    record_har_path: str | None = None,
) -> dict[str, Any]:
    kw: dict[str, Any] = {
        'viewport': viewport,
        'ignore_https_errors': resolve_ignore_https_errors(staging.ignore_https_errors),
    }
    if device_scale_factor is not None:
        kw['device_scale_factor'] = device_scale_factor
    if staging.http_credentials:
        kw['http_credentials'] = {
            'username': staging.http_credentials.username,
            'password': staging.http_credentials.password,
        }
    if staging.locale:
        kw['locale'] = staging.locale
    if staging.timezone_id:
        kw['timezone_id'] = staging.timezone_id
    if staging.geolocation:
        kw['geolocation'] = {
            'latitude': staging.geolocation.latitude,
            'longitude': staging.geolocation.longitude,
        }
        kw['permissions'] = ['geolocation']
    if record_har_path:
        kw['record_har_path'] = record_har_path
    return kw


async def _install_network_hooks(context: BrowserContext, staging: BrowserStagingOptions) -> None:
    blocks = [s.strip() for s in staging.network_block_url_substrings if s.strip()]
    if not blocks:
        return

    async def _route_handler(route: Any) -> None:
        req_url = route.request.url
        if any(pat in req_url for pat in blocks):
            await route.abort()
            return
        await route.continue_()

    await context.route('**/*', _route_handler)


async def _apply_page_headers(page: Page, staging: BrowserStagingOptions) -> None:
    if staging.extra_http_headers:
        await page.set_extra_http_headers(staging.extra_http_headers)


def read_har_payload(har_path: str | None) -> str | None:
    if not har_path or not os.path.isfile(har_path):
        return None
    try:
        data = read_capped_file(har_path, max_bytes=har_max_bytes())
        return base64.standard_b64encode(data).decode('ascii')
    except OSError:
        return None


@asynccontextmanager
async def open_crawl_session(
    browser: Browser,
    *,
    viewport: dict[str, int],
    staging: BrowserStagingOptions,
    record_har: bool = False,
    debug_on_failure: bool = False,
) -> AsyncIterator[tuple[BrowserContext, str | None, bool]]:
    """
    One browser context for an entire indexed crawl. Caller opens/closes pages.
    Yields ``(context, har_temp_path, tracing_started)``.
    """
    har_path: str | None = None
    if record_har:
        fd, har_path = tempfile.mkstemp(suffix='.har', prefix='web-capture-')
        os.close(fd)

    kw = build_new_context_kwargs(
        viewport=viewport,
        staging=staging,
        record_har_path=har_path,
    )
    context = await browser.new_context(**kw)
    tracing_started = False
    if resolve_debug(debug_on_failure):
        tracing_started = await start_tracing(context)
    await _install_network_hooks(context, staging)
    try:
        yield context, har_path, tracing_started
    finally:
        if tracing_started:
            try:
                await context.tracing.stop()
            except Exception:
                pass
        await context.close()


@asynccontextmanager
async def open_capture_context(
    browser: Browser,
    *,
    viewport: dict[str, int],
    staging: BrowserStagingOptions,
    device_scale_factor: float | None = None,
    capture_options: CaptureRequestOptions | None = None,
) -> AsyncIterator[tuple[BrowserContext, Page, str | None, bool]]:
    """
    Yield ``(context, page, har_temp_path, tracing_started)``.
    Caller must close context (handled on exit).
    """
    opts = capture_options or CaptureRequestOptions()
    har_path: str | None = None
    if opts.record_har:
        fd, har_path = tempfile.mkstemp(suffix='.har', prefix='web-capture-')
        os.close(fd)

    kw = build_new_context_kwargs(
        viewport=viewport,
        staging=staging,
        device_scale_factor=device_scale_factor,
        record_har_path=har_path,
    )
    context = await browser.new_context(**kw)
    tracing_started = False
    if resolve_debug(opts.debug_on_failure):
        tracing_started = await start_tracing(context)
    await _install_network_hooks(context, staging)
    page = await context.new_page()
    await _apply_page_headers(page, staging)
    try:
        yield context, page, har_path, tracing_started
    finally:
        await context.close()


async def post_load_sleep(delay_ms: int, *, max_ms: int | None = None) -> None:
    ms = min(delay_ms, max_ms) if max_ms is not None else delay_ms
    if ms <= 0:
        return
    await asyncio.sleep(ms / 1000.0)


async def safe_click_first_visible(page: Page, selector: str, timeout_ms: int = CLICK_TIMEOUT_MS) -> bool:
    loc = page.locator(selector).first
    try:
        await loc.click(timeout=timeout_ms)
        return True
    except Exception as e:
        if not _playwright_click_intercepted_by_overlay(e):
            return False
        try:
            await loc.click(force=True, timeout=timeout_ms)
            return True
        except Exception:
            return False


async def dismiss_overlays(
    page: Page,
    staging: BrowserStagingOptions,
    *,
    apply_delay: bool = True,
) -> int:
    from .gate_dismiss import dismiss_page_gates

    result = await dismiss_page_gates(
        page,
        staging,
        apply_delay=apply_delay,
        for_crawl=False,
        auto_dismiss_gates=staging.auto_dismiss_gates,
    )
    return result.overlay_clicks_attempted


async def dismiss_overlays_crawl(
    page: Page,
    staging: BrowserStagingOptions,
    delay_cap_ms: int,
    *,
    auto_dismiss_gates: bool = False,
) -> 'GateDismissResult':
    from .gate_dismiss import GateDismissResult, dismiss_page_gates

    async def _run() -> GateDismissResult:
        return await dismiss_page_gates(
            page,
            staging,
            apply_delay=True,
            delay_cap_ms=delay_cap_ms,
            for_crawl=True,
            auto_dismiss_gates=auto_dismiss_gates,
            click_timeout_ms=1800,
        )

    try:
        return await asyncio.wait_for(_run(), timeout=OVERLAY_BUDGET_CRAWL_SEC)
    except asyncio.TimeoutError:
        log.warning('dismiss_overlays_crawl: budget exceeded')
        return GateDismissResult()


async def goto_validated(page: Page, url: str, *, wait_until: WaitUntil, timeout_ms: int = NAV_TIMEOUT_MS) -> None:
    target = validate_public_http_url(url)
    await page.goto(target, wait_until=wait_until, timeout=timeout_ms)


async def run_form_login_if_configured(
    page: Page,
    *,
    target_url: str,
    staging: BrowserStagingOptions,
    wait_until: WaitUntil,
) -> int:
    form = staging.form_login
    if not form:
        return 0

    login_nav_url = form.login_url.strip() if form.login_url else target_url
    validate_public_http_url(login_nav_url)
    submit_wait: WaitUntil = form.post_submit_wait_until or wait_until

    await goto_validated(page, login_nav_url, wait_until=wait_until)
    login_clicks = await dismiss_overlays(page, staging, apply_delay=True)

    try:
        await page.fill(form.username_selector, form.username, timeout=NAV_TIMEOUT_MS)
        await page.fill(form.password_selector, form.password, timeout=NAV_TIMEOUT_MS)
        if form.submit_selector:
            await page.click(form.submit_selector, timeout=NAV_TIMEOUT_MS)
        else:
            await page.press(form.password_selector, 'Enter')
        await page.wait_for_load_state(submit_wait, timeout=NAV_TIMEOUT_MS)
    except Exception as e:
        log.warning('form_login failed')
        raise HTTPException(status_code=502, detail=f'form login failed: {e!s}') from e

    await post_load_sleep(form.post_submit_delay_ms)

    await goto_validated(page, target_url, wait_until=submit_wait)
    return login_clicks


async def click_interaction_plan_target(page: Page, selector: str, timeout_ms: int) -> None:
    deadline = time.monotonic() + timeout_ms / 1000.0
    last_error: BaseException | None = None
    base = page.locator(selector)
    while time.monotonic() < deadline:
        remaining_ms = max(50, int((deadline - time.monotonic()) * 1000))
        try:
            n = await base.count()
            for i in range(n):
                cand = base.nth(i)
                if not await cand.is_visible():
                    continue
                try:
                    await cand.scroll_into_view_if_needed(timeout=remaining_ms)
                    await cand.click(timeout=remaining_ms)
                    return
                except Exception as click_err:
                    last_error = click_err
                    if _playwright_click_intercepted_by_overlay(click_err):
                        try:
                            await cand.click(force=True, timeout=min(remaining_ms, 10_000))
                            return
                        except Exception as force_err:
                            last_error = force_err
                    continue
            await asyncio.sleep(0.1 if n else 0.05)
        except Exception as e:
            last_error = e
            await asyncio.sleep(0.05)
    tail = f': {last_error!s}' if last_error else ''
    raise TimeoutError(f'no visible, clickable element for selector{tail}') from last_error


async def _run_upload_step(page: Page, step: InteractionPlanStep) -> None:
    assert step.selector and step.file_base64 and step.filename
    raw = base64.standard_b64decode(step.file_base64)
    if len(raw) > UPLOAD_MAX_BYTES:
        raise ValueError('upload payload too large')
    fd, path = tempfile.mkstemp(prefix='web-upload-', suffix=os.path.splitext(step.filename)[1] or '.bin')
    os.close(fd)
    try:
        with open(path, 'wb') as f:
            f.write(raw)
        loc = page.locator(step.selector).first
        await loc.set_input_files(path, timeout=min(NAV_TIMEOUT_MS, 30_000))
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass


async def apply_interaction_plan(page: Page, plan: Optional[Sequence[InteractionPlanStep]]) -> None:
    if not plan:
        return
    click_timeout = min(NAV_TIMEOUT_MS, 30_000)
    for i, step in enumerate(plan):
        if step.action == 'wait_ms':
            assert step.wait_ms is not None
            await asyncio.sleep(step.wait_ms / 1000.0)
            continue
        if step.action == 'upload':
            assert step.selector is not None
            try:
                await _run_upload_step(page, step)
            except Exception as e:
                raise HTTPException(
                    status_code=502,
                    detail=f'interaction_plan step {i + 1} upload failed [{step.selector[:120]}]: {e!s}',
                ) from e
            continue
        assert step.selector is not None
        sel = step.selector
        try:
            await click_interaction_plan_target(page, sel, click_timeout)
        except Exception as e:
            raise HTTPException(
                status_code=502,
                detail=f'interaction_plan step {i + 1} click failed [{sel[:120]}]: {e!s}',
            ) from e


async def _handle_capture_error(
    exc: Exception,
    *,
    op: str,
    url: str,
    page: Page | None,
    context: BrowserContext | None,
    tracing_started: bool,
    debug_enabled: bool,
    overlay_clicks: int = 0,
) -> HTTPException:
    if isinstance(exc, HTTPException):
        if debug_enabled and exc.status_code == 502:
            return await enrich_http_exception(exc, page, context, tracing_started=tracing_started, op=op, url=url)
        return exc
    log_capture_failure(op, url=url, exc=exc, overlay_clicks=overlay_clicks)
    if debug_enabled:
        debug = await collect_failure_artifacts(page, context, tracing_started=tracing_started)
        from .capture_debug import http_exception_with_debug

        return http_exception_with_debug(502, f'{op} failed: {exc!s}', debug or None)
    return HTTPException(status_code=502, detail=f'{op} failed: {exc!s}')


async def playwright_capture_flow(
    browser: Browser,
    *,
    target_url: str,
    viewport: dict[str, int],
    staging: BrowserStagingOptions,
    screenshot_full_page: bool | None = None,
    device_scale_factor: float | None = None,
    omit_background: bool = False,
    article_extract: bool = False,
    include_interactives: bool = False,
    interaction_plan: Optional[List[InteractionPlanStep]] = None,
    capture_options: CaptureRequestOptions | None = None,
    pdf_format: str | None = None,
    pdf_print_background: bool = True,
) -> tuple[bytes | None, str, str, str, int, dict[str, Any] | None, str | None]:
    """
    Returns (bytes_or_none, final_url, title, body_text, overlay_clicks, interactives, har_base64).
    bytes are PNG screenshot, PDF, or None for extract-only.
    """
    opts = capture_options or CaptureRequestOptions()
    debug_enabled = resolve_debug(opts.debug_on_failure)
    overlay_total = 0
    page: Page | None = None
    context: BrowserContext | None = None
    tracing_started = False
    har_path: str | None = None
    result: tuple[bytes | None, str, str, str, int, dict[str, Any] | None] | None = None

    try:
        async with open_capture_context(
            browser,
            viewport=viewport,
            staging=staging,
            device_scale_factor=device_scale_factor,
            capture_options=opts,
        ) as (context, page, har_path, tracing_started):
            try:
                wt = staging.wait_until

                if staging.form_login:
                    overlay_total += await run_form_login_if_configured(
                        page, target_url=target_url, staging=staging, wait_until=wt
                    )
                    overlay_total += await dismiss_overlays(page, staging, apply_delay=False)
                else:
                    await goto_validated(page, target_url, wait_until=wt)
                    overlay_total += await dismiss_overlays(page, staging, apply_delay=True)

                await apply_interaction_plan(page, interaction_plan)

                final_url = page.url
                if pdf_format is not None:
                    interactives_block: dict[str, Any] | None = None
                    if include_interactives:
                        interactives_block = await collect_interactives(page)
                    pdf_bytes = await page.pdf(format=pdf_format, print_background=pdf_print_background)
                    result = (pdf_bytes, final_url, '', '', overlay_total, interactives_block)
                elif screenshot_full_page is not None:
                    interactives_block = None
                    if include_interactives:
                        interactives_block = await collect_interactives(page)
                    png = await page.screenshot(
                        full_page=screenshot_full_page,
                        type='png',
                        omit_background=omit_background,
                        animations='disabled',
                    )
                    result = (png, final_url, '', '', overlay_total, interactives_block)
                else:
                    title = (await page.title()).strip()
                    if article_extract:
                        import trafilatura as _trafilatura

                        html = await page.content()
                        extracted = _trafilatura.extract(
                            html,
                            url=final_url,
                            include_comments=False,
                            include_tables=True,
                            favor_precision=True,
                        )
                        body = (extracted or '').strip()
                        if not body:
                            body = (_trafilatura.extract(html, url=final_url, favor_precision=False) or '').strip()
                        if not body:
                            body = (await page.inner_text('body')).strip()
                        meta = _trafilatura.extract_metadata(html)
                        if meta and meta.title and meta.title.strip():
                            title = meta.title.strip()
                    else:
                        body = (await page.inner_text('body')).strip()
                    interactives_block = await collect_interactives(page) if include_interactives else None
                    result = (None, final_url, title, body, overlay_total, interactives_block)

                if tracing_started:
                    try:
                        await context.tracing.stop()
                    except Exception:
                        pass
            except Exception as inner:
                raise await _handle_capture_error(
                    inner,
                    op='capture',
                    url=target_url,
                    page=page,
                    context=context,
                    tracing_started=tracing_started,
                    debug_enabled=debug_enabled,
                    overlay_clicks=overlay_total,
                ) from inner

        har_b64 = read_har_payload(har_path)
        if har_path and os.path.isfile(har_path):
            try:
                os.unlink(har_path)
            except OSError:
                pass
        assert result is not None
        return (*result, har_b64)
    except HTTPException:
        if har_path and os.path.isfile(har_path):
            try:
                os.unlink(har_path)
            except OSError:
                pass
        raise
    except Exception as e:
        if har_path and os.path.isfile(har_path):
            try:
                os.unlink(har_path)
            except OSError:
                pass
        raise await _handle_capture_error(
            e,
            op='capture',
            url=target_url,
            page=page,
            context=context,
            tracing_started=tracing_started,
            debug_enabled=debug_enabled,
            overlay_clicks=overlay_total,
        ) from e


async def playwright_screenshot_bytes(
    browser: Browser,
    *,
    target_url: str,
    viewport: dict[str, int],
    staging: BrowserStagingOptions,
    full_page: bool,
    device_scale_factor: float | None = None,
    omit_background: bool = False,
    include_interactives: bool = False,
    interaction_plan: Optional[List[InteractionPlanStep]] = None,
    capture_options: CaptureRequestOptions | None = None,
) -> tuple[bytes, str, int, dict[str, Any] | None, str | None]:
    png, final_url, _, _, clicks, inter, har = await playwright_capture_flow(
        browser,
        target_url=target_url,
        viewport=viewport,
        staging=staging,
        screenshot_full_page=full_page,
        device_scale_factor=device_scale_factor,
        omit_background=omit_background,
        include_interactives=include_interactives,
        interaction_plan=interaction_plan,
        capture_options=capture_options,
    )
    assert png is not None
    return png, final_url, clicks, inter, har


async def playwright_pdf_bytes(
    browser: Browser,
    *,
    target_url: str,
    viewport: dict[str, int],
    staging: BrowserStagingOptions,
    pdf_format: str,
    print_background: bool,
    include_interactives: bool = False,
    interaction_plan: Optional[List[InteractionPlanStep]] = None,
    capture_options: CaptureRequestOptions | None = None,
) -> tuple[bytes, str, int, dict[str, Any] | None, str | None]:
    pdf, final_url, _, _, clicks, inter, har = await playwright_capture_flow(
        browser,
        target_url=target_url,
        viewport=viewport,
        staging=staging,
        include_interactives=include_interactives,
        interaction_plan=interaction_plan,
        capture_options=capture_options,
        pdf_format=pdf_format,
        pdf_print_background=print_background,
    )
    assert pdf is not None
    return pdf, final_url, clicks, inter, har
