"""Browser engine selection for Playwright (single engine per process)."""

from __future__ import annotations

import os
from typing import Literal

from playwright.async_api import Browser, Playwright

BrowserEngine = Literal['chromium', 'firefox', 'webkit']

_VALID: tuple[BrowserEngine, ...] = ('chromium', 'firefox', 'webkit')
_CHROMIUM_ARGS = ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu']


def browser_engine_name() -> BrowserEngine:
    raw = os.getenv('WEB_BROWSER_ENGINE', 'chromium').strip().lower()
    if raw in _VALID:
        return raw  # type: ignore[return-value]
    return 'chromium'


async def launch_browser(playwright: Playwright) -> Browser:
    engine = browser_engine_name()
    if engine == 'firefox':
        return await playwright.firefox.launch(headless=True)
    if engine == 'webkit':
        return await playwright.webkit.launch(headless=True)
    return await playwright.chromium.launch(headless=True, args=_CHROMIUM_ARGS)
