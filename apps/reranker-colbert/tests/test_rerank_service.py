"""Unit tests for the ColBERT reranker FastAPI service.

These tests run against the StubBackend (no torch/PyLate required) so they're
safe on CPU-only / minimal Python environments. The HTTP layer behavior under
test is identical regardless of the backend used.
"""

from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path

# Make ``server`` importable when running from repo root.
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Force StubBackend so we don't need torch/PyLate.
os.environ['COLBERT_FORCE_STUB'] = '1'

from fastapi.testclient import TestClient  # noqa: E402

from server import backend as backend_mod  # noqa: E402
from server.backend import StubBackend  # noqa: E402
from server.main import app  # noqa: E402


class TestHealth(unittest.TestCase):
    def setUp(self):
        backend_mod.reset_backend_for_tests()

    def test_health_reports_stub_backend(self):
        with TestClient(app) as client:
            res = client.get('/health')
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertTrue(body['ok'])
        self.assertEqual(body['backend'], 'stub')
        self.assertEqual(body['service'], 'reranker-colbert')


class TestRerank(unittest.TestCase):
    def setUp(self):
        backend_mod.reset_backend_for_tests()

    def test_empty_texts_returns_empty_list(self):
        with TestClient(app) as client:
            res = client.post('/rerank', json={'query': 'q', 'texts': []})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json(), [])

    def test_rerank_returns_tei_shape(self):
        payload = {
            'query': 'orange cat',
            'texts': [
                'a fluffy orange cat sat on the mat',
                'completely unrelated text about pencils',
                'orange',
            ],
        }
        with TestClient(app) as client:
            res = client.post('/rerank', json=payload)
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertIsInstance(body, list)
        self.assertEqual(len(body), 3)
        for row in body:
            self.assertIn('index', row)
            self.assertIn('score', row)
            self.assertIsInstance(row['index'], int)
            self.assertIsInstance(row['score'], float)
        # First-ranked should match query best (overlap with "orange" and "cat")
        top_idx = body[0]['index']
        self.assertEqual(top_idx, 0)

    def test_rerank_orders_by_score_desc(self):
        payload = {
            'query': 'apple banana',
            'texts': ['apple banana cherry', 'apple', 'pineapple', 'banana split apple pie'],
        }
        with TestClient(app) as client:
            res = client.post('/rerank', json=payload)
        body = res.json()
        scores = [row['score'] for row in body]
        self.assertEqual(scores, sorted(scores, reverse=True))


class TestStubBackendDirect(unittest.TestCase):
    """Sanity check the StubBackend's behavior directly (no HTTP)."""

    def test_overlap_ranking(self):
        b = StubBackend()
        out = b.rerank('foo bar', ['foo bar baz', 'qux quux', 'foo'])
        self.assertEqual(out[0].index, 0)


if __name__ == '__main__':
    unittest.main()
