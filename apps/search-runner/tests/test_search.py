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


@pytest.mark.asyncio
async def test_search_happy_path():
    mock_response = type(
        'R',
        (),
        {
            'status_code': 200,
            'json': lambda: {
                'results': [
                    {'title': 'A', 'url': 'https://example.com/a', 'content': 'snippet', 'score': 1.0}
                ]
            },
            'text': '{}',
            'raise_for_status': lambda: None,
        },
    )()

    with patch('tools.main.httpx.AsyncClient') as mock_client:
        inst = mock_client.return_value.__aenter__.return_value
        inst.get = AsyncMock(return_value=mock_response)
        r = client.post('/tools/web/search', json={'query': 'hello'})
    assert r.status_code == 200
    body = r.json()
    assert body['count'] == 1
    assert body['results'][0]['url'] == 'https://example.com/a'
