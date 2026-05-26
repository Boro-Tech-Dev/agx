"""Indexed crawl should reuse one browser context for all pages."""

from pathlib import Path


def test_crawl_iterate_uses_shared_session_not_per_page_context() -> None:
    src = (Path(__file__).resolve().parents[1] / 'tools' / 'crawl_execute.py').read_text()
    assert 'open_crawl_session' in src
    assert 'async with open_crawl_session' in src
    assert 'async with open_capture_context' not in src
    assert 'context.new_page()' in src
    assert 'await page.close()' in src
