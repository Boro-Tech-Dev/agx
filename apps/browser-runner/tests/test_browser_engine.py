"""Tests for browser_engine env parsing."""

from __future__ import annotations

import pytest

from tools.browser_engine import browser_engine_name


def test_browser_engine_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv('WEB_BROWSER_ENGINE', raising=False)
    assert browser_engine_name() == 'chromium'


def test_browser_engine_firefox(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv('WEB_BROWSER_ENGINE', 'firefox')
    assert browser_engine_name() == 'firefox'


def test_browser_engine_invalid_falls_back(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv('WEB_BROWSER_ENGINE', 'ie11')
    assert browser_engine_name() == 'chromium'
