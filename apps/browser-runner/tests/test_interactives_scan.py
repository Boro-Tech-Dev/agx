"""Tests for interactives_scan (mocked evaluate + env caps + optional DOM fixtures)."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock

import pytest

from tools.interactives_scan import collect_interactives


def test_collect_interactives_clamps_to_env_max(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv('WEB_INTERACTIVES_MAX', '3')

    async def inner() -> None:
        page = AsyncMock()
        page.evaluate = AsyncMock(
            return_value={
                'items': [
                    {
                        'kind': 'button',
                        'role': 'button',
                        'text': f'b{i}',
                        'selector_hint': f'button{i}',
                    }
                    for i in range(20)
                ],
                'truncated': True,
            }
        )
        out = await collect_interactives(page)
        assert len(out['items']) == 3
        assert out['truncated'] is True

    asyncio.run(inner())


def test_collect_interactives_password_text_stripped(monkeypatch: pytest.MonkeyPatch) -> None:
    async def run() -> None:
        page = AsyncMock()
        page.evaluate = AsyncMock(
            return_value={
                'items': [
                    {
                        'kind': 'input',
                        'role': 'textbox',
                        'text': 'secret',
                        'selector_hint': 'input#pw',
                        'input_type': 'password',
                    }
                ],
                'truncated': False,
            }
        )
        out = await collect_interactives(page)
        assert out['items'][0]['text'] == ''

    asyncio.run(run())


def test_collect_interactives_toggle_and_disclosure_kinds() -> None:
    async def run() -> None:
        page = AsyncMock()
        page.evaluate = AsyncMock(
            return_value={
                'items': [
                    {
                        'kind': 'toggle',
                        'role': 'button',
                        'text': 'More',
                        'selector_hint': 'button#acc',
                    },
                    {
                        'kind': 'disclosure',
                        'role': 'generic',
                        'text': 'Legal',
                        'selector_hint': 'details#sec > summary',
                    },
                ],
                'truncated': False,
            }
        )
        out = await collect_interactives(page)
        assert len(out['items']) == 2
        assert out['items'][0]['kind'] == 'toggle'
        assert out['items'][1]['kind'] == 'disclosure'

    asyncio.run(run())


@pytest.mark.integration
def test_collect_interactives_dom_toggle_and_disclosure() -> None:
    pytest.importorskip('playwright')

    html = """
    <html><body style="margin:0">
      <button id="acc" aria-expanded="false">More</button>
      <details id="sec"><summary>Legal</summary><p>Terms</p></details>
    </body></html>
    """

    async def run() -> None:
        from playwright.async_api import async_playwright

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page(viewport={'width': 800, 'height': 600})
            await page.set_content(html)
            out = await collect_interactives(page)
            await browser.close()
        kinds = {it['kind'] for it in out['items']}
        assert 'toggle' in kinds
        assert 'disclosure' in kinds

    asyncio.run(run())
