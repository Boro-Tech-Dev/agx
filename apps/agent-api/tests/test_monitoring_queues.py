"""cd apps/agent-api && PYTHONPATH=. python3 -m unittest discover -s tests -v"""

import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from app.main import app


class TestMonitoringQueues(unittest.TestCase):
    @patch('app.routes.monitoring.get_ingest_reconcile_last_result')
    @patch('app.routes.monitoring.get_reconcile_last_result')
    @patch('app.routes.monitoring.fetch_one')
    @patch('app.routes.monitoring.fetch')
    @patch('app.routes.monitoring._probe_health_urls', new_callable=AsyncMock)
    @patch('app.routes.monitoring.rconn')
    def test_queue_monitoring_includes_auxiliary_worker_keys(
        self,
        mock_rconn,
        mock_probe,
        mock_fetch,
        mock_fetch_one,
        mock_reconcile,
        mock_ingest_reconcile,
    ):
        redis_mock = MagicMock()
        redis_mock.llen.return_value = 0
        mock_rconn.return_value = redis_mock
        mock_probe.return_value = [{'url': 'http://stub', 'ok': True, 'health': {'ok': True}}]
        mock_fetch.side_effect = [
            [{'status': 'queued', 'n': 0}],
            [],
        ]
        mock_fetch_one.return_value = {
            'prompt_tokens': 0,
            'completion_tokens': 0,
            'total_tokens': 0,
        }
        mock_reconcile.return_value = {}
        mock_ingest_reconcile.return_value = {}

        c = TestClient(app)
        r = c.get('/api/monitoring/queues')
        self.assertEqual(r.status_code, 200, r.text)
        data = r.json()
        self.assertIn('veeva_suite_workers', data)
        self.assertIn('browser_workers', data)
        self.assertIn('model_router_workers', data)
        self.assertIsInstance(data['veeva_suite_workers'], list)
        self.assertIsInstance(data['browser_workers'], list)
        self.assertIsInstance(data['model_router_workers'], list)
        self.assertEqual(len(data['veeva_suite_workers']), 1)
        self.assertEqual(len(data['browser_workers']), 1)
        self.assertEqual(len(data['model_router_workers']), 1)


if __name__ == '__main__':
    unittest.main()
