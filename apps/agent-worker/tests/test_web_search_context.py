"""Integration tests for worker.web_search_context (no DB; httpx MockTransport).

Covers:
* WEB_DEEPFETCH_ENABLED=0 (default) -> snippet block as today.
* WEB_DEEPFETCH_ENABLED=1, pages have body -> chunks block emitted.
* WEB_DEEPFETCH_ENABLED=1, all pages empty -> falls back to snippet block
  and emits a ``web.deepfetch.fallback`` event.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
import types
import unittest
from typing import Any

import httpx

# Set env BEFORE importing module-level constants in web_search_context.
os.environ.setdefault('SEARCH_RUNNER_URL', 'http://search-runner.test')
os.environ.setdefault('MODEL_ROUTER_URL', 'http://model-router.test')
os.environ.setdefault('BROWSER_RUNNER_URL', 'http://browser-runner.test')
os.environ.setdefault('AGENT_API_URL', 'http://agent-api.test')

# Stub worker.workflows.common (and the workflows package) so importing
# web_search_context does not pull in psycopg / database setup. Only install
# the stub when the real module cannot be imported (older Python locally or
# missing psycopg); in Docker (Python 3.11 + psycopg installed) the real
# module loads fine and other tests can use it.
def _ensure_workflows_common_stub() -> None:
    try:
        import worker.workflows.common as _real  # noqa: F401
        return  # real module imported fine; nothing to stub
    except Exception:
        pass
    pkg = sys.modules.setdefault('worker.workflows', types.ModuleType('worker.workflows'))
    if not hasattr(pkg, '__path__'):
        pkg.__path__ = []
    stub = sys.modules.setdefault('worker.workflows.common', types.ModuleType('worker.workflows.common'))
    if not hasattr(stub, 'event'):
        stub.event = lambda *_a, **_k: None


_ensure_workflows_common_stub()

import worker.web_search_context as wsc  # noqa: E402
import worker.web_deepfetch as wdf  # noqa: E402
from worker.web_cache import WebCache  # noqa: E402


def _run(coro):
    return asyncio.run(coro)


class StubEventSink:
    """Captures event() calls (worker.workflows.common.event is patched per test)."""

    def __init__(self):
        self.events: list[tuple[str, str, str, Any]] = []

    def __call__(self, run_id, event_type, message, payload=None):
        self.events.append((run_id, event_type, message, payload))

    def types(self) -> list[str]:
        return [e[1] for e in self.events]


class FakeRedis:
    def __init__(self):
        self.store: dict[str, tuple[str, int]] = {}

    def get(self, key):
        v = self.store.get(key)
        return v[0] if v else None

    def setex(self, key, ttl, value):
        self.store[key] = (str(value), int(ttl))


def _install_mock_transport(monkeypatcher, responders: dict[str, Any]):
    """Patch httpx.AsyncClient so any URL prefix in ``responders`` is mocked.

    ``responders`` keys are URL prefixes (e.g. "http://search-runner.test/").
    Values are callables ``(request) -> httpx.Response`` or static JSON dicts.
    """
    original_async_client = httpx.AsyncClient

    def handler(request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        for prefix, val in responders.items():
            if url.startswith(prefix):
                if callable(val):
                    return val(request)
                return httpx.Response(200, json=val)
        return httpx.Response(404, json={'error': f'unmocked {url}'})

    transport = httpx.MockTransport(handler)

    def factory(*args, **kwargs):
        kwargs['transport'] = transport
        return original_async_client(*args, **kwargs)

    monkeypatcher.setattr(httpx, 'AsyncClient', factory)


class _PatchScope:
    """Tiny stand-in for pytest's monkeypatch (no pytest dep)."""

    def __init__(self):
        self._undo: list[tuple[Any, str, Any]] = []

    def setattr(self, obj, name, value):
        self._undo.append((obj, name, getattr(obj, name)))
        setattr(obj, name, value)

    def setenv(self, key, value):
        old = os.environ.get(key)
        self._undo.append(('__env__', key, old))
        os.environ[key] = value

    def delenv(self, key, *, raising=False):
        old = os.environ.pop(key, None)
        self._undo.append(('__env__', key, old))

    def undo(self):
        for obj, name, old in reversed(self._undo):
            if obj == '__env__':
                if old is None:
                    os.environ.pop(name, None)
                else:
                    os.environ[name] = old
            else:
                setattr(obj, name, old)


class TestSearchContextSnippetMode(unittest.TestCase):
    """Default behavior (WEB_DEEPFETCH_ENABLED unset/0) is unchanged."""

    def setUp(self):
        self.p = _PatchScope()
        self.events = StubEventSink()
        self.p.setattr(wsc, 'event', self.events)
        # Module-level URLs were captured at import time; pin them to our mock hosts.
        self.p.setattr(wsc, 'SEARCH_RUNNER_URL', 'http://search-runner.test')
        self.p.setattr(wsc, 'MODEL_ROUTER_URL', 'http://model-router.test')
        self.p.setattr(wdf, 'BROWSER_RUNNER_URL', 'http://browser-runner.test')
        self.p.setenv('WEB_DEEPFETCH_ENABLED', '0')
        self.p.setenv('WEB_SEARCH_ENABLED', '1')

    def tearDown(self):
        self.p.undo()

    def test_snippet_block_emitted_when_deepfetch_off(self):
        search_response = {
            'results': [
                {'title': 'A', 'url': 'https://a.test/', 'snippet': 'aa snippet'},
                {'title': 'B', 'url': 'https://b.test/', 'snippet': 'bb snippet'},
            ]
        }

        def model_router_404(_req: httpx.Request) -> httpx.Response:
            # snippet rerank path: skipped because agent=None -> should_rerank_web_search=False
            return httpx.Response(500, json={'error': 'should-not-be-called'})

        _install_mock_transport(
            self.p,
            {
                'http://search-runner.test/': lambda _r: httpx.Response(200, json=search_response),
                'http://model-router.test/': model_router_404,
            },
        )

        block, rows = _run(wsc.search_context('what is X', n=2, run_id='r1'))
        self.assertIn('## Web_search_facts', block)
        self.assertIn('[S1]', block)
        self.assertIn('https://a.test/', block)
        # Snippets format includes title text 'A'
        self.assertIn('aa snippet', block)
        self.assertEqual(len(rows), 2)
        # No deepfetch.* events
        self.assertNotIn('web.deepfetch.request', self.events.types())
        self.assertIn('web.search.completed', self.events.types())


class TestSearchContextDeepfetchMode(unittest.TestCase):
    def setUp(self):
        self.p = _PatchScope()
        self.events = StubEventSink()
        self.p.setattr(wsc, 'event', self.events)
        # Module-level URLs were captured at import time; pin them to our mock hosts.
        self.p.setattr(wsc, 'SEARCH_RUNNER_URL', 'http://search-runner.test')
        self.p.setattr(wsc, 'MODEL_ROUTER_URL', 'http://model-router.test')
        self.p.setattr(wdf, 'BROWSER_RUNNER_URL', 'http://browser-runner.test')
        # Replicate event() patching inside web_deepfetch's dependents.
        self.p.setenv('WEB_DEEPFETCH_ENABLED', '1')
        self.p.setenv('WEB_DEEPFETCH_TOP_URLS', '3')
        self.p.setenv('WEB_DEEPFETCH_TOP_CHUNKS', '4')
        self.p.setenv('WEB_DEEPFETCH_BUDGET_MS', '4000')
        self.p.setenv('WEB_DEEPFETCH_CONCURRENCY', '3')
        self.p.setenv('WEB_DEEPFETCH_PER_URL_TIMEOUT_SEC', '2')
        self.p.setenv('WEB_DEEPFETCH_MIN_CHARS', '50')
        self.p.setenv('WEB_DEEPFETCH_RENDER_JS_FALLBACK', '0')
        self.p.setenv('WEB_DEEPFETCH_RERANKER_ID', 'colbert_gte_modern')
        self.p.setenv('WEB_DEEPFETCH_CHUNK_SIZE', '300')
        self.p.setenv('WEB_DEEPFETCH_CHUNK_OVERLAP', '30')
        self.p.setenv('WEB_DEEPFETCH_BLOCK_MAX_CHARS', '8000')

        # Force deepfetch to use an in-memory cache (no real Redis).
        original_deepfetch_urls = wdf.deepfetch_urls
        cache_obj = WebCache(client=FakeRedis())

        async def deepfetch_with_fake_cache(urls, **kwargs):
            kwargs.setdefault('cache', cache_obj)
            return await original_deepfetch_urls(urls, **kwargs)

        self.p.setattr(wsc, 'deepfetch_urls', deepfetch_with_fake_cache)

    def tearDown(self):
        self.p.undo()

    def test_chunks_block_emitted_when_deepfetch_on(self):
        search_response = {
            'results': [
                {'title': 'Alpha', 'url': 'https://a.test/x', 'snippet': 'a snip'},
                {'title': 'Beta', 'url': 'https://b.test/y', 'snippet': 'b snip'},
                {'title': 'Gamma', 'url': 'https://c.test/z', 'snippet': 'c snip'},
            ]
        }

        def browser_responder(req: httpx.Request) -> httpx.Response:
            body = json.loads(req.content.decode('utf-8') or '{}')
            url = body.get('url') or 'about:blank'
            return httpx.Response(
                200,
                json={
                    'url': url,
                    'final_url': url,
                    'title': f'Page {url[-1]}',
                    'text': (f'long body for {url} ' * 80).strip(),
                },
            )

        def rerank_responder(req: httpx.Request) -> httpx.Response:
            body = json.loads(req.content.decode('utf-8') or '{}')
            docs = body.get('documents') or []
            # Reverse order to prove we use the rerank output, not fetch order.
            ranked = [{'index': i, 'score': 1.0 - i * 0.01} for i in range(len(docs) - 1, -1, -1)]
            return httpx.Response(
                200,
                json={'ranked': ranked, 'backend_used': 'colbert_gte_modern', 'latency_ms': 5},
            )

        _install_mock_transport(
            self.p,
            {
                'http://search-runner.test/': lambda _r: httpx.Response(200, json=search_response),
                'http://browser-runner.test/': browser_responder,
                'http://model-router.test/': rerank_responder,
            },
        )

        block, rows = _run(wsc.search_context('what is X', n=3, run_id='r2'))
        self.assertIn('## Web_search_facts', block)
        self.assertIn('App-fetched web page excerpts', block)
        self.assertIn('[S1]', block)
        # Each chunk should carry the source URL
        self.assertTrue('https://a.test/x' in block or 'https://b.test/y' in block or 'https://c.test/z' in block)
        self.assertEqual(len(rows), 3)  # raw SearXNG rows still returned
        types = self.events.types()
        self.assertIn('web.deepfetch.request', types)
        self.assertIn('web.deepfetch.fetched', types)
        self.assertIn('web.deepfetch.reranked', types)
        self.assertIn('web.deepfetch.attached', types)
        # In deepfetch mode we should NOT emit the snippet rerank events
        self.assertNotIn('web.search.rerank.start', types)

    def test_falls_back_to_snippet_block_when_all_pages_empty(self):
        search_response = {
            'results': [
                {'title': 'Alpha', 'url': 'https://a.test/x', 'snippet': 'a snip body content'},
                {'title': 'Beta', 'url': 'https://b.test/y', 'snippet': 'b snip body content'},
            ]
        }

        def browser_empty(req: httpx.Request) -> httpx.Response:
            body = json.loads(req.content.decode('utf-8') or '{}')
            return httpx.Response(
                200,
                json={'url': body['url'], 'final_url': body['url'], 'title': '', 'text': ''},
            )

        _install_mock_transport(
            self.p,
            {
                'http://search-runner.test/': lambda _r: httpx.Response(200, json=search_response),
                'http://browser-runner.test/': browser_empty,
            },
        )

        block, rows = _run(wsc.search_context('what is X', n=2, run_id='r3'))
        self.assertIn('## Web_search_facts', block)
        # Snippet block (not chunks block) — header text differs
        self.assertIn('App-supplied web search snippets', block)
        types = self.events.types()
        self.assertIn('web.deepfetch.request', types)
        self.assertIn('web.deepfetch.fallback', types)
        self.assertNotIn('web.deepfetch.attached', types)


class TestFormatChunksBlock(unittest.TestCase):
    def test_truncates_chunk_excerpt(self):
        long_text = 'x' * 5000
        block = wsc.format_web_search_chunks_block(
            [{'title': 'T', 'url': 'https://u.test/', 'text': long_text}],
            per_chunk_chars=400,
        )
        self.assertIn('## Web_search_facts', block)
        # 400 chars of 'x' should appear, but not the full 5000.
        self.assertIn('x' * 400, block)
        self.assertNotIn('x' * 401, block)

    def test_empty_input_returns_empty_string(self):
        self.assertEqual(wsc.format_web_search_chunks_block([]), '')


if __name__ == '__main__':
    unittest.main()
