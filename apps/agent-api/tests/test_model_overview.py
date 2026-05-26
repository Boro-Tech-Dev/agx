"""Unit tests for GET /api/model/overview."""

import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from app.main import app


class TestModelOverview(unittest.TestCase):
    @patch('app.routes.model_overview.get_agent_lanes')
    @patch('app.routes.model_overview._retrieval_slice')
    @patch('app.routes.model_overview._probe_rerankers', new_callable=AsyncMock)
    @patch('httpx.AsyncClient')
    def test_overview_assembles_slices(
        self,
        mock_client_cls,
        mock_probe_rerankers,
        mock_retrieval,
        mock_lanes,
    ):
        mock_retrieval.return_value = {
            'agents': [{'agent': 'pm', 'embedder_id': 'nomic-embed-text', 'reranker_id': 'colbert_gte_modern'}],
            'embedders': [{'embedder_id': 'nomic-embed-text', 'dim': 768}],
            'missing_embeddings': {'nomic-embed-text': 0},
        }
        mock_lanes.return_value = {
            'lanes': {'tool_capable': {'label': 'Tool-capable'}},
            'agents': [{'agent_key': 'pm', 'lane': 'tool_capable', 'default_model': 'llama3.1:8b'}],
        }
        mock_probe_rerankers.return_value = [
            {'reranker_id': 'colbert_gte_modern', 'endpoint': 'http://reranker-colbert:8097', 'ok': True, 'latency_ms': 12},
        ]

        ollama_payload = {
            'ok': True,
            'models_ready': True,
            'models_runnable': True,
            'required': [],
            'routes': {'pm': 'llama3.1:8b'},
            'embed_model': 'nomic-embed-text',
            'features': {'ollama_pull_enabled': True},
        }
        catalog_payload = {
            'embedders': [{'embedder_id': 'nomic-embed-text', 'dim': 768}],
            'rerankers': [
                {'reranker_id': 'off', 'backend': 'none'},
                {'reranker_id': 'colbert_gte_modern', 'backend': 'tei', 'endpoint': 'http://reranker-colbert:8097'},
            ],
        }
        health_payload = {'ok': True, 'models': {'pm': 'llama3.1:8b'}, 'features': {'mcp_bridge_enabled': False}}

        async def mock_get(url: str):
            res = MagicMock()
            res.raise_for_status = MagicMock()
            if url.endswith('/v1/models'):
                res.json.return_value = ollama_payload
            elif url.endswith('/v1/retrieval/catalog'):
                res.json.return_value = catalog_payload
            elif url.endswith('/health'):
                res.json.return_value = health_payload
            else:
                raise AssertionError(f'unexpected url {url}')
            return res

        mock_client = MagicMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.get = AsyncMock(side_effect=mock_get)
        mock_client_cls.return_value = mock_client

        c = TestClient(app)
        r = c.get('/api/model/overview')
        self.assertEqual(r.status_code, 200, r.text)
        data = r.json()
        self.assertEqual(data['version'], 1)
        self.assertIn('ollama', data)
        self.assertEqual(data['ollama']['routes']['pm'], 'llama3.1:8b')
        self.assertIn('catalog', data)
        self.assertEqual(len(data['catalog']['embedders']), 1)
        self.assertIn('retrieval', data)
        self.assertIn('lanes', data)
        self.assertEqual(len(data['reranker_health']), 1)
        self.assertEqual(data['reranker_health'][0]['reranker_id'], 'colbert_gte_modern')
        self.assertIn('runtime', data)
        mock_probe_rerankers.assert_awaited_once()

    @patch('app.routes.model_overview.get_agent_lanes')
    @patch('app.routes.model_overview._retrieval_slice')
    @patch('app.routes.model_overview._probe_rerankers', new_callable=AsyncMock)
    @patch('httpx.AsyncClient')
    def test_overview_skips_off_reranker_probes(
        self,
        mock_client_cls,
        mock_probe_rerankers,
        mock_retrieval,
        mock_lanes,
    ):
        mock_retrieval.return_value = {'agents': [], 'embedders': [], 'missing_embeddings': {}}
        mock_lanes.return_value = {'lanes': {}, 'agents': []}
        mock_probe_rerankers.return_value = []

        async def mock_get(url: str):
            res = MagicMock()
            res.raise_for_status = MagicMock()
            if url.endswith('/v1/models'):
                res.json.return_value = {'ok': True, 'required': [], 'routes': {}}
            elif url.endswith('/v1/retrieval/catalog'):
                res.json.return_value = {'embedders': [], 'rerankers': [{'reranker_id': 'off', 'backend': 'none'}]}
            elif url.endswith('/health'):
                res.json.return_value = {'ok': True}
            return res

        mock_client = MagicMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.get = AsyncMock(side_effect=mock_get)
        mock_client_cls.return_value = mock_client

        c = TestClient(app)
        r = c.get('/api/model/overview')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()['reranker_health'], [])


if __name__ == '__main__':
    unittest.main()
