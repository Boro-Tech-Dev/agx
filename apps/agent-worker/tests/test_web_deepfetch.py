"""Unit tests for worker.web_deepfetch (httpx MockTransport + in-memory cache)."""

from __future__ import annotations

import asyncio
import json
import time
import unittest

import httpx

from worker.web_cache import WebCache
from worker.web_deepfetch import FetchedPage, deepfetch_urls


def _run(coro):
    return asyncio.run(coro)


class FakeRedis:
    def __init__(self):
        self.store: dict[str, tuple[str, int]] = {}

    def get(self, key):
        entry = self.store.get(key)
        return entry[0] if entry else None

    def setex(self, key, ttl, value):
        self.store[key] = (str(value), int(ttl))


def _make_client_handler(responder):
    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content.decode('utf-8') or '{}')
        payload = responder(body, request)
        if isinstance(payload, httpx.Response):
            return payload
        return httpx.Response(200, json=payload)

    transport = httpx.MockTransport(handler)
    return httpx.AsyncClient(transport=transport)


class TestDeepfetchHappyPath(unittest.TestCase):
    def test_returns_one_result_per_input_in_order(self):
        cache = WebCache(client=FakeRedis())

        def responder(body, _req):
            url = body.get('url') or 'about:blank'
            return {
                'url': url,
                'final_url': url,
                'title': f'T-{url[-1]}',
                'text': 'this is some long enough body text ' * 20,
                'render_js': body.get('render_js', False),
            }

        async def go():
            async with _make_client_handler(responder) as client:
                return await deepfetch_urls(
                    ['https://x.test/1', 'https://x.test/2', 'https://x.test/3'],
                    cache=cache,
                    client=client,
                    concurrency=2,
                    per_url_timeout_sec=2.0,
                    budget_ms=5000,
                    min_chars=10,
                )

        results = _run(go())
        self.assertEqual(len(results), 3)
        self.assertEqual([r.url for r in results], ['https://x.test/1', 'https://x.test/2', 'https://x.test/3'])
        self.assertTrue(all(r.source == 'live' for r in results))
        self.assertTrue(all(len(r.text) > 100 for r in results))

    def test_cache_hit_is_used_without_calling_browser(self):
        fake = FakeRedis()
        cache = WebCache(client=fake)
        # Pre-populate cache for one URL
        prepop = {
            'text': 'cached body text',
            'title': 'cached',
            'final_url': 'https://x.test/cached',
            'rendered_js': False,
            'cached_at': int(time.time()),
        }
        _run(cache.set('https://x.test/cached', prepop))

        call_count = {'n': 0}

        def responder(body, _req):
            call_count['n'] += 1
            return {'url': body['url'], 'final_url': body['url'], 'title': 'live', 'text': 'live body ' * 50}

        async def go():
            async with _make_client_handler(responder) as client:
                return await deepfetch_urls(
                    ['https://x.test/cached', 'https://x.test/fresh'],
                    cache=cache,
                    client=client,
                    concurrency=2,
                    per_url_timeout_sec=2.0,
                    budget_ms=5000,
                )

        results = _run(go())
        self.assertEqual(len(results), 2)
        self.assertEqual(results[0].source, 'cache')
        self.assertEqual(results[0].text, 'cached body text')
        self.assertEqual(results[1].source, 'live')
        self.assertEqual(call_count['n'], 1)  # only the un-cached URL hit the browser

    def test_writes_to_cache_after_live_fetch(self):
        fake = FakeRedis()
        cache = WebCache(client=fake)

        def responder(body, _req):
            return {'url': body['url'], 'final_url': body['url'], 'title': 't', 'text': 'live body text here ' * 30}

        async def go():
            async with _make_client_handler(responder) as client:
                await deepfetch_urls(
                    ['https://x.test/abc'],
                    cache=cache,
                    client=client,
                    concurrency=1,
                    per_url_timeout_sec=2.0,
                    budget_ms=5000,
                )

        _run(go())
        # Second call should hit cache
        async def go2():
            async def fail_responder(*_a, **_k):
                raise AssertionError('should not be called')

            async with _make_client_handler(fail_responder) as client:
                return await deepfetch_urls(
                    ['https://x.test/abc'],
                    cache=cache,
                    client=client,
                    concurrency=1,
                    per_url_timeout_sec=2.0,
                    budget_ms=5000,
                )

        results = _run(go2())
        self.assertEqual(results[0].source, 'cache')


class TestDeepfetchRenderJsFallback(unittest.TestCase):
    def test_renders_js_when_initial_text_below_min_chars(self):
        cache = WebCache(client=FakeRedis())
        calls = []

        def responder(body, _req):
            calls.append({'url': body['url'], 'render_js': body.get('render_js', False)})
            if not body.get('render_js'):
                return {'url': body['url'], 'final_url': body['url'], 'title': 'short', 'text': 'tiny'}
            return {'url': body['url'], 'final_url': body['url'], 'title': 'full', 'text': 'plenty of content ' * 30}

        async def go():
            async with _make_client_handler(responder) as client:
                return await deepfetch_urls(
                    ['https://x.test/spa'],
                    cache=cache,
                    client=client,
                    concurrency=1,
                    per_url_timeout_sec=2.0,
                    budget_ms=5000,
                    min_chars=100,
                    render_js_fallback=True,
                )

        results = _run(go())
        self.assertEqual(results[0].source, 'live')
        self.assertTrue(results[0].rendered_js)
        self.assertGreaterEqual(len(results[0].text), 100)
        self.assertEqual(len(calls), 2)
        self.assertFalse(calls[0]['render_js'])
        self.assertTrue(calls[1]['render_js'])

    def test_skips_render_js_fallback_when_disabled(self):
        cache = WebCache(client=FakeRedis())
        calls = []

        def responder(body, _req):
            calls.append(body.get('render_js', False))
            return {'url': body['url'], 'final_url': body['url'], 'title': 't', 'text': 'tiny'}

        async def go():
            async with _make_client_handler(responder) as client:
                return await deepfetch_urls(
                    ['https://x.test/spa'],
                    cache=cache,
                    client=client,
                    concurrency=1,
                    per_url_timeout_sec=2.0,
                    budget_ms=5000,
                    min_chars=100,
                    render_js_fallback=False,
                )

        results = _run(go())
        self.assertEqual(len(calls), 1)
        self.assertFalse(results[0].rendered_js)


class TestDeepfetchBudget(unittest.TestCase):
    def test_budget_expired_marks_remaining_urls_as_skipped(self):
        cache = WebCache(client=FakeRedis())

        async def slow_handler(request: httpx.Request) -> httpx.Response:
            body = json.loads(request.content.decode('utf-8') or '{}')
            await asyncio.sleep(2.0)
            return httpx.Response(200, json={'url': body['url'], 'final_url': body['url'], 'title': '', 'text': 'x' * 200})

        transport = httpx.MockTransport(slow_handler)
        async def go():
            async with httpx.AsyncClient(transport=transport) as client:
                return await deepfetch_urls(
                    ['https://x.test/a', 'https://x.test/b'],
                    cache=cache,
                    client=client,
                    concurrency=2,
                    per_url_timeout_sec=5.0,
                    budget_ms=200,  # 0.2s; far smaller than the 2s sleep
                )

        results = _run(go())
        self.assertEqual(len(results), 2)
        for r in results:
            self.assertEqual(r.source, 'skipped')
            self.assertEqual(r.error, 'budget_expired')


class TestDeepfetchConcurrency(unittest.TestCase):
    def test_semaphore_caps_inflight_requests(self):
        cache = WebCache(client=FakeRedis())
        inflight = {'now': 0, 'max': 0}

        async def handler(request: httpx.Request) -> httpx.Response:
            inflight['now'] += 1
            inflight['max'] = max(inflight['max'], inflight['now'])
            await asyncio.sleep(0.05)
            inflight['now'] -= 1
            body = json.loads(request.content.decode('utf-8') or '{}')
            return httpx.Response(200, json={'url': body['url'], 'final_url': body['url'], 'title': '', 'text': 'x' * 300})

        transport = httpx.MockTransport(handler)
        async def go():
            async with httpx.AsyncClient(transport=transport) as client:
                return await deepfetch_urls(
                    [f'https://x.test/{i}' for i in range(8)],
                    cache=cache,
                    client=client,
                    concurrency=3,
                    per_url_timeout_sec=2.0,
                    budget_ms=5000,
                )

        results = _run(go())
        self.assertEqual(len(results), 8)
        self.assertLessEqual(inflight['max'], 3)


class TestDeepfetchFailures(unittest.TestCase):
    def test_transport_error_yields_skipped_and_blocks_host(self):
        cache = WebCache(client=FakeRedis())

        def handler(_request: httpx.Request) -> httpx.Response:
            return httpx.Response(503, text='nope')

        transport = httpx.MockTransport(handler)

        async def go():
            async with httpx.AsyncClient(transport=transport) as client:
                results = await deepfetch_urls(
                    ['https://flake.test/a'],
                    cache=cache,
                    client=client,
                    concurrency=1,
                    per_url_timeout_sec=2.0,
                    budget_ms=5000,
                )
            # Host should now be blocked for next request
            blocked = await cache.is_host_blocked('https://flake.test/b')
            return results, blocked

        results, blocked = _run(go())
        self.assertEqual(results[0].source, 'skipped')
        self.assertIsNotNone(results[0].error)
        self.assertTrue(blocked)


class TestFetchedPageShape(unittest.TestCase):
    def test_to_dict_round_trip(self):
        page = FetchedPage(url='u', final_url='u', title='t', text='x', source='live')
        d = page.to_dict()
        self.assertEqual(d['url'], 'u')
        self.assertEqual(d['source'], 'live')
        self.assertIn('error', d)


if __name__ == '__main__':
    unittest.main()
