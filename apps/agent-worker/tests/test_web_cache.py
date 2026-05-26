"""Unit tests for worker.web_cache (no Redis dependency; uses an in-memory fake)."""

from __future__ import annotations

import asyncio
import unittest

from worker.web_cache import (
    CACHE_KEY_PREFIX,
    NEG_HOST_KEY_PREFIX,
    WebCache,
    _host_key,
    _url_key,
)


class FakeRedis:
    """Minimal subset of redis-py used by WebCache (get / setex)."""

    def __init__(self):
        self.store: dict[str, tuple[str, int]] = {}
        self.set_calls: list[tuple[str, int, str]] = []

    def get(self, key):
        entry = self.store.get(key)
        return entry[0] if entry else None

    def setex(self, key, ttl, value):
        self.store[key] = (str(value), int(ttl))
        self.set_calls.append((key, int(ttl), str(value)))


def _run(coro):
    return asyncio.run(coro)


class TestWebCacheKeys(unittest.TestCase):
    def test_url_key_is_sha256_namespaced(self):
        key = _url_key('https://example.com/a')
        self.assertTrue(key.startswith(CACHE_KEY_PREFIX))
        # sha256 hex == 64 chars
        self.assertEqual(len(key), len(CACHE_KEY_PREFIX) + 64)

    def test_url_key_stable_across_calls(self):
        self.assertEqual(_url_key('https://x.test/p'), _url_key('https://x.test/p'))
        self.assertNotEqual(_url_key('https://x.test/p'), _url_key('https://x.test/q'))

    def test_host_key_uses_lowercased_hostname(self):
        self.assertEqual(_host_key('https://Example.COM/foo'), f'{NEG_HOST_KEY_PREFIX}example.com')
        self.assertIsNone(_host_key('not a url'))


class TestWebCacheNoop(unittest.TestCase):
    def test_disabled_when_no_client(self):
        cache = WebCache(client=None)
        self.assertFalse(cache.enabled)
        self.assertIsNone(_run(cache.get('https://x.test/a')))
        # Setting against a noop cache is silent
        _run(cache.set('https://x.test/a', {'text': 'hi'}))
        self.assertFalse(_run(cache.is_host_blocked('https://x.test/a')))


class TestWebCacheRoundTrip(unittest.TestCase):
    def test_get_after_set_returns_payload(self):
        fake = FakeRedis()
        cache = WebCache(client=fake)
        _run(cache.set('https://x.test/page', {'text': 'hello', 'title': 't', 'final_url': 'https://x.test/page'}))
        got = _run(cache.get('https://x.test/page'))
        self.assertIsNotNone(got)
        self.assertEqual(got['text'], 'hello')
        self.assertEqual(got['title'], 't')

    def test_set_uses_ttl(self):
        fake = FakeRedis()
        cache = WebCache(client=fake)
        _run(cache.set('https://x.test/a', {'text': 'h'}))
        self.assertEqual(len(fake.set_calls), 1)
        key, ttl, _ = fake.set_calls[0]
        self.assertTrue(key.startswith(CACHE_KEY_PREFIX))
        self.assertGreaterEqual(ttl, 60)

    def test_get_returns_none_when_corrupt(self):
        fake = FakeRedis()
        fake.store[_url_key('https://x.test/a')] = ('not-json', 60)
        cache = WebCache(client=fake)
        self.assertIsNone(_run(cache.get('https://x.test/a')))


class TestWebCacheNegativeHost(unittest.TestCase):
    def test_block_and_check_host(self):
        fake = FakeRedis()
        cache = WebCache(client=fake)
        self.assertFalse(_run(cache.is_host_blocked('https://bad.test/a')))
        _run(cache.block_host('https://bad.test/a'))
        self.assertTrue(_run(cache.is_host_blocked('https://bad.test/b')))
        # Different host not blocked
        self.assertFalse(_run(cache.is_host_blocked('https://other.test/x')))

    def test_block_host_noop_when_unparseable(self):
        fake = FakeRedis()
        cache = WebCache(client=fake)
        _run(cache.block_host('not a url'))
        self.assertEqual(fake.set_calls, [])


if __name__ == '__main__':
    unittest.main()
