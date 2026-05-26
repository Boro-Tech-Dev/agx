"""Redis-backed cache for SearXNG deep-fetch (per-URL extracted page text)."""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
from typing import Any
from urllib.parse import urlparse

log = logging.getLogger(__name__)

CACHE_KEY_PREFIX = 'web:deepfetch:v1:'
NEG_HOST_KEY_PREFIX = 'web:deepfetch:neg:'

DEFAULT_TTL_SEC = 21600  # 6h
DEFAULT_NEG_TTL_SEC = 600  # 10m


def _ttl_positive() -> int:
    raw = (os.getenv('WEB_DEEPFETCH_CACHE_TTL_SEC', '') or '').strip()
    try:
        v = int(raw) if raw else DEFAULT_TTL_SEC
    except ValueError:
        v = DEFAULT_TTL_SEC
    return max(60, v)


def _ttl_negative() -> int:
    raw = (os.getenv('WEB_DEEPFETCH_NEG_TTL_SEC', '') or '').strip()
    try:
        v = int(raw) if raw else DEFAULT_NEG_TTL_SEC
    except ValueError:
        v = DEFAULT_NEG_TTL_SEC
    return max(30, v)


def _url_key(url: str) -> str:
    h = hashlib.sha256((url or '').encode('utf-8')).hexdigest()
    return f'{CACHE_KEY_PREFIX}{h}'


def _host_key(url: str) -> str | None:
    try:
        host = (urlparse(url).hostname or '').lower()
    except Exception:
        host = ''
    if not host:
        return None
    return f'{NEG_HOST_KEY_PREFIX}{host[:200]}'


def _new_client(redis_url: str | None = None):
    url = (redis_url or os.getenv('REDIS_URL', '') or '').strip()
    if not url:
        return None
    try:
        import redis as redis_mod

        return redis_mod.Redis.from_url(url, decode_responses=True)
    except Exception as e:
        log.debug('web_cache redis unavailable: %s', e)
        return None


class WebCache:
    """Thin async wrapper around sync redis-py for per-URL fetch caching.

    Pass ``client`` to inject a fake in tests. With no client and no ``REDIS_URL``
    the cache is a no-op (all operations succeed and return ``None``/``False``).
    """

    def __init__(self, client: Any | None = None, *, redis_url: str | None = None):
        if client is None:
            client = _new_client(redis_url)
        self._client = client

    @property
    def enabled(self) -> bool:
        return self._client is not None

    async def get(self, url: str) -> dict[str, Any] | None:
        if self._client is None or not url:
            return None
        return await asyncio.to_thread(self._get_sync, url)

    async def set(self, url: str, payload: dict[str, Any]) -> None:
        if self._client is None or not url:
            return
        await asyncio.to_thread(self._set_sync, url, payload)

    async def is_host_blocked(self, url: str) -> bool:
        if self._client is None or not url:
            return False
        return await asyncio.to_thread(self._is_host_blocked_sync, url)

    async def block_host(self, url: str) -> None:
        if self._client is None or not url:
            return
        await asyncio.to_thread(self._block_host_sync, url)

    def _get_sync(self, url: str) -> dict[str, Any] | None:
        try:
            raw = self._client.get(_url_key(url))
            if not raw:
                return None
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, dict) else None
        except Exception as e:
            log.debug('web_cache get failed url=%s err=%s', url[:120], e)
            return None

    def _set_sync(self, url: str, payload: dict[str, Any]) -> None:
        try:
            self._client.setex(_url_key(url), _ttl_positive(), json.dumps(payload))
        except Exception as e:
            log.debug('web_cache set failed url=%s err=%s', url[:120], e)

    def _is_host_blocked_sync(self, url: str) -> bool:
        key = _host_key(url)
        if not key:
            return False
        try:
            return self._client.get(key) is not None
        except Exception:
            return False

    def _block_host_sync(self, url: str) -> None:
        key = _host_key(url)
        if not key:
            return
        try:
            self._client.setex(key, _ttl_negative(), '1')
        except Exception as e:
            log.debug('web_cache block_host failed url=%s err=%s', url[:120], e)
