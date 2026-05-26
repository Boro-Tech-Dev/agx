import os
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault('WEB_SEARCH_ENABLED', '1')
os.environ.setdefault('SEARXNG_URL', 'http://searxng:8080')

from tools.main import app  # noqa: E402

client = TestClient(app)


def test_health():
    r = client.get('/health')
    assert r.status_code == 200
    assert r.json()['ok'] is True


def test_search_happy_path():
    class _MockSearxResponse:
        status_code = 200
        text = '{}'

        def json(self):
            return {
                'results': [
                    {'title': 'A', 'url': 'https://example.com/a', 'content': 'snippet', 'score': 1.0}
                ]
            }

        def raise_for_status(self):
            return None

    mock_response = _MockSearxResponse()

    class _FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def get(self, url, params=None):
            return mock_response

    with patch('tools.main.httpx.AsyncClient', _FakeAsyncClient):
        r = client.post('/tools/web/search', json={'query': 'hello'})
    assert r.status_code == 200
    body = r.json()
    assert body['count'] == 1
    assert body['results'][0]['url'] == 'https://example.com/a'
