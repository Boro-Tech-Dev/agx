"""Unit tests for TEI/ColBERT reranker health probes."""

import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from app.routes.model_overview import _probe_reranker


class TestProbeReranker(unittest.IsolatedAsyncioTestCase):
    async def test_empty_tei_health_probes_rerank(self):
        health_res = MagicMock()
        health_res.raise_for_status = MagicMock()
        health_res.text = ''
        health_res.json = MagicMock()

        rerank_res = MagicMock()
        rerank_res.raise_for_status = MagicMock()
        rerank_res.json.return_value = [{'index': 0, 'score': 0.9}, {'index': 1, 'score': 0.1}]

        mock_client = MagicMock()
        mock_client.get = AsyncMock(return_value=health_res)
        mock_client.post = AsyncMock(return_value=rerank_res)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        with patch('app.routes.model_overview.httpx.AsyncClient', return_value=mock_client):
            out = await _probe_reranker('colbert_gte_modern', 'http://reranker-colbert:8097')

        self.assertTrue(out['ok'])
        self.assertEqual(out['health'], {'tei': True})
        self.assertNotIn('error', out)
        mock_client.post.assert_awaited_once()

    async def test_json_health_skips_rerank_probe(self):
        health_res = MagicMock()
        health_res.raise_for_status = MagicMock()
        health_res.text = '{"ok":true,"service":"reranker-colbert"}'
        health_res.json.return_value = {'ok': True, 'service': 'reranker-colbert', 'backend': 'colbert'}

        mock_client = MagicMock()
        mock_client.get = AsyncMock(return_value=health_res)
        mock_client.post = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        with patch('app.routes.model_overview.httpx.AsyncClient', return_value=mock_client):
            out = await _probe_reranker('colbert_gte_modern', 'http://reranker-colbert:8097')

        self.assertTrue(out['ok'])
        self.assertEqual(out['health']['backend'], 'colbert')
        mock_client.post.assert_not_awaited()

    async def test_health_http_error_marks_failed(self):
        health_res = MagicMock()
        health_res.raise_for_status = MagicMock(side_effect=Exception('503 Service Unavailable'))

        mock_client = MagicMock()
        mock_client.get = AsyncMock(return_value=health_res)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        with patch('app.routes.model_overview.httpx.AsyncClient', return_value=mock_client):
            out = await _probe_reranker('colbert_jina_v2', 'http://reranker-colbert:8097')

        self.assertFalse(out['ok'])
        self.assertIn('503', out['error'])

    async def test_empty_health_rerank_failure_marks_failed(self):
        health_res = MagicMock()
        health_res.raise_for_status = MagicMock()
        health_res.text = ''

        rerank_res = MagicMock()
        rerank_res.raise_for_status = MagicMock(side_effect=Exception('connection refused'))

        mock_client = MagicMock()
        mock_client.get = AsyncMock(return_value=health_res)
        mock_client.post = AsyncMock(return_value=rerank_res)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        with patch('app.routes.model_overview.httpx.AsyncClient', return_value=mock_client):
            out = await _probe_reranker('colbert_gte_modern', 'http://reranker-colbert:8097')

        self.assertFalse(out['ok'])
        self.assertIn('connection refused', out['error'])


if __name__ == '__main__':
    unittest.main()
