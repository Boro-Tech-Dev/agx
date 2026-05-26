"""HCP interstitial and cookie-banner dismissal before capture/crawl."""

from __future__ import annotations

import asyncio
import re
from typing import Any

from typing import TYPE_CHECKING

from pydantic import BaseModel
from playwright.async_api import Page

if TYPE_CHECKING:
    from .capture_helpers import BrowserStagingOptions

CLICK_TIMEOUT_MS = 2500
HCP_POST_CLICK_SLEEP_SEC = 0.35
ONETRUST_ACCEPT_SELECTOR = '#onetrust-accept-btn-handler'
ONETRUST_WAIT_MS = 3000

HCP_AFFIRMATIVE_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r'yes.*health\s*care\s*professional', re.I),
    re.compile(r'i\s*am\s*a\s*(us\s*)?health\s*care\s*professional', re.I),
    re.compile(r'continue\s+as\s+(an?\s+)?hcp', re.I),
    re.compile(r'confirm.*health\s*care\s*professional', re.I),
)

HCP_NEGATIVE_SUBSTRINGS: tuple[str, ...] = (
    'not a',
    'not an',
    "i'm not",
    'i am not',
    'no, i',
    'no i am',
)

# Exact labels for get_by_text (Blueprint / Ayvakit-style gates).
HCP_TEXT_LABELS: tuple[str, ...] = (
    'Yes, I am a US healthcare professional',
    'Yes, I am a healthcare professional',
)

HCP_CSS_FALLBACKS: tuple[str, ...] = (
    'motion.div.btn.gateway:has-text("Yes, I am a US healthcare professional")',
    'motion.div.btn.gateway:has-text("Yes, I am a healthcare professional")',
    'div.btn.gateway:has-text("Yes, I am a US healthcare professional")',
    'motion.div.btn.gateway:has-text("Yes, I am a healthcare professional")',
    'div.btn.gateway:has-text("Yes, I am a healthcare professional")',
    'button:has-text("Yes, I am a US healthcare professional")',
    'button:has-text("Yes, I am a healthcare professional")',
    'a:has-text("Yes, I am a US healthcare professional")',
    'a:has-text("Yes, I am a healthcare professional")',
    '[data-hcp-gate] button:has-text("Continue")',
    '#hcp-gate button:has-text("Continue")',
)

GATEWAY_BTN_SELECTOR = 'motion.div.btn.gateway, div.btn.gateway'


class GateDismissResult(BaseModel):
    overlay_clicks_attempted: int = 0
    hcp_clicks: int = 0
    cookie_clicks: int = 0
    extra_clicks: int = 0

    def record_hcp(self) -> None:
        self.hcp_clicks += 1
        self.overlay_clicks_attempted += 1

    def record_cookie(self) -> None:
        self.cookie_clicks += 1
        self.overlay_clicks_attempted += 1

    def record_extra(self) -> None:
        self.extra_clicks += 1
        self.overlay_clicks_attempted += 1

    def to_gate_dismissal_dict(self) -> dict[str, int]:
        return {
            'overlay_clicks_attempted': self.overlay_clicks_attempted,
            'hcp_clicks': self.hcp_clicks,
            'cookie_clicks': self.cookie_clicks,
            'extra_clicks': self.extra_clicks,
        }


def is_affirmative_hcp_name(name: str) -> bool:
    """True when accessible name looks like confirming HCP status (not declining)."""
    n = ' '.join(name.strip().split()).lower()
    if not n:
        return False
    if any(neg in n for neg in HCP_NEGATIVE_SUBSTRINGS):
        return False
    if any(p.search(n) for p in HCP_AFFIRMATIVE_PATTERNS):
        return True
    if 'healthcare professional' in n or 'health care professional' in n:
        if 'yes' in n or n.startswith('i am'):
            return True
    return False


def affirmative_hcp_text_labels() -> tuple[str, ...]:
    """Labels used for exact get_by_text matching (subset validated by is_affirmative_hcp_name)."""
    return tuple(label for label in HCP_TEXT_LABELS if is_affirmative_hcp_name(label))


async def _accessible_name(loc: Any) -> str:
    try:
        aria = await loc.get_attribute('aria-label')
        if aria and aria.strip():
            return aria.strip()
    except Exception:
        pass
    try:
        text = await loc.inner_text()
        if text and text.strip():
            return text.strip()
    except Exception:
        pass
    return ''


async def _click_locator(cand: Any, *, timeout_ms: int) -> bool:
    try:
        await cand.scroll_into_view_if_needed(timeout=min(timeout_ms, 3000))
        await cand.click(timeout=timeout_ms)
        return True
    except Exception:
        try:
            await cand.click(force=True, timeout=timeout_ms)
            return True
        except Exception:
            return False


async def _click_by_exact_text(page: Page, label: str, *, timeout_ms: int) -> bool:
    try:
        cand = page.get_by_text(label, exact=True).first
        if not await cand.is_visible():
            return False
        return await _click_locator(cand, timeout_ms=timeout_ms)
    except Exception:
        return False


async def dismiss_hcp_gate(page: Page, *, timeout_ms: int = 2500) -> bool:
    """Click an affirmative HCP interstitial control if present."""
    from .capture_helpers import safe_click_first_visible

    for role in ('button', 'link'):
        try:
            loc = page.get_by_role(role)
            count = await loc.count()
        except Exception:
            continue
        for i in range(min(count, 50)):
            cand = loc.nth(i)
            try:
                if not await cand.is_visible():
                    continue
            except Exception:
                continue
            name = await _accessible_name(cand)
            if not is_affirmative_hcp_name(name):
                continue
            if await _click_locator(cand, timeout_ms=timeout_ms):
                return True

    for label in affirmative_hcp_text_labels():
        if await _click_by_exact_text(page, label, timeout_ms=timeout_ms):
            return True

    try:
        gateway_loc = page.locator(GATEWAY_BTN_SELECTOR)
        count = await gateway_loc.count()
    except Exception:
        count = 0
    for i in range(min(count, 20)):
        cand = gateway_loc.nth(i)
        try:
            if not await cand.is_visible():
                continue
        except Exception:
            continue
        text = await _accessible_name(cand)
        if not is_affirmative_hcp_name(text):
            continue
        if await _click_locator(cand, timeout_ms=timeout_ms):
            return True

    for sel in HCP_CSS_FALLBACKS:
        if await safe_click_first_visible(page, sel, timeout_ms=timeout_ms):
            return True
    return False


async def _wait_for_onetrust_accept(page: Page) -> None:
    try:
        await page.wait_for_selector(
            ONETRUST_ACCEPT_SELECTOR,
            state='visible',
            timeout=ONETRUST_WAIT_MS,
        )
    except Exception:
        pass


def _should_run_gates(
    staging: 'BrowserStagingOptions',
    *,
    auto_dismiss_gates: bool,
) -> bool:
    return bool(
        staging.consent_auto_clicks
        or auto_dismiss_gates
        or staging.auto_dismiss_gates
    )


async def dismiss_page_gates(
    page: Page,
    staging: 'BrowserStagingOptions',
    *,
    apply_delay: bool = True,
    delay_cap_ms: int | None = None,
    for_crawl: bool = False,
    auto_dismiss_gates: bool = False,
    click_timeout_ms: int = 2500,
) -> GateDismissResult:
    """
    Dismiss HCP gates, cookie CMP, then extra_click_selectors (in that order).
    """
    from .capture_helpers import COMMON_CONSENT_SELECTORS, post_load_sleep, safe_click_first_visible

    result = GateDismissResult()
    run_gates = _should_run_gates(staging, auto_dismiss_gates=auto_dismiss_gates)

    if apply_delay and staging.post_load_delay_ms > 0:
        cap = delay_cap_ms if delay_cap_ms is not None else staging.post_load_delay_ms
        await post_load_sleep(staging.post_load_delay_ms, max_ms=cap)

    if run_gates:
        if await dismiss_hcp_gate(page, timeout_ms=click_timeout_ms):
            result.record_hcp()
            await asyncio.sleep(HCP_POST_CLICK_SLEEP_SEC)

    if run_gates:
        await _wait_for_onetrust_accept(page)
        for sel in COMMON_CONSENT_SELECTORS:
            if await safe_click_first_visible(page, sel, timeout_ms=click_timeout_ms):
                result.record_cookie()
                await asyncio.sleep(0.2 if for_crawl else 0.3)

    for sel in staging.extra_click_selectors:
        sel = sel.strip()
        if not sel:
            continue
        if await safe_click_first_visible(page, sel, timeout_ms=click_timeout_ms):
            result.record_extra()
            await asyncio.sleep(0.15 if for_crawl else 0.25)

    return result
