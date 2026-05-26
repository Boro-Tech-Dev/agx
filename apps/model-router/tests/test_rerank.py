import asyncio
import unittest
from unittest.mock import AsyncMock, patch

from router.rerank import rerank
from router.hybrid import OllamaConfig


class TestRerank(unittest.TestCase):
    def test_rerank_off_returns_identity_order(self):
        out = asyncio.run(
            rerank('query', ['a', 'b'], 'off', ollama=OllamaConfig('http://x', 30))
        )
        self.assertEqual(out['backend_used'], 'off')
        self.assertEqual(len(out['ranked']), 2)

    def test_rerank_tei_dispatches(self):
        mock_resp = AsyncMock()
        mock_resp.raise_for_status = lambda: None
        mock_resp.json = lambda: [{'index': 1, 'score': 0.9}, {'index': 0, 'score': 0.1}]

        with patch('router.rerank.httpx.AsyncClient') as client_cls:
            client = AsyncMock()
            client.__aenter__.return_value = client
            client.post = AsyncMock(return_value=mock_resp)
            client_cls.return_value = client
            out = asyncio.run(
                rerank(
                    'q',
                    ['doc0', 'doc1'],
                    'colbert_gte_modern',
                    ollama=OllamaConfig('http://ollama:11434', 30),
                )
            )
        self.assertEqual(out['backend_used'], 'colbert_gte_modern')
        self.assertEqual(out['ranked'][0]['index'], 1)

    def _run_tei_with_url_assertion(self, reranker_id: str, expected_url_substr: str):
        from router.reranker_catalog import get_reranker

        spec = get_reranker(reranker_id)
        self.assertIsNotNone(spec, f'expected catalog entry for {reranker_id}')
        self.assertEqual(spec.backend, 'tei')
        self.assertIn(expected_url_substr, spec.endpoint or '')

        captured = {}
        mock_resp = AsyncMock()
        mock_resp.raise_for_status = lambda: None
        mock_resp.json = lambda: [{'index': 0, 'score': 0.5}]

        async def fake_post(url, *, json):
            captured['url'] = url
            captured['payload'] = json
            return mock_resp

        with patch('router.rerank.httpx.AsyncClient') as client_cls:
            client = AsyncMock()
            client.__aenter__.return_value = client
            client.post = fake_post
            client_cls.return_value = client
            out = asyncio.run(
                rerank('q', ['doc'], reranker_id, ollama=OllamaConfig('http://ollama:11434', 30))
            )
        self.assertEqual(out['backend_used'], reranker_id)
        self.assertIn('/rerank', captured['url'])
        self.assertIn(expected_url_substr, captured['url'])
        # TEI-shape payload: {"query", "texts", "truncate"}
        self.assertIn('query', captured['payload'])
        self.assertIn('texts', captured['payload'])

    def test_rerank_colbert_gte_modern_routes_through_tei(self):
        self._run_tei_with_url_assertion('colbert_gte_modern', 'reranker-colbert:8097')

    def test_rerank_colbert_jina_v2_routes_through_tei(self):
        self._run_tei_with_url_assertion('colbert_jina_v2', 'reranker-colbert:8097')


if __name__ == '__main__':
    unittest.main()
