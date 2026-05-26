"""Tests for the local rerank fallback in hybrid_memory_context.

We can't easily exercise the full hybrid_memory_context (DB-coupled), so we
target the underlying ``_rerank_rows_local`` helper directly. This protects
the wiring that makes Phase 2 rerankers (BGE / Jina / ColBERT) reachable even
when agent-api's /api/memory/search is down.
"""

from __future__ import annotations

import asyncio
import json
import os
import unittest

import httpx

# Pin URLs in workflows.common at import time.
os.environ.setdefault('MODEL_ROUTER_URL', 'http://model-router.test')
os.environ.setdefault('AGENT_API_URL', 'http://agent-api.test')
os.environ.setdefault('RETRIEVAL_V2_ENABLED', '1')

_IMPORT_ERROR = None
try:
    from worker.workflows import common as wcommon  # type: ignore
except Exception as _e:  # pragma: no cover
    # Older Python (3.9) lacks PEP-604 ``str | None`` at runtime, and psycopg may
    # be missing in non-Docker environments. Both are fine; we just skip locally.
    _IMPORT_ERROR = _e
    wcommon = None  # type: ignore


def setUpModule():
    if _IMPORT_ERROR is not None:
        raise unittest.SkipTest(f'workflows.common unavailable: {_IMPORT_ERROR}')
    # In some test orderings a stub for worker.workflows.common is pre-installed
    # by another test module to avoid pulling psycopg. Detect the stub and skip.
    if not hasattr(wcommon, '_rerank_rows_local'):
        raise unittest.SkipTest('workflows.common is stubbed; _rerank_rows_local unavailable')


def _run(coro):
    return asyncio.run(coro)


class _PatchScope:
    def __init__(self):
        self._undo = []

    def setattr(self, obj, name, value):
        self._undo.append((obj, name, getattr(obj, name, None)))
        setattr(obj, name, value)

    def setenv(self, key, value):
        old = os.environ.get(key)
        self._undo.append(('__env__', key, old))
        os.environ[key] = value

    def undo(self):
        for obj, name, old in reversed(self._undo):
            if obj == '__env__':
                if old is None:
                    os.environ.pop(name, None)
                else:
                    os.environ[name] = old
            else:
                setattr(obj, name, old)


def _install_mock_transport(scope, handler_fn):
    original = httpx.AsyncClient
    transport = httpx.MockTransport(handler_fn)

    def factory(*a, **kw):
        kw['transport'] = transport
        return original(*a, **kw)

    scope.setattr(httpx, 'AsyncClient', factory)


class TestRerankRowsLocal(unittest.TestCase):
    def setUp(self):
        self.p = _PatchScope()
        # Silence the event() side-effects (default impl writes to DB).
        self.p.setattr(wcommon, 'event', lambda *_a, **_k: None)

    def tearDown(self):
        self.p.undo()

    def test_skips_when_agent_not_tool_capable(self):
        rows = [{'id': 'a', 'title': 't', 'body': 'x'}]
        out = _run(
            wcommon._rerank_rows_local(
                'q', rows, agent='synergy', reranker_override='colbert_gte_modern', run_id=None
            )
        )
        self.assertEqual(out, rows)

    def test_skips_when_reranker_override_off(self):
        rows = [{'id': 'a', 'title': 't', 'body': 'x'}]
        out = _run(
            wcommon._rerank_rows_local(
                'q', rows, agent='pm', reranker_override='off', run_id=None
            )
        )
        self.assertEqual(out, rows)

    def test_reorders_rows_per_router_response(self):
        rows = [
            {'id': 'a', 'title': 'A', 'body': 'first'},
            {'id': 'b', 'title': 'B', 'body': 'second'},
            {'id': 'c', 'title': 'C', 'body': 'third'},
        ]

        def handler(req: httpx.Request) -> httpx.Response:
            url = str(req.url)
            if url.endswith('/v1/rerank'):
                body = json.loads(req.content.decode('utf-8') or '{}')
                self.assertEqual(body.get('reranker_id'), 'colbert_gte_modern')
                self.assertEqual(len(body.get('documents') or []), 3)
                return httpx.Response(
                    200,
                    json={
                        'ranked': [
                            {'index': 2, 'score': 0.9},
                            {'index': 0, 'score': 0.8},
                            {'index': 1, 'score': 0.7},
                        ],
                        'backend_used': 'colbert_gte_modern',
                        'latency_ms': 3,
                    },
                )
            return httpx.Response(404, json={'error': f'unmocked {url}'})

        _install_mock_transport(self.p, handler)

        out = _run(
            wcommon._rerank_rows_local(
                'why', rows, agent='pm', reranker_override='colbert_gte_modern', run_id=None
            )
        )
        self.assertEqual([r['id'] for r in out], ['c', 'a', 'b'])

    def test_returns_original_on_router_error(self):
        rows = [{'id': 'a', 'title': 'A', 'body': 'b'}]

        def handler(_req: httpx.Request) -> httpx.Response:
            return httpx.Response(500, text='boom')

        _install_mock_transport(self.p, handler)

        out = _run(
            wcommon._rerank_rows_local(
                'q', rows, agent='pm', reranker_override='colbert_gte_modern', run_id=None
            )
        )
        self.assertEqual(out, rows)


if __name__ == '__main__':
    unittest.main()
